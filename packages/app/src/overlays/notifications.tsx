import { For, type JSX, Show } from 'solid-js';

import { Scrim } from './scrim.tsx';

import './overlay.css';

export interface AppNotification {
  id: string;
  message: string;
  /** Pre-formatted, e.g. "4m ago". */
  age: string;
  unread?: boolean;
  /** Where opening it goes. Absent for a notification with nothing to open. */
  href?: string;
}

export interface NotificationsProps {
  notifications: readonly AppNotification[];
  onOpen: (id: string) => void;
  onMarkAllRead?: () => void;
  onDismiss: () => void;
}

function NotificationRow(props: {
  notification: AppNotification;
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <li>
      <button
        type="button"
        class="cx-notification"
        onClick={() => props.onOpen(props.notification.id)}
      >
        {/* The lane is reserved on every row, like the sidebar's and the inbox's, so the copy
            shares a vertical lane whether or not a row is unread. */}
        <span class="cx-notification__lane">
          <Show when={props.notification.unread}>
            <span class="cx-notification__dot" role="img" aria-label="Unread" />
          </Show>
        </span>
        <span class="cx-notification__text">
          <span class="cx-notification__message">{props.notification.message}</span>
          <span class="cx-notification__age">{props.notification.age}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * The notifications popover.
 *
 * Mark all read is only offered when something is unread. Showing it against an already-read
 * list gives the user an action that provably does nothing.
 */
export function Notifications(props: NotificationsProps): JSX.Element {
  const unread = () => props.notifications.some((entry) => entry.unread);
  // `unread() && props.onMarkAllRead` would hand the accessor the function only when both
  // are truthy, which is what is wanted here - but written the other way round it would
  // yield the boolean, so the order matters.
  const markAllRead = () => (unread() ? props.onMarkAllRead : undefined);

  return (
    <Scrim label="Notifications" onDismiss={props.onDismiss}>
      <div class="cx-notifications">
        <div class="cx-notifications__header">
          <h2 class="cx-notifications__title">Notifications</h2>
          <Show when={markAllRead()}>
            {(action) => (
              <button type="button" class="cx-notifications__action" onClick={() => action()()}>
                Mark all read
              </button>
            )}
          </Show>
        </div>

        <Show
          when={props.notifications.length > 0}
          fallback={<p class="cx-notifications__empty">Nothing new.</p>}
        >
          <ul class="cx-notifications__list">
            <For each={props.notifications}>
              {(notification) => (
                <NotificationRow notification={notification} onOpen={props.onOpen} />
              )}
            </For>
          </ul>
        </Show>
      </div>
    </Scrim>
  );
}
