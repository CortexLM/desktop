import { createMemo, For, Show, type JSX } from 'solid-js';

import { Button, Icon, TextField, type IconName } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';

import './new-automation.css';

/**
 * The kinds of automation the product actually supports.
 *
 * Named after what they do for the user rather than after the trigger union in
 * `@cortex-ide/shared`: someone setting one up is choosing "run this on a
 * schedule", not choosing a `ScheduleTrigger`. The mapping to the trigger happens
 * on submit.
 *
 * `git_hook` is deliberately absent. `AutomationService` accepts it and logs that
 * it is not implemented, so offering it here would be offering something that
 * silently never fires.
 */
export type AutomationKind = 'schedule' | 'file_watch' | 'manual';

interface KindOption {
  id: AutomationKind;
  label: string;
  description: string;
  icon: IconName;
}

const KINDS: readonly KindOption[] = [
  {
    id: 'schedule',
    label: 'On a schedule',
    description: 'Runs at a time you choose, whether or not the app is in front.',
    icon: 'automations',
  },
  {
    id: 'file_watch',
    label: 'When files change',
    description: 'Runs whenever a file matching a pattern is added, edited or removed.',
    icon: 'repo',
  },
  {
    id: 'manual',
    label: 'Only when I run it',
    description: 'A saved task you start yourself from this screen.',
    icon: 'send',
  },
];

export interface NewAutomationDraft {
  name: string;
  kind: AutomationKind;
  /** Cron expression, for `schedule`. */
  cron: string;
  /** Comma-separated glob patterns, for `file_watch`. */
  patterns: string;
  /** What the agent is asked to do when it fires. */
  prompt: string;
}

export interface NewAutomationScreenProps {
  draft: NewAutomationDraft;
  onDraftChange: (draft: NewAutomationDraft) => void;
  onCreate: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string;
}

/**
 * A rough plain-English reading of a cron expression.
 *
 * Covers the shapes the presets produce and says so honestly for anything else.
 * A full cron parser would be a lot of code to describe a string the user typed
 * themselves; claiming to read every expression and getting one wrong would be
 * worse than admitting the limit.
 */
/** The five cron fields, once the expression is known to have five. */
interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  /** `HH:MM` when both minute and hour are literal numbers, else `null`. */
  time: string | null;
}

/**
 * The readings this function is willing to claim.
 *
 * A table rather than a chain, because the honest answer for anything unmatched is
 * the same and belongs at the end once.
 */
const CRON_READINGS: readonly ((fields: CronFields) => string | null)[] = [
  ({ time, dayOfMonth, month, dayOfWeek }) =>
    time && dayOfMonth === '*' && month === '*' && dayOfWeek === '*'
      ? `Every day at ${time}`
      : null,
  ({ time, dayOfMonth, dayOfWeek }) =>
    time && dayOfWeek === '1-5' && dayOfMonth === '*' ? `Weekdays at ${time}` : null,
  ({ time, dayOfMonth, dayOfWeek }) =>
    time && dayOfWeek === '1' && dayOfMonth === '*' ? `Every Monday at ${time}` : null,
  ({ minute, hour }) => (minute === '0' && hour === '*' ? 'Every hour, on the hour' : null),
  ({ minute }) => (minute.startsWith('*/') ? `Every ${minute.slice(2)} minutes` : null),
];

export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return 'Not a valid five-field cron expression';

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  const literal = /^\d+$/.test(hour) && /^\d+$/.test(minute);
  const fields: CronFields = {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
    time: literal ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : null,
  };

  for (const reading of CRON_READINGS) {
    const description = reading(fields);
    if (description) return description;
  }

  return 'On the schedule you entered';
}

const CRON_PRESETS: readonly { label: string; cron: string }[] = [
  { label: 'Nightly at 02:00', cron: '0 2 * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Weekdays at 09:00', cron: '0 9 * * 1-5' },
];

function KindPicker(props: {
  value: AutomationKind;
  onChange: (kind: AutomationKind) => void;
}): JSX.Element {
  return (
    <div class="cx-new-automation__kinds" role="radiogroup" aria-label="Trigger">
      <For each={KINDS}>
        {(kind) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.value === kind.id}
            class={
              props.value === kind.id
                ? 'cx-new-automation__kind cx-new-automation__kind--selected'
                : 'cx-new-automation__kind'
            }
            onClick={() => props.onChange(kind.id)}
          >
            <Icon name={kind.icon} size={14} />
            <span class="cx-new-automation__kind-text">
              <span class="cx-new-automation__kind-label">{kind.label}</span>
              <span class="cx-new-automation__kind-description">{kind.description}</span>
            </span>
          </button>
        )}
      </For>
    </div>
  );
}

/**
 * New Automation.
 *
 * Its own screen rather than a modal: the route `/automations/new` existed in the
 * design manifest and rendered the Automations list, so the button led nowhere.
 * A form with three fields also does not belong in a dialog the user cannot leave
 * halfway through.
 */
/**
 * Whether the draft is complete.
 *
 * Every kind needs a name and a prompt; the schedule and pattern fields are only
 * required by the kind that uses them, so a half-filled field belonging to a kind
 * the user did not choose must not block the button.
 */
export function isDraftReady(draft: NewAutomationDraft): boolean {
  if (!draft.name.trim() || !draft.prompt.trim()) return false;
  if (draft.kind === 'schedule') return draft.cron.trim().split(/\s+/).length === 5;
  if (draft.kind === 'file_watch') return draft.patterns.trim().length > 0;
  return true;
}

function TriggerFields(props: {
  draft: NewAutomationDraft;
  update: <K extends keyof NewAutomationDraft>(key: K, value: NewAutomationDraft[K]) => void;
}): JSX.Element {
  return (
    <>
      <Show when={props.draft.kind === 'schedule'}>
        <div class="cx-new-automation__field">
          {/* Mono is the field default, which is right here: a cron expression is an
              identifier, not prose. */}
          <TextField
            label="Schedule"
            value={props.draft.cron}
            placeholder="0 2 * * *"
            hint={describeCron(props.draft.cron)}
            onInput={(event) => props.update('cron', event.currentTarget.value)}
          />
          <div class="cx-new-automation__presets">
            <For each={CRON_PRESETS}>
              {(preset) => (
                <button
                  type="button"
                  class="cx-new-automation__preset"
                  onClick={() => props.update('cron', preset.cron)}
                >
                  {preset.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={props.draft.kind === 'file_watch'}>
        <TextField
          label="Files to watch"
          value={props.draft.patterns}
          placeholder="src/**/*.ts, package.json"
          hint="Comma-separated glob patterns, relative to the workspace."
          onInput={(event) => props.update('patterns', event.currentTarget.value)}
        />
      </Show>
    </>
  );
}

/**
 * The standing instruction.
 *
 * A textarea rather than `TextField`, which wraps an `<input>`: this is a
 * paragraph, and a single-line field would hide most of what the user wrote behind
 * a horizontal scroll.
 */
function PromptField(props: { value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label class="cx-new-automation__prompt">
      <span class="cx-new-automation__prompt-label">What should the agent do?</span>
      <textarea
        class="cx-new-automation__prompt-input"
        rows={4}
        value={props.value}
        placeholder="Check for outdated dependencies and open a pull request if any are behind."
        onInput={(event) => props.onChange(event.currentTarget.value)}
      />
    </label>
  );
}

export function NewAutomationScreen(props: NewAutomationScreenProps): JSX.Element {
  const update = <K extends keyof NewAutomationDraft>(
    key: K,
    value: NewAutomationDraft[K],
  ): void => {
    props.onDraftChange({ ...props.draft, [key]: value });
  };

  const ready = createMemo(() => isDraftReady(props.draft));

  return (
    <>
      <PageHeader
        title="New automation"
        subtitle="Give an agent a standing instruction and say when it should run."
      />

      <PageBody width="settings">
        <div class="cx-new-automation">
          <Show when={props.error}>
            {(message) => (
              <p class="cx-new-automation__error" role="alert">
                {message()}
              </p>
            )}
          </Show>

          <TextField
            label="Name"
            prose
            value={props.draft.name}
            placeholder="Nightly dependency audit"
            onInput={(event) => update('name', event.currentTarget.value)}
          />

          <KindPicker value={props.draft.kind} onChange={(kind) => update('kind', kind)} />

          <TriggerFields draft={props.draft} update={update} />

          <PromptField value={props.draft.prompt} onChange={(value) => update('prompt', value)} />

          <div class="cx-new-automation__actions">
            <Button
              variant="primary"
              disabled={!ready() || props.busy}
              onClick={() => props.onCreate()}
            >
              {props.busy ? 'Creating…' : 'Create automation'}
            </Button>
            <Button variant="ghost" onClick={() => props.onCancel()}>
              Cancel
            </Button>
          </div>
        </div>
      </PageBody>
    </>
  );
}
