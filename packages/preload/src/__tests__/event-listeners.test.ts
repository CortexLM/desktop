/**
 * Preload event listeners — registration, delivery, and removal.
 *
 * `createEventListener` / `createVoidEventListener` back 18 `on*` methods across
 * the bridge (fs, terminal, mcp, automation, update). Each returns an
 * unsubscribe function. Two things can go wrong and neither is a type error:
 *
 *  1. The listener is registered on the *wrong channel*, so the callback never
 *     fires. This is how `UpdateNotification` broke: it called a
 *     `window.electron.on(...)` that did not exist and threw on mount. The six
 *     `update.on*` methods exist to serve it, and a wrong channel name here
 *     means the update UI silently never updates.
 *  2. The unsubscribe function does not actually remove the listener, or removes
 *     a *different* function than the one registered. That is a listener leak —
 *     already found once in this repo, where a cancelled stream left its
 *     listener attached for the lifetime of the window. Every remount then adds
 *     another live listener on the same channel, and callbacks fire N times on
 *     a component that thinks it has one subscription.
 *
 * The removal assertions are therefore by *identity*: `removeListener` must be
 * called with the very function handed to `on`. Comparing only the channel name
 * would pass while leaking.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { IpcRendererEvent } from 'electron';

// ---------------------------------------------------------------------------
// Electron mock
// ---------------------------------------------------------------------------

type Listener = (event: IpcRendererEvent, ...args: unknown[]) => void;

const exposed = new Map<string, Record<string, unknown>>();

/** Channel -> currently-attached listeners, maintained like the real emitter. */
const attached = new Map<string, Listener[]>();

const onMock = vi.fn((channel: string, listener: Listener) => {
  const list = attached.get(channel) ?? [];
  list.push(listener);
  attached.set(channel, list);
});

const removeListenerMock = vi.fn((channel: string, listener: Listener) => {
  const list = attached.get(channel) ?? [];
  // Identity-based, exactly like Node's EventEmitter: removing a function that
  // was never added is a silent no-op, which is precisely the leak shape.
  const index = list.indexOf(listener);
  if (index !== -1) list.splice(index, 1);
  attached.set(channel, list);
});

const invokeMock = vi.fn(async (channel: string) => ({ success: true, channel }));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: Record<string, unknown>) => {
      exposed.set(name, api);
    },
  },
  ipcRenderer: {
    invoke: invokeMock,
    on: onMock,
    removeListener: removeListenerMock,
  },
}));

/** A stand-in for the event object the real ipcRenderer passes first. */
const FAKE_EVENT = {} as IpcRendererEvent;

type Unsubscribe = () => void;
type Subscribe<T> = (callback: (payload: T) => void) => Unsubscribe;

let cortex: Record<string, Record<string, unknown>>;
let ipcBridge: Record<string, unknown>;

beforeAll(async () => {
  await import('../index');
  cortex = exposed.get('cortex') as Record<string, Record<string, unknown>>;
  ipcBridge = exposed.get('ipc') as Record<string, unknown>;
});

beforeEach(() => {
  // `mockReset`, not `mockClear`: clear leaves a queued `mockResolvedValueOnce`
  // in place, so a value queued by one test is consumed by whichever test runs
  // next. That has already produced 4 unrelated failures in this repo when a
  // mutation was introduced, which hides *which* test the mutation broke.
  // Reset also drops the `invoke` implementation, so it is reinstalled below.
  onMock.mockReset();
  removeListenerMock.mockReset();
  invokeMock.mockReset();

  onMock.mockImplementation((channel: string, listener: Listener) => {
    const list = attached.get(channel) ?? [];
    list.push(listener);
    attached.set(channel, list);
  });
  removeListenerMock.mockImplementation((channel: string, listener: Listener) => {
    const list = attached.get(channel) ?? [];
    const index = list.indexOf(listener);
    if (index !== -1) list.splice(index, 1);
    attached.set(channel, list);
  });
  invokeMock.mockImplementation(async (channel: string) => ({ success: true, channel }));

  attached.clear();
});

/**
 * Every payload-carrying listener method, with the channel it must use.
 *
 * The channel strings are written literally rather than imported from
 * IPC_CHANNELS: the point is to pin the wire format that main actually emits on.
 * Importing the same constant the implementation uses would make the assertion
 * a tautology — renaming a constant's *value* would keep both sides in step and
 * the test would still pass while the renderer stopped receiving events.
 */
const PAYLOAD_LISTENERS: [group: string, method: string, channel: string][] = [
  ['fs', 'onFileChange', 'event:file-change'],
  ['terminal', 'onData', 'event:terminal-data'],
  ['terminal', 'onExit', 'event:terminal-exit'],
  ['mcp', 'onServerStarted', 'event:mcp-server-started'],
  ['mcp', 'onServerStopped', 'event:mcp-server-stopped'],
  ['mcp', 'onServerError', 'event:mcp-server-error'],
  ['mcp', 'onToolInvoked', 'event:mcp-tool-invoked'],
  ['mcp', 'onPermissionGranted', 'event:mcp-permission-granted'],
  ['mcp', 'onPermissionRevoked', 'event:mcp-permission-revoked'],
  ['automation', 'onStarted', 'event:automation-started'],
  ['automation', 'onCompleted', 'event:automation-completed'],
  ['automation', 'onFailed', 'event:automation-failed'],
  ['automation', 'onNotification', 'event:notification'],
  ['update', 'onAvailable', 'update:available'],
  ['update', 'onNotAvailable', 'update:not-available'],
  ['update', 'onDownloadProgress', 'update:download-progress'],
  ['update', 'onDownloaded', 'update:downloaded'],
  ['update', 'onError', 'update:error'],
  // Pushed rather than polled: the device-flow loop runs in main, and the account session
  // is process-wide, so a sign-in from one window has to reach every other one.
  ['cortex', 'onDeviceStatus', 'event:cortex-device-status'],
  ['cortex', 'onAccountChanged', 'event:cortex-account-changed'],
  ['cortex', 'onAuthComplete', 'event:cortex-auth-complete'],
  // Pushed, not polled: a run advances in main at its own pace, and the event
  // carries the updated summary so the inbox row and the timeline move together.
  ['session', 'onProgress', 'event:session-progress'],
  ['chat', 'onProgress', 'event:chat-progress'],
  ['windowControls', 'onMaximizedChange', 'event:window-maximized'],
];

function subscribeVia(group: string, method: string): Subscribe<unknown> {
  return cortex[group][method] as Subscribe<unknown>;
}

describe('listener registration uses the channel main emits on', () => {
  it.each(PAYLOAD_LISTENERS)('cortex.%s.%s listens on %s', (group, method, channel) => {
    subscribeVia(group, method)(() => {});

    expect(onMock).toHaveBeenCalledTimes(1);
    expect(onMock.mock.calls[0][0]).toBe(channel);
  });

  it('cortex.update.onChecking listens on update:checking', () => {
    (cortex.update.onChecking as (cb: () => void) => Unsubscribe)(() => {});

    expect(onMock).toHaveBeenCalledTimes(1);
    expect(onMock.mock.calls[0][0]).toBe('update:checking');
  });

  it('covers every on* method the bridge exposes', () => {
    // Guards the table above against drifting out of date: a new `on*` method
    // added to the bridge without a row here would otherwise be untested and
    // this suite would still be green.
    const exposedListenerMethods = Object.entries(cortex).flatMap(([group, api]) =>
      Object.keys(api)
        .filter((key) => key.startsWith('on'))
        .map((key) => `${group}.${key}`)
    );

    const tabled = [
      ...PAYLOAD_LISTENERS.map(([group, method]) => `${group}.${method}`),
      'update.onChecking',
    ];

    expect([...exposedListenerMethods].sort()).toEqual([...tabled].sort());
  });
});

describe('listener delivery', () => {
  it.each(PAYLOAD_LISTENERS)('cortex.%s.%s forwards the payload', (group, method, channel) => {
    const received: unknown[] = [];
    subscribeVia(group, method)((payload) => received.push(payload));

    const payload = { marker: `payload-for-${channel}` };
    for (const listener of attached.get(channel) ?? []) listener(FAKE_EVENT, payload);

    expect(received).toEqual([payload]);
  });

  it('strips the IpcRendererEvent and passes only the data', () => {
    // The renderer callback signature is `(data) => void`. Forwarding the raw
    // event as the first argument would hand renderer code an Electron event
    // object — and `event.sender` on it is a privileged handle.
    let firstArg: unknown;
    let argCount = -1;

    (cortex.terminal.onData as Subscribe<unknown>)((...args: unknown[]) => {
      firstArg = args[0];
      argCount = args.length;
    });

    const data = { terminalId: 't1', data: 'ls\n' };
    for (const listener of attached.get('event:terminal-data') ?? []) {
      listener(FAKE_EVENT, data);
    }

    expect(argCount).toBe(1);
    expect(firstArg).toBe(data);
    expect(firstArg).not.toBe(FAKE_EVENT);
  });

  it('invokes a void listener with no arguments', () => {
    let argCount = -1;
    (cortex.update.onChecking as (cb: (...a: unknown[]) => void) => Unsubscribe)(
      (...args: unknown[]) => {
        argCount = args.length;
      }
    );

    for (const listener of attached.get('update:checking') ?? []) {
      listener(FAKE_EVENT, { unexpected: 'payload' });
    }

    expect(argCount).toBe(0);
  });

  it('delivers to each of several subscribers on the same channel', () => {
    const calls: string[] = [];
    (cortex.terminal.onExit as Subscribe<unknown>)(() => calls.push('a'));
    (cortex.terminal.onExit as Subscribe<unknown>)(() => calls.push('b'));

    for (const listener of [...(attached.get('event:terminal-exit') ?? [])]) {
      listener(FAKE_EVENT, {});
    }

    expect(calls).toEqual(['a', 'b']);
  });
});

describe('unsubscribe actually detaches the listener', () => {
  it.each(PAYLOAD_LISTENERS)(
    'cortex.%s.%s removes the exact function it registered',
    (group, method, channel) => {
      const unsubscribe = subscribeVia(group, method)(() => {});

      const registered = onMock.mock.calls[0][1];
      expect(attached.get(channel)).toHaveLength(1);

      unsubscribe();

      // By identity: removing *a* listener on the right channel is not enough,
      // it must be the one that was added. `removeListener` with any other
      // function is a silent no-op on a real emitter.
      expect(removeListenerMock).toHaveBeenCalledWith(channel, registered);
      expect(attached.get(channel)).toHaveLength(0);
    }
  );

  it('cortex.update.onChecking removes its listener', () => {
    const unsubscribe = (cortex.update.onChecking as (cb: () => void) => Unsubscribe)(() => {});
    const registered = onMock.mock.calls[0][1];

    unsubscribe();

    expect(removeListenerMock).toHaveBeenCalledWith('update:checking', registered);
    expect(attached.get('update:checking')).toHaveLength(0);
  });

  it('stops delivering after unsubscribe', () => {
    // The observable consequence of a leak: a component that unsubscribed on
    // unmount still runs its callback, usually into unmounted state.
    const received: unknown[] = [];
    const unsubscribe = (cortex.fs.onFileChange as Subscribe<unknown>)((p) => received.push(p));

    for (const l of [...(attached.get('event:file-change') ?? [])]) l(FAKE_EVENT, { n: 1 });
    unsubscribe();
    for (const l of [...(attached.get('event:file-change') ?? [])]) l(FAKE_EVENT, { n: 2 });

    expect(received).toEqual([{ n: 1 }]);
  });

  it('unsubscribing one subscriber leaves the others attached', () => {
    // The bug this catches: an unsubscribe implemented as
    // `removeAllListeners(channel)` would tear down every other component's
    // subscription on the same channel. `event:terminal-data` has several.
    const calls: string[] = [];
    const offA = (cortex.terminal.onData as Subscribe<unknown>)(() => calls.push('a'));
    (cortex.terminal.onData as Subscribe<unknown>)(() => calls.push('b'));

    offA();
    for (const l of [...(attached.get('event:terminal-data') ?? [])]) l(FAKE_EVENT, {});

    expect(calls).toEqual(['b']);
    expect(attached.get('event:terminal-data')).toHaveLength(1);
  });

  it('leaves no listener attached once every subscriber unsubscribes', () => {
    // Whole-surface sweep: subscribe to everything, unsubscribe everything,
    // assert the emitter is empty. A single `on*` whose teardown is wrong shows
    // up here as a non-empty channel.
    const unsubscribes = PAYLOAD_LISTENERS.map(([group, method]) =>
      subscribeVia(group, method)(() => {})
    );
    unsubscribes.push(
      (cortex.update.onChecking as (cb: () => void) => Unsubscribe)(() => {})
    );

    const totalAttached = [...attached.values()].reduce((n, l) => n + l.length, 0);
    expect(totalAttached).toBe(PAYLOAD_LISTENERS.length + 1);

    for (const off of unsubscribes) off();

    const stillAttached = [...attached.entries()].filter(([, l]) => l.length > 0);
    expect(stillAttached.map(([channel]) => channel)).toEqual([]);
  });

  it('is idempotent — unsubscribing twice does not throw or over-remove', () => {
    const offA = (cortex.terminal.onData as Subscribe<unknown>)(() => {});
    (cortex.terminal.onData as Subscribe<unknown>)(() => {});

    offA();
    expect(() => offA()).not.toThrow();

    // The second call must not take the *other* subscriber's listener with it.
    expect(attached.get('event:terminal-data')).toHaveLength(1);
  });
});

describe('window.ipc.on', () => {
  type IpcOn = (channel: string, cb: (data: unknown) => void) => Unsubscribe;

  it('registers and delivers on an allowlisted event channel', () => {
    const received: unknown[] = [];
    (ipcBridge.on as IpcOn)('event:terminal-data', (d) => received.push(d));

    for (const l of attached.get('event:terminal-data') ?? []) l(FAKE_EVENT, { data: 'x' });

    expect(received).toEqual([{ data: 'x' }]);
  });

  it('returns a working unsubscribe', () => {
    const received: unknown[] = [];
    const off = (ipcBridge.on as IpcOn)('event:file-change', (d) => received.push(d));
    const registered = onMock.mock.calls[0][1];

    off();

    expect(removeListenerMock).toHaveBeenCalledWith('event:file-change', registered);
    expect(attached.get('event:file-change')).toHaveLength(0);
    expect(received).toEqual([]);
  });

  it('throws for an event channel outside the allowlist', () => {
    // Subscribing is a capability too: an arbitrary channel would let renderer
    // script observe traffic meant for other parts of the app.
    expect(() => (ipcBridge.on as IpcOn)('event:secret', () => {})).toThrow(
      'IPC event channel not allowed: event:secret'
    );
  });

  it('does not attach a listener when the channel is refused', () => {
    expect(() => (ipcBridge.on as IpcOn)('db:query', () => {})).toThrow();

    expect(onMock).not.toHaveBeenCalled();
    expect(attached.get('db:query') ?? []).toHaveLength(0);
  });

  it.each([
    'event:terminal-data',
    'event:terminal-exit',
    'event:file-change',
    'event:workspace-switched',
  ])('allows %s', (channel) => {
    expect(() => (ipcBridge.on as IpcOn)(channel, () => {})).not.toThrow();
    expect(attached.get(channel)).toHaveLength(1);
  });

  it('is not fooled by a prefix of an allowed event channel', () => {
    expect(() => (ipcBridge.on as IpcOn)('event:terminal-data-raw', () => {})).toThrow(
      'not allowed'
    );
  });
});
