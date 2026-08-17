/**
 * Round-trip tests: real component -> real main-process handler -> rendered DOM.
 *
 * These five features shipped with a working backend and a working UI that were
 * never connected. Asserting that a handler returns `{ success, data }` proves
 * the handler runs; it does not prove the component can read what came back.
 * That gap is exactly what produced the bug this mission exists to fix (the MCP
 * views read `response.server` while the handler returned
 * `response.data.server`, and silently rendered `undefined`).
 *
 * So each test here:
 *   1. mounts the REAL renderer component,
 *   2. points `window.ipc` at the REAL handler registered by the REAL
 *      main-process module (only the leaf services are mocked),
 *   3. asserts on the rendered DOM — the value the user would actually see.
 *
 * A field-name mismatch between handler and component therefore fails here, in
 * the render, rather than passing two green unit suites on either side of a
 * broken seam.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// electron mock
//
// The handler modules import `electron` directly. The renderer package has no
// global electron mock (it runs in jsdom and normally never touches it), so it
// is registered here.
// ---------------------------------------------------------------------------

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

const handlers = new Map<string, IpcHandler>();

const ipcMainMock = {
  handle: (channel: string, handler: IpcHandler) => handlers.set(channel, handler),
  removeHandler: (channel: string) => handlers.delete(channel),
  on: () => undefined,
  removeAllListeners: () => undefined,
};

const showOpenDialog = vi.fn(async () => ({ canceled: false, filePaths: ['/w/gamma'] }));

vi.mock('electron', () => ({
  ipcMain: ipcMainMock,
  app: {
    getPath: () => '/tmp',
    getAppPath: () => '/app',
    getVersion: () => '0.1.0',
  },
  dialog: { showOpenDialog, showSaveDialog: vi.fn(async () => ({ canceled: true })) },
  BrowserWindow: {
    getAllWindows: () => [],
    fromWebContents: () => null,
  },
  default: {},
}));

// ---------------------------------------------------------------------------
// Service mocks — the leaves. Everything between them and the DOM is real.
// ---------------------------------------------------------------------------

const stashes = [
  {
    index: 0,
    message: 'WIP on main: cafebabe refactor parser',
    hash: 'h0',
    branch: 'main',
    timestamp: Date.now() - 3_600_000,
  },
  {
    index: 1,
    message: 'WIP on feature/login: 1234abc wip login form',
    hash: 'h1',
    branch: 'feature/login',
    timestamp: Date.now() - 86_400_000,
  },
];

const stashServiceMock = {
  list: vi.fn(async () => stashes),
  show: vi.fn(async () => ({
    files: [
      { path: 'src/parser.ts', status: 'modified' as const, additions: 12, deletions: 4 },
      { path: 'src/new-file.ts', status: 'added' as const, additions: 30, deletions: 0 },
    ],
    totalAdditions: 42,
    totalDeletions: 4,
  })),
  save: vi.fn(async () => undefined),
  apply: vi.fn(async () => undefined),
  pop: vi.fn(async () => undefined),
  drop: vi.fn(async () => undefined),
  branch: vi.fn(async () => undefined),
  clearCache: vi.fn(),
};

const searchServiceMock = {
  search: vi.fn(async () => [
    {
      filePath: '/w/src/parser.ts',
      matches: [
        { line: 12, column: 4, length: 4, text: '  // TODO: handle escapes' },
        { line: 40, column: 8, length: 4, text: '      // TODO: unicode' },
      ],
      totalMatches: 2,
    },
  ]),
  replace: vi.fn(async () => [
    { filePath: '/w/src/parser.ts', replacements: 2, preview: 'Line 12:\n- TODO\n+ DONE\n' },
  ]),
  getSearchHistory: vi.fn(() => ['TODO', 'FIXME']),
};

const workspaces = [
  { id: 'ws_1', name: 'alpha-project', path: '/w/alpha', createdAt: 1, updatedAt: 1, settings: {} },
  { id: 'ws_2', name: 'beta-project', path: '/w/beta', createdAt: 2, updatedAt: 2, settings: {} },
];

const workspaceManagerMock = {
  initialize: vi.fn(async () => undefined),
  listWorkspaces: vi.fn(() => workspaces),
  getActiveWorkspace: vi.fn(() => workspaces[1]),
  switchWorkspace: vi.fn(async () => undefined),
  addWorkspace: vi.fn(async (path: string) => ({
    id: 'ws_3',
    name: 'gamma',
    path,
    createdAt: 3,
    updatedAt: 3,
    settings: {},
  })),
  removeWorkspace: vi.fn(async () => undefined),
  on: vi.fn(),
  off: vi.fn(),
};

const chatExportServiceMock = {
  exportSession: vi.fn(async () => ({
    content: '# Design discussion\n\n👤 User\n\nhello',
    filename: 'chat-design-discussion-2024-05-01.md',
    size: 38,
  })),
};

const dbManagerMock = {
  getSession: vi.fn(() => ({
    id: 's1',
    workspace_id: 'ws_1',
    title: 'Design discussion',
    model: 'claude-3',
    created_at: 1_714_521_600_000,
    updated_at: 1_714_521_600_000,
    metadata: undefined,
  })),
  listMessages: vi.fn(() => [
    {
      id: 'm1',
      session_id: 's1',
      role: 'user' as const,
      content: 'hello',
      created_at: 1_714_521_600_000,
      metadata: undefined,
    },
  ]),
};

// Paths are written out in full: `vi.mock` is hoisted above every const, so a
// shared path variable would be read before initialization.
vi.mock('../../../../main/src/services/git-stash-service', () => ({
  getGitStashService: () => stashServiceMock,
}));
vi.mock('../../../../main/src/services/advanced-search-service', () => ({
  getAdvancedSearchService: () => searchServiceMock,
}));
vi.mock('../../../../main/src/services/workspace-manager', () => ({
  getWorkspaceManager: () => workspaceManagerMock,
}));
vi.mock('../../../../main/src/services/chat-export-service', () => ({
  getChatExportService: () => chatExportServiceMock,
}));
vi.mock('../../../../main/src/services/database-service', () => ({
  getDatabaseService: () => ({ getManager: async () => dbManagerMock }),
}));

// ---------------------------------------------------------------------------
// Real handler modules + real components
// ---------------------------------------------------------------------------

const { registerGitStashHandlers } = await import(
  '../../../../main/src/ipc/handlers/git-stash-handlers'
);
const { registerSearchHandlers } = await import(
  '../../../../main/src/ipc/handlers/search-handlers'
);
const { registerWorkspaceHandlers } = await import(
  '../../../../main/src/ipc/handlers/workspace-handlers'
);
const { registerChatHandlers } = await import('../../../../main/src/ipc/handlers/chat-handlers');

const { GitStashPanel } = await import('../../components/git/GitStashPanel');
const { AdvancedSearchPanel } = await import('../../components/search/AdvancedSearchPanel');
const { WorkspaceSwitcher } = await import('../../components/workspace/WorkspaceSwitcher');
const { ChatExportButton } = await import('../../components/chat/ChatExportButton');

// ---------------------------------------------------------------------------
// The bridge: window.ipc -> registered main-process handler
// ---------------------------------------------------------------------------

/**
 * Mirrors the preload bridge: forwards to the registered handler and rejects on
 * an unknown channel, exactly as the allowlist does. A channel the renderer
 * calls but nobody registered therefore fails loudly here — which is the failure
 * mode this whole mission is about.
 */
function installIpcBridge(): void {
  Object.defineProperty(window, 'ipc', {
    configurable: true,
    writable: true,
    value: {
      invoke: async (channel: string, data?: unknown) => {
        const handler = handlers.get(channel);
        if (!handler) {
          throw new Error(`IPC channel has no registered handler: ${channel}`);
        }
        return handler({ sender: {} }, data);
      },
      on: () => () => {},
    },
  });
}

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();

  registerGitStashHandlers();
  registerSearchHandlers();
  registerWorkspaceHandlers();
  registerChatHandlers();

  installIpcBridge();
});

// ===========================================================================

describe('git stash: panel <-> handler round trip', () => {
  it('renders the stash list returned by the handler', async () => {
    render(<GitStashPanel repoPath="/repo" />);

    // The message and branch come from StashEntry via response.data.stashes.
    await waitFor(() => {
      expect(screen.getByText(/refactor parser/)).toBeTruthy();
    });
    expect(screen.getByText(/wip login form/)).toBeTruthy();
    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByText('feature/login')).toBeTruthy();

    // "No stashes" is the empty state; seeing it would mean the panel got
    // nothing usable out of the response.
    expect(screen.queryByText('No stashes')).toBeNull();
  });

  it('renders the diff totals after selecting a stash', async () => {
    const user = userEvent.setup();
    render(<GitStashPanel repoPath="/repo" />);

    await waitFor(() => expect(screen.getByText(/refactor parser/)).toBeTruthy());
    await user.click(screen.getByText(/refactor parser/));

    // These values are read from response.data.diff. The summary row is scoped
    // explicitly: the per-file rows render their own +/- counts, so a bare
    // getByText('-4') matches several nodes.
    await waitFor(() => {
      expect(screen.getByText('2 files changed')).toBeTruthy();
    });

    const summary = screen.getByText('2 files changed').parentElement!;
    expect(summary?.textContent ?? "").toContain('+42');
    expect(summary?.textContent ?? "").toContain('-4');

    expect(screen.getByText('src/parser.ts')).toBeTruthy();
    expect(screen.getByText('src/new-file.ts')).toBeTruthy();
  });

  it('creating a stash reaches the service and refreshes the list', async () => {
    const user = userEvent.setup();
    render(<GitStashPanel repoPath="/repo" />);

    await waitFor(() => expect(screen.getByText(/refactor parser/)).toBeTruthy());

    await user.click(screen.getByTitle('Create stash'));
    await user.type(screen.getByPlaceholderText('WIP: feature description'), 'my new stash');
    await user.click(screen.getByRole('button', { name: 'Create Stash' }));

    await waitFor(() => {
      expect(stashServiceMock.save).toHaveBeenCalledWith('/repo', 'my new stash', {
        includeUntracked: false,
        keepIndex: false,
      });
    });

    // The dialog closes only on `response.success`, so this also proves the
    // envelope was readable.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Create Stash' })).toBeNull();
    });
    expect(stashServiceMock.list).toHaveBeenCalledTimes(2);
  });

  it('applying a stash calls the service with the selected index', async () => {
    const user = userEvent.setup();
    render(<GitStashPanel repoPath="/repo" />);

    await waitFor(() => expect(screen.getByText(/wip login form/)).toBeTruthy());
    await user.click(screen.getByText(/wip login form/));

    await waitFor(() => expect(screen.getByRole('button', { name: /Apply/ })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /Apply/ }));

    await waitFor(() => expect(stashServiceMock.apply).toHaveBeenCalledWith('/repo', 1));
  });
});

// ===========================================================================

describe('advanced search: panel <-> handler round trip', () => {
  it('loads the search history through the no-payload channel', async () => {
    const user = userEvent.setup();
    render(<AdvancedSearchPanel workspacePath="/w" />);

    // search:get-history is invoked with no argument at all on mount.
    await waitFor(() => expect(searchServiceMock.getSearchHistory).toHaveBeenCalled());

    await user.click(screen.getByTitle('Search history'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'TODO' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'FIXME' })).toBeTruthy();
  });

  it('renders matches returned by the handler', async () => {
    const user = userEvent.setup();
    render(<AdvancedSearchPanel workspacePath="/w" />);

    await user.type(screen.getByPlaceholderText('Search query...'), 'TODO');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    // The summary is computed from response.data.results[].totalMatches.
    await waitFor(() => {
      expect(screen.getByText('2 matches in 1 file')).toBeTruthy();
    });
    expect(screen.getByText('parser.ts')).toBeTruthy();
    expect(screen.queryByText('No results found')).toBeNull();
  });

  it('expands a file and renders each match line', async () => {
    const user = userEvent.setup();
    render(<AdvancedSearchPanel workspacePath="/w" />);

    await user.type(screen.getByPlaceholderText('Search query...'), 'TODO');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => expect(screen.getByText('parser.ts')).toBeTruthy());
    await user.click(screen.getByText('parser.ts'));

    // Line numbers and text come from SearchMatch.
    await waitFor(() => expect(screen.getByText('12')).toBeTruthy());
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText(/handle escapes/)).toBeTruthy();
  });

  it('preview renders the replacement count and keeps dryRun on', async () => {
    const user = userEvent.setup();
    render(<AdvancedSearchPanel workspacePath="/w" />);

    await user.type(screen.getByPlaceholderText('Search query...'), 'TODO');
    // Toggle the replace row (the icon-only button next to Search).
    await user.click(screen.getByRole('button', { name: '' }).closest('button')!);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Replace with...')).toBeTruthy()
    );
    await user.type(screen.getByPlaceholderText('Replace with...'), 'DONE');
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(screen.getByText('Replace preview')).toBeTruthy();
    });
    expect(screen.getByText('2 changes')).toBeTruthy();

    const [, options] = searchServiceMock.replace.mock.calls[0] as unknown as [string, { dryRun: boolean }];
    expect(options.dryRun).toBe(true);
  });

  it('forwards rootPath positionally, so the service is not handed it as an option', async () => {
    const user = userEvent.setup();
    render(<AdvancedSearchPanel workspacePath="/w" />);

    await user.type(screen.getByPlaceholderText('Search query...'), 'TODO');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => expect(searchServiceMock.search).toHaveBeenCalled());
    const [rootPath, options] = searchServiceMock.search.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(rootPath).toBe('/w');
    expect(options).not.toHaveProperty('rootPath');
  });
});

// ===========================================================================

describe('workspaces: switcher <-> handler round trip', () => {
  it('renders the active workspace name resolved from activeId', async () => {
    render(<WorkspaceSwitcher />);

    // The handler returns activeId ('ws_2'); the component resolves it to the
    // entity and renders `.name`. Returning the entity instead of the id here
    // would render "No workspace".
    await waitFor(() => {
      expect(screen.getByText('beta-project')).toBeTruthy();
    });
    expect(screen.queryByText('No workspace')).toBeNull();
  });

  it('lists every workspace with its path in the dropdown', async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await waitFor(() => expect(screen.getByText('beta-project')).toBeTruthy());
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText('alpha-project')).toBeTruthy());
    expect(screen.getByText('/w/alpha')).toBeTruthy();
    expect(screen.getByText('/w/beta')).toBeTruthy();
    expect(screen.queryByText('No workspaces yet')).toBeNull();
  });

  it('switching a workspace reaches the manager and reloads', async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await waitFor(() => expect(screen.getByText('beta-project')).toBeTruthy());
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('alpha-project')).toBeTruthy());

    await user.click(screen.getByText('alpha-project'));

    await waitFor(() => expect(workspaceManagerMock.switchWorkspace).toHaveBeenCalledWith('ws_1'));
    // The list is reloaded only when `response.success` was readable.
    expect(workspaceManagerMock.listWorkspaces).toHaveBeenCalledTimes(2);
  });

  it('adding a workspace chains open-dialog into add', async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await waitFor(() => expect(screen.getByText('beta-project')).toBeTruthy());
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('Add Workspace')).toBeTruthy());

    await user.click(screen.getByText('Add Workspace'));

    // The component reads response.data.path from open-dialog and passes it as
    // the `path` of workspace:add.
    await waitFor(() => expect(workspaceManagerMock.addWorkspace).toHaveBeenCalledWith('/w/gamma', undefined));
  });

  it('a cancelled dialog does not add a workspace', async () => {
    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });

    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await waitFor(() => expect(screen.getByText('beta-project')).toBeTruthy());
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('Add Workspace')).toBeTruthy());

    await user.click(screen.getByText('Add Workspace'));

    await waitFor(() => expect(showOpenDialog).toHaveBeenCalled());
    expect(workspaceManagerMock.addWorkspace).not.toHaveBeenCalled();
  });
});

// ===========================================================================

describe('chat export: button <-> handler round trip', () => {
  beforeEach(() => {
    // The component turns the response into a Blob download; jsdom implements
    // neither createObjectURL nor a real click navigation.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it('exports through the handler and uses the returned filename', async () => {
    const user = userEvent.setup();
    const clicks: string[] = [];
    // Capture the download name the component sets from response.data.filename.
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicks.push(this.download);
    };

    try {
      render(<ChatExportButton sessionId="s1" sessionTitle="Design discussion" />);

      await user.click(screen.getByTitle('Export conversation'));
      await waitFor(() => expect(screen.getByText('Export Conversation')).toBeTruthy());
      await user.click(screen.getByRole('button', { name: /^Export$/ }));

      await waitFor(() => expect(chatExportServiceMock.exportSession).toHaveBeenCalled());
      // Proves the component could read response.data.filename.
      await waitFor(() => {
        expect(clicks).toContain('chat-design-discussion-2024-05-01.md');
      });
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it('hands the exporter a camelCase session, not the raw DB row', async () => {
    const user = userEvent.setup();
    HTMLAnchorElement.prototype.click = function click() {};

    render(<ChatExportButton sessionId="s1" />);
    await user.click(screen.getByTitle('Export conversation'));
    await waitFor(() => expect(screen.getByText('Export Conversation')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /^Export$/ }));

    await waitFor(() => expect(chatExportServiceMock.exportSession).toHaveBeenCalled());

    const [session] = chatExportServiceMock.exportSession.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(session).toMatchObject({ title: 'Design discussion', createdAt: 1_714_521_600_000 });
    expect(session).not.toHaveProperty('created_at');
  });
});

// ===========================================================================

describe('allowlist / registration coverage', () => {
  it('every channel the panels invoke has a registered handler', () => {
    // The list the seven components actually call, minus the terminal and editor
    // channels which belong to already-registered domains.
    for (const channel of [
      'git:stash-list',
      'git:stash-show',
      'git:stash-save',
      'git:stash-apply',
      'git:stash-pop',
      'git:stash-drop',
      'git:stash-branch',
      'search:find',
      'search:replace',
      'search:get-history',
      'workspace:list',
      'workspace:switch',
      'workspace:add',
      'workspace:remove',
      'workspace:open-dialog',
      'chat:export',
    ]) {
      expect(handlers.has(channel)).toBe(true);
    }
  });
});
