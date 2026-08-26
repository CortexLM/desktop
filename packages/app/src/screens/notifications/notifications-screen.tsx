import { For, type JSX, Show } from 'solid-js';

import { Icon } from '@cortex-ide/ui';

import './notifications.css';

export interface NotificationEntry {
  id: string;
  message: string;
  /** Pre-formatted, e.g. "4m ago". */
  age: string;
  /** Marks entries the user has not opened yet. */
  unread?: boolean;
}

export interface NotificationsScreenProps {
  notifications: readonly NotificationEntry[];
  onOpen: (id: string) => void;
}

/**
 * The Notifications surface (C3 / Code / Notifications): runs that finished or
 * failed while you were elsewhere, newest first, on chrome-free rows.
 */
export function NotificationsScreen(props: NotificationsScreenProps): JSX.Element {
  return (
    <div class="cx-notifications-page">
      <header class="cx-notifications-page__header">
        <h1 class="cx-notifications-page__title">Notifications</h1>
      </header>

      <Show
        when={props.notifications.length > 0}
        fallback={
          <div class="cx-notifications-page__empty">
            <Icon name="inbox" size={26} strokeWidth={1.6} />
            <p class="cx-notifications-page__empty-title">Nothing needs you</p>
            <p class="cx-notifications-page__empty-body">
              Runs that finish or fail while you are elsewhere will land here.
            </p>
          </div>
        }
      >
        <ul class="cx-notifications-page__list">
          <For each={props.notifications}>
            {(entry) => (
              <li>
                <button
                  type="button"
                  class="cx-notifications-page__row"
                  onClick={() => props.onOpen(entry.id)}
                >
                  <Show when={entry.unread}>
                    <span class="cx-notifications-page__dot" aria-label="Unread" role="img" />
                  </Show>
                  <span class="cx-notifications-page__message">{entry.message}</span>
                  <span class="cx-notifications-page__age">{entry.age}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
