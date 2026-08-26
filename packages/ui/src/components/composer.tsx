import { For, type JSX, Show, splitProps } from 'solid-js';

import { Chip } from './chip.tsx';
import { Icon } from '../icons/icon.tsx';

import './composer.css';

export interface ComposerAttachment {
  id: string;
  label: string;
  /** Set for secrets and other identifiers, which the design sets in mono. */
  mono?: boolean;
}

/** One of the pickers in the control row: repo, branch, model, runtime. */
export interface ComposerControl {
  id: string;
  label: string;
  icon?: Parameters<typeof Icon>[0]['name'];
  onPress?: () => void;
  disabled?: boolean;
  /** Shows the trailing chevron. Every picker in the design has one. */
  picker?: boolean;
}

export interface ComposerProps extends Omit<JSX.HTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** Repo shown as an inline mention chip ahead of the prompt. */
  mention?: string;
  attachments?: readonly ComposerAttachment[];
  onRemoveAttachment?: (id: string) => void;
  controls?: readonly ComposerControl[];
  /** Product-specific controls after the attach button, e.g. the chat mode segmented. */
  leading?: JSX.Element;
  onAttach?: () => void;
  onDictate?: () => void;
  /** The bare-text model picker on the right, e.g. "Cortex 2 · Thinking High". */
  modelLabel?: string;
  onPickModel?: () => void;
  /** Blocks submission, e.g. while a session is starting or a quota is exhausted. */
  disabled?: boolean;
  /** Announced reason the composer cannot submit, e.g. a reached limit. */
  disabledReason?: string;
  sendLabel?: string;
}

interface AttachmentRowProps {
  attachments: readonly ComposerAttachment[];
  onRemove?: (id: string) => void;
}

function AttachmentRow(props: AttachmentRowProps): JSX.Element {
  return (
    <div class="cx-composer__attachments">
      <For each={props.attachments}>
        {(attachment) => (
          <Chip
            variant="outlined"
            mono={attachment.mono}
            onDismiss={props.onRemove ? () => props.onRemove?.(attachment.id) : undefined}
            dismissLabel={`Remove ${attachment.label}`}
          >
            {attachment.label}
          </Chip>
        )}
      </For>
    </div>
  );
}

interface ControlRowProps {
  controls?: readonly ComposerControl[];
  leading?: JSX.Element;
  disabled?: boolean;
  /**
   * An accessor rather than a boolean. Passing the resolved value would depend on the JSX
   * compiler wrapping the call expression in a getter, which is a heuristic; an accessor is
   * reactive across the component boundary by construction.
   */
  canSend: () => boolean;
  sendLabel: string;
  modelLabel?: string;
  onPickModel?: () => void;
  onAttach?: () => void;
  onDictate?: () => void;
}

function ControlRow(props: ControlRowProps): JSX.Element {
  return (
    <div class="cx-composer__controls">
      <Show when={props.onAttach}>
        {(attach) => (
          <button
            type="button"
            class="cx-composer__attach"
            aria-label="Attach"
            disabled={props.disabled}
            onClick={() => attach()()}
          >
            <Icon name="plus" size={16} strokeWidth={1.75} />
          </button>
        )}
      </Show>

      {props.leading}

      <For each={props.controls}>
        {(control) => (
          <Chip
            icon={control.icon}
            picker={control.picker}
            onPress={control.onPress ? () => control.onPress?.() : undefined}
            disabled={control.disabled || props.disabled}
          >
            {control.label}
          </Chip>
        )}
      </For>

      <span class="cx-composer__spacer" />

      <Show when={props.modelLabel}>
        {(model) => (
          <button
            type="button"
            class="cx-composer__model"
            disabled={props.disabled || !props.onPickModel}
            onClick={() => props.onPickModel?.()}
          >
            {model()}
            <Icon name="chevronDownBold" size={14} strokeWidth={1.75} />
          </button>
        )}
      </Show>

      <Show when={props.onDictate}>
        {(dictate) => (
          <button
            type="button"
            class="cx-composer__action"
            aria-label="Dictate"
            disabled={props.disabled}
            onClick={() => dictate()()}
          >
            <Icon name="mic" size={16} strokeWidth={1.75} />
          </button>
        )}
      </Show>

      <button
        type="submit"
        class="cx-composer__send"
        aria-label={props.sendLabel}
        disabled={!props.canSend()}
      >
        <Icon name="send" size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/**
 * Props the composer consumes itself; everything else is forwarded to the `<form>`. Kept at
 * module scope so the component body stays readable - the composer has a wide surface
 * because it carries four pickers, two actions and a submit.
 */
const OWNED_PROPS = [
  'value',
  'onValueChange',
  'onSubmit',
  'placeholder',
  'mention',
  'attachments',
  'onRemoveAttachment',
  'controls',
  'leading',
  'onAttach',
  'onDictate',
  'modelLabel',
  'onPickModel',
  'disabled',
  'disabledReason',
  'sendLabel',
  'class',
] as const satisfies ReadonlyArray<keyof ComposerProps>;

function composerClasses(disabled: boolean | undefined, extra: string | undefined): string {
  return ['cx-composer', disabled ? 'cx-composer--disabled' : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

interface PromptRowProps {
  value: string;
  placeholder?: string;
  mention?: string;
  disabled?: boolean;
  describedBy?: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
}

function PromptRow(props: PromptRowProps): JSX.Element {
  return (
    <div>
      <Show when={props.mention}>
        {(mention) => <span class="cx-composer__mention">@{mention()}</span>}
      </Show>
      <textarea
        class="cx-composer__prompt"
        rows={1}
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        aria-label="Prompt"
        aria-describedby={props.describedBy}
        onInput={(event) => props.onValueChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter inserts a newline. The textarea default is the
          // opposite, and every chat surface has trained people to expect this one.
          if (event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          props.onSubmit();
        }}
      />
    </div>
  );
}

/**
 * The hero composer.
 *
 * A `<form>` rather than a div with a click handler, so Enter submits natively and the
 * browser's own "this is one input group" semantics apply.
 */
export function Composer(props: ComposerProps): JSX.Element {
  const [local, rest] = splitProps(props, OWNED_PROPS);

  // An empty prompt cannot be sent even when the composer is otherwise enabled; sending
  // nothing would start a session with no instruction.
  const canSend = () => !local.disabled && local.value.trim().length > 0;

  const submit = () => {
    if (canSend()) local.onSubmit();
  };

  return (
    <form
      class={composerClasses(local.disabled, local.class)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      {...rest}
    >
      <PromptRow
        value={local.value}
        placeholder={local.placeholder}
        mention={local.mention}
        disabled={local.disabled}
        describedBy={local.disabledReason ? 'composer-disabled-reason' : undefined}
        onValueChange={local.onValueChange}
        onSubmit={submit}
      />

      <Show when={local.attachments?.length}>
        <AttachmentRow
          attachments={local.attachments ?? []}
          onRemove={local.onRemoveAttachment}
        />
      </Show>

      <ControlRow
        controls={local.controls}
        leading={local.leading}
        disabled={local.disabled}
        canSend={canSend}
        sendLabel={local.sendLabel ?? 'Start session'}
        modelLabel={local.modelLabel}
        onPickModel={local.onPickModel}
        onAttach={local.onAttach}
        onDictate={local.onDictate}
      />

      <Show when={local.disabledReason}>
        {(reason) => (
          <span id="composer-disabled-reason" hidden>
            {reason()}
          </span>
        )}
      </Show>
    </form>
  );
}
