import { type JSX, Show, splitProps } from 'solid-js';

import { Icon, type IconName } from '../icons/icon.tsx';
import type { IconKey } from '../icons/geometry.generated.ts';

import './menu.css';

export interface MenuProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Narrows to the 196px the runtime picker uses instead of the generic 240px. */
  compact?: boolean;
}

/**
 * The dropdown surface.
 *
 * `role="menu"` is set here rather than left to the caller because every use in this design
 * is a menu; the composer's runtime picker, the repo row's overflow, the command palette's
 * result list.
 */
export function Menu(props: MenuProps): JSX.Element {
  const [local, rest] = splitProps(props, ['compact', 'class', 'children']);

  const classes = () =>
    ['cx-menu', local.compact ? 'cx-menu--compact' : '', local.class ?? ''].filter(Boolean).join(' ');

  return (
    <div class={classes()} role="menu" {...rest}>
      {local.children}
    </div>
  );
}

export interface MenuItemProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName | IconKey;
  label: string;
  /** Keyboard shortcut shown in the trailing slot. */
  shortcut?: string;
  /** Marks the row as selected. The runtime picker shows a check on the active runtime. */
  selected?: boolean;
  destructive?: boolean;
}

/**
 * A menu row.
 *
 * The trailing slot renders whether or not there is anything in it. Collapsing it would let
 * labels reflow between rows that have a shortcut and rows that do not, which is the same
 * lane problem the sidebar has.
 */
export function MenuItem(props: MenuItemProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'icon',
    'label',
    'shortcut',
    'selected',
    'destructive',
    'class',
  ]);

  const classes = () =>
    [
      'cx-menu__item',
      local.destructive ? 'cx-menu__item--destructive' : '',
      local.class ?? '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <button
      type="button"
      class={classes()}
      role="menuitem"
      aria-checked={local.selected}
      {...rest}
    >
      <Show when={local.icon}>{(name) => <Icon name={name()} size={13} />}</Show>
      <span class="cx-menu__label">{local.label}</span>
      <span class="cx-menu__trailing">
        <Show when={local.selected} fallback={local.shortcut}>
          <Icon name="checkSmall" size={12} label="Selected" />
        </Show>
      </span>
    </button>
  );
}

/**
 * A rule between groups of rows.
 *
 * `<hr>` rather than a styled div: assistive technology announces it as a separator, which
 * is the whole point of drawing it.
 */
export function MenuSeparator(props: JSX.HTMLAttributes<HTMLHRElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <hr
      class={local.class ? `cx-menu__separator ${local.class}` : 'cx-menu__separator'}
      {...rest}
    />
  );
}
