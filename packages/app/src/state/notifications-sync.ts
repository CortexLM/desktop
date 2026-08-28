/**
 * REST notification list / mark-read from the control plane.
 * Local inbox ids (`n_…`, `run:…`) never hit the service.
 */

import { createHttpProductSurface, isCortexApiError, markNotificationRead } from '@cortex-ide/cortex-api';

import { postInbox, type InboxKind } from './inbox.ts';
import { liveSession } from './realtime-session.ts';

function isLocalInboxId(id: string): boolean {
  return id.startsWith('n_') || id.startsWith('run:');
}

export function markRemoteNotificationRead(id: string): void {
  const live = liveSession();
  if (!live || isLocalInboxId(id)) return;
  void markNotificationRead(live.client, id).catch(() => undefined);
}

export async function hydrateRemoteNotifications(): Promise<void> {
  const live = liveSession();
  if (!live) return;
  try {
    const rows = await createHttpProductSurface(live.client).listNotifications();
    for (const row of rows) {
      if (!row.id || !row.message) continue;
      postInbox({
        id: row.id,
        kind: remoteKind(row.kind),
        message: row.message,
        href: row.href,
      });
    }
  } catch (error) {
    if (isCortexApiError(error) && error.code === 'not_found') return;
  }
}

function remoteKind(kind: string | undefined): InboxKind {
  if (kind === 'scheduled-task' || kind === 'mention') return kind;
  if (kind === 'code-run-done' || kind === 'code-run-blocked') return kind;
  if (kind === 'bot-ask-user' || kind === 'farm-wake-fail') return kind;
  return 'mention';
}
