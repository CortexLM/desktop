import { For, type JSX } from 'solid-js';

import type { ComputerHostOption, ComputerKind } from './computer-host.ts';

export function ComputerHostPicker(props: {
  value?: ComputerKind;
  options: readonly ComputerHostOption[];
  onChange: (kind: ComputerKind) => void;
}): JSX.Element {
  return (
    <fieldset class="cx-host-picker">
      <legend class="cx-host-picker__legend">Computer</legend>
      <div class="cx-host-picker__grid" role="radiogroup" aria-label="Computer">
        <For each={props.options}>{(option) => <HostCard option={option} selected={props.value === option.id} onChange={props.onChange} />}</For>
      </div>
    </fieldset>
  );
}

function HostCard(props: {
  option: ComputerHostOption;
  selected: boolean;
  onChange: (kind: ComputerKind) => void;
}): JSX.Element {
  const locked = () => Boolean(props.option.lockedReason);
  return (
    <button
      type="button"
      role="radio"
      class="cx-host-picker__card"
      aria-checked={props.selected}
      aria-disabled={locked() ? 'true' : undefined}
      title={props.option.lockedReason}
      disabled={locked()}
      onClick={() => {
        if (!locked()) props.onChange(props.option.id);
      }}
    >
      <span class="cx-host-picker__label">{props.option.label}</span>
      <span class="cx-host-picker__body">{props.option.lockedReason ?? props.option.body}</span>
    </button>
  );
}
