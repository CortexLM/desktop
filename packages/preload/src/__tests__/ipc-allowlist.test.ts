/**
 * Preload IPC allowlist — regression guard.
 *
 * Purpose: `window.electron.invoke` used to forward *any* channel to
 * `ipcRenderer.invoke`, handing the renderer (least-trusted process, renders
 * remote content through a `<webview>`) every registered main-process handler.
 * The allowlist closed that. This suite is what stops it from being silently
 * reopened — an emptied or bypassed allowlist would otherwise fail nothing.
 *
 * Written for vitest (the repo is consolidating on it), and deliberately
 * *behavioural*: it drives the functions actually handed to
 * `contextBridge.exposeInMainWorld`, rather than asserting on the allowlist
 * array. Asserting on the array would still pass if the bridge stopped consulting
 * it.
 *
 * `electron` is mocked locally: this package has no global setup file, and
 * `electron`'s npm entry point exports a *string* (the binary path), so
 * `import { contextBridge } from 'electron'` cannot link outside a real Electron
 * runtime.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Electron mock
// ---------------------------------------------------------------------------

/** Name -> API object, populated by `contextBridge.exposeInMainWorld`. */
const exposed = new Map<string, Record<string, unknown>>();

const invokeMock = vi.fn(async (channel: string, ..._args: unknown[]) => `ok:${channel}`);

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: Record<string, unknown>) => {
      exposed.set(name, api);
    },
  },
  ipcRenderer: {
    invoke: invokeMock,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

type InvokeFn = (channel: string, ...args: unknown[]) => Promise<unknown>;

let electronInvoke: InvokeFn;
let cortexInvoke: InvokeFn;
let ipcInvoke: InvokeFn;

beforeAll(async () => {
  // Imported inside the hook, after `vi.mock` is registered: the module calls
  // `exposeInMainWorld` at import time, which is what populates `exposed`.
  await import('../index');

  electronInvoke = exposed.get('electron')?.invoke as InvokeFn;
  cortexInvoke = exposed.get('cortex')?.invoke as InvokeFn;
  ipcInvoke = exposed.get('ipc')?.invoke as InvokeFn;
});

beforeEach(() => {
  invokeMock.mockClear();
});

// ---------------------------------------------------------------------------
// The inventory of channels the allowlist admits.
//
// PROVENANCE, and it has changed. This list was sourced from
// `grep -rn 'window.electron.invoke' packages/renderer/src/` — the `debug:*`
// family used by DebugPanel, plus what the old renderer's `lib/ipc.ts` routed
// through the same bridge. That renderer has been deleted.
//
// MEASURED 2026-08-25: the current renderer (`packages/app`) calls exactly one
// namespace, `window.cortex.cortex`. Nothing reads `window.electron` or
// `window.ipc` at all, so every channel below currently has no consumer.
//
// These tests are kept, and they are still worth running, because what they
// assert is a property of the *boundary* rather than of any caller: a channel
// outside the list must be rejected. That is what stops the generic `invoke`
// escape hatch from becoming "the renderer can reach any ipcMain handler",
// which is the state it would drift into the moment a caller reappears.
//
// It does mean the surface is currently wider than the app uses. Narrowing it is
// a deliberate change on its own, not something to do while the session
// workbench (which needs fs, git and terminal) is still being built.
// ---------------------------------------------------------------------------

const DEBUG_CHANNELS = [
  'debug:get-settings',
  'debug:update-settings',
  'debug:get-logs',
  'debug:clear-logs',
  'debug:get-metrics',
  'debug:clear-metrics',
  'debug:get-memory',
  'debug:get-ipc-messages',
  'debug:get-ipc-stats',
  'debug:clear-ipc',
  'debug:export-logs',
  'debug:get-system-info',
];

const FACADE_CHANNELS = [
  'fs:read-file',
  'fs:write-file',
  'fs:read-dir',
  'editor:open-file',
  'editor:save-file',
  'editor:format',
  'git:status',
  'git:commit',
  'git:push',
  'git:pull',
  'git:diff',
  'git:stage',
  'git:unstage',
  'git:discard',
  'ai:create-session',
  'ai:send-message',
  'terminal:create',
  'terminal:input',
  'terminal:resize',
  'db:query',
  'db:execute',
];

describe('preload bridges are exposed', () => {
  it('exposes cortex, ipc and electron on the main world', () => {
    expect([...exposed.keys()].sort()).toEqual(['cortex', 'electron', 'ipc']);
  });

  it('exposes an invoke function on each bridge', () => {
    expect(typeof electronInvoke).toBe('function');
    expect(typeof cortexInvoke).toBe('function');
    expect(typeof ipcInvoke).toBe('function');
  });
});

describe('window.electron.invoke rejects channels outside the allowlist', () => {
  // The point of the whole suite. Each of these reaches a real registered
  // handler in the main process, so an open bridge made them all callable from
  // renderer-side script.
  const forbidden = [
    'db:query-raw',
    'fs:unwatch',
    'fs:watch',
    'mcp:invoke-tool',
    'mcp:install-server',
    'automation:run',
    'automation:delete',
    'workspace:remove',
    'git:stash-drop',
    'search:replace',
    'chat:export',
    'update:install',
    'ai:stream-response',
    'ai:stop-stream',
    'terminal:kill',
    'app:get-version',
    '',
    'not-a-channel',
  ];

  it.each(forbidden)('rejects %j', async (channel) => {
    await expect(electronInvoke(channel)).rejects.toThrow(
      `IPC channel not allowed: ${channel}`
    );
  });

  it('does not reach ipcRenderer.invoke when a channel is refused', async () => {
    await expect(electronInvoke('mcp:invoke-tool', { evil: true })).rejects.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('rejects rather than throwing synchronously, so callers can catch it', () => {
    // A synchronous throw would escape the `try/catch` inside the panels'
    // async loaders and surface as an unhandled error instead of a caught one.
    let threw = false;
    let result: Promise<unknown> | undefined;

    try {
      result = electronInvoke('mcp:invoke-tool');
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).rejects.toThrow('not allowed');
  });

  it('is not fooled by a channel that merely starts with an allowed one', async () => {
    await expect(electronInvoke('debug:get-settings-and-secrets')).rejects.toThrow(
      'not allowed'
    );
    await expect(electronInvoke('db:querying')).rejects.toThrow('not allowed');
  });

  it('cannot be bypassed through prototype keys', async () => {
    // A `Set` is used rather than a plain object precisely so that
    // `'constructor'` / `'toString'` are not truthy lookups.
    for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      await expect(electronInvoke(key)).rejects.toThrow('not allowed');
    }
  });
});

describe('window.electron.invoke forwards allowlisted channels', () => {
  it.each(DEBUG_CHANNELS)('forwards %s', async (channel) => {
    await expect(electronInvoke(channel)).resolves.toBe(`ok:${channel}`);
    expect(invokeMock).toHaveBeenCalledWith(channel);
  });

  it.each(FACADE_CHANNELS)('forwards %s', async (channel) => {
    await expect(electronInvoke(channel, { path: '/x' })).resolves.toBe(`ok:${channel}`);
    expect(invokeMock).toHaveBeenCalledWith(channel, { path: '/x' });
  });

  it('allows every debug channel the panels call', () => {
    // Guards against the allowlist being trimmed to a subset: a missing entry
    // here means a debug sub-panel renders empty.
    expect(DEBUG_CHANNELS).toHaveLength(12);
  });

  it('preserves multiple arguments', async () => {
    // PerformancePanel invokes ('debug:get-metrics', undefined, 500). A
    // single-payload signature would drop the limit and the panel would read a
    // different slice than it asked for.
    await electronInvoke('debug:get-metrics', undefined, 500);
    expect(invokeMock).toHaveBeenCalledWith('debug:get-metrics', undefined, 500);
  });

  it('forwards a zero-argument call without inventing a payload', async () => {
    await electronInvoke('debug:get-system-info');
    expect(invokeMock).toHaveBeenCalledWith('debug:get-system-info');
  });

  it('propagates a rejection from the main process untouched', async () => {
    invokeMock.mockRejectedValueOnce(new Error('handler exploded'));
    await expect(electronInvoke('debug:get-logs')).rejects.toThrow('handler exploded');
  });
});

describe('git discard is reachable through the bridge', () => {
  /*
   * `git:discard` is the panel's only destructive channel, and it goes through
   * `window.electron.invoke` like staging. An unlisted channel is rejected by
   * the bridge with `IPC channel not allowed: git:discard` — no build error,
   * every discard broken at runtime.
   */
  it('forwards git:discard with its payload', async () => {
    const payload = { repoPath: '/repo', files: ['a.ts'], deleteUntracked: false };

    await expect(electronInvoke('git:discard', payload)).resolves.toBe('ok:git:discard');
    expect(invokeMock).toHaveBeenCalledWith('git:discard', payload);
  });

  it('does not widen window.ipc', async () => {
    await expect(ipcInvoke('git:discard')).rejects.toThrow(
      'IPC channel not allowed: git:discard'
    );
  });

  it('still rejects near-miss discard channel names', async () => {
    // `git:clean` and `git:reset` are the destructive neighbours nobody wired
    // up; reaching them through the bridge must stay impossible.
    for (const channel of ['git:discard-all', 'git:discarded', 'git:clean', 'git:reset']) {
      await expect(electronInvoke(channel)).rejects.toThrow('not allowed');
    }
  });
});

describe('git staging is reachable through the bridge', () => {
  /*
   * `GitPanel.toggleStage` and its "Stage All" action reach `git:stage` /
   * `git:unstage` through `renderer/src/lib/ipc.ts`, which routes through
   * `window.electron.invoke`. An unlisted channel is *rejected by the bridge*,
   * so omitting either one breaks staging at runtime with
   * `IPC channel not allowed: git:stage` and no build error — the same failure
   * mode that made `terminal:list` worth its own guard below.
   */
  it.each(['git:stage', 'git:unstage'])('forwards %s with its payload', async (channel) => {
    const payload = { repoPath: '/repo', files: ['a.ts'] };

    await expect(electronInvoke(channel, payload)).resolves.toBe(`ok:${channel}`);
    expect(invokeMock).toHaveBeenCalledWith(channel, payload);
  });

  it('does not widen window.ipc', async () => {
    // GitPanel uses the `electron` bridge; nothing needs staging on the other
    // one, so it stays off that allowlist.
    await expect(ipcInvoke('git:stage')).rejects.toThrow(
      'IPC channel not allowed: git:stage'
    );
  });

  it('still rejects near-miss staging channel names', async () => {
    for (const channel of ['git:stage-all', 'git:staged', 'git:unstage-hunk', 'git:stag']) {
      await expect(electronInvoke(channel)).rejects.toThrow('not allowed');
    }
  });
});

describe('window.cortex.invoke shares the same allowlist', () => {
  // It had no renderer consumer, so leaving it open would have kept a second
  // unrestricted door onto every handler after the first was closed.
  it('rejects a channel outside the allowlist', async () => {
    await expect(cortexInvoke('mcp:invoke-tool')).rejects.toThrow(
      'IPC channel not allowed: mcp:invoke-tool'
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('forwards an allowlisted channel', async () => {
    await expect(cortexInvoke('debug:get-settings')).resolves.toBe('ok:debug:get-settings');
  });
});

describe('window.ipc.invoke allowlist still holds', () => {
  // Pre-existing allowlist, re-asserted here so that a refactor touching the
  // shared helper cannot loosen it unnoticed.
  it('forwards an allowlisted channel', async () => {
    await expect(ipcInvoke('git:stash-list')).resolves.toBe('ok:git:stash-list');
  });

  it('rejects a channel outside its allowlist', async () => {
    await expect(ipcInvoke('db:query')).rejects.toThrow('IPC channel not allowed: db:query');
  });

  it('keeps the two allowlists independent', async () => {
    // `chat:export` is allowed on `ipc`, not on `electron`; `db:query` the
    // reverse. Each bridge exposes only what its own callers need.
    await expect(ipcInvoke('chat:export')).resolves.toBe('ok:chat:export');
    await expect(electronInvoke('chat:export')).rejects.toThrow('not allowed');

    await expect(electronInvoke('db:query')).resolves.toBe('ok:db:query');
    await expect(ipcInvoke('db:query')).rejects.toThrow('not allowed');
  });
});

describe('settings channels are reachable from window.ipc', () => {
  /*
   * Le pont des réglages : `SettingsView` écrivait la clé d'API dans
   * `localStorage` et `AIService` ne lisait que l'environnement. Ces deux canaux
   * sont ce qui les relie.
   *
   * Un canal absent de l'allowlist est *rejeté par le bridge*, donc l'omettre ne
   * produit aucune erreur de compilation : le bouton Save échouerait à
   * l'exécution sur `IPC channel not allowed: settings:set-provider`, et
   * l'utilisateur retrouverait exactement le symptôme d'origine — une clé
   * saisie qui ne sert à rien.
   */
  it('forwards settings:get-providers', async () => {
    await expect(ipcInvoke('settings:get-providers')).resolves.toBe(
      'ok:settings:get-providers'
    );
    expect(invokeMock).toHaveBeenCalledWith('settings:get-providers', undefined);
  });

  it('forwards settings:set-provider with its payload', async () => {
    const payload = { id: 'anthropic', enabled: true, apiKey: 'sk-ant-test' };

    await expect(ipcInvoke('settings:set-provider', payload)).resolves.toBe(
      'ok:settings:set-provider'
    );
    expect(invokeMock).toHaveBeenCalledWith('settings:set-provider', payload);
  });

  it('does not widen window.electron.invoke', async () => {
    // `SettingsView` utilise `window.ipc` ; rien n'a besoin de ces canaux sur
    // l'autre bridge, donc ils restent hors de son allowlist.
    for (const channel of ['settings:get-providers', 'settings:set-provider']) {
      await expect(electronInvoke(channel)).rejects.toThrow(
        `IPC channel not allowed: ${channel}`
      );
    }
  });

  it('still rejects near-miss settings channel names', async () => {
    // Un canal `settings:*` non prévu ne doit pas devenir joignable par simple
    // préfixe : il n'existe pas de handler pour eux, et une allowlist par
    // préfixe serait un affaiblissement.
    for (const channel of [
      'settings:get-providers-raw',
      'settings:set-providers',
      'settings:get',
      'settings:delete-provider',
      'settings:',
    ]) {
      await expect(ipcInvoke(channel)).rejects.toThrow('not allowed');
    }
  });
});

describe('terminal:list is reachable from window.ipc', () => {
  /*
   * `TerminalGrid` calls `terminal:list` on mount to reattach to the PTYs still
   * running in main. Without it the renderer forgot every terminal on a view
   * switch and never sent `terminal:kill`, leaking one shell process per
   * terminal (6 orphans measured for 6 terminals).
   *
   * The allowlist is why this needs its own guard: an unlisted channel is
   * rejected by the bridge, so omitting it here would break reattachment with a
   * runtime rejection rather than a build error — and the leak would come back
   * silently.
   */
  it('forwards terminal:list', async () => {
    await expect(ipcInvoke('terminal:list')).resolves.toBe('ok:terminal:list');
    expect(invokeMock).toHaveBeenCalledWith('terminal:list', undefined);
  });

  it('allows the whole terminal surface the grid uses', async () => {
    for (const channel of ['terminal:create', 'terminal:input', 'terminal:resize', 'terminal:kill', 'terminal:list']) {
      await expect(ipcInvoke(channel)).resolves.toBe(`ok:${channel}`);
    }
  });

  it('does not widen window.electron.invoke', async () => {
    // The grid uses `window.ipc`; nothing needs `terminal:list` on the other
    // bridge, so it stays off that allowlist.
    await expect(electronInvoke('terminal:list')).rejects.toThrow(
      'IPC channel not allowed: terminal:list'
    );
  });

  it('still rejects a near-miss channel name', async () => {
    await expect(ipcInvoke('terminal:list-all')).rejects.toThrow('not allowed');
  });
});
