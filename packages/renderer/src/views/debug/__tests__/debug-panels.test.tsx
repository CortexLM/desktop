/**
 * Debug view panels: the settings contract, and empty states that explain
 * themselves.
 *
 * Baseline: `packages/renderer/src/views/debug/` was at 44.64% line coverage
 * (100/224, read from lcov.info). `DebugPanel`, `MemoryPanel` and
 * `PerformancePanel` were at 0% — invisible in the text report, which listed no
 * row for them.
 *
 * These panels talk to the real main-process handlers through a mocked
 * `ipcRenderer` transport, the same arrangement as
 * `ipc-inspector-instrumented.test.tsx`. That matters for the settings tests in
 * particular: the bugs being guarded were *disagreements between two sides*, and
 * a test that stubs the response cannot see a disagreement — it just restates
 * whatever shape the test author assumed.
 *
 * Note on the `debug:*` envelope: this domain returns RAW values, not
 * `{ success, data }`. That is deliberate and documented in the handler module;
 * the panels do `setSettings(result)` and `result.map(...)` directly. Tests below
 * assert the raw shape on purpose.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// electron mock — doubles as the IPC transport
// ---------------------------------------------------------------------------

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

const handlers = new Map<string, IpcHandler>();

const ipcMainMock = {
  handle: (channel: string, handler: IpcHandler) => handlers.set(channel, handler),
  removeHandler: (channel: string) => handlers.delete(channel),
  on: () => undefined,
  removeAllListeners: () => undefined,
};

vi.mock('electron', () => ({
  ipcMain: ipcMainMock,
  ipcRenderer: {
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`IPC channel has no registered handler: ${channel}`);
      return handler({ sender: {} }, ...args);
    },
    on: () => undefined,
    removeListener: () => undefined,
  },
  contextBridge: { exposeInMainWorld: () => undefined },
  app: {
    getPath: (name: string) => `/tmp/${name}`,
    getAppPath: () => '/app/cortex-ide',
    getVersion: () => '0.1.0',
  },
  dialog: { showSaveDialog: vi.fn(async () => ({ canceled: true })) },
  BrowserWindow: { getAllWindows: () => [], fromWebContents: () => null },
  default: {},
}));

/**
 * recharts renders through an SVG measured against a container that jsdom always
 * reports as 0x0, so `ResponsiveContainer` renders nothing. The chart internals
 * are not what these tests are about; the stub keeps the data-dependent branches
 * (`chartData.length > 0`) meaningful while letting the sidebar assertions run.
 */
vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart">{children}</div>
  );
  const Nothing = () => null;
  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    Line: Nothing,
    XAxis: Nothing,
    YAxis: Nothing,
    CartesianGrid: Nothing,
    Tooltip: Nothing,
    Legend: Nothing,
  };
});

// ---------------------------------------------------------------------------
// Real modules
// ---------------------------------------------------------------------------

const { registerDebugHandlers, resetDebugSettings } = await import(
  '../../../../../main/src/ipc/handlers/debug-handlers'
);
const { ipcMonitor } = await import('../../../../../main/src/services/ipc-monitor');
const { performanceMonitor } = await import(
  '../../../../../main/src/services/performance-monitor'
);
const { debugService } = await import('../../../../../main/src/services/debug-service');
const { profiler } = await import('../../../../../main/src/performance/profiler');
const { logger } = await import('@cortex-ide/shared');

const { SettingsPanel } = await import('../SettingsPanel');
const { ConsolePanel } = await import('../ConsolePanel');
const { MemoryPanel } = await import('../MemoryPanel');
const { PerformancePanel } = await import('../PerformancePanel');
const { DebugPanel } = await import('../DebugPanel');

// ---------------------------------------------------------------------------
// window.electron — the renderer's view of the transport
// ---------------------------------------------------------------------------

const { ipcRenderer } = await import('electron');

function installElectronBridge(): void {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    writable: true,
    value: {
      invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    },
  });
}

let alertSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  handlers.clear();
  resetDebugSettings();
  ipcMonitor.clear();
  performanceMonitor.clear();
  profiler.clear();
  debugService.updateSettings({ enableIpcMonitoring: true });

  // `logger.clear()` LAST. `performanceMonitor.clear()` and
  // `debugService.updateSettings()` both log, so clearing the logger before them
  // leaves entries behind — and the ConsolePanel tests assert exact counts. A
  // "1 logs" footer where the test expected "0 logs" was the symptom.
  logger.clear();

  registerDebugHandlers();
  installElectronBridge();

  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  vi.restoreAllMocks();
});

// ===========================================================================
// SettingsPanel: the shape contract
// ===========================================================================

describe('the settings panel gets past its loading state', () => {
  /**
   * Regression: `debug:get-settings` answering with the service's own options
   * object (`DebugServiceOptions`) or with the `{ success, data }` envelope.
   *
   * Either one leaves `settings.enabled` undefined and — because the panel keys
   * its whole render off `if (!settings)` and then reads
   * `Object.entries(settings.categories)` — produces a permanent spinner or a
   * TypeError. The spinner has no text, so it is asserted by its element.
   */
  it('replaces the spinner with the form, rather than spinning forever', async () => {
    const { container } = render(<SettingsPanel />);

    // Pre-fix state: this element never went away.
    expect(container.querySelector('.animate-spin')).toBeTruthy();

    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  /**
   * Regression: the service shape has no `categories`, so
   * `Object.entries(settings.categories)` throws and takes the panel down.
   */
  it('renders one checkbox per entry in settings.categories', async () => {
    render(<SettingsPanel />);

    await waitFor(() => expect(screen.getByText('Log Categories')).toBeTruthy());

    // The six categories the shared DebugSettings contract declares.
    for (const category of ['ipc', 'performance', 'network', 'database', 'ai', 'git']) {
      expect(screen.getByText(category)).toBeTruthy();
    }
  });

  /**
   * Regression: `enabled`, `logRotation` and `maxLogSize` are fields the main
   * service does not hold. Projecting the service object over the response drops
   * them, and the controlled inputs fall back to undefined — an unchecked box and
   * an empty number field regardless of the stored value.
   */
  it('reflects enabled, logLevel, maxLogSize and logRotation in the form', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());

    const enabled = screen.getByText('Enable Debug Mode').closest('label')
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const rotation = screen.getByText('Log Rotation').closest('label')
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const maxSize = screen.getByDisplayValue('10') as HTMLInputElement;

    // Defaults from DEFAULT_SETTINGS: enabled false, rotation true, size 10.
    expect(enabled.checked).toBe(false);
    expect(rotation.checked).toBe(true);
    expect(maxSize.value).toBe('10');
    expect(maxSize.type).toBe('number');
  });

  it('keeps the raw response shape — no { success, data } envelope', async () => {
    const result = await window.electron.invoke('debug:get-settings');

    // Asserted deliberately: the panel does `setSettings(result)`, so the raw
    // shape is the contract for this domain.
    expect(result).not.toHaveProperty('success');
    expect(result).not.toHaveProperty('data');
    expect(result).toHaveProperty('categories');
    expect(result).toHaveProperty('enabled');
  });
});

describe('the settings panel renders the system information block', () => {
  /**
   * Regression: `systemInfo.logs` ("Logs Directory").
   *
   * The panel reads a field its own local `SystemInfo` interface does not
   * declare. The handler supplies it; if it stops doing so, the row renders
   * blank. The type gap is real and separate — a compile-time hole that no
   * runtime test can close — but the value reaching the screen is testable.
   */
  it('renders the logs directory row with a value', async () => {
    render(<SettingsPanel />);

    await waitFor(() => expect(screen.getByText('System Information')).toBeTruthy());

    const row = screen.getByText('Logs Directory').parentElement as HTMLElement;
    const value = row.querySelector('.font-mono') as HTMLElement;

    // `/tmp/logs` comes from the electron `app.getPath` mock above.
    expect(value.textContent).toBe('/tmp/logs');
    expect(value.textContent).not.toBe('');
  });

  it('renders every other field the panel displays', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(screen.getByText('System Information')).toBeTruthy());

    for (const label of ['Version', 'Platform', 'Electron', 'Chrome', 'Node', 'V8', 'App Path', 'User Data']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    expect(screen.getByText('0.1.0')).toBeTruthy();
    expect(screen.getByText('/app/cortex-ide')).toBeTruthy();
  });
});

// ===========================================================================
// The two-click Save trap
// ===========================================================================

describe('saving the debug settings does not switch recording off', () => {
  /**
   * Regression: the two-click trap.
   *
   * `enableIpcMonitoring` was derived from `enabled && categories.ipc`. The debug
   * panel is reachable without enabling debug mode, and `enabled` is false by
   * default — so opening the settings tab and pressing Save, which sends the
   * settings back unchanged, turned IPC recording off and left the Inspector
   * permanently empty. Measured before the fix: 1 message recorded, 0 after.
   *
   * The main-process side of this is guarded in
   * `packages/main/.../ipc-instrumentation.test.ts`. What was NOT covered is the
   * path a user actually takes: mount the real panel, click the real button. This
   * test drives the DOM, so it also fails if the button stops being wired.
   */
  it('keeps IPC monitoring enabled after a Save with debug mode off', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());

    // Precondition: the box the user never touched is unchecked.
    const enabled = screen.getByText('Enable Debug Mode').closest('label')
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(enabled.checked).toBe(false);

    expect(debugService.getSettings().enableIpcMonitoring).toBe(true);

    await userEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Settings saved successfully'));

    // The measurement that named the bug.
    expect(debugService.getSettings().enableIpcMonitoring).toBe(true);
  });

  it('records IPC traffic after the Save, which is the symptom that was reported', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());

    await userEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    // Straight at the monitor: this is "1 message before Save, 0 after" turned
    // into an assertion.
    ipcMonitor.recordMessage('fs:read-file', 'send', 3);
    expect(ipcMonitor.getMessages()).toHaveLength(1);
  });

  it('still lets the ipc category switch recording off deliberately', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(screen.getByText('Log Categories')).toBeTruthy());

    // The discoverable off switch must keep working, or the fix has simply
    // removed the control instead of correcting it.
    const ipcBox = screen.getByText('ipc').closest('label')
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await userEvent.click(ipcBox);
    await userEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(debugService.getSettings().enableIpcMonitoring).toBe(false));
  });

  it('round-trips an edited value through update and reload', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());

    await userEvent.selectOptions(
      screen.getByDisplayValue('Info (Info and above)'),
      'error'
    );
    await userEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    // Reset re-reads from the handler; the edited value must come back, not the
    // default.
    await userEvent.click(screen.getByText('Reset'));

    await waitFor(() =>
      expect((screen.getByDisplayValue('Error (Errors only)') as HTMLSelectElement).value).toBe(
        'error'
      )
    );
  });

  it('does not send maxLogSize to the service, whose unit is entries not MB', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());

    const before = debugService.getSettings().maxLogSize;

    const maxSize = screen.getByDisplayValue('10');
    fireEvent.change(maxSize, { target: { value: '50' } });
    await userEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    // Same name, incompatible units: the field is MB on screen and a count of
    // entries in the service. Forwarding 50 would shrink the log buffer from
    // 10 000 entries to 50.
    expect(debugService.getSettings().maxLogSize).toBe(before);
  });

  it('reports a failed save instead of claiming success', async () => {
    render(<SettingsPanel />);
    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());

    handlers.set('debug:update-settings', () => {
      throw new Error('disk full');
    });

    await userEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to save settings'));
    expect(alertSpy).not.toHaveBeenCalledWith('Settings saved successfully');
  });
});

// ===========================================================================
// ConsolePanel
// ===========================================================================

describe('the console panel', () => {
  it('renders log entries returned as a bare array', async () => {
    logger.info('startup', 'main process ready');
    logger.error('db', 'migration failed');

    render(<ConsolePanel />);

    await waitFor(() => expect(screen.getByText('main process ready')).toBeTruthy());
    expect(screen.getByText('migration failed')).toBeTruthy();
    expect(screen.queryByText('No logs to display')).toBeNull();
  });

  it('says there are no logs when there are none', async () => {
    render(<ConsolePanel />);

    await waitFor(() => expect(screen.getByText('No logs to display')).toBeTruthy());
    expect(screen.getByText('0 logs')).toBeTruthy();
  });

  it('filters by level and reports both counts in the footer', async () => {
    logger.info('a', 'an info line');
    logger.error('b', 'an error line');

    render(<ConsolePanel />);
    await waitFor(() => expect(screen.getByText('2 logs')).toBeTruthy());

    await userEvent.selectOptions(screen.getByDisplayValue('All Levels'), 'error');

    // The two counters mean different things: filtered vs. total. Collapsing
    // them would make a filter look like data loss.
    expect(screen.getByText('1 logs')).toBeTruthy();
    expect(screen.getByText('2 total')).toBeTruthy();
    expect(screen.queryByText('an info line')).toBeNull();
  });

  it('filters by free-text search across message and category', async () => {
    logger.info('database', 'connected');
    logger.info('network', 'request sent');

    render(<ConsolePanel />);
    await waitFor(() => expect(screen.getByText('2 logs')).toBeTruthy());

    await userEvent.type(screen.getByPlaceholderText('Search logs...'), 'datab');

    expect(screen.getByText('connected')).toBeTruthy();
    expect(screen.queryByText('request sent')).toBeNull();
  });

  it('filters by source, hiding entries from the other side', async () => {
    logger.info('a', 'an entry');

    render(<ConsolePanel />);
    await waitFor(() => expect(screen.getByText('an entry')).toBeTruthy());

    // `logger` stamps `source` by probing for `window` in globalThis. Under jsdom
    // that probe finds one, so entries created here are tagged 'renderer' even
    // though the same singleton runs in main in production. So 'main' is the
    // filter that must empty the list, not 'renderer'.
    expect(logger.getLogs()[0].source).toBe('renderer');

    await userEvent.selectOptions(screen.getByDisplayValue('All Sources'), 'main');

    expect(screen.queryByText('an entry')).toBeNull();
    expect(screen.getByText('No logs to display')).toBeTruthy();

    // And selecting the matching source brings it back — without this half the
    // test would pass on a filter that rejects everything.
    await userEvent.selectOptions(screen.getByDisplayValue('Main'), 'renderer');
    expect(screen.getByText('an entry')).toBeTruthy();
  });

  it('renders a timestamp rather than Invalid Date', async () => {
    logger.info('a', 'a line');

    render(<ConsolePanel />);

    await waitFor(() => expect(screen.getByText('a line')).toBeTruthy());
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it('empties the list through the clear button', async () => {
    logger.info('a', 'a line');

    render(<ConsolePanel />);
    await waitFor(() => expect(screen.getByText('a line')).toBeTruthy());

    // The trash button is the only <button> in the toolbar.
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText('No logs to display')).toBeTruthy());
    expect(logger.getLogs()).toHaveLength(0);
  });
});

// ===========================================================================
// MemoryPanel
// ===========================================================================

describe('the memory panel', () => {
  /**
   * These tests stub `debug:get-memory` rather than driving the real monitors.
   *
   * Neither `performanceMonitor` nor `profiler` accepts an injected snapshot —
   * both only sample `process.memoryUsage()` — so real values would be whatever
   * the test process happens to be using, and a byte/MB conversion cannot be
   * asserted against an unknown number. The handler's own shape is covered on the
   * main side; what is under test here is the panel's arithmetic and its empty
   * state.
   */
  const snapshot = (heapUsed: number, heapTotal: number, external = 0, rss = 0) => ({
    timestamp: Date.now(),
    heapUsed,
    heapTotal,
    external,
    rss,
  });

  const stubMemory = (snapshots: unknown[]): void => {
    handlers.set('debug:get-memory', () => snapshots);
  };

  it('says there is no data when the monitor is empty', async () => {
    render(<MemoryPanel />);

    await waitFor(() => expect(screen.getByText('No memory data')).toBeTruthy());
  });

  it('renders the latest snapshot converted from bytes to MB', async () => {
    stubMemory([
      snapshot(50 * 1024 * 1024, 100 * 1024 * 1024, 5 * 1024 * 1024, 200 * 1024 * 1024),
    ]);

    render(<MemoryPanel />);

    await waitFor(() => expect(screen.getByText('50.00 MB')).toBeTruthy());
    expect(screen.getByText('100.00 MB')).toBeTruthy();
    expect(screen.getByText('5.00 MB')).toBeTruthy();
    expect(screen.getByText('200.00 MB')).toBeTruthy();
    expect(screen.queryByText('No memory data')).toBeNull();
  });

  it('shows the last snapshot, not the first', async () => {
    stubMemory([
      snapshot(10 * 1024 * 1024, 100 * 1024 * 1024),
      snapshot(75 * 1024 * 1024, 100 * 1024 * 1024),
    ]);

    render(<MemoryPanel />);

    // `snapshots[snapshots.length - 1]`; an off-by-one here would report a stale
    // heap while the chart shows the current one.
    await waitFor(() => expect(screen.getByText('75.00 MB')).toBeTruthy());
    expect(screen.queryByText('10.00 MB')).toBeNull();
  });

  /**
   * Regression: bytes rendered as if they were already megabytes.
   *
   * The snapshot is in bytes and the panel divides twice. Dropping one division
   * shows "52428800.00 MB" for a 50 MB heap; dropping the unit switch shows MB
   * where GB is meant.
   */
  it('switches to GB above 1000 MB', async () => {
    stubMemory([snapshot(2 * 1024 * 1024 * 1024, 4 * 1024 * 1024 * 1024)]);

    render(<MemoryPanel />);

    await waitFor(() => expect(screen.getByText('2.00 GB')).toBeTruthy());
    expect(screen.getByText('4.00 GB')).toBeTruthy();
  });

  it('renders the heap-used percentage of heap total', async () => {
    stubMemory([snapshot(25 * 1024 * 1024, 100 * 1024 * 1024)]);

    render(<MemoryPanel />);

    await waitFor(() => expect(screen.getByText('25.0% of heap')).toBeTruthy());
  });

  it('renders a real snapshot from the actual handler without NaN', async () => {
    // No stub: the real `debug:get-memory` handler, fed by the real profiler.
    // The value is unknown, so the assertion is on the format rather than the
    // number — this is the test that would catch the handler returning a shape
    // the panel cannot divide.
    profiler.takeMemorySnapshot();

    render(<MemoryPanel />);

    await waitFor(() => expect(screen.getByText('Heap Used')).toBeTruthy());
    const sidebar = screen.getByText('Current Memory').parentElement as HTMLElement;
    expect(sidebar.textContent).not.toContain('NaN');
    // Four cards (heap used / total / external / RSS), so all four are matched
    // rather than assuming a single formatted value.
    expect(screen.getAllByText(/^\d+\.\d{2} (MB|GB)$/).length).toBeGreaterThanOrEqual(4);
  });

  it('renders the system info block', async () => {
    render(<MemoryPanel />);

    await waitFor(() => expect(screen.getByText('System Info')).toBeTruthy());
    expect(screen.getByText('Platform:')).toBeTruthy();
    expect(screen.getByText('Node:')).toBeTruthy();
  });
});

// ===========================================================================
// PerformancePanel — the second bug found here
// ===========================================================================

describe('the performance panel opens on a category that has data', () => {
  /**
   * Regression: the hardcoded initial category.
   *
   * Found while writing this suite. `selectedCategory` started as `'timing'`, a
   * value no producer emits: the single production `recordMetric` call uses
   * `'ipc'`, and the profiler's categories are ipc | database | render | memory |
   * cpu | startup | custom. `'timing'` exists only in test files. So the filter
   * `m.category === selectedCategory` matched nothing and the panel opened on
   * "No performance data" while metrics sat in the monitor — the same
   * "empty for the wrong reason" failure as the IPC Inspector.
   */
  it('charts metrics that exist under a category the panel did not hardcode', async () => {
    performanceMonitor.recordMetric('ipc', 'fs:read-file', 12.5, 'ms');
    performanceMonitor.recordMetric('ipc', 'fs:read-file', 8.5, 'ms');

    render(<PerformancePanel />);

    // Pre-fix: this stayed on screen because 'timing' matched nothing.
    await waitFor(() => expect(screen.queryByTestId('performance-empty')).toBeNull());
    expect(screen.getByText('fs:read-file')).toBeTruthy();
    expect((screen.getByTestId('metric-category') as HTMLSelectElement).value).toBe('ipc');
  });

  it('computes min, max, avg and count for the selected category', async () => {
    performanceMonitor.recordMetric('ipc', 'db:query', 10, 'ms');
    performanceMonitor.recordMetric('ipc', 'db:query', 20, 'ms');
    performanceMonitor.recordMetric('ipc', 'db:query', 30, 'ms');

    render(<PerformancePanel />);

    await waitFor(() => expect(screen.getByText('db:query')).toBeTruthy());
    const card = screen.getByTitle('db:query').closest('div')?.parentElement as HTMLElement;

    expect(within(card).getByText('10.00')).toBeTruthy();
    expect(within(card).getByText('30.00')).toBeTruthy();
    expect(within(card).getByText('20.00')).toBeTruthy();
    expect(within(card).getByText('3')).toBeTruthy();
  });

  /**
   * The empty state must distinguish "nothing is measured" from "this category
   * happens to be empty" — two situations that call for different reactions.
   */
  it('distinguishes no metrics at all from an empty category', async () => {
    render(<PerformancePanel />);

    await waitFor(() =>
      expect(screen.getByTestId('performance-empty').textContent).toBe('No performance data')
    );
  });

  it('lets the user switch category, and says which one is empty', async () => {
    performanceMonitor.recordMetric('ipc', 'fs:read-file', 5, 'ms');
    performanceMonitor.recordMetric('database', 'select', 7, 'ms');

    render(<PerformancePanel />);
    await waitFor(() => expect(screen.getByText('fs:read-file')).toBeTruthy());

    await userEvent.selectOptions(screen.getByTestId('metric-category'), 'database');

    expect(screen.getByText('select')).toBeTruthy();
    expect(screen.queryByText('fs:read-file')).toBeNull();
  });

  it('falls back to an available category when the chosen one disappears', async () => {
    performanceMonitor.recordMetric('ipc', 'a', 1, 'ms');
    performanceMonitor.recordMetric('database', 'b', 2, 'ms');

    render(<PerformancePanel />);
    await waitFor(() => expect(screen.getByText('a')).toBeTruthy());

    await userEvent.selectOptions(screen.getByTestId('metric-category'), 'database');
    expect(screen.getByText('b')).toBeTruthy();

    // The category vanishes from the data. Staying pinned to it would show an
    // empty chart with no indication that other data is available.
    performanceMonitor.clear();
    performanceMonitor.recordMetric('ipc', 'a', 1, 'ms');

    await waitFor(
      () => expect((screen.getByTestId('metric-category') as HTMLSelectElement).value).toBe('ipc'),
      { timeout: 4000 }
    );
    expect(screen.getByText('a')).toBeTruthy();
  });

  it('offers a labelled placeholder when there are no categories at all', async () => {
    render(<PerformancePanel />);

    await waitFor(() => expect(screen.getByText('No categories')).toBeTruthy());
  });
});

// ===========================================================================
// DebugPanel container
// ===========================================================================

describe('the debug panel container', () => {
  it('mounts on the console tab', async () => {
    render(<DebugPanel />);

    expect(screen.getByText('Debug Panel')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('No logs to display')).toBeTruthy());
  });

  /**
   * Radix `TabsTrigger` activates on `mousedown`, not `click`. `userEvent.click`
   * dispatches pointer events that Radix's trigger does not act on here, so the
   * tab would never change and the test would assert against the console panel
   * while believing it was on the IPC tab. Ordinary `<button>`s in this repo do
   * respond to `userEvent.click` — this is specific to `TabsTrigger`.
   */
  it('switches to the IPC Inspector tab', async () => {
    render(<DebugPanel />);

    fireEvent.mouseDown(screen.getByText('IPC Inspector'));

    await waitFor(() => expect(screen.getByText('Channel Statistics')).toBeTruthy());
  });

  it('switches to the settings tab and loads the form', async () => {
    render(<DebugPanel />);

    // The settings trigger is an icon-only button; it is the last trigger.
    const triggers = screen.getAllByRole('tab');
    fireEvent.mouseDown(triggers[triggers.length - 1]);

    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());
  });

  it('exports logs and reports the path it wrote to', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    // The real handler writes a file. `app.getPath('userData')` is mocked to
    // `/tmp/userData`, which does not exist, so the write would fail and the
    // handler would answer `{ success: false }` — a red test about the
    // filesystem rather than about the panel. The directory is created so the
    // real success path is the one exercised.
    const { mkdir, rm } = await import('node:fs/promises');
    await mkdir('/tmp/userData', { recursive: true });

    render(<DebugPanel />);

    // Download is the first toolbar button.
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);

    // `{ success, path }` is the shape DebugPanel reads; a bare boolean or an
    // envelope would log nothing.
    await waitFor(() =>
      expect(logSpy).toHaveBeenCalledWith(
        'Logs exported to:',
        expect.stringContaining('/tmp/userData/cortex-logs-')
      )
    );

    const written = logSpy.mock.calls[0][1] as string;
    await rm(written, { force: true });
    logSpy.mockRestore();
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = vi.fn();
    render(<DebugPanel onClose={onClose} />);

    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[1]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits the close button when no handler is given', () => {
    render(<DebugPanel />);

    // Only the export button remains in the header.
    const header = screen.getByText('Debug Panel').closest('div')?.parentElement as HTMLElement;
    expect(within(header).getAllByRole('button')).toHaveLength(1);
  });
});
