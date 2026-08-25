import { type JSX, Show, splitProps } from 'solid-js';

import { Icon, type IconName } from '../icons/icon.tsx';
import type { IconKey } from '../icons/geometry.generated.ts';

import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Glyph before the label. */
  icon?: IconName | IconKey;
  /** Glyph after the label, e.g. the chevron on a picker trigger. */
  trailingIcon?: IconName | IconKey;
  /** Square, label-less button. Requires `aria-label`. */
  iconOnly?: boolean;
  /** Pill shape. The composer's send button is round rather than radius-sm. */
  round?: boolean;
  /** Stretches to the container, as the auth screens' provider buttons do. */
  block?: boolean;
}

/**
 * The four button variants from the Paper UI kit.
 *
 * `type` defaults to `button`. The HTML default is `submit`, which inside the composer's
 * form would send the prompt on every icon press.
 */
export function Button(props: ButtonProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'variant',
    'icon',
    'trailingIcon',
    'iconOnly',
    'round',
    'block',
    'class',
    'children',
    'type',
  ]);

  const classes = () =>
    [
      'cx-button',
      `cx-button--${local.variant ?? 'secondary'}`,
      local.iconOnly ? 'cx-button--icon' : '',
      local.round ? 'cx-button--round' : '',
      local.block ? 'cx-button--block' : '',
      local.class ?? '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <button type={local.type ?? 'button'} class={classes()} {...rest}>
      <Show when={local.icon}>{(name) => <Icon name={name()} />}</Show>
      {local.children}
      <Show when={local.trailingIcon}>{(name) => <Icon name={name()} />}</Show>
    </button>
  );
}
