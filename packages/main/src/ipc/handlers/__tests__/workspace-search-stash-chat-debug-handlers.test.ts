/**
 * IPC handler tests — git stash, advanced search, workspace, chat export and
 * debug channels.
 *
 * These five domains had no registered handler at all: the services and the UI
 * existed, nothing connected them. So the assertions here are deliberately about
 * the *wire contract* rather than the services' internals:
 *
 *   1. the channel is actually registered on `ipcMain`;
 *   2. the response is shaped the way the consuming component reads it
 *      (`response.data.<field>`, or a raw value for the `debug:*` family);
 *   3. the service is called with the arguments its signature expects, since the
 *      renderer sends a flat payload the services do not accept as-is.
 *
 * Point 2 is the one that matters: a handler that returns the wrong shape is no
 * better than a missing handler, it just fails further away from the cause.
 *
 * Written for vitest. `electron` is mocked by the global setup file
 * (`test/vitest-setup-main.ts`), so `ipcMain.handle` records into
 * `registeredHandlers` and handlers can be invoked exactly as the main process
 * would receive them.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  registeredHandlers,
  resetElectronMock,
  dialogMock,
  appMock,
} from '../../../../../../test/electron-mock';

// ---------------------------------------------------------------------------
// Electron mock
//
// `BrowserWindow.fromWebContents` (returns null) and `app.getAppPath` (returns
// '/app/cortex-ide') are provided by the shared mock in `test/electron-mock.ts`,
// which the `main` project loads as a setup file. This suite previously patched
// both in locally with `??=` because the mock was maintained in two runner-
// specific copies; they are real spies on the single mock now.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Service mocks
//
// Registered before the handler modules are imported so they link against the
// mocks. Each mock mirrors the real service's signature — the point of these
// tests is to catch a handler calling a service the wrong way.
// ---------------------------------------------------------------------------

const stashServiceMock = {
  list: vi.fn(async () => [
    { index: 0, message: 'WIP on main: abc123 wip', hash: 'h0', branch: 'main', timestamp: 1000 },
    { index: 1, message: 'WIP on dev: def456 wip', hash: 'h1', branch: 'dev', timestamp: 2000 },
  ]),
  show: vi.fn(async () => ({
    files: [{ path: 'src/a.ts', status: 'modified' as const, additions: 3, deletions: 1 }],
    totalAdditions: 3,
    totalDeletions: 1,
  })),
  save: vi.fn(async () => undefined),
  apply: vi.fn(async () => undefined),
  pop: vi.fn(async () => undefined),
  drop: vi.fn(async () => undefined),
  branch: vi.fn(async () => undefined),
  clearCache: vi.fn(() => undefined),
};

const searchServiceMock = {
  search: vi.fn(async () => [
    {
      filePath: '/w/src/a.ts',
      matches: [{ line: 3, column: 8, length: 4 , text: 'const todo = 1' }],
      totalMatches: 1,
    },
  ]),
  replace: vi.fn(async () => [{ filePath: '/w/src/a.ts', replacements: 2, preview: 'Line 3:' }]),
  getSearchHistory: vi.fn(() => ['todo', 'fixme']),
};

class WorkspaceManagerMock {
  initialize = vi.fn(async () => undefined);
  listWorkspaces = vi.fn(() => [
    { id: 'ws_1', name: 'alpha', path: '/w/alpha', createdAt: 1, updatedAt: 1, settings: {} },
    { id: 'ws_2', name: 'beta', path: '/w/beta', createdAt: 2, updatedAt: 2, settings: {} },
  ]);
  getActiveWorkspace = vi.fn(() => ({
    id: 'ws_2',
    name: 'beta',
    path: '/w/beta',
    createdAt: 2,
    updatedAt: 2,
    settings: {},
  }));
  switchWorkspace = vi.fn(async () => undefined);
  addWorkspace = vi.fn(async (path: string, name?: string) => ({
    id: 'ws_3',
    name: name ?? 'gamma',
    path,
    createdAt: 3,
    updatedAt: 3,
    settings: {},
  }));
  removeWorkspace = vi.fn(async () => undefined);
  // Parameters are declared so `on.mock.calls` is a typed tuple rather than `[]`,
  // which lets the assertions below destructure the recorded listener.
  on = vi.fn((_event: string, _listener: (...args: never[]) => void) => this);
  off = vi.fn((_event: string, _listener: (...args: never[]) => void) => this);
}

let workspaceManagerMock = new WorkspaceManagerMock();

const chatExportServiceMock = {
  exportSession: vi.fn(async () => ({
    content: '# Chat\n\nhello',
    filename: 'chat-my-session-2024-01-01.md',
    size: 15,
  })),
};

/**
 * Rows in the *database* shape: snake_case, and nullable where the schema allows
 * it. The nullability is the point — the handler has to substitute displayable
 * values before the export service touches them.
 */
interface DBSessionRow {
  id: string;
  workspace_id: string | null;
  title: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
  metadata?: Record<string, unknown>;
}

const dbManagerMock = {
  getSession: vi.fn((id: string): DBSessionRow | null =>
    id === 'missing'
      ? null
      : {
          id,
          workspace_id: 'ws_1',
          title: 'My Session',
          model: 'claude-3',
          created_at: 1_700_000_000_000,
          updated_at: 1_700_000_000_000,
          metadata: undefined,
        }
  ),
  listMessages: vi.fn(() => [
    {
      id: 'm1',
      session_id: 's1',
      role: 'user' as const,
      content: 'hello',
      created_at: 1_700_000_000_000,
      metadata: undefined,
    },
  ]),
};

vi.mock('../../../services/git-stash-service', () => ({
  getGitStashService: () => stashServiceMock,
  GitStashService: class {},
}));

vi.mock('../../../services/advanced-search-service', () => ({
  getAdvancedSearchService: () => searchServiceMock,
  AdvancedSearchService: class {},
}));

vi.mock('../../../services/workspace-manager', () => ({
  getWorkspaceManager: () => workspaceManagerMock,
  WorkspaceManager: WorkspaceManagerMock,
}));

vi.mock('../../../services/chat-export-service', () => ({
  getChatExportService: () => chatExportServiceMock,
  ChatExportService: class {},
}));

vi.mock('../../../services/database-service', () => ({
  getDatabaseService: () => ({ getManager: async () => dbManagerMock }),
}));

/**
 * The updater is stubbed because `src/updater.ts` touches `electron-updater` at
 * module scope, and `electron-updater` reads `app.getVersion()` while linking.
 * The registry test below imports `handlers/index.ts`, which pulls in
 * `update-handlers` -> `updater`; without this stub that import throws before
 * any assertion runs. Nothing here tests the updater itself.
 */
vi.mock('../../../updater', () => ({
  updateManager: {
    initialize: vi.fn(),
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
    destroy: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Handlers under test (imported after the mocks above)
// ---------------------------------------------------------------------------

const {
  GIT_STASH_CHANNELS,
  registerGitStashHandlers,
  unregisterGitStashHandlers,
} = await import('../git-stash-handlers');

const { SEARCH_CHANNELS, registerSearchHandlers, unregisterSearchHandlers } = await import(
  '../search-handlers'
);

const {
  WORKSPACE_CHANNELS,
  WORKSPACE_SWITCHED_EVENT,
  registerWorkspaceHandlers,
  unregisterWorkspaceHandlers,
} = await import('../workspace-handlers');

const { CHAT_CHANNELS, registerChatHandlers, unregisterChatHandlers } = await import(
  '../chat-handlers'
);

const {
  DEBUG_CHANNELS,
  registerDebugHandlers,
  unregisterDebugHandlers,
  resetDebugSettings,
} = await import('../debug-handlers');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal stand-in for `IpcMainInvokeEvent`. */
const fakeEvent = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;

/**
 * Invokes a channel the way `ipcMain` would, i.e. through the registry rather
 * than by calling the exported handler directly. A handler registered on the
 * wrong channel name therefore fails here instead of passing silently.
 */
async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = registeredHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for "${channel}"`);
  }
  return handler(fakeEvent, ...(args as [unknown]));
}

/** Asserts a successful `{ success, data }` envelope and returns `data`. */
function expectOk<T = Record<string, unknown>>(response: unknown): T {
  expect(response).toMatchObject({ success: true });
  const envelope = response as { success: true; data: T };
  expect(envelope.data).toBeDefined();
  return envelope.data;
}

function expectFailure(response: unknown): { code: string; message: string } {
  expect(response).toMatchObject({ success: false });
  const envelope = response as { success: false; error: { code: string; message: string } };
  expect(envelope.error).toBeDefined();
  return envelope.error;
}

beforeEach(async () => {
  resetElectronMock();
  vi.clearAllMocks();
  workspaceManagerMock = new WorkspaceManagerMock();

  // The initialised manager is memoised in `services/active-workspace`, shared by
  // the workspace handlers and the session service so two callers cannot race to
  // fix the singleton's dataDir. That memo outlives a test, so without this the
  // fresh mock above would be ignored in favour of the previous test's instance.
  //
  // Imported here rather than at the top of the file, and that is not a style
  // choice: `vi.mock` factories are hoisted, so a static import would evaluate the
  // `workspace-manager` mock before `WorkspaceManagerMock` is initialised and the
  // whole module would fail to load on a TDZ error.
  const { resetActiveWorkspace } = await import('../../../services/active-workspace');
  resetActiveWorkspace();

  resetDebugSettings();
});

afterEach(() => {
  unregisterGitStashHandlers();
  unregisterSearchHandlers();
  unregisterWorkspaceHandlers();
  unregisterChatHandlers();
  unregisterDebugHandlers();
});

// ===========================================================================
// Git stash
// ===========================================================================

describe('git stash handlers', () => {
  beforeEach(() => registerGitStashHandlers());

  it('registers every git:stash-* channel', () => {
    for (const channel of GIT_STASH_CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(true);
    }
  });

  it('git:stash-list returns { stashes } — the field GitStashPanel reads', async () => {
    const data = await invoke('git:stash-list', { repoPath: '/repo' });
    const { stashes } = expectOk<{ stashes: unknown[] }>(data);

    expect(Array.isArray(stashes)).toBe(true);
    expect(stashes).toHaveLength(2);
    // The panel keys rows on `index` and renders these four fields.
    expect(stashes[0]).toMatchObject({
      index: 0,
      message: expect.any(String),
      branch: 'main',
      timestamp: expect.any(Number),
    });
    expect(stashServiceMock.list).toHaveBeenCalledWith('/repo');
  });

  it('git:stash-show returns { diff } with the totals the panel renders', async () => {
    const { diff } = expectOk<{ diff: { files: unknown[]; totalAdditions: number; totalDeletions: number } }>(
      await invoke('git:stash-show', { repoPath: '/repo', stashIndex: 1 })
    );

    expect(diff.files).toHaveLength(1);
    expect(diff.totalAdditions).toBe(3);
    expect(diff.totalDeletions).toBe(1);
    expect(stashServiceMock.show).toHaveBeenCalledWith('/repo', 1);
  });

  it('git:stash-save regroups the flat payload into the service option object', async () => {
    expectOk(
      await invoke('git:stash-save', {
        repoPath: '/repo',
        message: 'wip',
        includeUntracked: true,
        keepIndex: true,
      })
    );

    // The renderer sends the options flat; the service takes (repoPath, message,
    // { includeUntracked, keepIndex }).
    expect(stashServiceMock.save).toHaveBeenCalledWith('/repo', 'wip', {
      includeUntracked: true,
      keepIndex: true,
    });
  });

  it('git:stash-save omits an empty message rather than stashing an empty string', async () => {
    expectOk(await invoke('git:stash-save', { repoPath: '/repo' }));

    expect(stashServiceMock.save).toHaveBeenCalledWith('/repo', undefined, {
      includeUntracked: false,
      keepIndex: false,
    });
  });

  it.each([
    ['git:stash-apply', 'apply'],
    ['git:stash-pop', 'pop'],
    ['git:stash-drop', 'drop'],
  ] as const)('%s forwards the index and returns a dereferenceable data', async (channel, method) => {
    const data = expectOk(await invoke(channel, { repoPath: '/repo', stashIndex: 2 }));

    // The panel only branches on `response.success`, but `data` must still be an
    // object: `response.data.x` on `undefined` would throw.
    expect(data).toEqual({});
    expect(stashServiceMock[method]).toHaveBeenCalledWith('/repo', 2);
  });

  it('git:stash-branch forwards branch name and index in the service order', async () => {
    expectOk(
      await invoke('git:stash-branch', {
        repoPath: '/repo',
        branchName: 'feature/x',
        stashIndex: 1,
      })
    );

    expect(stashServiceMock.branch).toHaveBeenCalledWith('/repo', 'feature/x', 1);
  });

  it('rejects a missing repoPath as a validation error instead of calling git', async () => {
    const error = expectFailure(await invoke('git:stash-list', {}));

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(stashServiceMock.list).not.toHaveBeenCalled();
  });

  it('rejects a negative stash index', async () => {
    const error = expectFailure(await invoke('git:stash-drop', { repoPath: '/repo', stashIndex: -1 }));

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(stashServiceMock.drop).not.toHaveBeenCalled();
  });

  it('turns a service failure into a failed envelope, never a thrown exception', async () => {
    stashServiceMock.list.mockRejectedValueOnce(new Error('git stash list failed'));

    const error = expectFailure(await invoke('git:stash-list', { repoPath: '/repo' }));

    expect(error.code).toBe('GIT_ERROR');
    expect(error.message).toContain('git stash list failed');
  });

  it('unregister removes the channels and releases the git instance cache', () => {
    unregisterGitStashHandlers();

    for (const channel of GIT_STASH_CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(false);
    }
    expect(stashServiceMock.clearCache).toHaveBeenCalled();
  });
});

// ===========================================================================
// Advanced search
// ===========================================================================

describe('advanced search handlers', () => {
  beforeEach(() => registerSearchHandlers());

  it('registers every search:* channel', () => {
    for (const channel of SEARCH_CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(true);
    }
  });

  it('search:find returns { results } and splits rootPath from the options', async () => {
    const { results } = expectOk<{ results: Array<{ matches: unknown[] }> }>(
      await invoke('search:find', {
        rootPath: '/w',
        query: 'todo',
        useRegex: false,
        caseSensitive: true,
        maxResults: 100,
        contextLines: 2,
      })
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ filePath: '/w/src/a.ts', totalMatches: 1 });

    // rootPath is positional; everything else is the options object.
    const [rootPath, options] = searchServiceMock.search.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(rootPath).toBe('/w');
    expect(options).toMatchObject({ query: 'todo', caseSensitive: true, maxResults: 100 });
    expect(options).not.toHaveProperty('rootPath');
  });

  it('search:replace defaults to a dry run when the flag is omitted', async () => {
    expectOk(await invoke('search:replace', { rootPath: '/w', query: 'a', replacement: 'b' }));

    const [, options] = searchServiceMock.replace.mock.calls[0] as unknown as [string, { dryRun: boolean }];
    // A global replace writes to disk and cannot be undone; omitting the flag
    // must not perform it.
    expect(options.dryRun).toBe(true);
  });

  it('search:replace performs the write when dryRun is explicitly false', async () => {
    const { results } = expectOk<{ results: Array<{ replacements: number }> }>(
      await invoke('search:replace', {
        rootPath: '/w',
        query: 'a',
        replacement: 'b',
        dryRun: false,
      })
    );

    expect(results[0].replacements).toBe(2);
    const [, options] = searchServiceMock.replace.mock.calls[0] as unknown as [string, { dryRun: boolean }];
    expect(options.dryRun).toBe(false);
  });

  it('search:get-history works when invoked with no payload at all', async () => {
    // AdvancedSearchPanel calls `invoke('search:get-history')`, so the payload
    // arrives as `undefined`. A plain z.object() schema would reject it.
    const { history } = expectOk<{ history: string[] }>(await invoke('search:get-history'));

    expect(history).toEqual(['todo', 'fixme']);
  });

  it('rejects an empty query', async () => {
    const error = expectFailure(await invoke('search:find', { rootPath: '/w', query: '' }));

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(searchServiceMock.search).not.toHaveBeenCalled();
  });

  it('reports an invalid regex as a failed envelope', async () => {
    searchServiceMock.search.mockRejectedValueOnce(
      new Error('Invalid regex pattern: Unterminated group')
    );

    const error = expectFailure(await invoke('search:find', { rootPath: '/w', query: '(' }));

    expect(error.message).toContain('Invalid regex');
  });
});

// ===========================================================================
// Workspaces
// ===========================================================================

describe('workspace handlers', () => {
  beforeEach(() => registerWorkspaceHandlers());

  it('registers every workspace:* channel', () => {
    for (const channel of WORKSPACE_CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(true);
    }
  });

  it('workspace:list returns { workspaces, activeId } with activeId as an id', async () => {
    const data = expectOk<{ workspaces: Array<{ id: string }>; activeId: string | null }>(
      await invoke('workspace:list')
    );

    expect(data.workspaces).toHaveLength(2);
    // WorkspaceSwitcher resolves the entity from the list using this id, so it
    // must be the bare string, not the object.
    expect(data.activeId).toBe('ws_2');
    expect(typeof data.activeId).toBe('string');
  });

  it('workspace:list initializes the manager, otherwise the list is always empty', async () => {
    await invoke('workspace:list');

    // WorkspaceManager.initialize() is what reads workspaces.json.
    expect(workspaceManagerMock.initialize).toHaveBeenCalled();
  });

  it('initializes the manager once across concurrent invokes', async () => {
    await Promise.all([invoke('workspace:list'), invoke('workspace:list'), invoke('workspace:list')]);

    expect(workspaceManagerMock.initialize).toHaveBeenCalledTimes(1);
  });

  it('workspace:switch forwards the id and returns an object data', async () => {
    const data = expectOk(await invoke('workspace:switch', { workspaceId: 'ws_1' }));

    expect(data).toEqual({});
    expect(workspaceManagerMock.switchWorkspace).toHaveBeenCalledWith('ws_1');
  });

  it('workspace:add returns { workspace } — the shape the switcher reloads from', async () => {
    const { workspace } = expectOk<{ workspace: { id: string; path: string } }>(
      await invoke('workspace:add', { path: '/w/gamma' })
    );

    expect(workspace).toMatchObject({ id: 'ws_3', path: '/w/gamma' });
    expect(workspaceManagerMock.addWorkspace).toHaveBeenCalledWith('/w/gamma', undefined);
  });

  it('workspace:remove forwards the id', async () => {
    expectOk(await invoke('workspace:remove', { workspaceId: 'ws_1' }));

    expect(workspaceManagerMock.removeWorkspace).toHaveBeenCalledWith('ws_1');
  });

  it('workspace:open-dialog returns the chosen path', async () => {
    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/w/chosen'],
    });

    const { path } = expectOk<{ path?: string }>(await invoke('workspace:open-dialog'));

    expect(path).toBe('/w/chosen');
  });

  it('workspace:open-dialog omits path when the user cancels', async () => {
    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });

    const data = expectOk<{ path?: string }>(await invoke('workspace:open-dialog'));

    // WorkspaceSwitcher guards on `response.data.path` before calling
    // workspace:add, so cancelling must not surface a path.
    expect(data.path).toBeUndefined();
    expect(data).toEqual({});
  });

  it('subscribes to workspace-switched so the renderer can be notified', async () => {
    await invoke('workspace:list');

    expect(workspaceManagerMock.on).toHaveBeenCalledWith(
      'workspace-switched',
      expect.any(Function)
    );
  });

  it('forwards workspace-switched to the channel the preload allows', async () => {
    await invoke('workspace:list');

    const [, listener] = workspaceManagerMock.on.mock.calls.find(
      ([event]) => event === 'workspace-switched'
    ) as unknown as [string, (id: string) => void];

    // The event name must match the preload allowlist entry, otherwise the
    // subscription in WorkspaceSwitcher never fires.
    expect(WORKSPACE_SWITCHED_EVENT).toBe('event:workspace-switched');
    expect(() => listener('ws_1')).not.toThrow();
  });

  it('rejects a missing workspaceId', async () => {
    const error = expectFailure(await invoke('workspace:switch', {}));

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(workspaceManagerMock.switchWorkspace).not.toHaveBeenCalled();
  });

  it('reports an unknown workspace as a failed envelope', async () => {
    workspaceManagerMock.switchWorkspace.mockRejectedValueOnce(
      new Error('Workspace ws_9 not found')
    );

    const error = expectFailure(await invoke('workspace:switch', { workspaceId: 'ws_9' }));

    expect(error.code).toBe('FILE_NOT_FOUND');
    expect(error.message).toContain('not found');
  });

  it('retries initialization after a failure instead of caching it', async () => {
    workspaceManagerMock.initialize.mockRejectedValueOnce(new Error('EACCES'));

    expectFailure(await invoke('workspace:list'));

    // Second attempt must re-run initialize() rather than reuse the rejection.
    const data = expectOk<{ workspaces: unknown[] }>(await invoke('workspace:list'));
    expect(data.workspaces).toHaveLength(2);
    expect(workspaceManagerMock.initialize).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// Chat export
// ===========================================================================

describe('chat export handler', () => {
  beforeEach(() => registerChatHandlers());

  it('registers chat:export', () => {
    for (const channel of CHAT_CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(true);
    }
  });

  it('returns { content, filename, size } — what ChatExportButton downloads', async () => {
    const data = expectOk<{ content: string; filename: string; size: number }>(
      await invoke('chat:export', { sessionId: 's1', format: 'markdown' })
    );

    // The component builds a Blob from `content` and uses `filename` as the
    // download name, so both must be present and non-empty.
    expect(typeof data.content).toBe('string');
    expect(data.content.length).toBeGreaterThan(0);
    expect(data.filename).toBe('chat-my-session-2024-01-01.md');
    expect(typeof data.size).toBe('number');
  });

  it('converts the snake_case DB row to the camelCase shape the service needs', async () => {
    await invoke('chat:export', { sessionId: 's1', format: 'markdown' });

    const [session, messages] = chatExportServiceMock.exportSession.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Array<Record<string, unknown>>,
    ];

    // ChatExportService reads session.title / session.createdAt. Handing it the
    // raw row would make generateFilename() throw on `title` and
    // `new Date(undefined).toISOString()` throw RangeError.
    expect(session).toMatchObject({
      workspaceId: 'ws_1',
      title: 'My Session',
      model: 'claude-3',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });
    expect(session).not.toHaveProperty('created_at');
    expect(session).not.toHaveProperty('workspace_id');

    expect(messages[0]).toMatchObject({ sessionId: 's1', createdAt: 1_700_000_000_000 });
    expect(messages[0]).not.toHaveProperty('created_at');
  });

  it('substitutes a displayable title when the row has none', async () => {
    dbManagerMock.getSession.mockReturnValueOnce({
      id: 's2',
      workspace_id: null,
      title: null,
      model: null,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      metadata: undefined,
    });

    await invoke('chat:export', { sessionId: 's2', format: 'markdown' });

    const [session] = chatExportServiceMock.exportSession.mock.calls[0] as unknown as [
      { title: string; model: string; workspaceId: string },
    ];

    // Propagating null would make `session.title.toLowerCase()` throw.
    expect(session.title).toBe('Untitled conversation');
    expect(session.model).toBe('unknown');
    expect(session.workspaceId).toBe('');
  });

  it('forwards the export options', async () => {
    await invoke('chat:export', {
      sessionId: 's1',
      format: 'html',
      includeMetadata: false,
      includeTimestamps: false,
      prettify: false,
    });

    const [, , options] = chatExportServiceMock.exportSession.mock.calls[0] as unknown as [
      unknown,
      unknown,
      Record<string, unknown>,
    ];
    expect(options).toMatchObject({
      format: 'html',
      includeMetadata: false,
      includeTimestamps: false,
      prettify: false,
    });
  });

  it('reports an unknown session without calling the exporter', async () => {
    const error = expectFailure(await invoke('chat:export', { sessionId: 'missing', format: 'json' }));

    expect(error.code).toBe('FILE_NOT_FOUND');
    expect(chatExportServiceMock.exportSession).not.toHaveBeenCalled();
  });

  it('rejects an unsupported format', async () => {
    const error = expectFailure(await invoke('chat:export', { sessionId: 's1', format: 'pdf' }));

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(chatExportServiceMock.exportSession).not.toHaveBeenCalled();
  });

  it.each(['markdown', 'json', 'html', 'text'] as const)('accepts the %s format', async (format) => {
    expectOk(await invoke('chat:export', { sessionId: 's1', format }));
  });
});

// ===========================================================================
// Debug panel
// ===========================================================================

describe('debug handlers', () => {
  beforeEach(() => registerDebugHandlers());

  it('registers every debug:* channel the renderer calls', () => {
    for (const channel of DEBUG_CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(true);
    }
  });

  it('debug:get-settings returns the value RAW, not a { success, data } envelope', async () => {
    const result = (await invoke('debug:get-settings')) as Record<string, unknown>;

    // DebugContext does `setSettings(result)` and reads `settings.enabled`
    // directly. An envelope here would leave debug mode stuck off.
    expect(result).not.toHaveProperty('success');
    expect(result).not.toHaveProperty('data');
    expect(result).toHaveProperty('enabled');
  });

  it('debug:get-settings returns the shape the renderer imports, not the service one', async () => {
    const settings = (await invoke('debug:get-settings')) as {
      enabled: boolean;
      logLevel: string;
      categories: Record<string, boolean>;
      maxLogSize: number;
      logRotation: boolean;
    };

    // SettingsPanel does Object.entries(settings.categories) — a missing
    // `categories` is a TypeError that blanks the panel.
    expect(typeof settings.enabled).toBe('boolean');
    expect(typeof settings.logRotation).toBe('boolean');
    expect(settings.categories).toBeDefined();
    expect(Object.keys(settings.categories).sort()).toEqual([
      'ai',
      'database',
      'git',
      'ipc',
      'network',
      'performance',
    ]);
    // The main service's DebugSettings fields must not leak through.
    expect(settings).not.toHaveProperty('enableIpcMonitoring');
    expect(settings).not.toHaveProperty('enablePerformanceMonitoring');
  });

  it('persists enabled / categories / logRotation across a get→update→get cycle', async () => {
    await invoke('debug:update-settings', { enabled: true, logRotation: false });

    const settings = (await invoke('debug:get-settings')) as {
      enabled: boolean;
      logRotation: boolean;
    };

    // These three fields do not exist on the main service, so without local
    // state they would be silently dropped on every save.
    expect(settings.enabled).toBe(true);
    expect(settings.logRotation).toBe(false);
  });

  it('merges a partial categories update instead of replacing the object', async () => {
    await invoke('debug:update-settings', { categories: { ipc: false } });

    const settings = (await invoke('debug:get-settings')) as {
      categories: Record<string, boolean>;
    };

    expect(settings.categories.ipc).toBe(false);
    // The untouched categories must survive.
    expect(settings.categories.git).toBe(true);
    expect(settings.categories.ai).toBe(true);
  });

  it('accepts the { enabled } only payload DebugContext.toggleDebugMode sends', async () => {
    const result = (await invoke('debug:update-settings', { enabled: true })) as {
      enabled: boolean;
      categories: Record<string, boolean>;
    };

    expect(result.enabled).toBe(true);
    expect(result.categories).toBeDefined();
  });

  it('rejects an invalid logLevel', async () => {
    await expect(invoke('debug:update-settings', { logLevel: 'verbose' })).rejects.toThrow();
  });

  it('debug:get-logs returns a bare array', async () => {
    const result = await invoke('debug:get-logs', 1000);

    // ConsolePanel does `result.map(...)`; an envelope gives
    // "result.map is not a function".
    expect(Array.isArray(result)).toBe(true);
  });

  it('debug:get-logs tolerates being called with no limit', async () => {
    expect(Array.isArray(await invoke('debug:get-logs'))).toBe(true);
  });

  it('debug:get-metrics reads (category, limit) — the arg order the panel sends', async () => {
    // PerformancePanel calls invoke('debug:get-metrics', undefined, 500): the
    // limit is the SECOND argument, not the first.
    const result = await invoke('debug:get-metrics', undefined, 500);

    expect(Array.isArray(result)).toBe(true);
  });

  it('debug:get-metrics returns metrics carrying the fields the chart reads', async () => {
    const { performanceMonitor } = await import('../../../services/performance-monitor');
    performanceMonitor.recordMetric('timing', 'ipc-roundtrip', 12.5, 'ms');

    const result = (await invoke('debug:get-metrics', undefined, 500)) as Array<
      Record<string, unknown>
    >;

    const metric = result.find((m) => m.name === 'ipc-roundtrip');
    expect(metric).toBeDefined();
    // The chart groups by category/name and plots `value`; `id` is required by
    // the shared type.
    expect(metric).toMatchObject({
      category: 'timing',
      name: 'ipc-roundtrip',
      value: 12.5,
      unit: 'ms',
    });
    expect(typeof metric?.id).toBe('string');
    expect(typeof metric?.timestamp).toBe('number');

    performanceMonitor.clear();
  });

  it('debug:get-metrics filters by category when one is given', async () => {
    const { performanceMonitor } = await import('../../../services/performance-monitor');
    performanceMonitor.recordMetric('timing', 'a', 1);
    performanceMonitor.recordMetric('memory', 'b', 2);

    const result = (await invoke('debug:get-metrics', 'timing', 500)) as Array<{ category: string }>;

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((m) => m.category === 'timing')).toBe(true);

    performanceMonitor.clear();
  });

  it('debug:get-memory returns a bare array of snapshots', async () => {
    const { performanceMonitor } = await import('../../../services/performance-monitor');
    performanceMonitor.takeMemorySnapshot();

    const result = (await invoke('debug:get-memory', 100)) as Array<Record<string, number>>;

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // MemoryPanel divides each of these by 1024*1024.
    expect(result[0]).toMatchObject({
      heapUsed: expect.any(Number),
      heapTotal: expect.any(Number),
      external: expect.any(Number),
      rss: expect.any(Number),
    });

    performanceMonitor.clear();
  });

  it('debug:get-ipc-messages maps direction to the values the panel filters on', async () => {
    const { ipcMonitor } = await import('../../../services/ipc-monitor');
    ipcMonitor.clear();
    ipcMonitor.recordMessage('fs:read-file', 'send', 4);
    ipcMonitor.recordMessage('event:file-change', 'receive');

    const result = (await invoke('debug:get-ipc-messages', 500)) as Array<{
      id: string;
      direction: string;
      channel: string;
    }>;

    expect(result).toHaveLength(2);
    // The monitor stores 'send' | 'receive'; the panel filters and colours on
    // 'renderer->main' | 'main->renderer'.
    expect(result[0].direction).toBe('renderer->main');
    expect(result[1].direction).toBe('main->renderer');
    // `id` is the React key and the expand toggle; the monitor has no such field.
    expect(typeof result[0].id).toBe('string');
    expect(result[0].id).not.toBe(result[1].id);

    ipcMonitor.clear();
  });

  it('debug:get-ipc-stats never reports NaN for avgDuration', async () => {
    const { ipcMonitor } = await import('../../../services/ipc-monitor');
    ipcMonitor.clear();
    // No duration recorded: totalDuration/count could produce NaN, which the
    // panel would render as "NaNms" via toFixed().
    ipcMonitor.recordMessage('git:status', 'send');

    const stats = (await invoke('debug:get-ipc-stats')) as Record<
      string,
      { count: number; avgDuration: number }
    >;

    expect(stats['git:status'].count).toBe(1);
    expect(Number.isFinite(stats['git:status'].avgDuration)).toBe(true);

    ipcMonitor.clear();
  });

  it('debug:clear-ipc empties the monitor', async () => {
    const { ipcMonitor } = await import('../../../services/ipc-monitor');
    ipcMonitor.recordMessage('git:status', 'send', 1);

    await invoke('debug:clear-ipc');

    expect(ipcMonitor.getMessages()).toHaveLength(0);
  });

  it('debug:clear-logs empties the logger', async () => {
    const { logger } = await import('@cortex-ide/shared');
    logger.info('test', 'a log line');
    expect(logger.getLogs().length).toBeGreaterThan(0);

    await invoke('debug:clear-logs');

    expect(logger.getLogs()).toHaveLength(0);
  });

  it('debug:clear-metrics empties the recorded metrics', async () => {
    const { performanceMonitor } = await import('../../../services/performance-monitor');
    performanceMonitor.recordMetric('timing', 'x', 1);

    await invoke('debug:clear-metrics');

    expect(performanceMonitor.getMetrics()).toHaveLength(0);
  });

  it('debug:get-system-info includes every field SettingsPanel renders', async () => {
    const info = (await invoke('debug:get-system-info')) as Record<string, string>;

    for (const field of [
      'version',
      'platform',
      'arch',
      'electron',
      'chrome',
      'node',
      'v8',
      'appPath',
      'userData',
      // Rendered as "Logs Directory" even though the panel's local SystemInfo
      // interface omits it.
      'logs',
    ]) {
      expect(info[field]).toBeDefined();
      expect(typeof info[field]).toBe('string');
    }
  });

  it('debug:export-logs returns { success, path } as DebugPanel expects', async () => {
    appMock.getPath.mockReturnValue('/tmp');

    const result = (await invoke('debug:export-logs')) as { success: boolean; path?: string };

    // DebugPanel reads result.success then logs result.path.
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      expect(typeof result.path).toBe('string');
    }
  });

  it('unregister removes every debug channel', () => {
    unregisterDebugHandlers();

    for (const channel of DEBUG_CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(false);
    }
  });
});

// ===========================================================================
// Registry
// ===========================================================================

describe('handler registry', () => {
  it('registers all five new domains through registerIPCHandlers', async () => {
    // Importing the handler index must not load `node-pty`. The native addon
    // is resolved on first PTY spawn, so a missing Electron ABI cannot
    // prevent this module graph (or the window) from loading.
    const { HANDLER_DOMAINS } = await import('../index');

    const names = HANDLER_DOMAINS.map((domain) => domain.name);
    for (const domain of ['git-stash', 'search', 'workspace', 'chat', 'debug']) {
      expect(names).toContain(domain);
    }
  });

  it('each new domain cleans up only its own channels', () => {
    registerGitStashHandlers();
    registerSearchHandlers();

    unregisterGitStashHandlers();

    // Domain-scoped cleanup: removing git stash must leave search registered.
    expect(registeredHandlers.has('git:stash-list')).toBe(false);
    expect(registeredHandlers.has('search:find')).toBe(true);
  });
});
