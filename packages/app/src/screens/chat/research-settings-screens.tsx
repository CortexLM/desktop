import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { RemoteStateView } from '../shared/remote-state-view.tsx';
import { SettingGroup, SettingRow, Toggle } from '../settings/controls.tsx';
import type { RemoteState } from '../../state/remote-collection.ts';
import type { ResearchRun } from '../../state/research.ts';

import './product-pages.css';

function statusLabel(run: ResearchRun): string {
  if (run.status === 'running') return 'Researching';
  if (run.status === 'done') return `${run.sourceCount} source${run.sourceCount === 1 ? '' : 's'}`;
  if (run.status === 'failed') return 'Failed';
  return 'Queued';
}

function QuestionForm(props: { onStart: (question: string) => void }): JSX.Element {
  const [question, setQuestion] = createSignal('');

  return (
    <form
      class="cx-product-form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = question().trim();
        if (!value) return;
        props.onStart(value);
        setQuestion('');
      }}
    >
      <input
        type="text"
        value={question()}
        placeholder="What should Cortex look into?"
        aria-label="Research question"
        onInput={(event) => setQuestion(event.currentTarget.value)}
      />
      <Button variant="primary" type="submit">
        Start
      </Button>
    </form>
  );
}

function ResearchList(props: {
  runs: readonly ResearchRun[];
  onOpen?: (run: ResearchRun) => void;
}): JSX.Element {
  return (
    <div class="cx-product-list">
      <For each={props.runs}>
        {(run) => (
          <div class="cx-product-row" data-research={run.id}>
            <div>
              <div class="cx-product-row__title">{run.question}</div>
              <p class="cx-product-row__meta">{statusLabel(run)}</p>
            </div>
            <div class="cx-product-row__action">
              <Show when={run.conversationId && props.onOpen}>
                <Button variant="secondary" onClick={() => props.onOpen?.(run)}>
                  Open
                </Button>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export function ResearchScreen(props: {
  runs: readonly ResearchRun[];
  state: RemoteState;
  error?: string;
  signedIn: boolean;
  onStart: (question: string) => void;
  onOpen?: (run: ResearchRun) => void;
  onRetry: () => void;
  onSignIn: () => void;
}): JSX.Element {
  return (
    <>
      <PageHeader title="Research" subtitle="Cited answers from live sources." />
      <PageBody width="list">
        <Show
          when={props.signedIn}
          fallback={
            <HonestState
              kind="signed-out"
              title="Research needs a Cortex account"
              body="Live sources are read by Cortex, not by this tab. Sign in to queue a brief."
              actionLabel="Sign in"
              onAction={props.onSignIn}
            />
          }
        >
          {/* Offered only once the account answered: a box that accepts a question
              against a backend with no research route would take work nothing is
              going to do. */}
          <Show when={props.state === 'ready' || props.state === 'empty'}>
            <QuestionForm onStart={props.onStart} />
          </Show>

          <RemoteStateView
            state={props.state}
            {...(props.error ? { error: props.error } : {})}
            label="Research"
            emptyTitle="Nothing is queued"
            emptyBody="Ask a question above. Finished briefs land here with their citations."
            onRetry={props.onRetry}
          >
            <ResearchList runs={props.runs} {...(props.onOpen ? { onOpen: props.onOpen } : {})} />
          </RemoteStateView>
        </Show>
      </PageBody>
    </>
  );
}

/**
 * One preference.
 *
 * `editable` disables the control rather than hiding the row: a setting the account
 * has and this client cannot reach should still be visible, and a toggle that moves
 * but saves nowhere is worse than one that is visibly unavailable.
 */
function PreferenceRow(props: {
  group: string;
  title: string;
  description: string;
  label: string;
  checked: boolean;
  editable: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <SettingGroup label={props.group}>
      <SettingRow
        title={props.title}
        description={props.description}
        control={
          <Toggle
            checked={props.checked}
            disabled={!props.editable}
            onChange={props.onChange}
            label={props.label}
          />
        }
      />
    </SettingGroup>
  );
}

export function ChatSettingsScreen(props: {
  streamReplies: boolean;
  onStreamReplies: (value: boolean) => void;
  notifyMentions: boolean;
  onNotifyMentions: (value: boolean) => void;
  /** False when the account could not be reached; the toggles are then read-only. */
  editable: boolean;
  error?: string;
}): JSX.Element {
  return (
    <>
      <PageHeader title="Settings" subtitle="Chat defaults, stored on your Cortex account." />
      <PageBody width="settings">
        <Show when={props.error}>
          <p class="cx-product-error" role="alert">{props.error}</p>
        </Show>
        <Show when={!props.editable}>
          <p class="cx-product-note">
            These are the shipped defaults. They cannot be changed until Cortex answers.
          </p>
        </Show>
        <PreferenceRow
          group="Replies"
          title="Stream replies"
          description="Show tokens as they arrive."
          label="Stream replies"
          checked={props.streamReplies}
          editable={props.editable}
          onChange={props.onStreamReplies}
        />
        <PreferenceRow
          group="Notifications"
          title="Mentions"
          description="Cortex notifies you when someone mentions you."
          label="Notify on mentions"
          checked={props.notifyMentions}
          editable={props.editable}
          onChange={props.onNotifyMentions}
        />
      </PageBody>
    </>
  );
}
