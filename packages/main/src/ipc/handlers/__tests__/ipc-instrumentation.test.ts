/**
 * IPC instrumentation — feeds `ipcMonitor` / `performanceMonitor`.
 *
 * Context: neither monitor had a single producer in `packages/main/`. No
 * `recordMessage`, no `recordMetric`, and `ipcMonitor.initialize()` was never
 * called despite its own doc comment claiming it ran at startup. The IPC
 * Inspector therefore rendered empty.
 *
 * These tests drive the instrumentation through the real registration path
 * (`withIpcInstrumentation` patching `ipcMain.handle`), then read the monitors
 * back, so they fail if the wrapper stops recording — not merely if the recording
 * code disappears.
 *
 * Written for vitest. `electron` is mocked by the global setup file
 * (`test/vitest-setup-main.ts`).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ipcMainMock, registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

import {
  withIpcInstrumentation,
  __testing,
} from '../shared/ipc-instrumentation';
import { ipcMonitor } from '../../../services/ipc-monitor';
import { performanceMonitor } from '../../../services/performance-monitor';
import { debugService } from '../../../services/debug-service';

/** Invokes a registered handler the way the main process would. */
async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = registeredHandlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return (handler as (event: unknown, ...rest: unknown[]) => unknown)({}, ...args);
}

beforeEach(() => {
  resetElectronMock();
  ipcMonitor.clear();
  performanceMonitor.clear();
  debugService.updateSettings({ enableIpcMonitoring: true });
});

describe('withIpcInstrumentation wraps registration', () => {
  it('registers the channel on ipcMain unchanged', () => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('fs:read-file', async () => ({ success: true, data: {} }));
    });

    expect(registeredHandlers.has('fs:read-file')).toBe(true);
  });

  it('restores the original ipcMain.handle afterwards', () => {
    const before = ipcMainMock.handle;
    withIpcInstrumentation(() => {
      ipcMainMock.handle('git:status', async () => ({ success: true }));
    });

    // A permanent monkey-patch would silently instrument any later
    // `ipcMain.handle` — a test's own stub, a plugin's handler.
    expect(ipcMainMock.handle).toBe(before);
  });

  it('restores ipcMain.handle even when registration throws', () => {
    const before = ipcMainMock.handle;

    expect(() =>
      withIpcInstrumentation(() => {
        throw new Error('domain registration failed');
      })
    ).toThrow('domain registration failed');

    expect(ipcMainMock.handle).toBe(before);
  });

  it('passes through the handler return value', async () => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('db:query', async () => ({ success: true, data: { rows: [1, 2] } }));
    });

    expect(await invoke('db:query', { sql: 'SELECT 1' })).toEqual({
      success: true,
      data: { rows: [1, 2] },
    });
  });

  it('forwards every argument, not just the first', async () => {
    const spy = vi.fn(async () => []);
    withIpcInstrumentation(() => {
      ipcMainMock.handle('perf:multi', spy as never);
    });

    // `debug:get-metrics` is invoked as (event, category, limit): a wrapper that
    // forwarded only one payload would drop the limit.
    await invoke('perf:multi', 'timing', 500);
    expect(spy).toHaveBeenCalledWith({}, 'timing', 500);
  });

  it('propagates a thrown error to the caller', async () => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('git:push', async () => {
        throw new Error('remote rejected');
      });
    });

    await expect(invoke('git:push', {})).rejects.toThrow('remote rejected');
  });
});

describe('ipcMonitor is fed', () => {
  beforeEach(() => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('fs:read-file', async () => ({ success: true, data: { content: 'x' } }));
      ipcMainMock.handle('git:status', async () => ({ success: true, data: { branch: 'main' } }));
      ipcMainMock.handle('db:execute', async () => ({
        success: false,
        error: { code: 'DB_ERROR', message: 'constraint' },
      }));
      ipcMainMock.handle('git:commit', async () => {
        throw new Error('boom');
      });
    });
  });

  it('records a message per invoke', async () => {
    expect(ipcMonitor.getMessages()).toHaveLength(0);

    await invoke('fs:read-file', { path: '/a' });
    await invoke('git:status', { repoPath: '/r' });

    expect(ipcMonitor.getMessages()).toHaveLength(2);
  });

  it('records the channel name', async () => {
    await invoke('fs:read-file', { path: '/a' });
    expect(ipcMonitor.getMessages()[0].channel).toBe('fs:read-file');
  });

  it("records direction 'send', which debug-handlers maps to 'renderer->main'", async () => {
    // The monitor's own vocabulary is 'send' | 'receive'; the panel filters on
    // 'renderer->main' | 'main->renderer' and `toSharedIPCMessage` already
    // translates. Recording 'send' feeds that single existing translation
    // instead of stacking a second one.
    await invoke('fs:read-file', { path: '/a' });
    expect(ipcMonitor.getMessages()[0].direction).toBe('send');
  });

  it('records a timestamp', async () => {
    const before = Date.now();
    await invoke('fs:read-file', { path: '/a' });
    const { timestamp } = ipcMonitor.getMessages()[0];

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('records a duration', async () => {
    await invoke('fs:read-file', { path: '/a' });
    const { duration } = ipcMonitor.getMessages()[0];

    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('records a message even when the handler throws', async () => {
    await expect(invoke('git:commit', {})).rejects.toThrow('boom');
    expect(ipcMonitor.getMessages().map((m) => m.channel)).toContain('git:commit');
  });

  it('records a message when the handler returns a failure envelope', async () => {
    await invoke('db:execute', { statements: [] });
    expect(ipcMonitor.getMessages().map((m) => m.channel)).toContain('db:execute');
  });

  it('feeds channel stats the Inspector sidebar reads', async () => {
    await invoke('fs:read-file', { path: '/a' });
    await invoke('fs:read-file', { path: '/b' });
    await invoke('git:status', { repoPath: '/r' });

    const stats = ipcMonitor.getChannelStats();
    expect(stats['fs:read-file'].count).toBe(2);
    expect(stats['git:status'].count).toBe(1);
    expect(Number.isFinite(stats['fs:read-file'].avgDuration)).toBe(true);
  });
});

describe('payloads are never recorded', () => {
  beforeEach(() => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('fs:write-file', async (_event, request) => ({
        success: true,
        // Echo it back, so a leak could come from either direction.
        data: request,
      }));
    });
  });

  it('keeps no field carrying the request or response payload', async () => {
    const secret = 'sk-live-DEADBEEF-should-never-be-recorded';
    await invoke('fs:write-file', { path: '/etc/x', content: secret, apiKey: secret });

    const serialized = JSON.stringify([
      ipcMonitor.getMessages(),
      ipcMonitor.getChannelStats(),
      performanceMonitor.getMetrics(),
    ]);

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('/etc/x');
  });

  it('does not throw on a circular payload', async () => {
    const circular: Record<string, unknown> = { name: 'x' };
    circular.self = circular;

    // Any attempt to serialize or size the payload would throw here. Nothing
    // reads the arguments, so nothing can.
    await expect(invoke('fs:write-file', circular)).resolves.toBeTruthy();
  });

  it('does not read the payload at all, so a hostile getter is never called', async () => {
    const trap = vi.fn(() => 'read!');
    const payload = {};
    Object.defineProperty(payload, 'content', { enumerable: true, get: trap });

    await invoke('fs:write-file', payload);

    // A size estimate walking the keys would have triggered this.
    expect(trap).not.toHaveBeenCalled();
  });

  it('does not read the payload of the channel that carries an API key', async () => {
    // `settings:set-provider` is the one channel in the repo whose payload holds
    // a plaintext API key. The IPC Inspector records every call and is displayed
    // on screen, so reading this payload -- even to size it -- would put the key
    // one panel away from the user's screenshot.
    //
    // Same trap as above, aimed at the field that actually holds the secret.
    const trap = vi.fn(() => 'sk-live-should-never-be-read');
    const payload = { id: 'anthropic', enabled: true };
    Object.defineProperty(payload, 'apiKey', { enumerable: true, get: trap });

    withIpcInstrumentation(() => {
      ipcMainMock.handle('settings:set-provider', async () => ({
        success: true,
        data: { providers: [], activeProviders: [] },
      }));
    });

    const handler = registeredHandlers.get('settings:set-provider');
    await handler?.({}, payload);

    expect(trap).not.toHaveBeenCalled();
  });
});

describe('performanceMonitor receives only notable calls', () => {
  beforeEach(() => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('fs:read-dir', async () => ({ success: true, data: { entries: [] } }));
      ipcMainMock.handle('db:query', async () => ({
        success: false,
        error: { code: 'DB_ERROR', message: 'no such table' },
      }));
      ipcMainMock.handle('git:diff', async () => {
        throw new Error('not a repository');
      });
      ipcMainMock.handle('git:log', async () => {
        // Deliberately over the 16 ms threshold.
        await new Promise((resolve) => setTimeout(resolve, __testing.SLOW_CALL_THRESHOLD_MS + 10));
        return { success: true, data: [] };
      });
    });
  });

  it('records nothing for a fast successful call', async () => {
    // Measured on this repo: recording every call evicts the profiler's `timing`
    // metrics from the 500-entry window `PerformancePanel` fetches, from ~250
    // calls onward — which would blank the default chart.
    await invoke('fs:read-dir', { path: '/' });

    expect(performanceMonitor.getMetrics('ipc')).toHaveLength(0);
    // The Inspector still sees it: ipcMonitor keeps every call.
    expect(ipcMonitor.getMessages()).toHaveLength(1);
  });

  it('records a slow successful call', async () => {
    await invoke('git:log', {});

    const metrics = performanceMonitor.getMetrics('ipc');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('git:log');
    expect(metrics[0].unit).toBe('ms');
    expect(metrics[0].value).toBeGreaterThanOrEqual(__testing.SLOW_CALL_THRESHOLD_MS);
  });

  it('marks a failure envelope as failed, regardless of speed', async () => {
    // `createHandler` never throws: it returns `{ success: false, error }`.
    // Reading only exceptions would count every validation failure as a success.
    await invoke('db:query', { sql: 'SELECT 1' });

    const metrics = performanceMonitor.getMetrics('ipc');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('db:query (failed)');
  });

  it('marks a thrown error as failed, regardless of speed', async () => {
    await expect(invoke('git:diff', {})).rejects.toThrow();
    expect(performanceMonitor.getMetrics('ipc')[0].name).toBe('git:diff (failed)');
  });

  it('leaves the profiler timing series intact under IPC load', async () => {
    // The regression this threshold exists to prevent.
    performanceMonitor.recordMetric('timing', 'startup-step', 12, 'ms');

    for (let i = 0; i < 400; i++) {
      await invoke('fs:read-dir', { path: `/d${i}` });
    }

    expect(performanceMonitor.getMetrics('timing')).toHaveLength(1);
    expect(performanceMonitor.getMetrics().length).toBeLessThan(10);
  });

  it('treats `{ success: false }` without an error as a success', () => {
    // A cancelled log export legitimately returns `{ success: false }` with no
    // error. That is a user decision, not an IPC failure.
    expect(__testing.isEnvelopeFailure({ success: false })).toBe(false);
    expect(__testing.isEnvelopeFailure({ success: false, error: { message: 'x' } })).toBe(true);
  });

  it('treats a raw (non-envelope) return value as a success', () => {
    // The `debug:*` domain returns raw values by design, not `{ success, data }`.
    expect(__testing.isEnvelopeFailure([])).toBe(false);
    expect(__testing.isEnvelopeFailure({ enabled: true })).toBe(false);
    expect(__testing.isEnvelopeFailure(undefined)).toBe(false);
    expect(__testing.isEnvelopeFailure('ok')).toBe(false);
  });
});

describe('the observer does not record itself', () => {
  it('excludes debug:* channels', () => {
    expect(__testing.isExcluded('debug:get-ipc-messages')).toBe(true);
    expect(__testing.isExcluded('debug:get-ipc-stats')).toBe(true);
    expect(__testing.isExcluded('fs:read-file')).toBe(false);
    expect(__testing.isExcluded('db:query')).toBe(false);
  });

  it('records nothing when a debug channel is invoked', async () => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('debug:get-ipc-messages', async () => []);
      ipcMainMock.handle('debug:get-settings', async () => {
        // Slow enough to clear the metric threshold, so exclusion is what keeps
        // it out — not the threshold.
        await new Promise((resolve) => setTimeout(resolve, __testing.SLOW_CALL_THRESHOLD_MS + 10));
        return { enabled: true };
      });
    });

    await invoke('debug:get-ipc-messages', 500);
    await invoke('debug:get-settings');

    // The Inspector polls these twice a second. Recording them would fill the
    // 1000-entry buffer with polling in ~8 minutes and evict the real traffic —
    // the empty panel this work exists to fix.
    expect(ipcMonitor.getMessages()).toHaveLength(0);
    expect(performanceMonitor.getMetrics('ipc')).toHaveLength(0);
  });

  it('leaves the debug handler behaviour untouched', async () => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('debug:get-settings', async () => ({ enabled: true, logLevel: 'info' }));
    });

    // The debug domain returns raw values, not `{ success, data }`. The
    // instrumentation must not wrap or reshape that.
    expect(await invoke('debug:get-settings')).toEqual({ enabled: true, logLevel: 'info' });
  });
});

describe('memory growth is bounded', () => {
  beforeEach(() => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('fs:read-file', async () => ({ success: true, data: {} }));
    });
  });

  it('caps the message buffer at the monitor limit', async () => {
    for (let i = 0; i < 1200; i++) {
      await invoke('fs:read-file', { path: `/f${i}` });
    }

    // The monitor's own circular buffer is 1000 entries. An unbounded log
    // retaining 32 MB has already been found in this repo.
    expect(ipcMonitor.getMessages().length).toBeLessThanOrEqual(1000);
  });

  it('does not grow the metric store on ordinary traffic', async () => {
    for (let i = 0; i < 300; i++) {
      await invoke('fs:read-file', { path: `/f${i}` });
    }

    // Fast successful calls are not charted, so 300 invokes add (almost) nothing.
    // A few may cross the 16 ms threshold under load, hence the small margin
    // rather than an exact 0.
    expect(performanceMonitor.getMetrics().length).toBeLessThan(20);
  });

  it('keeps channel stats bounded by the number of distinct channels', async () => {
    for (let i = 0; i < 500; i++) {
      await invoke('fs:read-file', { path: `/f${i}` });
    }

    // Channel names are static constants, so this map cannot grow with traffic.
    expect(Object.keys(ipcMonitor.getChannelStats())).toEqual(['fs:read-file']);
  });
});

describe('a user action cannot silently stop the recording', () => {
  // Regression guard on `handleUpdateSettings`' projection.
  //
  // It used to derive `enableIpcMonitoring: settings.enabled && categories.ipc`.
  // `DebugPanel` is reachable without enabling debug mode and `enabled` defaults
  // to false, so opening SettingsPanel and clicking Save — which sends the
  // settings back unchanged — turned recording off and emptied the Inspector.
  // Measured before the fix: 1 message recorded, then 0 after Save.
  let currentSettings: () => unknown;

  beforeEach(async () => {
    const { registerDebugHandlers, resetDebugSettings, handleGetSettings } = await import(
      '../debug-handlers'
    );

    resetDebugSettings();
    registerDebugHandlers();

    withIpcInstrumentation(() => {
      ipcMainMock.handle('fs:read-file', async () => ({ success: true, data: {} }));
    });

    currentSettings = handleGetSettings;
  });

  it('keeps recording after Save with debug mode off (the default)', async () => {
    await invoke('debug:update-settings', currentSettings());
    await invoke('fs:read-file', { path: '/a' });

    expect(ipcMonitor.getMessages()).toHaveLength(1);
  });

  it('keeps recording after debug mode is toggled on and back off', async () => {
    await invoke('debug:update-settings', { enabled: true });
    await invoke('debug:update-settings', { enabled: false });
    await invoke('fs:read-file', { path: '/a' });

    expect(ipcMonitor.getMessages()).toHaveLength(1);
  });

  it('stops recording when the ipc category is unchecked', async () => {
    // The discoverable, intentional off switch — the one labelled "ipc" in the
    // Log Categories list.
    await invoke('debug:update-settings', { categories: { ipc: false } });
    await invoke('fs:read-file', { path: '/a' });

    expect(ipcMonitor.getMessages()).toHaveLength(0);
  });

  it('resumes when the ipc category is checked again', async () => {
    await invoke('debug:update-settings', { categories: { ipc: false } });
    await invoke('fs:read-file', { path: '/a' });
    expect(ipcMonitor.getMessages()).toHaveLength(0);

    await invoke('debug:update-settings', { categories: { ipc: true } });
    await invoke('fs:read-file', { path: '/b' });
    expect(ipcMonitor.getMessages()).toHaveLength(1);
  });
});

describe('recording respects the debug setting', () => {
  beforeEach(() => {
    withIpcInstrumentation(() => {
      ipcMainMock.handle('fs:read-file', async () => ({ success: true, data: {} }));
    });
  });

  it('records nothing when IPC monitoring is disabled', async () => {
    debugService.updateSettings({ enableIpcMonitoring: false });

    await invoke('fs:read-file', { path: '/a' });

    expect(ipcMonitor.getMessages()).toHaveLength(0);
    expect(performanceMonitor.getMetrics('ipc')).toHaveLength(0);
  });

  it('still returns the handler result when recording is off', async () => {
    debugService.updateSettings({ enableIpcMonitoring: false });
    expect(await invoke('fs:read-file', { path: '/a' })).toEqual({ success: true, data: {} });
  });

  it('reads the setting per call, not at registration time', async () => {
    // The panel can toggle it at runtime; a value captured at registration would
    // freeze the behaviour to whatever it was at boot.
    debugService.updateSettings({ enableIpcMonitoring: false });
    await invoke('fs:read-file', { path: '/a' });
    expect(ipcMonitor.getMessages()).toHaveLength(0);

    debugService.updateSettings({ enableIpcMonitoring: true });
    await invoke('fs:read-file', { path: '/b' });
    expect(ipcMonitor.getMessages()).toHaveLength(1);
  });
});
