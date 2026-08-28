/**
 * In-app notification inbox. Code-run items are derived from sessions;
 * the other kinds are posted here by Planning, Chat, and Bot.
 */

import { createSignal } from 'solid-js';

import { readJson, writeJson } from './persist.ts';

export type InboxKind =
  | 'scheduled-task'
  | 'mention'
  | 'code-run-done'
  | 'code-run-blocked'
  | 'bot-ask-user'
  | 'farm-wake-fail';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  message: string;
  at: number;
  unread: boolean;
  href?: string;
}

const STORAGE_KEY = 'cortex.inbox.v1';

const [posted, setPosted] = createSignal<InboxItem[]>(readJson(STORAGE_KEY, []));

export { posted as postedInbox };

function persist(next: InboxItem[]): void {
  setPosted(next);
  writeJson(STORAGE_KEY, next);
}

export function postInbox(item: Omit<InboxItem, 'id' | 'at' | 'unread'> & { at?: number }): InboxItem {
  const next: InboxItem = {
    ...item,
    id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: item.at ?? Date.now(),
    unread: true,
  };
  persist([next, ...posted()].slice(0, 100));
  return next;
}

export function markInboxRead(id?: string): void {
  persist(
    posted().map((item) => {
      if (id && item.id !== id) return item;
      return { ...item, unread: false };
    }),
  );
}

export function inboxFromSessions(
  sessions: readonly { id: string; title: string; status: string; updatedAt: number }[],
): InboxItem[] {
  return sessions
    .filter((session) => session.status === 'review' || session.status === 'failed' || session.status === 'blocked')
    .map((session) => ({
      id: `run:${session.id}`,
      kind: session.status === 'blocked' ? 'code-run-blocked' : 'code-run-done',
      message:
        session.status === 'failed'
          ? `${session.title} failed`
          : session.status === 'blocked'
            ? `${session.title} is waiting on a permission`
            : `${session.title} is ready to review`,
      at: session.updatedAt,
      unread: session.status === 'review' || session.status === 'blocked',
      href: `/code/sessions/${session.id}`,
    }));
}

/** Posted items plus session-derived items, newest first. */
export function mergeInbox(
  sessions: readonly { id: string; title: string; status: string; updatedAt: number }[],
): InboxItem[] {
  return [...posted(), ...inboxFromSessions(sessions)].sort((a, b) => b.at - a.at).slice(0, 50);
}
