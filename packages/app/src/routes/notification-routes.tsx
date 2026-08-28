/**
 * Notifications destination: inbox kinds plus session-derived Code events.
 */

import { createMemo, onMount, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { useSessions } from '../state/sessions-context.tsx';
import { formatAge } from '../state/session-view.ts';
import { markInboxRead, mergeInbox } from '../state/inbox.ts';
import { requestWebPermission } from '../state/os-notify.ts';
import {
  NotificationsScreen,
  type NotificationEntry,
} from '../screens/notifications/notifications-screen.tsx';

export function NotificationsRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();

  onMount(() => {
    void requestWebPermission();
  });

  const entries = createMemo((): NotificationEntry[] => {
    const now = Date.now();
    return mergeInbox(runs.sessions() ?? []).map((item) => ({
      id: item.id,
      message: item.message,
      age: formatAge(item.at, now),
      unread: item.unread,
    }));
  });

  return (
    <NotificationsScreen
      notifications={entries()}
      onOpen={(id) => {
        const item = mergeInbox(runs.sessions() ?? []).find((entry) => entry.id === id);
        markInboxRead(id);
        navigate(item?.href ?? '/code/sessions');
      }}
    />
  );
}
