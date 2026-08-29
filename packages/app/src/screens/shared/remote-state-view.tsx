import { type JSX, Show } from 'solid-js';

import type { RemoteState } from '../../state/remote-collection.ts';
import { HonestState } from './honest-state.tsx';

export interface RemoteStateViewProps {
  state: RemoteState;
  error?: string;
  /** What this list is, for the loading and empty copy. */
  label: string;
  /** Shown when the account genuinely has nothing. */
  emptyTitle: string;
  emptyBody: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRetry?: () => void;
  /** Rendered instead of a state when the list has rows. */
  children: JSX.Element;
}

/**
 * Renders one remote list's lifecycle.
 *
 * Exists so the five states are decided once. Each Chat screen used to branch on
 * `loading` then `error` then `length > 0` by hand, which is how `unsupported` and
 * `disconnected` ended up rendering as "you have nothing" — the two states that
 * most need their own words got the empty state's.
 */
export function RemoteStateView(props: RemoteStateViewProps): JSX.Element {
  return (
    <Show when={props.state !== 'loading' && props.state !== 'idle'} fallback={
      <HonestState kind="loading" title={`Loading ${props.label.toLowerCase()}`} body="Reading your account." />
    }>
      <Show when={props.state !== 'unsupported'} fallback={
        <HonestState
          kind="error"
          title={`${props.label} is not on this backend`}
          body={props.error ?? ''}
        />
      }>
        <Show when={props.state !== 'disconnected'} fallback={
          <HonestState
            kind="error"
            title="Not connected to Cortex"
            body={props.error ?? ''}
            {...(props.onRetry ? { actionLabel: 'Try again', onAction: props.onRetry } : {})}
          />
        }>
          <Show when={props.state !== 'error'} fallback={
            <HonestState
              kind="error"
              title={`Could not load ${props.label.toLowerCase()}`}
              body={props.error ?? ''}
              {...(props.onRetry ? { actionLabel: 'Try again', onAction: props.onRetry } : {})}
            />
          }>
            <Show when={props.state !== 'empty'} fallback={
              <HonestState
                kind="empty"
                title={props.emptyTitle}
                body={props.emptyBody}
                {...(props.emptyActionLabel && props.onEmptyAction
                  ? { actionLabel: props.emptyActionLabel, onAction: props.onEmptyAction }
                  : {})}
              />
            }>
              {props.children}
            </Show>
          </Show>
        </Show>
      </Show>
    </Show>
  );
}
