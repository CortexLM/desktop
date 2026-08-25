/**
 * Preload façade — channel routing, argument shape, and error behaviour.
 *
 * Every `cortex.*` method is a thin forwarder onto `ipcRenderer.invoke`. Thin
 * does not mean safe: the two ways it breaks are invisible to TypeScript,
 * because the channel is a string and the payload is structurally typed at the
 * call site only.
 *
 *  1. **Wrong channel.** `cortex.git.push` invoking `git:pull` type-checks
 *     perfectly and does the wrong thing at runtime. The main process has a
 *     handler for both, so there is no error either — just the wrong operation.
 *  2. **Reshaped payload.** `fs.watch(path, watchId)` must arrive as
 *     `{ path, watchId }`. A shape disagreement across this boundary has already
 *     broken a whole feature in this repo (snake_case nullable where camelCase
 *     non-null was expected, producing `new Date(undefined)` → RangeError on
 *     every export).
 *
 * The error-path tests cover what the mission calls out: main not responding,
 * main returning an error, and main returning an unexpected shape. The façade's
 * contract is to pass responses through untouched — a forwarder that *swallows*
 * a rejection is worse than one that propagates it, because the caller then
 * treats a failure as a success with `undefined` data.
 *
 * `streamResponse` gets its own section: it is the only method with real logic
 * (a listener attached before the invoke, a settled-flag, and three exit paths),
 * and it is where this repo's known listener leak lived.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { IpcRendererEvent } from 'electron';

// ---------------------------------------------------------------------------
// Electron mock
// ---------------------------------------------------------------------------

type Listener = (event: IpcRendererEvent, ...args: unknown[]) => void;

const exposed = new Map<string, Record<string, unknown>>();
const attached = new Map<string, Listener[]>();

const invokeMock = vi.fn();
const onMock = vi.fn();
const removeListenerMock = vi.fn();

function installEmitterBehaviour(): void {
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
}

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

const FAKE_EVENT = {} as IpcRendererEvent;

let cortex: Record<string, Record<string, unknown>>;

beforeAll(async () => {
  await import('../index');
  cortex = exposed.get('cortex') as Record<string, Record<string, unknown>>;
});

beforeEach(() => {
  // `mockReset` rather than `mockClear`. `mockClear` keeps queued
  // `mockResolvedValueOnce` values, so a value queued but not consumed by one
  // test is picked up by the next one — which in this repo produced four
  // unrelated failures and hid which test a mutation had actually broken.
  invokeMock.mockReset();
  onMock.mockReset();
  removeListenerMock.mockReset();
  attached.clear();

  invokeMock.mockResolvedValue({ success: true, data: {} });
  installEmitterBehaviour();
});

/** Emit a chunk to everything currently listening on a stream channel. */
function emit(channel: string, chunk: unknown): void {
  for (const listener of [...(attached.get(channel) ?? [])]) {
    listener(FAKE_EVENT, chunk);
  }
}

// ---------------------------------------------------------------------------
// Channel routing
//
// Channel strings are literal, not imported from IPC_CHANNELS. Importing the
// same constant the implementation uses would make these tautologies: changing
// the constant's value would move both sides together and the test would stay
// green while main — which registers handlers under the old names — stopped
// matching. These literals are the wire contract.
// ---------------------------------------------------------------------------

const SINGLE_ARG_METHODS: [group: string, method: string, channel: string][] = [
  ['fs', 'readFile', 'fs:read-file'],
  ['fs', 'writeFile', 'fs:write-file'],
  ['fs', 'readDir', 'fs:read-dir'],
  ['editor', 'openFile', 'editor:open-file'],
  ['editor', 'saveFile', 'editor:save-file'],
  ['editor', 'format', 'editor:format'],
  ['git', 'status', 'git:status'],
  ['git', 'commit', 'git:commit'],
  ['git', 'push', 'git:push'],
  ['git', 'pull', 'git:pull'],
  ['git', 'diff', 'git:diff'],
  ['git', 'stage', 'git:stage'],
  ['git', 'unstage', 'git:unstage'],
  ['git', 'discard', 'git:discard'],
  ['ai', 'createSession', 'ai:create-session'],
  ['ai', 'sendMessage', 'ai:send-message'],
  ['ai', 'resolvePermission', 'ai:resolve-permission'],
  ['mission', 'list', 'mission:list'],
  ['mission', 'create', 'mission:create'],
  ['mission', 'start', 'mission:start'],
  ['mission', 'pause', 'mission:pause'],
  ['mission', 'resume', 'mission:resume'],
  ['mcp', 'listServers', 'mcp:list-servers'],
  ['mcp', 'getServer', 'mcp:get-server'],
  ['mcp', 'installServer', 'mcp:install-server'],
  ['mcp', 'uninstallServer', 'mcp:uninstall-server'],
  ['mcp', 'startServer', 'mcp:start-server'],
  ['mcp', 'stopServer', 'mcp:stop-server'],
  ['mcp', 'discoverTools', 'mcp:discover-tools'],
  ['mcp', 'invokeTool', 'mcp:invoke-tool'],
  ['mcp', 'listPermissions', 'mcp:list-permissions'],
  ['mcp', 'grantPermission', 'mcp:grant-permission'],
  ['mcp', 'revokePermission', 'mcp:revoke-permission'],
  ['mcp', 'checkPermission', 'mcp:check-permission'],
  ['terminal', 'create', 'terminal:create'],
  ['terminal', 'input', 'terminal:input'],
  ['terminal', 'resize', 'terminal:resize'],
  ['db', 'query', 'db:query'],
  ['db', 'execute', 'db:execute'],
  ['automation', 'create', 'automation:create'],
  ['automation', 'update', 'automation:update'],
  ['automation', 'delete', 'automation:delete'],
  ['automation', 'list', 'automation:list'],
  ['automation', 'get', 'automation:get'],
  ['automation', 'run', 'automation:run'],
  ['automation', 'toggle', 'automation:toggle'],
  ['automation', 'getLogs', 'automation:get-logs'],
  ['session', 'list', 'session:list'],
  ['session', 'get', 'session:get'],
  ['session', 'start', 'session:start'],
  ['session', 'followUp', 'session:follow-up'],
  ['session', 'stop', 'session:stop'],
  ['session', 'archive', 'session:archive'],
  ['session', 'remove', 'session:delete'],
  ['session', 'resolvePermission', 'session:resolve-permission'],
  ['settings', 'setProvider', 'settings:set-provider'],
  ['settings', 'setWorkspace', 'settings:set-workspace'],
];

/**
 * Methods that take no argument at all.
 *
 * Kept separate because the assertion is different, and the difference is the point: these
 * must invoke with the channel *only*. Main validates them with an optional schema precisely
 * because `invoke(channel)` delivers `undefined`, and a forwarder that helpfully passed `{}`
 * or `null` instead would be validated against a shape nobody declared.
 */
const NO_ARG_METHODS: [group: string, method: string, channel: string][] = [
  ['session', 'listRepositories', 'session:list-repositories'],
  ['session', 'openWorkspace', 'session:open-workspace'],
  ['settings', 'getProviders', 'settings:get-providers'],
  ['settings', 'getWorkspace', 'settings:get-workspace'],
  ['cortex', 'getState', 'cortex:get-state'],
  ['cortex', 'listModels', 'cortex:list-models'],
  ['cortex', 'deviceStart', 'cortex:device-start'],
  ['cortex', 'deviceCancel', 'cortex:device-cancel'],
  ['cortex', 'openVerification', 'cortex:open-verification'],
  ['cortex', 'signOut', 'cortex:sign-out'],
];

type AnyFn = (...args: unknown[]) => Promise<unknown>;

function call(group: string, method: string): AnyFn {
  return cortex[group][method] as AnyFn;
}

describe('façade methods invoke the channel main registered', () => {
  it.each(SINGLE_ARG_METHODS)('cortex.%s.%s -> %s', async (group, method, channel) => {
    // A unique request object per case: asserting on identity proves the
    // payload is forwarded untouched, not rebuilt.
    const request = { marker: `req-for-${channel}` };

    await call(group, method)(request);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith(channel, request);
  });

  it.each(NO_ARG_METHODS)('cortex.%s.%s -> %s (no payload)', async (group, method, channel) => {
    await call(group, method)();

    expect(invokeMock).toHaveBeenCalledTimes(1);
    // Exactly one argument. `toHaveBeenCalledWith(channel)` would also pass if a second
    // `undefined` were forwarded, which is a different wire message.
    expect(invokeMock.mock.calls[0]).toEqual([channel]);
  });

  it('routes each method to a distinct channel', () => {
    // Catches a copy-paste that points two methods at one channel — the shape
    // of the `git.push` -> `git:pull` bug, which no type check can see.
    const channels = [...SINGLE_ARG_METHODS, ...NO_ARG_METHODS].map(([, , channel]) => channel);
    expect(new Set(channels).size).toBe(channels.length);
  });

  it('covers every promise-returning façade method', () => {
    // Keeps the table honest. A new method added to the bridge with no row here
    // would be untested while this suite still reported green — the silent-skip
    // failure mode this repo has hit repeatedly.
    const tabled = new Set([
      ...SINGLE_ARG_METHODS.map(([group, method]) => `${group}.${method}`),
      ...NO_ARG_METHODS.map(([group, method]) => `${group}.${method}`),
      // Covered by their own cases below.
      'fs.watch',
      'fs.unwatch',
      'ai.streamResponse',
      'ai.stopStream',
      'terminal.kill',
      'update.check',
      'update.download',
      'update.install',
    ]);

    const onBridge = Object.entries(cortex)
      .flatMap(([group, api]) =>
        Object.keys(api)
          .filter((key) => !key.startsWith('on'))
          .map((key) => `${group}.${key}`)
      )
      // `cortex.invoke` is the allowlisted escape hatch, covered by
      // ipc-allowlist.test.ts.
      .filter((name) => name !== 'invoke.invoke');

    const untested = onBridge.filter((name) => !tabled.has(name));
    expect(untested).toEqual([]);
  });
});

describe('methods that reshape their arguments', () => {
  it('fs.watch packs (path, watchId) into one object', async () => {
    // The signature is positional but the wire format is an object. Forwarding
    // the two arguments positionally would give main `undefined` for both
    // fields of its destructured payload.
    await (cortex.fs.watch as AnyFn)('/tmp/project', 'watch-1');

    expect(invokeMock).toHaveBeenCalledWith('fs:watch', {
      path: '/tmp/project',
      watchId: 'watch-1',
    });
  });

  it('fs.unwatch sends the bare id, not an object', async () => {
    await (cortex.fs.unwatch as AnyFn)('watch-1');
    expect(invokeMock).toHaveBeenCalledWith('fs:unwatch', 'watch-1');
  });

  it('terminal.kill sends the bare terminal id', async () => {
    await (cortex.terminal.kill as AnyFn)('term-7');
    expect(invokeMock).toHaveBeenCalledWith('terminal:kill', 'term-7');
  });

  it('ai.stopStream sends the bare session id', async () => {
    await (cortex.ai.stopStream as AnyFn)('sess-3');
    expect(invokeMock).toHaveBeenCalledWith('ai:stop-stream', 'sess-3');
  });

  it.each([
    ['check', 'update:check'],
    ['download', 'update:download'],
    ['install', 'update:install'],
  ])('update.%s invokes %s with no payload', async (method, channel) => {
    await (cortex.update[method] as AnyFn)();

    expect(invokeMock).toHaveBeenCalledWith(channel);
    // Explicitly one argument: inventing a payload would make main's handler
    // read a request object that the renderer never sent.
    expect(invokeMock.mock.calls[0]).toHaveLength(1);
  });
});

describe('responses are passed through untouched', () => {
  it('returns the main-process response by identity', async () => {
    // The façade must not copy, wrap, or normalise. A caller reading
    // `response.data.content` depends on getting exactly what main sent.
    const response = { success: true, data: { content: 'hello' } };
    invokeMock.mockResolvedValue(response);

    await expect(call('fs', 'readFile')({ path: '/x' })).resolves.toBe(response);
  });

  it('passes a failure response through as a resolved value, not a throw', async () => {
    // `IPCResponse` models failure in-band (`success: false`). Turning it into a
    // rejection would break every caller that checks the flag.
    const failure = { success: false, error: { message: 'ENOENT' } };
    invokeMock.mockResolvedValue(failure);

    await expect(call('fs', 'readFile')({ path: '/nope' })).resolves.toBe(failure);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a bare string', 'not-a-response'],
    ['an empty object', {}],
    ['an array', [1, 2, 3]],
  ])('does not crash when main returns %s', async (_label, value) => {
    // Unexpected *shape*, the third error case. The façade has no business
    // validating it, but it must not throw on the way through — a throw here
    // would surface as a rejected promise the caller never expected, instead of
    // a value it can narrow and reject itself.
    invokeMock.mockResolvedValue(value);

    await expect(call('db', 'query')({ sql: 'SELECT 1' })).resolves.toEqual(value);
  });

  it('propagates a rejection when main does not respond', async () => {
    // Electron rejects the invoke promise when no handler is registered. The
    // façade must not swallow it into a resolved `undefined`, which the caller
    // would read as a successful empty result.
    invokeMock.mockRejectedValue(new Error("No handler registered for 'db:query'"));

    await expect(call('db', 'query')({ sql: 'SELECT 1' })).rejects.toThrow(
      'No handler registered'
    );
  });

  it('propagates a thrown main-process error with its message intact', async () => {
    invokeMock.mockRejectedValue(new Error('SQLITE_CONSTRAINT: FOREIGN KEY failed'));

    await expect(call('db', 'execute')({ sql: 'INSERT' })).rejects.toThrow(
      'SQLITE_CONSTRAINT: FOREIGN KEY failed'
    );
  });

  it('awaits the invoke for void-returning methods', async () => {
    // `stopStream` is `async` and awaits internally. If it returned before the
    // invoke settled, a caller that awaits it would proceed while the stream
    // was still running.
    let settled = false;
    invokeMock.mockImplementation(async () => {
      await Promise.resolve();
      settled = true;
      return { success: true };
    });

    await (cortex.ai.stopStream as AnyFn)('sess-1');
    expect(settled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// streamResponse
// ---------------------------------------------------------------------------

describe('ai.streamResponse', () => {
  const request = { sessionId: 'sess-42', messages: [] };
  const channel = 'ai:stream:sess-42';

  type StreamFn = (
    req: unknown,
    onChunk: (chunk: unknown) => void
  ) => Promise<void>;

  function stream(onChunk: (chunk: unknown) => void, req: unknown = request): Promise<void> {
    return (cortex.ai.streamResponse as StreamFn)(req, onChunk);
  }

  it('subscribes on the per-session channel', () => {
    void stream(() => {}).catch(() => {});
    expect(onMock).toHaveBeenCalledWith(channel, expect.any(Function));
  });

  it('attaches the listener before invoking, so no early chunk is lost', () => {
    // A fast provider can emit its first chunk before the invoke promise
    // settles. If the listener were attached after the invoke resolved, that
    // chunk would be dropped and the UI would miss the start of the answer.
    const order: string[] = [];
    onMock.mockImplementation((ch: string, listener: Listener) => {
      order.push(`on:${ch}`);
      const list = attached.get(ch) ?? [];
      list.push(listener);
      attached.set(ch, list);
    });
    invokeMock.mockImplementation(async (ch: string) => {
      order.push(`invoke:${ch}`);
      return { success: true };
    });

    void stream(() => {}).catch(() => {});

    expect(order).toEqual([`on:${channel}`, 'invoke:ai:stream-response']);
  });

  it('invokes the stream channel with the request', () => {
    void stream(() => {}).catch(() => {});
    expect(invokeMock).toHaveBeenCalledWith('ai:stream-response', request);
  });

  it('forwards every chunk in order and resolves on done', async () => {
    const chunks: unknown[] = [];
    const promise = stream((c) => chunks.push(c));

    emit(channel, { type: 'text', text: 'Hel' });
    emit(channel, { type: 'text', text: 'lo' });
    emit(channel, { type: 'done' });

    await expect(promise).resolves.toBeUndefined();
    expect(chunks).toEqual([
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
      { type: 'done' },
    ]);
  });

  it('detaches its listener after done — no leak per stream', async () => {
    // The known leak in this repo: a finished or cancelled stream whose listener
    // stayed attached for the life of the window. One orphan per stream, each
    // still firing `onChunk` into a component that has moved on.
    const promise = stream(() => {});
    expect(attached.get(channel)).toHaveLength(1);

    emit(channel, { type: 'done' });
    await promise;

    expect(attached.get(channel) ?? []).toHaveLength(0);
  });

  it('rejects on an error chunk, using its message', async () => {
    const promise = stream(() => {});
    emit(channel, { type: 'error', error: 'rate limited' });

    await expect(promise).rejects.toThrow('rate limited');
  });

  it('detaches its listener after an error chunk', async () => {
    const promise = stream(() => {});
    emit(channel, { type: 'error', error: 'boom' });
    await expect(promise).rejects.toThrow();

    expect(attached.get(channel) ?? []).toHaveLength(0);
  });

  it('falls back to a generic message when an error chunk carries none', async () => {
    const promise = stream(() => {});
    emit(channel, { type: 'error' });

    await expect(promise).rejects.toThrow('AI stream failed');
  });

  it('still forwards the error chunk to onChunk before rejecting', async () => {
    // The UI renders the error chunk; swallowing it would leave the message
    // only in the rejection, which callers often log rather than display.
    const chunks: unknown[] = [];
    const promise = stream((c) => chunks.push(c));

    emit(channel, { type: 'error', error: 'nope' });
    await expect(promise).rejects.toThrow('nope');

    expect(chunks).toEqual([{ type: 'error', error: 'nope' }]);
  });

  it('rejects when the stream cannot be started', async () => {
    invokeMock.mockResolvedValue({ success: false, error: { message: 'no provider configured' } });

    await expect(stream(() => {})).rejects.toThrow('no provider configured');
  });

  it('detaches its listener when the stream cannot be started', async () => {
    invokeMock.mockResolvedValue({ success: false, error: { message: 'no provider' } });

    await expect(stream(() => {})).rejects.toThrow();
    expect(attached.get(channel) ?? []).toHaveLength(0);
  });

  it('falls back to a generic message when the failure carries no error field', async () => {
    invokeMock.mockResolvedValue({ success: false });
    await expect(stream(() => {})).rejects.toThrow('Could not start AI stream');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty object', {}],
    ['a bare string', 'weird'],
  ])('rejects when the invoke resolves with %s', async (_label, value) => {
    // Unexpected shape from main. `response?.success` is falsy for all of these,
    // so the stream must fail loudly rather than hang forever waiting for a
    // `done` chunk that is never coming.
    invokeMock.mockResolvedValue(value);

    await expect(stream(() => {})).rejects.toThrow('Could not start AI stream');
  });

  it('rejects when the invoke itself rejects', async () => {
    invokeMock.mockRejectedValue(new Error('IPC transport died'));
    await expect(stream(() => {})).rejects.toThrow('IPC transport died');
  });

  it('detaches its listener when the invoke rejects', async () => {
    invokeMock.mockRejectedValue(new Error('IPC transport died'));

    await expect(stream(() => {})).rejects.toThrow();
    expect(attached.get(channel) ?? []).toHaveLength(0);
  });

  it('does not reject a stream that already finished, even if the invoke fails late', async () => {
    // The `settled` flag. The main process can broadcast `done` and *then* have
    // its invoke reject (or resolve unsuccessfully). Without the flag the
    // already-resolved promise would get a second, conflicting settlement — and
    // in the reject-late case an unhandled rejection.
    let rejectInvoke: (error: Error) => void = () => {};
    invokeMock.mockImplementation(
      () => new Promise((_resolve, reject) => { rejectInvoke = reject; })
    );

    const chunks: unknown[] = [];
    const promise = stream((c) => chunks.push(c));

    emit(channel, { type: 'done' });
    rejectInvoke(new Error('late failure'));

    await expect(promise).resolves.toBeUndefined();
    expect(chunks).toEqual([{ type: 'done' }]);
  });

  it('does not reject a finished stream when the invoke resolves unsuccessfully late', async () => {
    let resolveInvoke: (value: unknown) => void = () => {};
    invokeMock.mockImplementation(
      () => new Promise((resolve) => { resolveInvoke = resolve; })
    );

    const promise = stream(() => {});

    emit(channel, { type: 'done' });
    resolveInvoke({ success: false, error: { message: 'too late' } });

    await expect(promise).resolves.toBeUndefined();
  });

  it('does not run cleanup a second time after the stream already finished', async () => {
    // The observable effect of the `settled` guard on the late-response path.
    //
    // Found by mutation testing: dropping `|| settled` from the `.then` branch
    // left all 79 tests green, because rejecting an already-resolved promise is
    // a no-op and the assertions above could not see it. The one thing that does
    // change is that `cleanup()` runs twice, so `removeListener` is called twice
    // for a single subscription (measured: 2 calls mutated, 1 unmutated).
    //
    // Worth pinning rather than dismissing as harmless: `cleanup` is the seam
    // where a future change (a refcount, a disposal flag, an unsubscribe that is
    // not idempotent) turns "called twice" into a real fault, and this is the
    // assertion that would catch it then.
    let resolveInvoke: (value: unknown) => void = () => {};
    invokeMock.mockImplementation(
      () => new Promise((resolve) => { resolveInvoke = resolve; })
    );

    const promise = stream(() => {});

    emit(channel, { type: 'done' });
    resolveInvoke({ success: false, error: { message: 'too late' } });
    await promise;
    // Let the `.then` continuation run before counting.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
  });

  it('does not run cleanup a second time when the invoke rejects after done', async () => {
    // Same guard, `.catch` branch.
    let rejectInvoke: (error: Error) => void = () => {};
    invokeMock.mockImplementation(
      () => new Promise((_resolve, reject) => { rejectInvoke = reject; })
    );

    const promise = stream(() => {});

    emit(channel, { type: 'done' });
    rejectInvoke(new Error('late failure'));
    await promise;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
  });

  it('uses a channel derived from the session id', async () => {
    // Two concurrent sessions must not cross-talk: a chunk for one session
    // going to the other's callback would interleave two answers in one panel.
    const otherRequest = { sessionId: 'sess-99', messages: [] };
    const chunksA: unknown[] = [];
    const chunksB: unknown[] = [];

    const a = stream((c) => chunksA.push(c));
    const b = stream((c) => chunksB.push(c), otherRequest);

    emit('ai:stream:sess-42', { type: 'text', text: 'for-a' });
    emit('ai:stream:sess-99', { type: 'text', text: 'for-b' });
    emit('ai:stream:sess-42', { type: 'done' });
    emit('ai:stream:sess-99', { type: 'done' });

    await Promise.all([a, b]);

    expect(chunksA).toEqual([{ type: 'text', text: 'for-a' }, { type: 'done' }]);
    expect(chunksB).toEqual([{ type: 'text', text: 'for-b' }, { type: 'done' }]);
  });

  it('ignores chunk types it does not know, without settling', async () => {
    // Forward-compatibility: a new chunk type from main must reach onChunk and
    // must not be mistaken for a terminal chunk.
    const chunks: unknown[] = [];
    const promise = stream((c) => chunks.push(c));

    emit(channel, { type: 'tool_call', name: 'search' });
    emit(channel, { type: 'thinking' });

    let settledEarly = false;
    void promise.then(
      () => { settledEarly = true; },
      () => { settledEarly = true; }
    );
    await Promise.resolve();
    expect(settledEarly).toBe(false);

    emit(channel, { type: 'done' });
    await promise;

    expect(chunks).toEqual([
      { type: 'tool_call', name: 'search' },
      { type: 'thinking' },
      { type: 'done' },
    ]);
  });
});
