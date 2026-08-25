import { type JSX, splitProps } from 'solid-js';

import { Icon, type IconName } from '../icons/icon.tsx';
import type { IconKey } from '../icons/geometry.generated.ts';

import './nav-item.css';

export interface NavItemProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName | IconKey;
  label: string;
  active?: boolean;
  /** Shows the primary-coloured dot. The design uses it for unread activity. */
  unread?: boolean;
  /**
   * Why this destination is unavailable, when it is. Announced to assistive technology, so
   * a locked row explains itself rather than just refusing to respond.
   */
  lockedReason?: string;
}

/**
 * A sidebar navigation row.
 *
 * The indicator slot is rendered whether or not there is a dot to show. Collapsing it when
 * empty would let the label reflow between rows and break the vertical lane the sidebar
 * reads along.
 */
export function NavItem(props: NavItemProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'icon',
    'label',
    'active',
    'unread',
    'lockedReason',
    'class',
    'disabled',
  ]);

  const classes = () =>
    ['cx-nav-item', local.active ? 'cx-nav-item--active' : '', local.class ?? '']
      .filter(Boolean)
      .join(' ');

  const disabled = () => local.disabled || Boolean(local.lockedReason);

  return (
    <button
      type="button"
      class={classes()}
      disabled={disabled()}
      aria-current={local.active ? 'page' : undefined}
      aria-describedby={undefined}
      title={local.lockedReason}
      {...rest}
    >
      <Icon name={local.icon} size={14} />
      <span class="cx-nav-item__label">{local.label}</span>
      <span
        class={
          local.unread
            ? 'cx-nav-item__indicator cx-nav-item__indicator--unread'
            : 'cx-nav-item__indicator'
        }
        aria-hidden={local.unread ? undefined : 'true'}
        aria-label={local.unread ? 'Unread activity' : undefined}
        role={local.unread ? 'img' : undefined}
      />
    </button>
  );
}
