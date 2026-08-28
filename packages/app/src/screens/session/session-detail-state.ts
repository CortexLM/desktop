/**
 * Loads one run and projects it onto what Session Detail draws.
 *
 * The projection is the substance here. Main persists an append-only timeline of
 * what happened — prompts, replies, tool calls, plans, permission requests — and
 * the screen wants named slots: the prompt, the reply, a plan, a worklog, a diff.
 * Turning one into the other is a decision per slot, not a rename, so it lives in
 * one place rather than being spread across the screen's children.
 *
 * It refetches on progress rather than patching. Unlike the inbox — where the
 * event carries the whole updated row — a timeline event does not carry the diff,
 * and the diff is read from git at the end of a run. Refetching is one round trip
 * per event on a screen the user is actively watching, against the alternative of
 * a locally-reconstructed timeline that can drift from what was stored.
 */

import { createMemo, createResource, type Accessor } from 'solid-js';

import type { SessionDetail, SessionEvent } from '@cortex-ide/shared';

import type { SessionsContextValue } from '../../state/sessions-context.tsx';
import { watchLiveRoom } from '../../state/realtime-rooms.ts';
import { formatDuration, toSessionMeta } from '../../state/session-view.ts';
import { parseUnifiedDiff, type DiffFile } from './diff-view.tsx';
import type { PlanStep, SessionArtifact, WorkEntry } from './session-timeline.tsx';
import type { SessionDetailScreenProps } from './session-detail-screen.tsx';

/** The props Session Detail needs, minus the ones the route owns (tab, follow-up). */
type DetailView = Omit<
  SessionDetailScreenProps,
  | 'activeTab'
  | 'onTabChange'
  | 'followUp'
  | 'onFollowUpChange'
  | 'onSendFollowUp'
  | 'onBack'
  | 'onResolvePermission'
>;

/**
 * The one-line summary a tool call gets in the worklog.
 *
 * The agent already produces a `title` for display; `detail` is appended when it
 * adds something the title does not say (which file, which command). Falling back
 * to the tool's raw name keeps the row honest rather than blank when neither is
 * set.
 */
function toWorkEntry(event: SessionEvent & { kind: 'tool' }, index: number): WorkEntry {
  const text = [event.title || event.name, event.detail].filter(Boolean).join(' — ');
  return { id: `tool-${index}`, text };
}

/**
 * The prose the agent produced, joined.
 *
 * Multiple `reply` entries mean multiple turns — a follow-up adds one. Joined with
 * a blank line so the turns stay readable as separate paragraphs instead of
 * running together mid-sentence.
 */
function replyOf(events: readonly SessionEvent[]): string | undefined {
  const replies = events
    .filter((event): event is SessionEvent & { kind: 'reply' } => event.kind === 'reply')
    .map((event) => event.text.trim())
    .filter((text) => text.length > 0);

  return replies.length > 0 ? replies.join('\n\n') : undefined;
}

/** The latest plan. An agent revises its plan; only the current one is useful. */
function planOf(events: readonly SessionEvent[]): readonly PlanStep[] | undefined {
  const plans = events.filter(
    (event): event is SessionEvent & { kind: 'plan' } => event.kind === 'plan',
  );
  const latest = plans.at(-1);
  return latest ? latest.steps.map((step) => ({ ...step })) : undefined;
}

/**
 * What is happening right now, shown above the follow-up composer.
 *
 * Read off the LAST event only, not scanned backwards: a decided permission is
 * never rewritten in place — the decision shows up as the tool events that follow
 * it — so a scan that walks past those would rediscover the old request and
 * report a run as "waiting" that was allowed minutes ago.
 */
function activityOf(detail: SessionDetail): string | undefined {
  if (detail.status !== 'running') return undefined;

  const event = detail.events.at(-1);
  if (event?.kind === 'permission' && event.decision === undefined) {
    return `Waiting for permission: ${event.summary}`;
  }
  if (event?.kind === 'tool' && event.ok === undefined) {
    return `Running ${event.title || event.name}`;
  }

  return 'Working…';
}

/**
 * The permission the run is currently blocked on, if any.
 *
 * Same reading as `activityOf`: pending means the request is the newest thing on
 * the timeline and the run is still live. The moment it is decided, the loop
 * appends a tool event after it and the banner leaves on its own — no decision
 * field needs to be written back into the stored event.
 */
function pendingPermissionOf(
  detail: SessionDetail,
): { requestId: string; summary: string; risk: 'safe' | 'caution' | 'dangerous' } | undefined {
  if (detail.status !== 'running') return undefined;

  const event = detail.events.at(-1);
  if (event?.kind !== 'permission' || event.decision !== undefined) return undefined;

  return { requestId: event.requestId, summary: event.summary, risk: event.risk };
}

/** "Worked for 4m 32s", once the run has both ends of its interval. */
function workSummaryOf(detail: SessionDetail): string | undefined {
  const events = detail.events;
  const first = events[0]?.at;
  const last = detail.finishedAt ?? events.at(-1)?.at;
  if (first === undefined || last === undefined || last <= first) return undefined;

  const tools = events.filter((event) => event.kind === 'tool').length;
  const duration = formatDuration(last - first);
  return tools > 0 ? `Worked for ${duration} · ${tools} steps` : `Worked for ${duration}`;
}

/**
 * Files the agent wrote, as artifacts.
 *
 * Derived from tool calls that reported a diff rather than from a separate list:
 * an "artifact" in the design is a file the run produced, and a tool call that
 * added lines to a path is exactly that. Deduplicated on the detail line, because
 * three edits to one file are one artifact.
 */
function artifactsOf(detail: SessionDetail): readonly SessionArtifact[] | undefined {
  const seen = new Map<string, SessionArtifact>();

  for (const event of detail.events) {
    if (event.kind !== 'tool' || !event.detail) continue;
    if (event.additions === undefined && event.deletions === undefined) continue;
    if (seen.has(event.detail)) continue;

    const added = event.additions ?? 0;
    const removed = event.deletions ?? 0;
    seen.set(event.detail, {
      id: event.detail,
      name: event.detail,
      meta: `Changed · +${added} −${removed}`,
    });
  }

  return seen.size > 0 ? [...seen.values()] : undefined;
}

function toDiffFiles(detail: SessionDetail): DiffFile[] {
  return detail.files.map((file) => ({
    path: file.path,
    added: file.additions,
    removed: file.deletions,
    rows: parseUnifiedDiff(file.diff),
  }));
}

/** The view for a run that could not be loaded. */
function missing(id: string): DetailView {
  return {
    title: 'Session not found',
    // Names the id rather than saying "something went wrong": the usual cause is a
    // stale link or a deleted run, and the id is what makes that recognisable.
    meta: `No session with id ${id}`,
    running: false,
    files: [],
    prompt: '',
    followUpDisabled: true,
    followUpDisabledReason: 'This session no longer exists',
  };
}

/**
 * Copies a value onto the view only when it is set.
 *
 * The screen distinguishes an absent slot from an empty one — no plan renders
 * nothing, an empty plan renders an empty list — so `undefined` must not be
 * assigned. Doing it through one helper keeps `toView` readable instead of a wall
 * of conditional spreads.
 */
function assign<K extends keyof DetailView>(
  view: DetailView,
  key: K,
  value: DetailView[K] | undefined,
): void {
  if (value !== undefined) view[key] = value;
}

function toView(detail: SessionDetail): DetailView {
  const running = detail.status === 'running' || detail.status === 'queued';

  const work = detail.events
    .filter((event): event is SessionEvent & { kind: 'tool' } => event.kind === 'tool')
    .map(toWorkEntry);

  const prompt =
    detail.events.find(
      (event): event is SessionEvent & { kind: 'prompt' } => event.kind === 'prompt',
    )?.text ?? detail.title;

  const view: DetailView = {
    title: detail.title,
    meta: toSessionMeta(detail),
    running,
    files: toDiffFiles(detail),
    prompt,
  };

  assign(view, 'reply', replyOf(detail.events));
  assign(view, 'plan', planOf(detail.events));
  assign(view, 'work', work.length > 0 ? work : undefined);
  assign(view, 'artifacts', artifactsOf(detail));
  assign(view, 'activity', activityOf(detail));
  assign(view, 'permission', pendingPermissionOf(detail));
  assign(view, 'workSummary', workSummaryOf(detail));
  // The recorded reason, or the last error event when the row has none — a run can
  // fail mid-turn and be recorded on the timeline before the status catches up.
  assign(
    view,
    'error',
    detail.error ??
      [...detail.events]
        .reverse()
        .find((event): event is SessionEvent & { kind: 'error' } => event.kind === 'error')
        ?.message,
  );
  assign(
    view,
    'pullRequestNumber',
    detail.pullRequestUrl ? pullRequestNumberOf(detail.pullRequestUrl) : undefined,
  );

  // A run in flight accepts no follow-up: the agent is mid-turn and a second
  // prompt would either be dropped or interleave with the one it is working on.
  if (running) {
    view.followUpDisabled = true;
    view.followUpDisabledReason = 'Wait for this turn to finish, or stop it first';
  }

  return view;
}

/** `https://github.com/o/r/pull/42` -> `42`. */
function pullRequestNumberOf(url: string): number | undefined {
  const match = /\/pull\/(\d+)/.exec(url);
  return match ? Number(match[1]) : undefined;
}

export interface SessionDetailState {
  view: Accessor<DetailView>;
  detail: Accessor<SessionDetail | null>;
}

export function createSessionDetail(
  id: Accessor<string>,
  runs: SessionsContextValue,
): SessionDetailState {
  watchLiveRoom('code_session', id);
  /**
   * Refetches whenever the store's row for this run moves.
   *
   * Keyed on `updatedAt` rather than on a progress subscription of its own, and that
   * is the fix for a real bug: a run that failed in the milliseconds between
   * navigating and mounting emitted its progress before this component existed, so
   * no event ever arrived and the screen showed it as still running — forever. The
   * store holds the row either way, so deriving from it cannot miss an update that
   * happened first.
   */
  const revision = createMemo(() => {
    const summary = (runs.sessions() ?? []).find((session) => session.id === id());
    return `${id()}:${summary?.updatedAt ?? 0}`;
  });

  const [detail] = createResource(
    revision,
    async () => {
      try {
        return await runs.host.get(id());
      } catch {
        return null;
      }
    },
    { initialValue: null },
  );

  const view = createMemo(() => {
    const current = detail();
    return current ? toView(current) : missing(id());
  });

  return { view, detail: () => detail() ?? null };
}
