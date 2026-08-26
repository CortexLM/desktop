/**
 * Review and Usage.
 *
 * Both are read-only views over data that already exists, and both were passing
 * empty arrays while that data sat one accessor away.
 *
 * Review reads the run store: a run in `review` is by definition one whose changes
 * a human has not looked at, which is exactly the screen's subject. Usage reads the
 * same store rather than the Cortex API, and that is a deliberate limit stated
 * below.
 */

import { createMemo, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import type { SessionSummary } from '@cortex-ide/shared';

import { useAccount } from '../state/session-context.tsx';
import { useSessions } from '../state/sessions-context.tsx';
import { formatAge, toBadgeStatus } from '../state/session-view.ts';
import { ReviewScreen, type ReviewItem } from '../screens/review/review-screen.tsx';
import { UsageScreen, type UsageRow } from '../screens/usage/usage-screen.tsx';

/** `https://github.com/o/r/pull/42` -> `42`. */
function pullRequestNumber(url: string | undefined): number | undefined {
  if (!url) return undefined;
  const match = /\/pull\/(\d+)/.exec(url);
  return match ? Number(match[1]) : undefined;
}

function toReviewItem(session: SessionSummary, now: number): ReviewItem {
  const number = pullRequestNumber(session.pullRequestUrl);
  return {
    id: session.id,
    title: session.title,
    repo: session.repo ?? 'Local folder',
    status: toBadgeStatus(session.status),
    diff: { added: session.additions, removed: session.deletions },
    age: formatAge(session.finishedAt ?? session.updatedAt, now),
    ...(number !== undefined ? { pullRequest: number } : {}),
  };
}

export function ReviewRoute(): JSX.Element {
  const account = useAccount();
  const runs = useSessions();
  const navigate = useNavigate();

  const items = createMemo(() => {
    const now = Date.now();
    // `awaitingReview` is the store's own definition of the state, so this screen
    // and the inbox's "Needs review" filter cannot drift apart.
    return runs.awaitingReview().map((session) => toReviewItem(session, now));
  });

  return (
    <ReviewScreen
      capabilities={account.capabilities()}
      items={items()}
      onOpen={(id) => navigate(`/code/sessions/${id}`)}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

/** `1` -> `1 session`, `4` -> `4 sessions`. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The month the figures cover, as the design labels it.
 *
 * Derived from the clock rather than from the data: an empty month is still this
 * month, and labelling it from the newest run would say "August" in September.
 */
function currentPeriod(now = new Date()): string {
  return now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function toUsageStats(sessions: readonly SessionSummary[]) {
  const finished = sessions.filter((session) => session.finishedAt !== undefined);
  const added = sessions.reduce((total, session) => total + session.additions, 0);
  const removed = sessions.reduce((total, session) => total + session.deletions, 0);

  return [
    { label: 'Sessions', value: String(sessions.length) },
    { label: 'Completed', value: String(finished.length) },
    { label: 'Lines changed', value: `+${added} −${removed}` },
  ];
}

/**
 * Sessions grouped by what ran them.
 *
 * Credits are a dash, not a zero. Metering is server-side and the API exposes no
 * usage route (see `packages/cortex-api/CONTRACT.md`), so a number here would be
 * invented — and a billing figure that looks precise and is made up is worse than an
 * honest blank. Session counts and diff sizes are local facts, so those are real.
 */
function toUsageRows(sessions: readonly SessionSummary[]): UsageRow[] {
  if (sessions.length === 0) return [];

  const byRuntime = new Map<string, number>();
  for (const session of sessions) {
    // The summary carries no model, so runs group under the runtime that ran them —
    // the honest granularity the local data supports.
    const key = session.runtime === 'local' ? 'Local runtime' : session.runtime;
    byRuntime.set(key, (byRuntime.get(key) ?? 0) + 1);
  }

  return [...byRuntime.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([model, count]) => ({
      id: model,
      model,
      sessions: count,
      credits: '—',
      share: `${Math.round((count / sessions.length) * 100)}%`,
    }));
}

export function UsageRoute(): JSX.Element {
  const account = useAccount();
  const runs = useSessions();
  const navigate = useNavigate();

  const thisMonth = createMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return (runs.sessions() ?? []).filter((session) => session.createdAt >= start.getTime());
  });

  const stats = createMemo(() => toUsageStats(thisMonth()));
  const rows = createMemo(() => toUsageRows(thisMonth()));

  const period = createMemo(() => {
    const sessions = thisMonth();
    return sessions.length === 0
      ? currentPeriod()
      : `${currentPeriod()} · ${plural(sessions.length, 'session')}`;
  });

  return (
    <UsageScreen
      capabilities={account.capabilities()}
      period={period()}
      stats={stats()}
      rows={rows()}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}
