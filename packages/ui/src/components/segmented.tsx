import { For, type JSX, Show, splitProps } from 'solid-js';

import { Icon, type IconName } from '../icons/icon.tsx';
import type { IconKey } from '../icons/geometry.generated.ts';

import './segmented.css';

export interface SegmentedOption {
  id: string;
  label: string;
  icon?: IconName | IconKey;
  disabled?: boolean;
}

export interface SegmentedProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: readonly SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the group, e.g. "Product" or "Thinking level". */
  label: string;
  /**
   * The composer's register: page-colour track with a hairline, active segment
   * on the neutral wash. The default is the raised-chip register.
   */
  bordered?: boolean;
}

/**
 * The C3 segmented control: product switcher, composer modes, thinking levels,
 * inbox filters. A group of toggle buttons rather than a tablist — segments
 * switch a value, they do not own panels.
 */
export function Segmented(props: SegmentedProps): JSX.Element {
  const [local, rest] = splitProps(props, ['options', 'value', 'onChange', 'label', 'bordered', 'class']);

  const classes = () =>
    ['cx-segmented', local.bordered ? 'cx-segmented--bordered' : '', local.class ?? '']
      .filter(Boolean)
      .join(' ');

  return (
    <div class={classes()} role="group" aria-label={local.label} {...rest}>
      <For each={local.options}>
        {(option) => (
          <button
            type="button"
            class="cx-segmented__option"
            aria-pressed={option.id === local.value}
            disabled={option.disabled}
            onClick={() => local.onChange(option.id)}
          >
            <Show when={option.icon}>{(name) => <Icon name={name()} size={14} strokeWidth={1.75} />}</Show>
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}
