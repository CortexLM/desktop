import { Show, type JSX, splitProps } from 'solid-js';

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
   * Why this destination is unavailable, when it is.
   *
   * Shown as a lock glyph and folded into the accessible name, so a locked row explains
   * itself rather than just refusing to respond.
   */
  lockedReason?: string;
}

/**
 * A sidebar navigation row.
 *
 * The indicator slot is rendered whether or not there is a dot to show. Collapsing it when
 * empty would let the label reflow between rows and break the vertical lane the sidebar
 * reads along.
 *
 * A locked row is `aria-disabled`, not `disabled`, and that distinction is the whole point.
 * It used to be `disabled` with the reason in `title`, which explained nothing to anybody:
 * browsers suppress the native tooltip on a disabled control, and a disabled button is
 * skipped by tab order, so a keyboard or screen-reader user could not reach the row at all.
 * Click it and nothing happened; hover it and nothing appeared. The intent is the opposite —
 * these rows exist to advertise what an account adds.
 *
 * `aria-disabled` keeps the row focusable and lets `title` and `aria-describedby` work, while
 * the click guard below is what actually makes it inert.
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

  const locked = () => Boolean(local.lockedReason);

  const classes = () =>
    ['cx-nav-item', local.active ? 'cx-nav-item--active' : '', local.class ?? '']
      .filter(Boolean)
      .join(' ');

  return (
    <button
      type="button"
      class={classes()}
      disabled={local.disabled}
      aria-disabled={locked() ? 'true' : undefined}
      aria-current={local.active ? 'page' : undefined}
      // `title` rather than a hidden `aria-describedby` target: it is the standard fallback
      // for an accessible description, it now works because the row is not `disabled`, and it
      // keeps the reason out of the button's `textContent` — a hidden span inside would make
      // the row read as "AutomationsSign in to Cortex to use Automations" to anything walking
      // the DOM.
      title={local.lockedReason}
      {...rest}
      onClick={(event) => {
        // `aria-disabled` is advisory: the browser still fires the click. Guarding here is
        // what makes the row inert, and it is guarded rather than `disabled` so the row stays
        // reachable by keyboard.
        if (locked()) {
          event.preventDefault();
          return;
        }
        const handler = rest.onClick;
        if (typeof handler === 'function') handler(event);
      }}
    >
      <Icon name={local.icon} size={14} />
      <span class="cx-nav-item__label">{local.label}</span>
      <Indicator unread={local.unread} />
      {/*
        The lock is decorative — the reason is already the row's accessible description, so
        labelling the glyph too would make it announce itself twice. What it adds is a state
        that is visible without hovering, which `title` alone never was.
      */}
      <Show when={locked()}>
        <Icon name="lock" size={11} class="cx-nav-item__lock" aria-hidden="true" />
      </Show>
    </button>
  );
}

/**
 * The trailing dot.
 *
 * Rendered whether or not there is anything to show. Collapsing it when empty would let the
 * label reflow between rows and break the vertical lane the sidebar reads along.
 */
function Indicator(props: { unread?: boolean }): JSX.Element {
  return (
    <span
      class={
        props.unread
          ? 'cx-nav-item__indicator cx-nav-item__indicator--unread'
          : 'cx-nav-item__indicator'
      }
      aria-hidden={props.unread ? undefined : 'true'}
      aria-label={props.unread ? 'Unread activity' : undefined}
      role={props.unread ? 'img' : undefined}
    />
  );
}
