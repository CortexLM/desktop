import { createSignal, type JSX, Show } from 'solid-js';

import { Composer, type ComposerControl } from '@cortex-ide/ui';
import type { Capabilities, RuntimeKind } from '@cortex-ide/cortex-api';

import { PageBody } from '../../shell/app-shell.tsx';
import { Checklist, type ChecklistStep } from './checklist.tsx';
import { RecentSessions, type RecentSessionRow } from './recent-sessions.tsx';
import { HarnessBanner } from '../code/harness-banner.tsx';
import type { HarnessStatus } from '../../state/harness.ts';

import './home.css';

/** What the composer will start a session with. */
export interface SessionDraft {
  prompt: string;
  repo?: string;
  branch?: string;
  model?: string;
  runtime: RuntimeKind;
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
  local: 'Local',
  cloud: 'Cloud',
  ssh: 'SSH server',
};

const RUNTIME_ICONS: Record<RuntimeKind, ComposerControl['icon']> = {
  local: 'desktop',
  cloud: 'cloud',
  ssh: 'server',
};

interface PickerSpec {
  id: string;
  label: string;
  icon?: ComposerControl['icon'];
  onPress?: () => void;
  /** Forces the control off even when a handler exists. */
  unavailable?: boolean;
}

/**
 * Builds a composer picker.
 *
 * A picker with no handler wired is rendered as a *disabled button*, not as inert text. An
 * inert chip looks identical to a live one and silently does nothing when clicked; a
 * disabled control says what it is and that it cannot be used yet.
 */
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

/**
 * Home: the composer plus what has happened recently.
 *
 * The Limits Usage Warning and Limits Limit Reached artboards are this screen with a notice
 * above the composer, not separate screens. A reached limit disables the composer as well as
 * showing the notice - offering a send button that cannot work would be worse than saying so.
 */
function draftControls(props: HomeScreenProps): ComposerControl[] {
  // The model is not a chip: C3 puts it on the composer's right as bare text
  // (`modelLabel`), so the left row carries only where the run happens.
  return [
    picker({
      id: 'repo',
      label: props.draft.repo ?? 'Choose a repository',
      icon: 'repo',
      onPress: props.onPickRepo,
    }),
    picker({
      id: 'branch',
      label: props.draft.branch ?? 'Default branch',
      icon: 'branch',
      onPress: props.onPickBranch,
    }),
    picker({
      id: 'runtime',
      label: RUNTIME_LABELS[props.draft.runtime],
      icon: RUNTIME_ICONS[props.draft.runtime],
      onPress: props.onPickRuntime,
      // With only one runtime available there is nothing to pick between, so the control
      // reports the runtime rather than pretending to offer a choice.
      unavailable: props.capabilities.runtimes.length < 2,
    }),
  ];
}

export function HomeScreen(props: HomeScreenProps): JSX.Element {
  const [checklistDismissed, setChecklistDismissed] = createSignal(false);

  const blocked = () => props.limit?.kind === 'reached';
  const controls = () => draftControls(props);

  return (
    <PageBody width="centred">
      <div class="cx-home">
        <h1 class="cx-home__greeting">{props.greeting}</h1>

        <Show when={props.harness}>
          {(status) => <HarnessBanner status={status()} remoteHost={props.remoteHost} onRemoteHostChange={props.onRemoteHostChange} />}
        </Show>

        <Show when={props.limit}>{(limit) => <LimitBanner limit={limit()} />}</Show>

        <div class="cx-home__composer">
          <Composer
            value={props.draft.prompt}
            onValueChange={(prompt) => props.onDraftChange({ ...props.draft, prompt })}
            onSubmit={() => props.onStart(props.draft)}
            placeholder="Describe a task, or paste an issue link"
            controls={controls()}
            modelLabel={props.draft.model ?? 'Choose a model'}
            onPickModel={props.onPickModel}
            onAttach={props.onAttach}
            onDictate={props.onDictate}
            disabled={blocked()}
            disabledReason={blocked() ? props.limit?.message : undefined}
          />
        </div>

        {/* `when={props.checklist && !dismissed()}` would hand the child accessor the
            boolean rather than the checklist, because `&&` yields its last truthy operand. */}
        <Show when={checklistDismissed() ? undefined : props.checklist}>
          {(checklist) => (
            <Checklist
              title={checklist().title}
              steps={checklist().steps}
              onDismiss={() => setChecklistDismissed(true)}
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
    </PageBody>
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
