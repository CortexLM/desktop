/**
 * OS notification banners. The renderer already posted the in-app row;
 * this is the Electron `Notification` when the window is in the background.
 *
 * Titles only — never log the body (it can name a private repo).
 */

import { Notification, ipcMain } from 'electron';

import { IPC_CHANNELS } from '@cortex-ide/shared';
import type { NotifyShowRequest, NotifyShowResponse } from '@cortex-ide/shared';

export function registerNotifyHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.NOTIFY_SHOW, (_event, request: NotifyShowRequest) => {
    const payload: NotifyShowResponse = { shown: false };
    if (!Notification.isSupported()) return { success: true, data: payload };

    const banner = new Notification({
      title: request.title,
      body: request.body,
      silent: false,
    });
    banner.show();
    return { success: true, data: { shown: true } satisfies NotifyShowResponse };
  });
}

export function unregisterNotifyHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.NOTIFY_SHOW);
}
