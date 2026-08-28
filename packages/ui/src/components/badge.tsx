import { type JSX, Show, splitProps } from 'solid-js';

import './badge.css';

export type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'accent';

/**
 * The session states the design draws a badge for, and the tone each maps to.
 *
 * Concept 03 paints these straight on the row: running is the copper accent (the
 * "something is happening" hue), landed states are the brand green, failures the
 * oxblood error. `draft` is the only neutral — nothing is running and nothing
 * has landed.
 */
export const SESSION_STATUS_TONES = {
  'pr-ready': { tone: 'success', label: 'PR ready', dot: true },
  running: { tone: 'accent', label: 'Running', dot: true },
  error: { tone: 'error', label: 'Error', dot: true },
  draft: { tone: 'neutral', label: 'Draft', dot: false },
  merged: { tone: 'success', label: 'Merged', dot: false },
} as const satisfies Record<string, { tone: BadgeTone; label: string; dot: boolean }>;

export type SessionStatus = keyof typeof SESSION_STATUS_TONES;

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Shows the 6px leading dot. The design uses it for live states only. */
  dot?: boolean;
}

export function Badge(props: BadgeProps): JSX.Element {
  const [local, rest] = splitProps(props, ['tone', 'dot', 'class', 'children']);

  const classes = () =>
    ['cx-badge', `cx-badge--${local.tone ?? 'neutral'}`, local.class ?? ''].filter(Boolean).join(' ');

  return (
    <span class={classes()} {...rest}>
      <Show when={local.dot}>
        <span class="cx-badge__dot" aria-hidden="true" />
      </Show>
      {local.children}
    </span>
  );
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'tone' | 'dot' | 'children'> {
  status: SessionStatus;
  /** Overrides the design's copy, e.g. to append a duration. */
  label?: string;
}

/** A badge for a known session status, so call sites cannot pair the wrong tone with it. */
export function StatusBadge(props: StatusBadgeProps): JSX.Element {
  const [local, rest] = splitProps(props, ['status', 'label']);
  const spec = () => SESSION_STATUS_TONES[local.status];

  return (
    <Badge tone={spec().tone} dot={spec().dot} {...rest}>
      {local.label ?? spec().label}
    </Badge>
  );
}
