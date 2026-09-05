/**
 * Fans realtime events into the inbox, OS banners, and harness flags.
 *
 * Chat token streams are handled by the Chat host. This module is the rest:
 * notifications, Bot ask-user, Code permission blocks, farm wake failures.
 */

import { createSignal } from 'solid-js';

import { isConnectionLocalType, type RealtimeEvent, type RealtimeStatus } from '@cortex-ide/cortex-api';

import { applyBotRealtime } from './bot-realtime.ts';
import { postInbox, type InboxKind } from './inbox.ts';
import { showOsNotification } from './os-notify.ts';

const [realtimeStatus, setStatus] = createSignal<RealtimeStatus>('idle');
const [codePermissionBlocked, setCodePermissionBlocked] = createSignal(false);

export { realtimeStatus, codePermissionBlocked };

export function setRealtimeStatus(status: RealtimeStatus): void {
  setStatus(status);
}

const EVENT_HANDLERS: Record<string, (event: RealtimeEvent) => void> = {
  'code.permission': applyCodeBlocked,
  'bot.ask_user': (event) =>
    postAndNotify('bot-ask-user', event.message ?? 'A mascot needs you', event.href ?? botHref(event.mascot_id)),
  'farm.wake_fail': (event) =>
    postAndNotify(
      'farm-wake-fail',
      event.message ?? 'A computer failed to wake',
      event.href ?? botHref(event.mascot_id),
    ),
  send_to_user: notifyBotMessage,
  'bot.send_to_user': notifyBotMessage,
};

export function applyRealtimeEvent(event: RealtimeEvent): void {
  if (isConnectionLocalType(event.type)) return;
  applyBotRealtime(event);
  if (event.type === 'code.run' && event.status === 'done') {
    setCodePermissionBlocked(false);
    postAndNotify('code-run-done', event.message ?? 'A Code session finished', event.href);
    return;
  }
  const handler = EVENT_HANDLERS[event.type];
  if (handler) {
    handler(event);
    return;
  }
  if (event.type === 'notification' && event.message) {
    postAndNotify(inboxKind(event.kind), event.message, event.href);
  }
}

function notifyBotMessage(event: RealtimeEvent): void {
  const text = event.message;
  if (!text) return;
  postAndNotify('bot-message', text, event.href ?? botHref(event.mascot_id));
}

function applyCodeBlocked(event: RealtimeEvent): void {
  setCodePermissionBlocked(true);
  postAndNotify(
    'code-run-blocked',
    event.message ?? 'A Code session is waiting on a permission',
    event.href,
  );
}

function postAndNotify(kind: InboxKind, message: string, href?: string): void {
  const item = postInbox({ kind, message, href });
  void showOsNotification({ title: titleFor(kind), body: item.message, kind });
}

function inboxKind(kind: string | undefined): InboxKind {
  if (kind === 'scheduled-task' || kind === 'mention') return kind;
  if (kind === 'code-run-done' || kind === 'code-run-blocked') return kind;
  if (kind === 'bot-ask-user' || kind === 'bot-message' || kind === 'farm-wake-fail') return kind;
  return 'mention';
}

function titleFor(kind: InboxKind): string {
  if (kind.startsWith('code')) return 'Code';
  if (kind.startsWith('bot') || kind === 'farm-wake-fail') return 'Bot';
  return 'Chat';
}

function botHref(mascotId?: string): string | undefined {
  return mascotId ? `/bot/${mascotId}` : undefined;
}
