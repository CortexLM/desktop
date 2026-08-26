import { For, type JSX, Show } from 'solid-js';

import { SESSION_STATUS_TONES, type SessionStatus } from '@cortex-ide/ui';

export interface RecentSessionRow {
  id: string;
  title: string;
  /** Repo and branch, shown as one muted line under the title. */
  context: string;
  status: SessionStatus;
  diff?: { added: number; removed: number };
  /** Pre-formatted, e.g. "4m ago" or "Yesterday". */
  age: string;
}

export interface RecentSessionsProps {
  rows: readonly RecentSessionRow[];
  onOpen: (id: string) => void;
  onViewAll?: () => void;
}

/** The dot takes the status tone: copper for live, green for landed, red for failed. */
function statusClass(status: SessionStatus): string {
  return `cx-recent__status cx-recent__status--${SESSION_STATUS_TONES[status].tone}`;
}

/**
 * The recent-sessions table on Home.
 *
 * The status, diff and age columns are fixed-width lanes rather than content-sized. With
 * content sizing, the diff figures would sit at a different x on every row - the failure
 * mode the design's repeated-row guidance is specifically about.
 */
export function RecentSessions(props: RecentSessionsProps): JSX.Element {
  return (
    <section class="cx-recent" aria-label="Recent sessions">
      <div class="cx-recent__header">
        <h2 class="cx-recent__title">Recent sessions</h2>
        <Show when={props.onViewAll}>
          {(viewAll) => (
            <button type="button" class="cx-recent__link" onClick={() => viewAll()()}>
              View all
            </button>
          )}
        </Show>
      </div>

      <div class="cx-recent__list">
        <For each={props.rows}>
          {(row) => (
            <button type="button" class="cx-recent__row" onClick={() => props.onOpen(row.id)}>
              <span class="cx-recent__row-text">
                <span class="cx-recent__row-title">{row.title}</span>
                <span class="cx-recent__row-meta">{row.context}</span>
              </span>

              <span class={statusClass(row.status)}>{SESSION_STATUS_TONES[row.status].label}</span>

              <span class="cx-recent__spacer" aria-hidden="true" />

              <span class="cx-recent__diff">
                <Show when={row.diff}>
                  {(diff) => (
                    <>
                      <span class="cx-recent__added">+{diff().added}</span>
                      <span class="cx-recent__removed">{'\u2212'}{diff().removed}</span>
                    </>
                  )}
                </Show>
              </span>

              <span class="cx-recent__age">{row.age}</span>
            </button>
          )}
        </For>
      </div>
    </section>
  );
}
