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
    <div class="cx-notifications">
      <header class="cx-notifications__header">
        <h1 class="cx-notifications__title">Notifications</h1>
      </header>

      <Show
        when={props.notifications.length > 0}
        fallback={
          <div class="cx-notifications__empty">
            <Icon name="inbox" size={26} strokeWidth={1.6} />
            <p class="cx-notifications__empty-title">Nothing needs you</p>
            <p class="cx-notifications__empty-body">
              Runs that finish or fail while you are elsewhere will land here.
            </p>
          </div>
        }
      >
        <ul class="cx-notifications__list">
          <For each={props.notifications}>
            {(entry) => (
              <li>
                <button
                  type="button"
                  class="cx-notifications__row"
                  onClick={() => props.onOpen(entry.id)}
                >
                  <Show when={entry.unread}>
                    <span class="cx-notifications__dot" aria-label="Unread" role="img" />
                  </Show>
                  <span class="cx-notifications__message">{entry.message}</span>
                  <span class="cx-notifications__age">{entry.age}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
