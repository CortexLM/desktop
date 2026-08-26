import { type JSX, Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';

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

interface DismissButtonProps {
  label: string;
  onDismiss: (event: MouseEvent) => void;
}

function DismissButton(props: DismissButtonProps): JSX.Element {
  return (
    <button
      type="button"
      class="cx-chip__dismiss"
      aria-label={props.label}
      onClick={(event) => {
        // Both targets overlap, so without this, removing an attachment would also trigger
        // the chip it sits inside.
        event.stopPropagation();
        props.onDismiss(event);
      }}
    >
      <Icon name="closeSmall" size={9} />
    </button>
  );
}

interface ChipContentProps {
  icon?: IconName | IconKey;
  picker?: boolean;
  onDismiss?: (event: MouseEvent) => void;
  dismissLabel?: string;
  children?: JSX.Element;
}

function ChipContent(props: ChipContentProps): JSX.Element {
  return (
    <>
      <Show when={props.icon}>{(name) => <Icon name={name()} />}</Show>
      {props.children}
      <Show when={props.picker}>
        <Icon name="chevronDownSmall" size={9} />
      </Show>
      <Show when={props.onDismiss}>
        {(dismiss) => (
          <DismissButton label={props.dismissLabel ?? 'Remove'} onDismiss={dismiss()} />
        )}
      </Show>
    </>
  );
}

function chipClasses(options: {
  variant?: ChipVariant;
  mono?: boolean;
  interactive: boolean;
  extra?: string;
}): string {
  return [
    'cx-chip',
    `cx-chip--${options.variant ?? 'control'}`,
    options.mono ? 'cx-chip--mono' : '',
    options.interactive ? 'cx-chip--interactive' : '',
    options.extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
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
    chipClasses({
      variant: local.variant,
      mono: local.mono,
      interactive: Boolean(local.onPress),
      extra: local.class,
    });

  // Dynamic rather than a Show with a fallback: the two branches differ only in the tag and
  // three attributes, and writing them out twice meant the children were declared twice too.
  const interactive = () => Boolean(local.onPress);

  return (
    <Dynamic
      component={interactive() ? 'button' : 'span'}
      class={classes()}
      type={interactive() ? 'button' : undefined}
      disabled={interactive() ? local.disabled : undefined}
      onClick={local.onPress}
      {...rest}
    >
      <ChipContent
        icon={local.icon}
        picker={local.picker}
        onDismiss={local.onDismiss}
        dismissLabel={local.dismissLabel}
      >
        {local.children}
      </ChipContent>
    </Dynamic>
  );
}
