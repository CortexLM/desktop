/**
 * IPC Inspector, end to end: instrumentation -> monitor -> handler -> DOM.
 *
 * The gap this closes
 * -------------------
 * `debug-round-trip.test.tsx` already proves the Inspector renders rows *if* the
 * monitor holds messages — it calls `ipcMonitor.recordMessage()` by hand. What was
 * never proven is that anything fills the monitor in production: there was no
 * `recordMessage` call anywhere in `packages/main/`, and `ipcMonitor.initialize()`
 * was never called despite its doc comment claiming otherwise. The panel rendered
 * "No IPC messages" permanently.
 *
 * So this file records nothing by hand. Every row asserted below exists because an
 * IPC call went through the instrumented registration path.
 *
 * The chain under test is real at every link except one:
 *   panel (real)
 *     -> preload allowlist (real module, `window.electron.invoke`)
 *       -> ipcRenderer.invoke (mocked transport, dispatches to the handler map)
 *         -> instrumented handler (real `withIpcInstrumentation`)
 *           -> ipcMonitor (real)
 *             -> debug:get-ipc-messages handler (real)
 *               -> IPCInspector DOM (real)
 *
 * The one stand-in: the *traffic-generating* handlers (`fs:read-file` etc.) are
 * local stubs rather than the real domain handlers, which would drag chokidar,
 * better-sqlite3 and simple-git into jsdom. They stand in only as "some domain
 * handler"; `registerIPCHandlers()` registers the real ones through the very same
 * `ipcMain.handle` call this test instruments.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// electron mock — doubles as the IPC transport
// ---------------------------------------------------------------------------

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

const handlers = new Map<string, IpcHandler>();
const exposed = new Map<string, Record<string, unknown>>();

const ipcMainMock = {
  handle: (channel: string, handler: IpcHandler) => handlers.set(channel, handler),
  removeHandler: (channel: string) => handlers.delete(channel),
  on: () => undefined,
  removeAllListeners: () => undefined,
};

vi.mock('electron', () => ({
  ipcMain: ipcMainMock,
  // `ipcRenderer.invoke` is the wire: it dispatches straight into the handler
  // map, so a call that leaves the preload really does reach the instrumented
  // handler.
  ipcRenderer: {
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`IPC channel has no registered handler: ${channel}`);
      return handler({ sender: {} }, ...args);
    },
    on: () => undefined,
    removeListener: () => undefined,
  },
  contextBridge: {
    exposeInMainWorld: (name: string, api: Record<string, unknown>) => exposed.set(name, api),
  },
  app: {
    getPath: (name: string) => `/tmp/${name}`,
    getAppPath: () => '/app/cortex-ide',
    getVersion: () => '0.1.0',
  },
  dialog: { showSaveDialog: vi.fn(async () => ({ canceled: true })) },
  BrowserWindow: { getAllWindows: () => [], fromWebContents: () => null },
  default: {},
}));

// ---------------------------------------------------------------------------
// Real modules
// ---------------------------------------------------------------------------

const { registerDebugHandlers, resetDebugSettings } = await import(
  '../../../../../main/src/ipc/handlers/debug-handlers'
);
const { withIpcInstrumentation } = await import(
  '../../../../../main/src/ipc/handlers/shared/ipc-instrumentation'
);
const { ipcMonitor } = await import('../../../../../main/src/services/ipc-monitor');
const { performanceMonitor } = await import(
  '../../../../../main/src/services/performance-monitor'
);
const { debugService } = await import('../../../../../main/src/services/debug-service');

// Importing the preload runs `exposeInMainWorld`, which is what fills `exposed`.
await import('../../../../../preload/src/index');

const { IPCInspector } = await import('../IPCInspector');

/**
 * A payload carrying things that must never reach the screen: the debug panel is
 * visible, and IPC requests routinely carry file content and credentials.
 */
const SECRET = 'sk-live-DEADBEEF-never-render-me';

/**
 * Registers the traffic handlers through the instrumented path — i.e. the same
 * `ipcMain.handle` call `registerIPCHandlers()` makes for all 14 domains.
 */
function registerInstrumentedTraffic(): void {
  withIpcInstrumentation(() => {
    ipcMainMock.handle('fs:read-file', async () => ({
      success: true,
      data: { content: SECRET },
    }));
    ipcMainMock.handle('git:status', async () => ({ success: true, data: { branch: 'main' } }));
    ipcMainMock.handle('db:query', async () => ({
      success: false,
      error: { code: 'DB_ERROR', message: 'no such table' },
    }));
  });
}

/** The preload's real bridge, allowlist included. */
function installPreloadBridge(): void {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    writable: true,
    value: exposed.get('electron'),
  });
}

type InvokeFn = <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;

const invoke = (): InvokeFn =>
  (window as unknown as { electron: { invoke: InvokeFn } }).electron.invoke;

/**
 * Scopes queries to the message list.
 *
 * Necessary because a channel name appears twice on screen: once as a message
 * row, once in the "Channel Statistics" sidebar. An unscoped `getByText` matches
 * both and throws. `.overflow-auto.font-mono` is the scrolling list container in
 * `IPCInspector`; the sidebar renders a `<table>` instead.
 */
function renderInspector() {
  const { container } = render(<IPCInspector />);

  const listNode = container.querySelector('div.overflow-auto.font-mono');
  if (!listNode) throw new Error('message list container not found');

  return { container, list: within(listNode as HTMLElement), listNode: listNode as HTMLElement };
}

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  resetDebugSettings();
  ipcMonitor.clear();
  performanceMonitor.clear();
  debugService.updateSettings({ enableIpcMonitoring: true });

  registerDebugHandlers();
  registerInstrumentedTraffic();
  installPreloadBridge();
});

// ===========================================================================

describe('the Inspector starts empty and fills from real IPC traffic', () => {
  it('renders "No IPC messages" before any call', async () => {
    const { list } = renderInspector();

    // The pre-change state: this is what the panel showed permanently.
    await waitFor(() => expect(list.getByText('No IPC messages')).toBeTruthy());
    expect(screen.getByText('0 messages')).toBeTruthy();
  });

  it('renders a row for a channel that was actually invoked', async () => {
    await invoke()('fs:read-file', { path: '/notes.md' });

    const { list } = renderInspector();

    await waitFor(() => expect(list.getByText('fs:read-file')).toBeTruthy());
    expect(list.queryByText('No IPC messages')).toBeNull();
  });

  it('renders one row per call and counts them in the footer', async () => {
    await invoke()('fs:read-file', { path: '/a' });
    await invoke()('git:status', { repoPath: '/r' });
    await invoke()('db:query', { sql: 'SELECT 1' });

    const { list } = renderInspector();

    await waitFor(() => expect(screen.getByText('3 messages')).toBeTruthy());
    expect(list.getByText('fs:read-file')).toBeTruthy();
    expect(list.getByText('git:status')).toBeTruthy();
    expect(list.getByText('db:query')).toBeTruthy();
  });

  it('picks up traffic that happens while the panel is mounted', async () => {
    const { list } = renderInspector();
    await waitFor(() => expect(list.getByText('No IPC messages')).toBeTruthy());

    await invoke()('git:status', { repoPath: '/r' });

    // The panel polls every second; `waitFor` covers the interval.
    await waitFor(() => expect(list.getByText('git:status')).toBeTruthy(), { timeout: 3000 });
  });

  it('renders a row for a call that failed', async () => {
    // `db:query` returns a failure envelope. The row must still appear — an IPC
    // call that failed is precisely what someone opens this panel to find.
    await invoke()('db:query', { sql: 'SELECT 1' });

    const { list } = renderInspector();
    await waitFor(() => expect(list.getByText('db:query')).toBeTruthy());
  });
});

describe('rows carry the fields the panel reads', () => {
  it('renders the direction arrow, so `direction` matched the panel vocabulary', async () => {
    // The monitor stores 'send'; the panel filters and colours on
    // 'renderer->main'. `toSharedIPCMessage` is the single translation. A raw
    // 'send' would render the '<-' arrow and be invisible to the filter.
    await invoke()('fs:read-file', { path: '/a' });

    const { list } = renderInspector();

    await waitFor(() => expect(list.getByText('fs:read-file')).toBeTruthy());
    expect(list.getAllByText('→').length).toBe(1);
    expect(list.queryByText('←')).toBeNull();
  });

  it('survives the direction filter, which proves the mapped value', async () => {
    await invoke()('fs:read-file', { path: '/a' });

    const { list } = renderInspector();
    await waitFor(() => expect(list.getByText('fs:read-file')).toBeTruthy());

    await userEvent.selectOptions(screen.getByRole('combobox'), 'renderer->main');

    expect(list.getByText('fs:read-file')).toBeTruthy();
    expect(screen.getByText('1 messages')).toBeTruthy();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'main->renderer');
    expect(list.getByText('No IPC messages')).toBeTruthy();
  });

  it('renders a measured duration', async () => {
    await invoke()('fs:read-file', { path: '/a' });

    const { list } = renderInspector();

    // `msg.duration.toFixed(1)` — an absent duration renders no cell at all.
    await waitFor(() => expect(list.getByText(/^\d+\.\d+ms$/)).toBeTruthy());
  });

  it('renders a timestamp cell', async () => {
    await invoke()('fs:read-file', { path: '/a' });

    const { list } = renderInspector();

    // `new Date(msg.timestamp).toLocaleTimeString()` on a missing timestamp
    // yields "Invalid Date".
    await waitFor(() => expect(list.getByText('fs:read-file')).toBeTruthy());
    expect(list.queryByText(/Invalid Date/)).toBeNull();
  });

  it('gives each row a distinct React key, so no row is dropped', async () => {
    // Same channel three times within the same millisecond is the collision case:
    // `id` is derived from channel + timestamp + index, and duplicate keys would
    // make React render fewer rows than there are messages.
    await invoke()('fs:read-file', { path: '/a' });
    await invoke()('fs:read-file', { path: '/b' });
    await invoke()('fs:read-file', { path: '/c' });

    const { list } = renderInspector();

    await waitFor(() => expect(screen.getByText('3 messages')).toBeTruthy());
    expect(list.getAllByText('fs:read-file')).toHaveLength(3);
  });

  it('filters by channel name', async () => {
    await invoke()('fs:read-file', { path: '/a' });
    await invoke()('git:status', { repoPath: '/r' });

    const { list } = renderInspector();
    await waitFor(() => expect(screen.getByText('2 messages')).toBeTruthy());

    await userEvent.type(screen.getByPlaceholderText('Filter by channel...'), 'git');

    expect(screen.getByText('1 messages')).toBeTruthy();
    expect(list.queryByText('fs:read-file')).toBeNull();
  });
});

describe('the stats sidebar fills too', () => {
  it('renders a channel row with its call count', async () => {
    await invoke()('fs:read-file', { path: '/a' });
    await invoke()('fs:read-file', { path: '/b' });
    await invoke()('git:status', { repoPath: '/r' });

    renderInspector();

    await waitFor(() => expect(screen.getByText('Channel Statistics')).toBeTruthy());

    const table = screen.getByRole('table');
    const row = within(table).getByTitle('fs:read-file').closest('tr');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('2')).toBeTruthy();
  });

  it('renders an average duration rather than NaN', async () => {
    await invoke()('git:status', { repoPath: '/r' });

    renderInspector();

    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy());
    // `data.avgDuration.toFixed(1)` prints "NaN" when the division has no
    // samples.
    expect(within(screen.getByRole('table')).queryByText('NaN')).toBeNull();
  });
});

describe('no payload reaches the screen', () => {
  it('does not render the request payload or its secrets', async () => {
    await invoke()('fs:read-file', { path: '/etc/credentials', token: SECRET });

    const { container, list } = renderInspector();
    await waitFor(() => expect(list.getByText('fs:read-file')).toBeTruthy());

    expect(container.textContent).not.toContain(SECRET);
    expect(container.textContent).not.toContain('/etc/credentials');
  });

  it('does not render the response payload when a row is expanded', async () => {
    await invoke()('fs:read-file', { path: '/a' });

    const { container, list } = renderInspector();
    await waitFor(() => expect(list.getByText('fs:read-file')).toBeTruthy());

    // Expanding renders `JSON.stringify(msg.data)`; `data` is deliberately
    // undefined, so there is nothing to leak.
    await userEvent.click(list.getByText('fs:read-file'));

    expect(container.textContent).not.toContain(SECRET);
  });
});

describe("the Inspector's own polling does not crowd out real traffic", () => {
  it('shows no rows for the debug:* channels it polls', async () => {
    const { list } = renderInspector();

    // Two invokes per poll, every second. Recording them would evict the real
    // traffic from the 1000-entry buffer.
    await waitFor(() => expect(list.getByText('No IPC messages')).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(list.queryByText('debug:get-ipc-messages')).toBeNull();
    expect(list.queryByText('debug:get-ipc-stats')).toBeNull();
    expect(list.getByText('No IPC messages')).toBeTruthy();
  });

  it('keeps real traffic visible across several polls', async () => {
    await invoke()('git:status', { repoPath: '/r' });

    const { list } = renderInspector();
    await waitFor(() => expect(list.getByText('git:status')).toBeTruthy());

    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(list.getByText('git:status')).toBeTruthy();
    expect(screen.getByText('1 messages')).toBeTruthy();
  });
});

describe('the clear button empties what instrumentation filled', () => {
  it('returns the panel to its empty state', async () => {
    await invoke()('fs:read-file', { path: '/a' });

    const { list } = renderInspector();
    await waitFor(() => expect(list.getByText('fs:read-file')).toBeTruthy());

    // The trash button is the only one in the toolbar.
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(list.getByText('No IPC messages')).toBeTruthy());
  });
});

describe('the allowlist did not break the debug panel', () => {
  it('lets the Inspector reach both channels it needs', async () => {
    // If `debug:get-ipc-messages` or `debug:get-ipc-stats` had been left out of
    // the preload allowlist, these would reject and the panel would render empty
    // with a console error instead of rows.
    await invoke()('fs:read-file', { path: '/a' });

    await expect(invoke()('debug:get-ipc-messages', 500)).resolves.toBeInstanceOf(Array);
    await expect(invoke()('debug:get-ipc-stats')).resolves.toBeTruthy();
  });

  it('still refuses a channel outside the allowlist', async () => {
    // The bridge under the panel is the restricted one, not an open forwarder.
    await expect(invoke()('mcp:invoke-tool', {})).rejects.toThrow('IPC channel not allowed');
  });

  it('keeps the raw (non-enveloped) debug response shape', async () => {
    // `debug:*` returns raw values by design; the panel does `result.map(...)`.
    const messages = await invoke()('debug:get-ipc-messages', 500);
    expect(Array.isArray(messages)).toBe(true);
    expect(messages).not.toHaveProperty('success');
  });
});
