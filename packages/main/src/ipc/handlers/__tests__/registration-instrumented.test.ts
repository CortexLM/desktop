/**
 * Startup wiring: `registerIPCHandlers()` must produce *instrumented* handlers.
 *
 * The tests in `ipc-instrumentation.test.ts` drive `withIpcInstrumentation`
 * directly with local stub handlers. That proves the wrapper works, not that the
 * real registration path uses it. This file closes that gap by calling
 * `registerIPCHandlers()` — the function `app.whenReady()` calls — and checking
 * that invoking a real registered channel lands in the monitor.
 *
 * It is the same class of mistake as the one that created this ticket: code that
 * exists but is never called.
 *
 * Written for vitest. `electron` is mocked by `test/vitest-setup-main.ts`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

// ---------------------------------------------------------------------------
// Service mocks
//
// The real domains reach for chokidar, better-sqlite3, simple-git and node-pty.
// Registration is all that matters here, so the services are stubbed to keep the
// module graph loadable under plain Node.
// ---------------------------------------------------------------------------

vi.mock('../../../services/database-service', () => ({
  getDatabaseService: () => ({
    initialize: vi.fn(async () => ({})),
    query: vi.fn(() => []),
    execute: vi.fn(() => ({ changes: 0 })),
    close: vi.fn(),
  }),
}));

vi.mock('../../../services/automation-service', () => ({
  automationService: {
    on: vi.fn(),
    dispose: vi.fn(),
    list: vi.fn(async () => []),
  },
}));

vi.mock('../../../services/terminal-service', () => ({
  getTerminalService: () => ({
    create: vi.fn(async () => ({ terminalId: 't1' })),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
  }),
}));

// `electron-updater` instantiates an AppUpdater at import time, which reads the
// real `app.getVersion()` and throws outside an Electron runtime.
vi.mock('../../../updater', () => ({
  updateManager: {
    initialize: vi.fn(),
    destroy: vi.fn(),
    checkForUpdates: vi.fn(async () => ({ success: true })),
    downloadUpdate: vi.fn(async () => ({ success: true })),
    quitAndInstall: vi.fn(() => ({ success: true })),
  },
}));

const { registerIPCHandlers, unregisterIPCHandlers } = await import('../index');
const { ipcMonitor } = await import('../../../services/ipc-monitor');
const { debugService } = await import('../../../services/debug-service');

beforeEach(() => {
  resetElectronMock();
  ipcMonitor.clear();
  debugService.updateSettings({ enableIpcMonitoring: true });
});

afterEach(() => {
  try {
    unregisterIPCHandlers();
  } catch {
    // Teardown of a stubbed domain may throw; irrelevant to these assertions.
  }
});

describe('registerIPCHandlers wires instrumentation', () => {
  it('registers handlers across the domains', () => {
    registerIPCHandlers();

    // Sanity: the loop ran.
    expect(registeredHandlers.size).toBeGreaterThan(20);
  });

  it('registers the debug channels', () => {
    registerIPCHandlers();

    for (const channel of ['debug:get-ipc-messages', 'debug:get-ipc-stats', 'debug:get-settings']) {
      expect(registeredHandlers.has(channel)).toBe(true);
    }
  });

  it('feeds the monitor when a really-registered channel is invoked', async () => {
    registerIPCHandlers();

    expect(ipcMonitor.getMessages()).toHaveLength(0);

    // `fs:read-file` with an invalid payload: the handler returns a validation
    // failure envelope rather than touching the disk, which is enough to prove
    // the call passed through the instrumentation.
    const handler = registeredHandlers.get('fs:read-file');
    expect(handler).toBeTruthy();
    await handler!({}, { path: 12345 });

    const messages = ipcMonitor.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].channel).toBe('fs:read-file');
    expect(messages[0].direction).toBe('send');
    expect(typeof messages[0].duration).toBe('number');
  });

  it('feeds the monitor for a second, unrelated domain', async () => {
    registerIPCHandlers();

    const handler = registeredHandlers.get('git:status');
    expect(handler).toBeTruthy();
    await handler!({}, { repoPath: 42 });

    expect(ipcMonitor.getMessages().map((m) => m.channel)).toContain('git:status');
  });

  it('does not feed the monitor for debug channels', async () => {
    registerIPCHandlers();

    const handler = registeredHandlers.get('debug:get-ipc-messages');
    expect(handler).toBeTruthy();
    await handler!({}, 500);

    expect(ipcMonitor.getMessages()).toHaveLength(0);
  });

  it('leaves the debug channels returning raw values', async () => {
    registerIPCHandlers();

    // The documented exception: `debug:*` returns bare values, not
    // `{ success, data }`. Instrumentation must not reshape that.
    const result = await registeredHandlers.get('debug:get-ipc-messages')!({}, 500);

    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toHaveProperty('success');
  });

  it('keeps the standard envelope on the other domains', async () => {
    registerIPCHandlers();

    const result = (await registeredHandlers.get('fs:read-file')!({}, { path: 12345 })) as {
      success: boolean;
      error?: unknown;
    };

    // A wrapper that swallowed or rewrapped the return value would show up here.
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
