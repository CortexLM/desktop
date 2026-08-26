import { createUniqueId, For, type JSX, Show, splitProps } from 'solid-js';

import './settings.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name. Settings rows pass the row title. */
  label: string;
  disabled?: boolean;
}

/**
 * The switch from the Settings screen.
 *
 * A real checkbox under the drawn track rather than a div with a click handler: it is
 * focusable, announces its own state, and responds to Space without reimplementing any of
 * that. The track and thumb are siblings so CSS can react to `:checked` and `:focus-visible`
 * without the component tracking those itself.
 */
export function Toggle(props: ToggleProps): JSX.Element {
  return (
    <span class="cx-toggle">
      <input
        type="checkbox"
        class="cx-toggle__input"
        checked={props.checked}
        disabled={props.disabled}
        aria-label={props.label}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      <span class="cx-toggle__track" />
      <span class="cx-toggle__thumb" />
    </span>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  label: string;
}

/**
 * A native select behind the design's trigger styling.
 *
 * Native rather than a custom listbox: the design draws a plain chip with a chevron, and a
 * native select brings keyboard navigation, type-ahead and the platform's own popup for
 * free. A custom one would have to earn all of that back to reach parity.
 */
export function Select(props: SelectProps): JSX.Element {
  const [local, rest] = splitProps(props, ['value', 'options', 'onValueChange', 'label', 'class']);

  return (
    <select
      class={local.class ? `cx-select ${local.class}` : 'cx-select'}
      value={local.value}
      aria-label={local.label}
      onChange={(event) => local.onValueChange(event.currentTarget.value)}
      {...rest}
    >
      <For each={local.options}>
        {(option) => (
          <option value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        )}
      </For>
    </select>
  );
}

export interface SettingRowProps {
  title: string;
  description?: string;
  /** The control on the right. */
  control: JSX.Element;
  /** Why this setting is unavailable. Marks the row inert and explains itself. */
  lockedReason?: string;
}

export function SettingRow(props: SettingRowProps): JSX.Element {
  const descriptionId = createUniqueId();

  return (
    <div
      class={props.lockedReason ? 'cx-setting cx-setting--locked' : 'cx-setting'}
      title={props.lockedReason}
    >
      <div class="cx-setting__text">
        <span class="cx-setting__title">{props.title}</span>
        <Show when={props.lockedReason ?? props.description}>
          {(text) => (
            <span class="cx-setting__description" id={descriptionId}>
              {text()}
            </span>
          )}
        </Show>
      </div>
      <div class="cx-setting__control">{props.control}</div>
    </div>
  );
}

export interface SettingGroupProps {
  label: string;
  children: JSX.Element;
}

export function SettingGroup(props: SettingGroupProps): JSX.Element {
  return (
    <section class="cx-settings__group" aria-label={props.label}>
      <h2 class="cx-settings__group-label">{props.label}</h2>
      <div class="cx-settings__card">{props.children}</div>
    </section>
  );
}
