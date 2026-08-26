import { For, type JSX, Show } from 'solid-js';

import { Icon } from '@cortex-ide/ui';

export interface ChecklistStep {
  id: string;
  label: string;
  done: boolean;
  /** Label for the trailing action, e.g. "Start" or "Browse". */
  action?: string;
  onAction?: () => void;
}

export interface ChecklistProps {
  title: string;
  steps: readonly ChecklistStep[];
  onDismiss?: () => void;
}

function StepRow(props: { step: ChecklistStep }): JSX.Element {
  const done = () => props.step.done;

  return (
    <li class={done() ? 'cx-checklist__step cx-checklist__step--done' : 'cx-checklist__step'}>
      <span
        class={
          done()
            ? 'cx-checklist__mark cx-checklist__mark--done'
            : 'cx-checklist__mark cx-checklist__mark--open'
        }
        role="img"
        aria-label={done() ? 'Done' : 'Not started'}
      >
        <Show when={done()}>
          <Icon name="checkSmall" size={10} />
        </Show>
      </span>

      <span class="cx-checklist__label">{props.step.label}</span>

      {/* The action is dropped once a step is done: a completed step has nothing left to do,
          and leaving the link would invite a pointless second trip. */}
      <Show when={props.step.action && !done() ? props.step.action : undefined}>
        {(action) => (
          <button
            type="button"
            class="cx-checklist__action"
            onClick={() => props.step.onAction?.()}
          >
            {action()}
          </button>
        )}
      </Show>
    </li>
  );
}

/**
 * The get-started checklist on Home.
 *
 * The progress pill counts done steps rather than taking a caller-supplied number, so it
 * cannot disagree with the rows beneath it.
 */
export function Checklist(props: ChecklistProps): JSX.Element {
  const done = () => props.steps.filter((step) => step.done).length;

  return (
    <section class="cx-checklist" aria-label={props.title}>
      <div class="cx-checklist__header">
        <h2 class="cx-checklist__title">{props.title}</h2>
        <span class="cx-checklist__progress">
          {done()} of {props.steps.length}
        </span>
        <span class="cx-checklist__spacer" />
        <Show when={props.onDismiss}>
          {(dismiss) => (
            <button type="button" class="cx-checklist__dismiss" onClick={() => dismiss()()}>
              Dismiss
            </button>
          )}
        </Show>
      </div>

      <ul class="cx-checklist__steps">
        <For each={props.steps}>{(step) => <StepRow step={step} />}</For>
      </ul>
    </section>
  );
}
