/**
 * Projects a run onto the shapes the screens draw.
 *
 * Two vocabularies meet here, and they are deliberately not the same one:
 *
 *   - **The domain states** (`queued`, `running`, `review`, `merged`, `failed`,
 *     `stopped`) describe what the orchestrator is doing. They are what main
 *     persists and what the inbox filters on.
 *   - **The badge states** (`draft`, `running`, `pr-ready`, `merged`, `error`)
 *     are what the design draws. `pr-ready` is a statement about a pull request,
 *     not about the agent.
 *
 * Collapsing them would mean either the database storing presentation labels, or
 * the design growing two badges that look identical. Mapping in one place instead
 * means there is a single answer to "what does this state look like", and it is
 * reviewable.
 */

import type { SessionStatus as BadgeStatus } from '@cortex-ide/ui';
import type { SessionStatus, SessionSummary } from '@cortex-ide/shared';

import type { InboxSession } from '../screens/sessions/sessions-screen.tsx';
import type { RecentSessionRow } from '../screens/home/recent-sessions.tsx';

const BADGE_STATUS: Record<SessionStatus, BadgeStatus> = {
  // Created but no turn has produced anything yet — the design's neutral state.
  queued: 'draft',
  running: 'running',
  // The run finished and left changes for a human. `pr-ready` is the design's
  // name for that, even before a pull request exists.
  review: 'pr-ready',
  merged: 'merged',
  failed: 'error',
  // A user-cancelled run reads as neutral, not as a failure: nothing went wrong,
  // somebody changed their mind. `error` would send them looking for a cause.
  stopped: 'draft',
};

export function toBadgeStatus(status: SessionStatus): BadgeStatus {
  return BADGE_STATUS[status];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * `1723459200000` -> `"4m ago"`.
 *
 * Coarse on purpose, and it stops at weeks. A run from three months ago does not
 * become more findable for saying "13w ago", and the design gives the cell one
 * short line.
 */
export function formatAge(timestamp: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - timestamp);

  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 2 * DAY) return 'yesterday';
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;
  return `${Math.floor(elapsed / (7 * DAY))}w ago`;
}

/** `272000` -> `"4m 32s"`. Used for "Worked for …" above the timeline. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * The diff stat, or nothing.
 *
 * `undefined` rather than a pair of zeroes when nothing changed: the design hides
 * the cell in that case, and `+0 −0` is a claim that a diff was computed and came
 * out empty — which is not the same as a run that has not produced one yet.
 */
function diffOf(summary: SessionSummary): { added: number; removed: number } | undefined {
  if (summary.additions === 0 && summary.deletions === 0) return undefined;
  return { added: summary.additions, removed: summary.deletions };
}

export function toInboxSession(summary: SessionSummary, now = Date.now()): InboxSession {
  const diff = diffOf(summary);
  return {
    id: summary.id,
    title: summary.title,
    // The inbox groups by repo, so a run with no repository still needs a lane to
    // sit in rather than being dropped from the list.
    repo: summary.repo ?? 'Local folder',
    branch: summary.branch ?? '—',
    status: toBadgeStatus(summary.status),
    age: formatAge(summary.updatedAt, now),
    ...(diff ? { diff } : {}),
  };
}

export function toRecentRow(summary: SessionSummary, now = Date.now()): RecentSessionRow {
  const diff = diffOf(summary);
  return {
    id: summary.id,
    title: summary.title,
    context: [summary.repo, summary.branch].filter(Boolean).join(' · ') || 'Local folder',
    status: toBadgeStatus(summary.status),
    age: formatAge(summary.updatedAt, now),
    ...(diff ? { diff } : {}),
  };
}

/**
 * The meta line under a session's title: repo, branch and when it ran.
 *
 * Dates from `finishedAt` once the run is over and from `createdAt` while it is
 * live. Using `updatedAt` throughout would make a finished run's line creep
 * forward every time anything touched the row — archiving it, for instance.
 */
export function toSessionMeta(summary: SessionSummary, now = Date.now()): string {
  const parts = [summary.repo, summary.branch].filter(Boolean) as string[];
  parts.push(formatAge(summary.finishedAt ?? summary.createdAt, now));
  return parts.join(' · ');
}
