/**
 * Round-trip tests for the `debug:*` family: real panel -> real handler -> DOM.
 *
 * This domain is the one where the shapes disagreed most, so it gets its own
 * file:
 *
 * - The `debug:*` channels return the value RAW, not the `{ success, data }`
 *   envelope every other domain uses, because the panels consume the result
 *   directly (`setSettings(result)`, `result.map(...)`).
 * - `DebugSettings` exists twice with the same name and different fields: the
 *   renderer imports the one from `@cortex-ide/shared` (`enabled`, `categories`,
 *   `logRotation`), while `services/debug-service.ts` declares a structurally
 *   different type. Returning the service's version leaves `SettingsPanel`
 *   spinning forever on `if (!settings)` and throws inside
 *   `Object.entries(settings.categories)`.
 *
 * Both of those are invisible to a handler-only test and to a screenshot, but
 * they are visible here: the panel either renders its controls or it does not.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// electron mock
// ---------------------------------------------------------------------------

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

const handlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
    on: () => undefined,
    removeAllListeners: () => undefined,
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
// Real handler module + real monitors + real panels
// ---------------------------------------------------------------------------

const { registerDebugHandlers, resetDebugSettings } = await import(
  '../../../../main/src/ipc/handlers/debug-handlers'
);
const { ipcMonitor } = await import('../../../../main/src/services/ipc-monitor');
const { performanceMonitor } = await import('../../../../main/src/services/performance-monitor');
const { logger } = await import('@cortex-ide/shared');

const { SettingsPanel } = await import('../../views/debug/SettingsPanel');
const { IPCInspector } = await import('../../views/debug/IPCInspector');
const { ConsolePanel } = await import('../../views/debug/ConsolePanel');
const { DebugProvider, useDebug } = await import('../../contexts/DebugContext');

/**
 * Mirrors the preload's `window.electron.invoke`, which forwards every argument
 * after the channel. `debug:get-metrics` relies on that: the panel calls it with
 * `(undefined, 500)`.
 */
function installElectronBridge(): void {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    writable: true,
    value: {
      invoke: async (channel: string, ...args: unknown[]) => {
        const handler = handlers.get(channel);
        if (!handler) {
          throw new Error(`IPC channel has no registered handler: ${channel}`);
        }
        return handler({ sender: {} }, ...args);
      },
    },
  });
}

beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  resetDebugSettings();
  ipcMonitor.clear();
  performanceMonitor.clear();
  logger.clear();
  registerDebugHandlers();
  installElectronBridge();
});

// ===========================================================================

describe('debug settings: panel <-> handler round trip', () => {
  it('renders its controls instead of spinning forever on the loading state', async () => {
    render(<SettingsPanel />);

    // `if (!settings) return <spinner/>` — reaching this heading proves the
    // panel received something it could assign.
    await waitFor(() => {
      expect(screen.getByText('Debug Settings')).toBeTruthy();
    });
  });

  it('renders every category checkbox from settings.categories', async () => {
    render(<SettingsPanel />);

    await waitFor(() => expect(screen.getByText('Log Categories')).toBeTruthy());

    // Object.entries(settings.categories) — a missing `categories` is a
    // TypeError, and the service-shaped settings have no such field.
    for (const category of ['ipc', 'performance', 'network', 'database', 'ai', 'git']) {
      expect(screen.getByText(category)).toBeTruthy();
    }
  });

  it('reflects enabled / logLevel / maxLogSize / logRotation in the form', async () => {
    render(<SettingsPanel />);

    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());

    // Each of these is bound to a field the main service does not expose.
    const enable = screen.getByLabelText(/Enable Debug Mode/i, { selector: 'input' });
    expect(enable).toBeInstanceOf(HTMLInputElement);
    expect((enable as HTMLInputElement).checked).toBe(false);

    expect(screen.getByDisplayValue('10')).toBeTruthy();

    const rotation = screen.getByLabelText(/Log Rotation/i, { selector: 'input' });
    expect((rotation as HTMLInputElement).checked).toBe(true);
  });

  it('saving then reloading keeps the fields the main service does not store', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SettingsPanel />);

    await waitFor(() => expect(screen.getByText('Debug Settings')).toBeTruthy());

    await user.click(screen.getByLabelText(/Enable Debug Mode/i, { selector: 'input' }));
    // `handleSave` alerts on success; jsdom has no implementation.
    window.alert = vi.fn();
    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => expect(window.alert).toHaveBeenCalled());

    unmount();
    render(<SettingsPanel />);

    // A fresh mount re-reads debug:get-settings. Without handler-side state the
    // toggle would come back false and the user's save would be silently lost.
    await waitFor(() => {
      const enable = screen.getByLabelText(/Enable Debug Mode/i, { selector: 'input' });
      expect((enable as HTMLInputElement).checked).toBe(true);
    });
  });

  it('renders the system information block, including the logs directory', async () => {
    render(<SettingsPanel />);

    await waitFor(() => expect(screen.getByText('System Information')).toBeTruthy());

    expect(screen.getByText('0.1.0')).toBeTruthy();
    expect(screen.getByText('/app/cortex-ide')).toBeTruthy();
    // `SettingsPanel` renders `systemInfo.logs` even though its local interface
    // omits the field; the handler supplies it so the row is not blank.
    expect(screen.getByText('Logs Directory')).toBeTruthy();
    expect(screen.getByText('/tmp/logs')).toBeTruthy();
  });
});

// ===========================================================================

describe('debug context: toggle round trip', () => {
  function Probe() {
    const { enabled, toggleDebugMode, settings } = useDebug();
    return (
      <div>
        <span data-testid="enabled">{String(enabled)}</span>
        <span data-testid="loaded">{settings ? 'loaded' : 'pending'}</span>
        <button onClick={toggleDebugMode}>toggle</button>
      </div>
    );
  }

  it('loads settings and reads `enabled` off them', async () => {
    render(
      <DebugProvider>
        <Probe />
      </DebugProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loaded')?.textContent ?? "").toContain('loaded'));
    // `settings?.enabled || false` — a service-shaped response has no `enabled`,
    // which would pin this to "false" forever.
    expect(screen.getByTestId('enabled')?.textContent ?? "").toContain('false');
  });

  it('toggling debug mode round-trips through update-settings', async () => {
    const user = userEvent.setup();
    render(
      <DebugProvider>
        <Probe />
      </DebugProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loaded')?.textContent ?? "").toContain('loaded'));
    await user.click(screen.getByRole('button', { name: 'toggle' }));

    await waitFor(() => expect(screen.getByTestId('enabled')?.textContent ?? "").toContain('true'));

    // The partial `{ enabled }` payload must not wipe the other fields.
    const settings = (await handlers.get('debug:get-settings')!({ sender: {} })) as {
      enabled: boolean;
      categories: Record<string, boolean>;
    };
    expect(settings.enabled).toBe(true);
    expect(settings.categories.git).toBe(true);
  });
});

// ===========================================================================

describe('IPC inspector: monitor -> handler -> panel', () => {
  it('renders recorded messages with a direction the panel understands', async () => {
    ipcMonitor.recordMessage('fs:read-file', 'send', 4.2);
    ipcMonitor.recordMessage('event:file-change', 'receive');

    render(<IPCInspector />);

    // Each channel appears twice — once in the message list, once in the
    // per-channel stats table — so the queries are on all matches.
    await waitFor(() => {
      expect(screen.getAllByText('fs:read-file').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('event:file-change').length).toBeGreaterThan(0);

    // The monitor stores 'send' | 'receive'; the panel colours and filters on
    // 'renderer->main' | 'main->renderer'. Passing the raw value through would
    // render every row as an incoming arrow.
    expect(screen.getByText('→')).toBeTruthy();
    expect(screen.getByText('←')).toBeTruthy();
  });

  it('renders the duration the monitor recorded', async () => {
    ipcMonitor.recordMessage('git:status', 'send', 12.34);

    render(<IPCInspector />);

    // `msg.duration.toFixed(1)`
    await waitFor(() => expect(screen.getByText('12.3ms')).toBeTruthy());
  });

  it('renders per-channel stats without NaN when no duration was recorded', async () => {
    ipcMonitor.recordMessage('git:status', 'send');

    render(<IPCInspector />);

    await waitFor(() => expect(screen.getAllByText('git:status').length).toBeGreaterThan(0));
    // avgDuration goes through toFixed(); NaN would render as "NaN".
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('filtering by direction keeps the mapped values usable', async () => {
    const user = userEvent.setup();
    ipcMonitor.recordMessage('fs:read-file', 'send', 1);
    ipcMonitor.recordMessage('event:file-change', 'receive', 1);

    render(<IPCInspector />);

    // Both arrows present = both directions mapped and rendered.
    await waitFor(() => expect(screen.getByText('→')).toBeTruthy());
    expect(screen.getByText('←')).toBeTruthy();

    await user.selectOptions(screen.getByRole('combobox'), 'renderer->main');

    // The filter compares `msg.direction` against 'renderer->main'. With the
    // monitor's raw 'send' | 'receive' values nothing would match and the list
    // would go empty — here the outgoing row survives and the incoming one is
    // filtered out. (The stats table is unaffected by the filter, so this is
    // asserted on the arrows, which only the message rows render.)
    await waitFor(() => expect(screen.getByText('→')).toBeTruthy());
    expect(screen.queryByText('←')).toBeNull();
  });
});

// ===========================================================================

describe('console panel: logger -> handler -> panel', () => {
  it('renders log entries returned as a bare array', async () => {
    logger.info('ipc', 'handler registered for git:stash-list');
    logger.error('git', 'stash apply failed');

    render(<ConsolePanel />);

    // `result.map(...)` on an envelope would throw "result.map is not a
    // function" and leave the panel empty.
    await waitFor(() => {
      expect(screen.getByText(/handler registered for git:stash-list/)).toBeTruthy();
    });
    expect(screen.getByText(/stash apply failed/)).toBeTruthy();
  });
});

// ===========================================================================

describe('debug channel coverage', () => {
  it('every debug channel the renderer invokes has a registered handler', () => {
    // Collected from the renderer sources (DebugContext + the five panels).
    for (const channel of [
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
    ]) {
      expect(handlers.has(channel)).toBe(true);
    }
  });
});
