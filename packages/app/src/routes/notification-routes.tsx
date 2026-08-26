/**
 * The Notifications route: runs that finished or failed, as a destination.
 *
 * Derived from the run store rather than kept in a store of its own — a
 * notification here IS a run in a notable state, so a second store would just be
 * a cache of the first with its own staleness.
 */

import { createMemo, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { useSessions } from '../state/sessions-context.tsx';
import { formatAge } from '../state/session-view.ts';
import {
  NotificationsScreen,
  type NotificationEntry,
} from '../screens/notifications/notifications-screen.tsx';

function toEntries(
  sessions: readonly { id: string; title: string; status: string; updatedAt: number }[],
  now: number,
): NotificationEntry[] {
  return sessions
    .filter((session) => session.status === 'review' || session.status === 'failed')
    .slice(0, 50)
    .map((session) => ({
      id: session.id,
      message:
        session.status === 'failed'
          ? `${session.title} failed`
          : `${session.title} is ready to review`,
      age: formatAge(session.updatedAt, now),
      unread: session.status === 'review',
    }));
}

export function NotificationsRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();

  const entries = createMemo(() => toEntries(runs.sessions() ?? [], Date.now()));

  return (
    <NotificationsScreen
      notifications={entries()}
      onOpen={(id) => navigate(`/code/sessions/${id}`)}
    />
  );
}
