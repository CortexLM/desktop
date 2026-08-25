import { createUniqueId, type JSX, Show, splitProps } from 'solid-js';

import { Icon, type IconName } from '../icons/icon.tsx';
import type { IconKey } from '../icons/geometry.generated.ts';

import './text-field.css';

export interface TextFieldProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'id' | 'children'> {
  label?: string;
  /** Supporting copy under the control. Replaced by `error` when there is one. */
  hint?: string;
  /** Marks the control invalid and replaces the hint. */
  error?: string;
  icon?: IconName | IconKey;
  /**
   * Sets the value in sans instead of mono. The design's fields hold identifiers, so mono
   * is the default; this is for the ones that hold prose.
   */
  prose?: boolean;
  /** Class for the wrapper, so a caller can size the field. */
  containerClass?: string;
}

/**
 * A labelled text input.
 *
 * The id is generated rather than required. Every field in this design has a visible
 * label, and making callers thread an id through would eventually produce a field whose
 * label points at nothing.
 */
export function TextField(props: TextFieldProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'label',
    'hint',
    'error',
    'icon',
    'prose',
    'containerClass',
    'class',
  ]);

  const id = createUniqueId();
  const describedBy = `${id}-description`;
  const description = () => local.error ?? local.hint;

  const controlClasses = () =>
    ['cx-field__control', local.error ? 'cx-field__control--invalid' : ''].filter(Boolean).join(' ');

  const inputClasses = () =>
    ['cx-field__input', local.prose ? 'cx-field__input--prose' : '', local.class ?? '']
      .filter(Boolean)
      .join(' ');

  return (
    <div class={local.containerClass ? `cx-field ${local.containerClass}` : 'cx-field'}>
      <Show when={local.label}>
        {(label) => (
          <label class="cx-field__label" for={id}>
            {label()}
          </label>
        )}
      </Show>

      <div class={controlClasses()}>
        <Show when={local.icon}>{(name) => <Icon name={name()} />}</Show>
        <input
          id={id}
          class={inputClasses()}
          aria-invalid={local.error ? 'true' : undefined}
          aria-describedby={description() ? describedBy : undefined}
          {...rest}
        />
      </div>

      <Show when={description()}>
        {(text) => (
          <p
            id={describedBy}
            class={local.error ? 'cx-field__hint cx-field__hint--error' : 'cx-field__hint'}
          >
            {text()}
          </p>
        )}
      </Show>
    </div>
  );
}
