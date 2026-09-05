import { createSignal, type JSX, Show } from 'solid-js';

import { Composer, Segmented, type ComposerControl } from '@cortex-ide/ui';
import type { Capabilities, RuntimeKind } from '@cortex-ide/cortex-api';

import { PageBody } from '../../shell/app-shell.tsx';
import { Checklist, type ChecklistStep } from './checklist.tsx';
import { CodeEmptyHome } from './code-empty-home.tsx';
import { RecentSessions, type RecentSessionRow } from './recent-sessions.tsx';
import { HarnessBanner } from '../code/harness-banner.tsx';
import type { HarnessStatus } from '../../state/harness.ts';

import './home.css';

/** What the composer will start a session with. */
export interface SessionDraft {
  prompt: string;
  repo?: string;
  branch?: string;
  worktree?: string;
  model?: string;
  runtime: RuntimeKind;
  mode?: 'ask' | 'plan' | 'agent';
}

export interface LimitNotice {
  kind: 'warning' | 'reached';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface HomeScreenProps {
  capabilities: Capabilities;
  /** "What should we build, Ana?" — assembled by the caller, which knows the name. */
  greeting: string;
  draft: SessionDraft;
  onDraftChange: (draft: SessionDraft) => void;
  onStart: (draft: SessionDraft) => void;
  recentSessions: readonly RecentSessionRow[];
  onOpenSession: (id: string) => void;
  onViewAllSessions?: () => void;
  checklist?: { title: string; steps: readonly ChecklistStep[] };
  /** Drives the Limits Usage Warning and Limits Limit Reached variants of this screen. */
  limit?: LimitNotice;
  onPickRepo?: () => void;
  onPickBranch?: () => void;
  onPickModel?: () => void;
  onPickRuntime?: () => void;
  onAttach?: () => void;
  onDictate?: () => void;
  harness?: HarnessStatus;
  remoteHost?: string;
  onRemoteHostChange?: (value: string) => void;
}

const RUNTIME_LABELS: Record<RuntimeKind, string> = {
  local: 'This PC',
  cloud: 'Cloud',
  ssh: 'SSH',
};

const RUNTIME_ICONS: Record<RuntimeKind, ComposerControl['icon']> = {
  local: 'desktop',
  cloud: 'cloud',
  ssh: 'server',
};

const CODE_MODES = [
  { id: 'ask', label: 'Ask' },
  { id: 'plan', label: 'Plan' },
  { id: 'agent', label: 'Agent' },
];

interface PickerSpec {
  id: string;
  label: string;
  icon?: ComposerControl['icon'];
  onPress?: () => void;
  unavailable?: boolean;
}

function picker(spec: PickerSpec): ComposerControl {
  return {
    id: spec.id,
    label: spec.label,
    icon: spec.icon,
    picker: true,
    onPress: () => spec.onPress?.(),
    disabled: Boolean(spec.unavailable) || !spec.onPress,
  };
}

function repoLabel(draft: SessionDraft): string {
  if (draft.repo) return draft.repo;
  return draft.runtime === 'local' ? 'Open a folder' : 'Choose a repository';
}

function draftControls(props: HomeScreenProps): ComposerControl[] {
  return [
    picker({ id: 'repo', label: repoLabel(props.draft), icon: 'repo', onPress: props.onPickRepo }),
    picker({
      id: 'branch',
      label: props.draft.branch ?? 'Default branch',
      icon: 'branch',
      onPress: props.onPickBranch,
    }),
    picker({
      id: 'worktree',
      label: props.draft.worktree ?? 'Worktree',
      icon: 'folder',
    }),
    picker({
      id: 'runtime',
      label: RUNTIME_LABELS[props.draft.runtime],
      icon: RUNTIME_ICONS[props.draft.runtime],
      onPress: props.onPickRuntime,
      unavailable: props.capabilities.runtimes.length < 2,
    }),
  ];
}

function CodeMode(props: HomeScreenProps): JSX.Element {
  return (
    <Segmented
      bordered
      label="Mode"
      value={props.draft.mode ?? 'agent'}
      onChange={(id) => props.onDraftChange({ ...props.draft, mode: id as SessionDraft['mode'] })}
      options={CODE_MODES}
    />
  );
}

export function HomeScreen(props: HomeScreenProps): JSX.Element {
  const [checklistDismissed, setChecklistDismissed] = createSignal(false);
  const blocked = () => props.limit?.kind === 'reached';
  const controls = () => draftControls(props);
  const empty = () => props.recentSessions.length === 0;

  return (
    <PageBody width="centred">
      <Show
        when={empty()}
        fallback={
          <PopulatedHome
            {...props}
            checklistDismissed={checklistDismissed}
            setChecklistDismissed={setChecklistDismissed}
            blocked={blocked}
            controls={controls}
          />
        }
      >
        <EmptyHomeFrame
          harness={props.harness}
          remoteHost={props.remoteHost}
          onRemoteHostChange={props.onRemoteHostChange}
          capabilities={props.capabilities}
          draft={props.draft}
          onDraftChange={props.onDraftChange}
          onStart={props.onStart}
          limit={props.limit}
        />
      </Show>
    </PageBody>
  );
}

function EmptyHomeFrame(
  props: Pick<
    HomeScreenProps,
    | 'harness'
    | 'remoteHost'
    | 'onRemoteHostChange'
    | 'capabilities'
    | 'draft'
    | 'onDraftChange'
    | 'onStart'
    | 'limit'
  >,
): JSX.Element {
  return (
    <>
      <Show when={props.harness}>
        {(status) => (
          <HarnessBanner
            status={status()}
            remoteHost={props.remoteHost}
            onRemoteHostChange={props.onRemoteHostChange}
          />
        )}
      </Show>
      <Show when={props.limit}>{(limit) => <LimitBanner limit={limit()} />}</Show>
      <CodeEmptyHome
        capabilities={props.capabilities}
        draft={props.draft}
        onDraftChange={props.onDraftChange}
        onStart={props.onStart}
      />
    </>
  );
}

function PopulatedHome(
  props: HomeScreenProps & {
    checklistDismissed: () => boolean;
    setChecklistDismissed: (value: boolean) => void;
    blocked: () => boolean;
    controls: () => ComposerControl[];
  },
): JSX.Element {
  return (
    <div class="cx-home">
      <h1 class="cx-home__greeting">{props.greeting}</h1>

      <Show when={props.harness}>
        {(status) => (
          <HarnessBanner
            status={status()}
            remoteHost={props.remoteHost}
            onRemoteHostChange={props.onRemoteHostChange}
          />
        )}
      </Show>

      <Show when={props.limit}>{(limit) => <LimitBanner limit={limit()} />}</Show>

      <div class="cx-home__composer">
        <Composer
          value={props.draft.prompt}
          onValueChange={(prompt) => props.onDraftChange({ ...props.draft, prompt })}
          onSubmit={() => props.onStart(props.draft)}
          placeholder="Describe a task, or paste an issue link"
          controls={props.controls()}
          leading={<CodeMode {...props} />}
          modelLabel={props.draft.model ?? 'Choose a model'}
          onPickModel={props.onPickModel}
          onAttach={props.onAttach}
          onDictate={props.onDictate}
          disabled={props.blocked()}
          disabledReason={props.blocked() ? props.limit?.message : undefined}
        />
      </div>

      <Show when={props.checklistDismissed() ? undefined : props.checklist}>
        {(checklist) => (
          <Checklist
            title={checklist().title}
            steps={checklist().steps}
            onDismiss={() => props.setChecklistDismissed(true)}
          />
        )}
      </Show>

      <Show when={props.recentSessions.length > 0}>
        <RecentSessions
          rows={props.recentSessions}
          onOpen={props.onOpenSession}
          onViewAll={props.onViewAllSessions}
        />
      </Show>
    </div>
  );
}

/**
 * The usage warning and limit-reached notice.
 *
 * `role="alert"` for a reached limit and `role="status"` for a warning: the first is
 * blocking and worth interrupting for, the second is information the user can act on later.
 */
function LimitBanner(props: { limit: LimitNotice }): JSX.Element {
  const reached = () => props.limit.kind === 'reached';

  return (
    <div
      class={reached() ? 'cx-limit cx-limit--reached' : 'cx-limit cx-limit--warning'}
      role={reached() ? 'alert' : 'status'}
    >
      <span class="cx-limit__message">{props.limit.message}</span>
      <Show when={props.limit.actionLabel}>
        {(label) => (
          <button type="button" class="cx-limit__action" onClick={() => props.limit.onAction?.()}>
            {label()}
          </button>
        )}
      </Show>
    </div>
  );
}
