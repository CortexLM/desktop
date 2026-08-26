/**
 * The renderer's view of a PTY.
 *
 * The shell itself runs in main, via `node-pty`. It has to: a pseudo-terminal is an
 * OS object, and the renderer is sandboxed with no Node integration. What crosses
 * the bridge is bytes in one direction and bytes out the other, plus a size.
 *
 * **Main assigns the id.** `terminal:create` ignores whatever `terminalId` a caller
 * sends and answers with its own, so everything afterwards — writes, resizes and the
 * `onData` filter — has to use the returned value. Filtering on a locally-invented id
 * silently matches nothing, which renders as a terminal that mounts, sizes itself
 * correctly and stays blank forever.
 */

import type { IPCResponse } from '@cortex-ide/shared';

export interface TerminalHost {
  /** Resolves with the id main assigned, which every later call must use. */
  create(options: { cwd?: string; cols: number; rows: number }): Promise<string>;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  kill(id: string): void;
  onData(listener: (event: { terminalId: string; data: string }) => void): () => void;
  onExit(listener: (event: { terminalId: string }) => void): () => void;
  /** False under the preview server and the suites, where there is no PTY to open. */
  readonly available: boolean;
}

interface TerminalBridge {
  create(request: {
    cwd?: string;
    cols?: number;
    rows?: number;
  }): Promise<IPCResponse<{ terminalId: string }>>;
  input(request: { terminalId: string; data: string }): Promise<IPCResponse<unknown>>;
  resize(request: {
    terminalId: string;
    cols: number;
    rows: number;
  }): Promise<IPCResponse<unknown>>;
  kill(terminalId: string): Promise<IPCResponse<unknown>>;
  onData(callback: (event: { terminalId: string; data: string }) => void): () => void;
  onExit(callback: (event: { terminalId: string }) => void): () => void;
}

function bridge(): TerminalBridge | undefined {
  return (globalThis as { cortex?: { terminal?: TerminalBridge } }).cortex?.terminal;
}

export function resolveTerminalHost(): TerminalHost {
  const api = bridge();

  if (!api) {
    return {
      available: false,
      create: async () => '',
      write: () => {},
      resize: () => {},
      kill: () => {},
      onData: () => () => {},
      onExit: () => () => {},
    };
  }

  return {
    available: true,
    create: async (options) => {
      const response = await api.create({
        cols: options.cols,
        rows: options.rows,
        ...(options.cwd ? { cwd: options.cwd } : {}),
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data.terminalId;
    },
    // Writes are fire-and-forget. Awaiting each keystroke would put an IPC round
    // trip between the key and the echo, which reads as a laggy terminal.
    write: (id, data) => void api.input({ terminalId: id, data }),
    resize: (id, cols, rows) => void api.resize({ terminalId: id, cols, rows }),
    kill: (id) => void api.kill(id),
    onData: (listener) => api.onData(listener),
    onExit: (listener) => api.onExit(listener),
  };
}
