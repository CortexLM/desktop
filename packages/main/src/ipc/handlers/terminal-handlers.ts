/**
 * Terminal IPC Handlers
 *
 * ## `terminal:list` and why it exists
 *
 * `TerminalService` owns the PTY processes and outlives any view. The renderer's
 * `TerminalGrid` is a view: switching to Explorer unmounts it. With no way to ask
 * main what is running, the renderer forgot every terminal it had opened and
 * never sent `terminal:kill` — so one shell process leaked per terminal, alive
 * with nobody reading it. Measured before the fix: 6 terminals created across 3
 * view switches left 6 orphaned PTYs (`scripts/measure-pty-leak.ts`).
 *
 * `terminal:list` closes that gap by exposing the inventory
 * `TerminalService.listTerminals()` already kept, so the grid can reattach on
 * mount instead of losing track. Killing on unmount was the alternative and was
 * rejected: it would destroy a running build every time the user glanced at Git.
 *
 * The channel is declared here, next to its handler, rather than in
 * `@cortex-ide/shared`'s `IPC_CHANNELS` — same as `workspace:*`, `search:*` and
 * `git:stash-*`, which are the channels served over `window.ipc`. It must also
 * be listed in the preload allowlist (`packages/preload/src/index.ts`), which
 * rejects anything unlisted.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { getTerminalService } from '../../services/terminal-service';
import { NoPayloadSchema, type NoPayload } from '@cortex-ide/shared';
import {
  IPC_CHANNELS,
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalInputRequest,
  TerminalResizeRequest,
  IPCResponse,
} from '@cortex-ide/shared/types/ipc';
import { createHandler } from './shared/handler-factory';
import { activeWorkspacePath } from '../../services/active-workspace';

/** Channel serving the live terminal inventory to the renderer. */
export const TERMINAL_LIST_CHANNEL = 'terminal:list';

/** One live PTY, as reported to the renderer. */
export interface TerminalSummary {
  id: string;
  pid: number;
  cwd: string;
  shell: string;
}

export interface TerminalListResponse {
  terminals: TerminalSummary[];
}

/**
 * Lists the PTYs currently running in the main process.
 *
 * Returns the service's own inventory, so a terminal that has already exited is
 * absent (`TerminalService` removes it on the PTY's `exit` event). That matters
 * for the caller: the grid rebuilds its tab list from this, and a dead terminal
 * must not come back as a tab that can never produce output.
 */
export const handleTerminalList = createHandler<NoPayload, TerminalListResponse>(
  NoPayloadSchema,
  async () => ({ terminals: getTerminalService().listTerminals() })
);

/**
 * Enregistre les handlers IPC pour les terminaux
 */
export function registerTerminalHandlers() {
  const terminalService = getTerminalService();

  // Gestionnaire: Lister les terminaux actifs
  ipcMain.handle(TERMINAL_LIST_CHANNEL, handleTerminalList);

  // Gestionnaire: Créer un terminal
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_, request: CreateTerminalRequest): Promise<IPCResponse<CreateTerminalResponse>> => {
      try {
        const terminalId = randomUUID();

        // The active workspace, when the caller named no directory. The renderer is
        // deliberately never sent a disk path, so it *cannot* ask for the right one —
        // without this default a session's shell opens in the home directory and the
        // user's first command is a `cd` into the repository they are already working
        // in.
        const cwd = request.cwd ?? (await activeWorkspacePath());

        const terminal = terminalService.createTerminal(terminalId, {
          ...(cwd ? { cwd } : {}),
          env: request.env,
          shell: request.shell,
        });

        return {
          success: true,
          data: {
            terminalId,
            pid: terminal.pid,
          },
        };
      } catch (error) {
        console.error('Failed to create terminal:', error);
        return {
          success: false,
          error: {
            code: 'TERMINAL_CREATE_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error,
          },
        };
      }
    }
  );

  // Gestionnaire: Input terminal
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_INPUT,
    async (_, request: TerminalInputRequest): Promise<IPCResponse<void>> => {
      try {
        terminalService.writeToTerminal(request.terminalId, request.data);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('Failed to write to terminal:', error);
        return {
          success: false,
          error: {
            code: 'TERMINAL_INPUT_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error,
          },
        };
      }
    }
  );

  // Gestionnaire: Resize terminal
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_RESIZE,
    async (_, request: TerminalResizeRequest): Promise<IPCResponse<void>> => {
      try {
        terminalService.resizeTerminal(request.terminalId, request.cols, request.rows);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('Failed to resize terminal:', error);
        return {
          success: false,
          error: {
            code: 'TERMINAL_RESIZE_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error,
          },
        };
      }
    }
  );

  // Gestionnaire: Kill terminal
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_KILL,
    async (_, terminalId: string): Promise<IPCResponse<void>> => {
      try {
        terminalService.killTerminal(terminalId);
        return { success: true, data: undefined };
      } catch (error) {
        console.error('Failed to kill terminal:', error);
        return {
          success: false,
          error: {
            code: 'TERMINAL_KILL_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error,
          },
        };
      }
    }
  );

  // Événements: Terminal data
  terminalService.on('data', (terminalId: string, data: string) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send(IPC_CHANNELS.EVENT_TERMINAL_DATA, {
        type: 'terminal-data',
        terminalId,
        data,
      });
    });
  });

  // Événements: Terminal exit
  terminalService.on('exit', (terminalId: string, exitCode: number) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send(IPC_CHANNELS.EVENT_TERMINAL_EXIT, {
        type: 'terminal-exit',
        terminalId,
        exitCode,
      });
    });
  });
}

/**
 * Désenregistre les handlers IPC pour les terminaux
 */
export function unregisterTerminalHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_CREATE);
  ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_INPUT);
  ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_RESIZE);
  ipcMain.removeHandler(IPC_CHANNELS.TERMINAL_KILL);
  ipcMain.removeHandler(TERMINAL_LIST_CHANNEL);

  
  // Cleanup terminal service
  const terminalService = getTerminalService();
  terminalService.cleanup();
  terminalService.removeAllListeners();
}
