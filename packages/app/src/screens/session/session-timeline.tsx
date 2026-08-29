import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button, Composer, Icon, type ComposerControl } from '@cortex-ide/ui';

export type PlanStepState = 'done' | 'current' | 'pending';

export interface PlanStep {
  id: string;
  label: string;
  state: PlanStepState;
}

export interface WorkEntry {
  id: string;
  /** The command or tool call, shown in mono, e.g. `pytest tests/auth -x --count=50`. */
  text: string;
}

export interface SessionArtifact {
  id: string;
  name: string;
  /** Kind and size, e.g. "Artifact · 2.1 KB · root-cause writeup". */
  meta: string;
  onOpen?: () => void;
}

export type PermissionDecision = 'allow-once' | 'allow-always' | 'deny';

export interface PendingPermission {
  requestId: string;
  /** What the agent is asking to do, e.g. `Create NOTES.md`. */
  summary: string;
  risk: 'safe' | 'caution' | 'dangerous';
}

export interface SessionTimelineProps {
  /** What the user asked for. */
  prompt: string;
  /** The agent's reply above its plan. */
  reply?: string;
  plan?: readonly PlanStep[];
  /** Mermaid flowchart or sequenceDiagram from plan mode. Shown in mono; plan prose is Inter. */
  planMermaid?: string;
  /** Pre-formatted, e.g. "Worked for 4m 32s". */
  workSummary?: string;
  work?: readonly WorkEntry[];
  artifacts?: readonly SessionArtifact[];
  /** One line on what is happening right now, shown above the follow-up composer. */
  activity?: string;
  /** The permission the run is blocked on. The agent waits until it is decided. */
  permission?: PendingPermission;
  onResolvePermission?: (requestId: string, decision: PermissionDecision) => void;
  followUp: string;
  onFollowUpChange: (value: string) => void;
  onSendFollowUp: () => void;
  followUpControls?: readonly ComposerControl[];
  /** Blocks the follow-up, e.g. once the session has finished. */
  followUpDisabled?: boolean;
  followUpDisabledReason?: string;
}

const STEP_LABELS: Record<PlanStepState, string> = {
  done: 'Done',
  current: 'In progress',
  pending: 'Not started',
};

function PlanList(props: { steps: readonly PlanStep[] }): JSX.Element {
  return (
    <ol class="cx-plan">
      <For each={props.steps}>
        {(step) => (
          <li
            class={
              step.state === 'current' ? 'cx-plan__step cx-plan__step--current' : 'cx-plan__step'
            }
          >
            <span
              class={
                step.state === 'pending' ? 'cx-plan__mark cx-plan__mark--pending' : 'cx-plan__mark'
              }
              role="img"
              aria-label={STEP_LABELS[step.state]}
            >
              <Show when={step.state === 'done'}>
                <Icon name="checkSmall" size={9} strokeWidth={1.4} />
              </Show>
              <Show when={step.state === 'current'}>
                <span class="cx-plan__current-dot" />
              </Show>
            </span>
            <span class="cx-plan__label">{step.label}</span>
          </li>
        )}
      </For>
    </ol>
  );
}

/**
 * The tool calls the agent made.
 *
 * Collapsed by default: it is the detail you go looking for when something went wrong, not
 * what you read first. The summary line stays visible so the cost is always in view.
 */
function Worklog(props: { summary: string; entries: readonly WorkEntry[] }): JSX.Element {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="cx-worklog">
      <button
        type="button"
        class="cx-worklog__toggle"
        aria-expanded={open()}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open() ? 'chevronDown' : 'chevronRight'} size={8} />
        {props.summary}
      </button>
      <Show when={open()}>
        <ul class="cx-worklog__entries">
          <For each={props.entries}>
            {(entry) => <li class="cx-worklog__entry">{entry.text}</li>}
          </For>
        </ul>
      </Show>
    </div>
  );
}

function ArtifactCard(props: { artifact: SessionArtifact }): JSX.Element {
  return (
    <div class="cx-artifact">
      <span class="cx-artifact__icon">
        <Icon name="file" size={14} />
      </span>
      <span class="cx-artifact__text">
        <span class="cx-artifact__name">{props.artifact.name}</span>
        <span class="cx-artifact__meta">{props.artifact.meta}</span>
      </span>
      <Show when={props.artifact.onOpen}>
        {(open) => (
          <button
            type="button"
            class="cx-artifact__action"
            onClick={() => open()()}
            aria-label={`View ${props.artifact.name}`}
          >
            View
          </button>
        )}
      </Show>
    </div>
  );
}

/**
 * The decision the run is blocked on: Allow / Always allow / Deny.
 *
 * `role="alert"`: this is the one timeline state where the agent is waiting on the
 * user, not the other way round. The buttons disable themselves after a click —
 * the banner only leaves the screen when the loop reacts (a tool event follows),
 * and until then a second click would race the first decision.
 */
function PermissionBanner(props: {
  request: PendingPermission;
  onResolve?: (requestId: string, decision: PermissionDecision) => void;
}): JSX.Element {
  const [decidedId, setDecidedId] = createSignal<string>();
  const busy = () => decidedId() === props.request.requestId;

  const decide = (decision: PermissionDecision) => {
    if (busy()) return;
    setDecidedId(props.request.requestId);
    props.onResolve?.(props.request.requestId, decision);
  };

  return (
    <div class="cx-permission" role="alert" data-risk={props.request.risk}>
      <span class="cx-permission__icon" aria-hidden="true">
        <Icon name="lock" size={14} />
      </span>
      <span class="cx-permission__text">
        <span class="cx-permission__title">Permission needed</span>
        <span class="cx-permission__summary">{props.request.summary}</span>
      </span>
      <span class="cx-permission__actions">
        <Button variant="ghost" disabled={busy()} onClick={() => decide('deny')}>
          Deny
        </Button>
        <Button variant="secondary" disabled={busy()} onClick={() => decide('allow-always')}>
          Always allow
        </Button>
        <Button variant="primary" disabled={busy()} onClick={() => decide('allow-once')}>
          Allow
        </Button>
      </span>
    </div>
  );
}

/**
 * The agent timeline: what was asked, the plan, what was done, and the follow-up composer.
 *
 * The composer is pinned below the scrolling transcript rather than sitting at the end of
 * it, so a long session does not push the way to reply off-screen.
 */
export function SessionTimeline(props: SessionTimelineProps): JSX.Element {
  return (
    <>
      <div class="cx-timeline">
        <p class="cx-timeline__prompt">{props.prompt}</p>
        <TimelineReply {...props} />
        <For each={props.artifacts}>{(artifact) => <ArtifactCard artifact={artifact} />}</For>
      </div>
      <TimelineFooter {...props} />
    </>
  );
}

function TimelineReply(props: SessionTimelineProps): JSX.Element {
  return (
    <Show when={props.reply || props.plan?.length || props.workSummary || props.planMermaid}>
      <div class="cx-timeline__reply">
        <Show when={props.reply}>{(reply) => <p class="cx-timeline__reply-text">{reply()}</p>}</Show>
        <Show when={props.planMermaid}>
          {(diagram) => (
            <pre class="cx-plan__mermaid" aria-label="Plan diagram">
              {diagram()}
            </pre>
          )}
        </Show>
        <Show when={props.plan?.length ? props.plan : undefined}>
          {(steps) => <PlanList steps={steps()} />}
        </Show>
        <Show when={props.workSummary}>
          {(summary) => <Worklog summary={summary()} entries={props.work ?? []} />}
        </Show>
      </div>
    </Show>
  );
}

function TimelineFooter(props: SessionTimelineProps): JSX.Element {
  return (
    <div class="cx-timeline__footer">
      <Show when={props.permission}>
        {(request) => (
          <PermissionBanner request={request()} onResolve={props.onResolvePermission} />
        )}
      </Show>
      <Show when={!props.permission && props.activity}>
        <p class="cx-timeline__activity" role="status">
          <span class="cx-timeline__pulse" aria-hidden="true" />
          {props.activity}
        </p>
      </Show>
      <Composer
        value={props.followUp}
        onValueChange={props.onFollowUpChange}
        onSubmit={props.onSendFollowUp}
        placeholder="Ask a follow-up or adjust the plan…"
        controls={props.followUpControls}
        disabled={props.followUpDisabled}
        disabledReason={props.followUpDisabledReason}
        sendLabel="Send follow-up"
      />
    </div>
  );
}
