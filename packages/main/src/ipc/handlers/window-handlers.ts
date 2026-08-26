/**
 * Window IPC Handlers — what the native frame used to do.
 *
 * The app draws its own title bar, so minimize/maximize/close arrive over IPC
 * from the renderer's buttons. Every handler resolves the window FROM THE
 * SENDER: acting on "the focused window" would let a background window's
 * stray call close the one the user is looking at.
 */

import { BrowserWindow, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

import { IPC_CHANNELS } from '@cortex-ide/shared';
import type { IsWindowMaximizedResponse } from '@cortex-ide/shared';

export const WINDOW_CHANNELS = [
  IPC_CHANNELS.WINDOW_MINIMIZE,
  IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE,
  IPC_CHANNELS.WINDOW_CLOSE,
  IPC_CHANNELS.WINDOW_IS_MAXIMIZED,
] as const;

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

type Envelope<T> = { success: true; data: T };

function ok<T>(data: T): Envelope<T> {
  return { success: true, data };
}

export function registerWindowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    senderWindow(event)?.minimize();
    return ok({ minimized: true });
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE, (event) => {
    const window = senderWindow(event);
    if (!window) return ok<IsWindowMaximizedResponse>({ maximized: false });

    if (window.isMaximized()) window.unmaximize();
    else window.maximize();

    return ok<IsWindowMaximizedResponse>({ maximized: window.isMaximized() });
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    senderWindow(event)?.close();
    return ok({ closed: true });
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (event) =>
    ok<IsWindowMaximizedResponse>({ maximized: senderWindow(event)?.isMaximized() ?? false }),
  );
}

export function unregisterWindowHandlers(): void {
  WINDOW_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
