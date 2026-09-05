/**
 * Startup sequence: `ipcMonitor.initialize()` must actually run.
 *
 * This is the assertion the ticket was built on. `IPCMonitor.initialize()` carried
 * a doc comment saying "Called during app startup"; nothing called it. The comment
 * was believed, so the IPC Inspector was assumed to work while it rendered empty.
 *
 * Asserting that the call *exists* in `index.ts` would repeat the mistake at one
 * remove. So this file imports the real `packages/main/src/index.ts`, lets its
 * `app.whenReady()` callback run, and checks the monitor was initialized — and
 * that it happened before the handlers registered, since registration is what
 * installs the instrumentation feeding it.
 *
 * Written for vitest. `electron` is mocked locally rather than through the shared
 * setup file: this suite needs `app.whenReady()` to resolve and `BrowserWindow` to
 * be constructible, which the shared mock does not provide.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Call-order log
//
// A single ordered record is what lets the "before registration" assertion be
// made at all.
// ---------------------------------------------------------------------------

const calls: string[] = [];

// ---------------------------------------------------------------------------
// electron mock
// ---------------------------------------------------------------------------

type ReadyCallback = () => unknown;

let whenReadyResolved: Promise<unknown> = Promise.resolve();

const appMock = {
  commandLine: { appendSwitch: vi.fn() },
  whenReady: vi.fn(() => {
    // `index.ts` does `app.whenReady().then(async () => {...})`. Capturing the
    // returned promise lets the test await the whole startup body.
    return {
      then: (callback: ReadyCallback) => {
        whenReadyResolved = Promise.resolve().then(callback);
        return whenReadyResolved;
      },
    };
  }),
  on: vi.fn(),
  getPath: vi.fn(() => '/tmp'),
  getVersion: vi.fn(() => '0.1.0'),
  getAppPath: vi.fn(() => '/app'),
  quit: vi.fn(),
  setAsDefaultProtocolClient: vi.fn(() => true),
  requestSingleInstanceLock: vi.fn(() => true),
  removeListener: vi.fn(),
};

class BrowserWindowMock {
  static getAllWindows = vi.fn(() => [] as BrowserWindowMock[]);
  static fromWebContents = vi.fn(() => null);
  webContents = {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    openDevTools: vi.fn(),
    isLoading: vi.fn(() => false),
  };
  loadURL = vi.fn();
  loadFile = vi.fn();
  on = vi.fn();
  show = vi.fn();
  focus = vi.fn();
  restore = vi.fn();
  isMinimized = vi.fn(() => false);
  isDestroyed = vi.fn(() => false);

  constructor() {
    calls.push('createWindow');
  }
}

vi.mock('electron', () => ({
  app: appMock,
  BrowserWindow: BrowserWindowMock,
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() },
  dialog: { showSaveDialog: vi.fn() },
  default: {},
}));

// ---------------------------------------------------------------------------
// Startup collaborators
//
// Each is stubbed and logs its own name, so the sequence can be read back.
// `ipcMonitor` is the subject: its `initialize` is spied on, not replaced.
// ---------------------------------------------------------------------------

const initializeSpy = vi.fn();

vi.mock('../services/ipc-monitor', async (importOriginal) => {
  const actual = (await importOriginal()) as { ipcMonitor: { initialize: () => void } };

  return {
    ipcMonitor: {
      ...actual.ipcMonitor,
      initialize: () => {
        calls.push('ipcMonitor.initialize');
        initializeSpy();
        // The real implementation still runs, so this is not a hollow stub.
        return actual.ipcMonitor.initialize.call(actual.ipcMonitor);
      },
    },
  };
});

vi.mock('../ipc/handlers/index', () => ({
  registerIPCHandlers: () => calls.push('registerIPCHandlers'),
  unregisterIPCHandlers: () => calls.push('unregisterIPCHandlers'),
}));

vi.mock('../security', () => ({
  initializeSecurity: () => calls.push('initializeSecurity'),
}));

vi.mock('../performance', () => ({
  initializePerformance: async () => calls.push('initializePerformance'),
  cleanupPerformance: async () => calls.push('cleanupPerformance'),
}));

vi.mock('../updater', () => ({
  updateManager: { initialize: vi.fn(), destroy: vi.fn() },
}));

vi.mock('../services/automation-service', () => ({
  automationService: { on: vi.fn(), dispose: vi.fn() },
}));

vi.mock('../services/database-service', () => ({
  getDatabaseService: () => ({
    initialize: async () => calls.push('database.initialize'),
    close: vi.fn(),
  }),
}));

vi.mock('../services/debug-service', () => ({
  debugService: {
    initialize: async () => calls.push('debugService.initialize'),
    cleanup: vi.fn(),
    getSettings: () => ({ enableIpcMonitoring: true }),
    updateSettings: vi.fn(),
  },
}));

beforeAll(async () => {
  // Importing runs the module body, including `app.whenReady().then(...)`.
  await import('../index');
  await whenReadyResolved;
});

describe('app startup initializes the IPC monitor', () => {
  it('calls ipcMonitor.initialize()', () => {
    // The claim that was false before this change.
    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });

  it('calls it during the whenReady sequence, not at import time', () => {
    expect(calls).toContain('ipcMonitor.initialize');
    expect(calls.indexOf('ipcMonitor.initialize')).toBeGreaterThan(
      calls.indexOf('initializeSecurity') - 1
    );
  });

  it('initializes the monitor before the handlers register', () => {
    // Registration installs the instrumentation that feeds the monitor;
    // initializing afterwards would clear the buffer and drop early messages.
    const monitorAt = calls.indexOf('ipcMonitor.initialize');
    const registerAt = calls.indexOf('registerIPCHandlers');

    expect(monitorAt).toBeGreaterThanOrEqual(0);
    expect(registerAt).toBeGreaterThanOrEqual(0);
    expect(monitorAt).toBeLessThan(registerAt);
  });

  it('still registers handlers before the window opens', () => {
    // Pre-existing ordering requirement: the renderer's first invokes must not
    // hit unregistered channels.
    expect(calls.indexOf('registerIPCHandlers')).toBeLessThan(calls.indexOf('createWindow'));
  });

  it('opens the window', () => {
    // Guards the failure mode a previous bug caused: a throw inside whenReady
    // aborting startup before `createWindow()`.
    expect(calls).toContain('createWindow');
  });

  it('reaches the background steps after the window', () => {
    expect(calls.indexOf('createWindow')).toBeLessThan(calls.indexOf('database.initialize'));
  });
});
