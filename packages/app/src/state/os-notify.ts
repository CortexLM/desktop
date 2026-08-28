/**
 * OS / Web banners for inbox events.
 *
 * Electron goes through main (`notify:show`) so the banner works when the
 * window is unfocused. The browser uses the Notification API after permission.
 * A denied permission is not an error — the in-app center still works.
 */

import { chromePlatform } from './platform.ts';
import type { InboxKind } from './inbox.ts';

export interface OsNotifyPayload {
  title: string;
  body: string;
  kind: InboxKind;
}

interface NotifyBridge {
  show: (payload: OsNotifyPayload) => Promise<unknown>;
}

function electronNotify(): NotifyBridge | undefined {
  return (globalThis as { cortex?: { notify?: NotifyBridge } }).cortex?.notify;
}

export async function requestWebPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function showOsNotification(payload: OsNotifyPayload): Promise<void> {
  const bridge = electronNotify();
  if (bridge) {
    await bridge.show(payload);
    return;
  }

  if (chromePlatform() !== 'browser' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(payload.title, { body: payload.body, tag: payload.kind });
  } catch {
    // Permission can race; the in-app row is already posted.
  }
}
