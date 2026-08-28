import { type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import './honest-state.css';

export type HonestKind = 'empty' | 'loading' | 'error' | 'signed-out';

export interface HonestStateProps {
  kind: HonestKind;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * The four honest states every Chat / Code / Bot destination must handle.
 *
 * A screen that cannot load must not look like an empty install, and a
 * signed-out gate must not look like a crash.
 */
export function HonestState(props: HonestStateProps): JSX.Element {
  return (
    <div class={`cx-honest cx-honest--${props.kind}`} role={props.kind === 'error' ? 'alert' : 'status'}>
      <h2 class="cx-honest__title">{props.title}</h2>
      <p class="cx-honest__body">{props.body}</p>
      <Show when={props.actionLabel && props.onAction}>
        <Button variant={props.kind === 'signed-out' ? 'primary' : 'secondary'} onClick={() => props.onAction?.()}>
          {props.actionLabel}
        </Button>
      </Show>
    </div>
  );
}
