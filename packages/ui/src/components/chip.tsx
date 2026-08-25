import { type JSX, Show, splitProps } from 'solid-js';

import { Icon, type IconName } from '../icons/icon.tsx';
import type { IconKey } from '../icons/geometry.generated.ts';

import './chip.css';

export type ChipVariant = 'control' | 'outlined';

export interface ChipProps extends JSX.HTMLAttributes<HTMLElement> {
  variant?: ChipVariant;
  icon?: IconName | IconKey;
  /** Sets the label in mono, as the design does for secret names and other literals. */
  mono?: boolean;
  /** Shows a trailing chevron. The composer's pickers all carry one. */
  picker?: boolean;
  /** Renders a `<button>` and wires hover. Without this the chip is a static `<span>`. */
  onPress?: (event: MouseEvent) => void;
  disabled?: boolean;
  /** Adds a dismiss control, as on the composer's attachment chips. */
  onDismiss?: (event: MouseEvent) => void;
  dismissLabel?: string;
}

/**
 * The pill used across the composer control row, the attachment row and the secret list.
 *
 * Renders a `<button>` only when it can actually be pressed. A chip that is decoration -
 * the repo name on an inbox row, a secret name in a list - should not be in the tab order
 * or announced as a control.
 */
export function Chip(props: ChipProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'variant',
    'icon',
    'mono',
    'picker',
    'onPress',
    'disabled',
    'onDismiss',
    'dismissLabel',
    'class',
    'children',
  ]);

  const classes = () =>
    [
      'cx-chip',
      `cx-chip--${local.variant ?? 'control'}`,
      local.mono ? 'cx-chip--mono' : '',
      local.onPress ? 'cx-chip--interactive' : '',
      local.class ?? '',
    ]
      .filter(Boolean)
      .join(' ');

  const content = () => (
    <>
      <Show when={local.icon}>{(name) => <Icon name={name()} />}</Show>
      {local.children}
      <Show when={local.picker}>
        <Icon name="chevronDownSmall" size={9} />
      </Show>
      <Show when={local.onDismiss}>
        {(dismiss) => (
          <button
            type="button"
            class="cx-chip__dismiss"
            aria-label={local.dismissLabel ?? 'Remove'}
            onClick={(event) => {
              // A dismiss inside an interactive chip must not also trigger the chip.
              event.stopPropagation();
              dismiss()(event);
            }}
          >
            <Icon name="closeSmall" size={9} />
          </button>
        )}
      </Show>
    </>
  );

  return (
    <Show
      when={local.onPress}
      fallback={
        <span class={classes()} {...(rest as JSX.HTMLAttributes<HTMLSpanElement>)}>
          {content()}
        </span>
      }
    >
      {(press) => (
        <button
          type="button"
          class={classes()}
          disabled={local.disabled}
          onClick={press()}
          {...(rest as JSX.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {content()}
        </button>
      )}
    </Show>
  );
}
