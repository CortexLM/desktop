import { type JSX, Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { StatusBadge, type SessionStatus } from './badge.tsx';

import './session-card.css';

export interface DiffStat {
  added: number;
  removed: number;
}

export interface SessionCardProps extends JSX.HTMLAttributes<HTMLElement> {
  title: string;
  status: SessionStatus;
  /** Overrides the badge copy, e.g. to append an elapsed time. */
  statusLabel?: string;
  /** Branch the session works on. Truncates before the trailing group does. */
  branch?: string;
  diff?: DiffStat;
  /** Pre-formatted relative age, e.g. "2h ago". */
  age?: string;
  onOpen?: (event: MouseEvent) => void;
}

/**
 * Formats a diff stat the way the design does.
 *
 * The removed count uses U+2212 MINUS SIGN, not a hyphen. The design sets it that way, and
 * at 12px a hyphen sits noticeably higher and shorter than the plus it pairs with.
 */
function formatAdded(count: number): string {
  return `+${count}`;
}

function formatRemoved(count: number): string {
  return `\u2212${count}`;
}

/**
 * The session summary card from the UI kit, used on Home and in the sessions list.
 *
 * The meta row separates its two halves with a flex-grow spacer rather than
 * `space-between`, so the diff stats and age stay grouped on the right while a long branch
 * name truncates on the left.
 */
export function SessionCard(props: SessionCardProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'title',
    'status',
    'statusLabel',
    'branch',
    'diff',
    'age',
    'onOpen',
    'class',
  ]);

  const interactive = () => Boolean(local.onOpen);

  const classes = () =>
    [
      'cx-session-card',
      interactive() ? 'cx-session-card--interactive' : '',
      local.class ?? '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <Dynamic
      component={interactive() ? 'button' : 'article'}
      class={classes()}
      type={interactive() ? 'button' : undefined}
      onClick={local.onOpen}
      {...rest}
    >
      <div class="cx-session-card__header">
        <span class="cx-session-card__title">{local.title}</span>
        <StatusBadge status={local.status} label={local.statusLabel} />
      </div>

      <div class="cx-session-card__meta">
        <Show when={local.branch}>
          {(branch) => <span class="cx-session-card__branch">{branch()}</span>}
        </Show>
        <span class="cx-session-card__spacer" />
        <Show when={local.diff}>
          {(diff) => (
            <>
              <span class="cx-session-card__added">{formatAdded(diff().added)}</span>
              <span class="cx-session-card__removed">{formatRemoved(diff().removed)}</span>
            </>
          )}
        </Show>
        <Show when={local.age}>{(age) => <span class="cx-session-card__age">{age()}</span>}</Show>
      </div>
    </Dynamic>
  );
}
