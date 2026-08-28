/**
 * Terminal IPC handlers, and the `terminal:list` channel that stops the PTY leak.
 *
 * ## What was broken
 *
 * `TerminalGrid` is a view: switching to Explorer unmounts it. Its terminal list
 * lived in component-local `useState`, so the renderer forgot every terminal it
 * had opened — and since `terminal:kill` is only sent from the close button, the
 * PTY processes stayed alive with nobody reading them. Measured before the fix:
 * 6 terminals over 3 view switches left 6 orphaned shell processes
 * (`scripts/measure-pty-leak.ts`).
 *
 * `TerminalService.listTerminals()` already tracked what was running but was not
 * reachable from the renderer. These tests cover the channel that exposes it and
 * the properties the grid's reattachment depends on:
 *
 *   - a created terminal appears in the list, so it can be reattached;
 *   - a killed terminal does not, so reattachment cannot resurrect a dead tab;
 *   - `cwd` comes back, because the grid displays it after reattaching.
 *
 * `node-pty` is mocked: spawning real shells in a unit test would be slow and
 * would leak processes if a test failed. Real PTYs are covered by the
 * measurement scripts, which is where process-level claims belong.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

// ---------------------------------------------------------------------------
// node-pty mock
// ---------------------------------------------------------------------------

interface FakePty {
  pid: number;
  killed: boolean;
  written: string[];
  resized: Array<{ cols: number; rows: number }>;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (event: { exitCode: number; signal?: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  /** Drives the PTY's own exit, as if the shell had terminated. */
  emitExit: (code: number) => void;
}

const spawned: FakePty[] = [];
let nextPid = 1000;

const spawnMock = vi.fn((_shell: string, _args: string[], options: { cwd: string }) => {
  let exitCallback: ((event: { exitCode: number; signal?: number }) => void) | undefined;

  const pty: FakePty = {
    pid: nextPid++,
    killed: false,
    written: [],
    resized: [],
    onData: () => {},
    onExit: (cb) => {
      exitCallback = cb;
    },
    write: (data) => {
      pty.written.push(data);
    },
    resize: (cols, rows) => {
      pty.resized.push({ cols, rows });
    },
    kill: () => {
      pty.killed = true;
    },
    emitExit: (code) => {
      exitCallback?.({ exitCode: code });
    },
  };

  // Recorded so assertions can check the cwd the service resolved.
  (pty as FakePty & { cwd: string }).cwd = options.cwd;
  spawned.push(pty);
  return pty;
});

vi.mock('node-pty', () => ({ spawn: spawnMock }));

// Imported after the mock is registered.
const { registerTerminalHandlers, unregisterTerminalHandlers, TERMINAL_LIST_CHANNEL } = await import(
  '../terminal-handlers'
);
const { getTerminalService, resetTerminalService } = await import(
  '../../../services/terminal-service'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface IpcOk<T> {
  success: true;
  data: T;
}

interface IpcFail {
  success: false;
  error: { code: string; message: string };
}

type IpcResult<T> = IpcOk<T> | IpcFail;

async function invoke<T>(channel: string, payload?: unknown): Promise<IpcResult<T>> {
  const handler = registeredHandlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return (await handler({}, payload)) as IpcResult<T>;
}

function expectOk<T>(result: IpcResult<T>): T {
  if (!result.success) {
    throw new Error(`Expected success, got failure: ${result.error.message}`);
  }
  return result.data;
}

interface TerminalListData {
  terminals: Array<{ id: string; pid: number; cwd: string; shell: string }>;
}

async function createTerminal(cwd?: string): Promise<string> {
  const data = expectOk(await invoke<{ terminalId: string; pid: number }>('terminal:create', { cwd }));
  return data.terminalId;
}

async function listTerminals() {
  return expectOk(await invoke<TerminalListData>(TERMINAL_LIST_CHANNEL, undefined)).terminals;
}

describe('terminal handlers', () => {
  beforeEach(() => {
    resetElectronMock();
    spawned.length = 0;
    spawnMock.mockClear();
    // Seed the singleton with the mock spawn so register() never createRequire's
    // the native addon. `vi.mock('node-pty')` does not intercept createRequire.
    resetTerminalService();
    getTerminalService(spawnMock);
    registerTerminalHandlers();
  });

  afterEach(() => {
    // Also kills every PTY through `TerminalService.cleanup()`, so no fake
    // terminal leaks into the next test.
    unregisterTerminalHandlers();
    resetTerminalService();
  });

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  describe('registration', () => {
    it('registers terminal:list alongside the existing channels', () => {
      expect([...registeredHandlers.keys()].sort()).toEqual(
        ['terminal:create', 'terminal:input', 'terminal:kill', 'terminal:list', 'terminal:resize'].sort()
      );
    });

    it('uses the channel name the preload allowlist and renderer expect', () => {
      // The bridge rejects unlisted channels, so a rename here would break
      // reattachment at runtime rather than at build time.
      expect(TERMINAL_LIST_CHANNEL).toBe('terminal:list');
    });

    it('removes terminal:list on unregister', () => {
      unregisterTerminalHandlers();

      expect(registeredHandlers.has(TERMINAL_LIST_CHANNEL)).toBe(false);
    });

    it('kills every PTY on unregister, which is the app-quit path', async () => {
      await createTerminal();
      await createTerminal();
      expect(spawned).toHaveLength(2);

      unregisterTerminalHandlers();

      expect(spawned.every((pty) => pty.killed)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // terminal:list — what reattachment reads
  // -------------------------------------------------------------------------

  describe('terminal:list', () => {
    it('is empty when nothing is running', async () => {
      expect(await listTerminals()).toEqual([]);
    });

    it('reports a created terminal so the grid can reattach to it', async () => {
      const id = await createTerminal('/tmp/project');

      const terminals = await listTerminals();
      expect(terminals).toHaveLength(1);
      expect(terminals[0].id).toBe(id);
      expect(terminals[0].cwd).toBe('/tmp/project');
      expect(terminals[0].pid).toBeGreaterThan(0);
      expect(terminals[0].shell).toBeTruthy();
    });

    it('reports every live terminal', async () => {
      const first = await createTerminal();
      const second = await createTerminal();
      const third = await createTerminal();

      expect((await listTerminals()).map((t) => t.id)).toEqual([first, second, third]);
    });

    it('omits a killed terminal', async () => {
      const kept = await createTerminal();
      const doomed = await createTerminal();

      expectOk(await invoke('terminal:kill', doomed));

      const ids = (await listTerminals()).map((t) => t.id);
      expect(ids).toEqual([kept]);
    });

    it('omits a terminal that exited on its own', async () => {
      const id = await createTerminal();
      expect(await listTerminals()).toHaveLength(1);

      // The shell terminated (the user typed `exit`). Reattachment must not
      // offer a tab that can never produce output again.
      spawned[0].emitExit(0);

      expect(await listTerminals()).toEqual([]);
      expect(id).toBeTruthy();
    });

    it('accepts a call with no payload, as window.ipc sends it', async () => {
      // `ipcRenderer.invoke(channel)` transmits `undefined`; a `z.object({})`
      // schema would reject that and turn a valid call into a validation error.
      expect(expectOk(await invoke<TerminalListData>(TERMINAL_LIST_CHANNEL)).terminals).toEqual([]);
    });

    it('tolerates an empty object payload', async () => {
      expect(
        expectOk(await invoke<TerminalListData>(TERMINAL_LIST_CHANNEL, {})).terminals
      ).toEqual([]);
    });

    it('rejects a payload of the wrong type, signalling a bad renderer call', async () => {
      const result = await invoke<TerminalListData>(TERMINAL_LIST_CHANNEL, 'nonsense');

      expect(result.success).toBe(false);
    });

    it('returns a snapshot, not a live view onto service state', async () => {
      await createTerminal();
      const snapshot = await listTerminals();

      await createTerminal();

      // The first response must not have mutated behind the caller's back.
      expect(snapshot).toHaveLength(1);
      expect(await listTerminals()).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // The rest of the surface the grid uses, so reattachment is actually usable
  // -------------------------------------------------------------------------

  describe('reattached terminals stay usable', () => {
    it('accepts input for a terminal created earlier', async () => {
      const id = await createTerminal();

      expectOk(await invoke('terminal:input', { terminalId: id, data: 'ls\r' }));

      expect(spawned[0].written).toEqual(['ls\r']);
    });

    it('accepts a resize, which the grid sends on remount', async () => {
      const id = await createTerminal();

      expectOk(await invoke('terminal:resize', { terminalId: id, cols: 120, rows: 40 }));

      expect(spawned[0].resized).toEqual([{ cols: 120, rows: 40 }]);
    });

    it('fails input for an unknown terminal instead of throwing across IPC', async () => {
      const result = await invoke('terminal:input', { terminalId: 'ghost', data: 'x' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TERMINAL_INPUT_FAILED');
      }
    });

    it('treats killing an unknown terminal as a no-op', async () => {
      // The grid can ask twice (close button, then the exit event), and the
      // second call must not surface an error.
      expectOk(await invoke('terminal:kill', 'ghost'));
    });
  });

  // -------------------------------------------------------------------------
  // The service's own bookkeeping
  // -------------------------------------------------------------------------

  describe('TerminalService inventory', () => {
    it('is the same source terminal:list reports from', async () => {
      const id = await createTerminal();

      expect(getTerminalService().listTerminals().map((t) => t.id)).toEqual([id]);
    });

    it('drops a terminal from the map when its PTY exits', async () => {
      await createTerminal();

      spawned[0].emitExit(0);

      expect(getTerminalService().getTerminal('missing')).toBeUndefined();
      expect(getTerminalService().listTerminals()).toEqual([]);
    });
  });
});
