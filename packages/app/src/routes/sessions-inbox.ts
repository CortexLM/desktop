/**
 * Code inbox helpers — filter chips, empty copy, and the grouped summary.
 *
 * Split out of `run-routes.tsx` so that file stays a route adapter.
 */

import type { SessionSummary } from '@cortex-ide/shared';

export const SESSION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'review', label: 'Needs review' },
  { id: 'archived', label: 'Archived' },
];

/** Copy that names the filter, so an empty list explains itself. */
export const EMPTY_STATES: Record<string, { title: string; body: string }> = {
  all: {
    title: 'No sessions yet',
    body: 'Start one from the composer on Home, and it will show up here as it runs.',
  },
  active: {
    title: 'Nothing running',
    body: 'Sessions appear here while an agent is working on them.',
  },
  review: {
    title: 'Nothing to review',
    body: 'Finished sessions with changes land here for you to look over.',
  },
  archived: { title: 'Nothing archived', body: 'Sessions you archive are kept here.' },
};

/** "6 sessions across 3 repositories · 1 running" — over everything unarchived. */
export function workspaceSummary(sessions: readonly SessionSummary[]): string | undefined {
  const all = sessions.filter((session) => !session.archived);
  if (all.length === 0) return undefined;
  const repos = new Set(all.map((session) => session.repo ?? 'This PC')).size;
  const running = all.filter(
    (session) => session.status === 'running' || session.status === 'queued',
  ).length;
  const parts = [
    `${all.length} session${all.length === 1 ? '' : 's'} across ${repos} repositor${repos === 1 ? 'y' : 'ies'}`,
  ];
  if (running > 0) parts.push(`${running} running`);
  return parts.join(' · ');
}

export function filterCounts(sessions: readonly SessionSummary[]) {
  const all = sessions.filter((session) => !session.archived);
  const counts: Record<string, number> = {
    all: all.length,
    active: all.filter((s) => s.status === 'queued' || s.status === 'running').length,
    review: all.filter((s) => s.status === 'review').length,
    archived: sessions.filter((s) => s.archived).length,
  };
  return SESSION_FILTERS.map((entry) => ({ ...entry, count: counts[entry.id] ?? 0 }));
}
