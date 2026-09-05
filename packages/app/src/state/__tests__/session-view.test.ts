/**
 * Projecting a run onto what the screens draw.
 *
 * Two vocabularies meet in this module and they are deliberately not the same one:
 * the domain states the orchestrator persists, and the badge states the design
 * draws. The mapping is the substance, so it is asserted rather than assumed.
 */

import { describe, expect, it } from 'vitest';

import type { SessionSummary } from '@cortex-ide/shared';

import {
  formatAge,
  formatDuration,
  toBadgeStatus,
  toInboxSession,
  toRecentRow,
  toSessionMeta,
} from '../session-view.ts';

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 'session_1',
    title: 'Fix the flaky auth test',
    status: 'review',
    runtime: 'local',
    repo: 'cortex/app',
    branch: 'main',
    additions: 12,
    deletions: 3,
    filesChanged: 2,
    createdAt: NOW - HOUR,
    updatedAt: NOW - 4 * MINUTE,
    archived: false,
    ...overrides,
  };
}

describe('toBadgeStatus', () => {
  it('maps every domain state to a badge the design draws', () => {
    expect(toBadgeStatus('queued')).toBe('draft');
    expect(toBadgeStatus('running')).toBe('running');
    expect(toBadgeStatus('review')).toBe('pr-ready');
    expect(toBadgeStatus('merged')).toBe('merged');
    expect(toBadgeStatus('failed')).toBe('error');
  });

  it('reads a cancelled run as neutral, not as a failure', () => {
    // Nothing went wrong; somebody changed their mind. `error` would send them
    // looking for a cause that does not exist.
    expect(toBadgeStatus('stopped')).toBe('draft');
  });
});

describe('formatAge', () => {
  it.each([
    [0, 'just now'],
    [30_000, 'just now'],
    [4 * MINUTE, '4m ago'],
    [3 * HOUR, '3h ago'],
    [30 * HOUR, 'yesterday'],
    [4 * DAY, '4d ago'],
    [3 * 7 * DAY, '3w ago'],
  ])('renders %ims ago as %s', (elapsed, expected) => {
    expect(formatAge(NOW - elapsed, NOW)).toBe(expected);
  });

  it('never reports a negative age', () => {
    // A row written by a machine whose clock is ahead would otherwise read as
    // "-3m ago", which looks like a rendering bug rather than a clock skew.
    expect(formatAge(NOW + HOUR, NOW)).toBe('just now');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [4200, '4s'],
    [272_000, '4m 32s'],
    [3_600_000, '1h 0m'],
    [7_500_000, '2h 5m'],
  ])('renders %ims as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('toInboxSession', () => {
  it('carries the diff when there is one', () => {
    expect(toInboxSession(summary(), NOW).diff).toEqual({ added: 12, removed: 3 });
  });

  it('labels local as This PC and SSH as SSH', () => {
    const ssh = toInboxSession(summary({ runtime: 'ssh' }), NOW).runtime ?? '';
    expect(toInboxSession(summary(), NOW).runtime).toBe('This PC');
    expect(ssh).toBe('SSH');
    expect(ssh.toLowerCase()).not.toMatch(/\bthis pc\b|\bthis desktop\b/);
  });

  it('omits the diff rather than showing two zeroes', () => {
    // The design hides the cell when nothing changed. `+0 −0` claims a diff was
    // computed and came out empty, which is not the same as one not existing yet.
    const row = toInboxSession(summary({ additions: 0, deletions: 0 }), NOW);
    expect('diff' in row).toBe(false);
  });

  it('gives a run with no repository a lane to sit in', () => {
    // The inbox groups by repo, so a run without one must not be dropped from the
    // list entirely.
    const row = toInboxSession(summary({ repo: undefined, branch: undefined }), NOW);
    expect(row.repo).toBe('This PC');
    expect(row.branch).toBe('—');
  });
});

describe('toRecentRow', () => {
  it('joins repo and branch into one muted line', () => {
    expect(toRecentRow(summary(), NOW).context).toBe('cortex/app · main');
  });

  it('names the fallback when there is neither', () => {
    expect(toRecentRow(summary({ repo: undefined, branch: undefined }), NOW).context).toBe(
      'This PC',
    );
  });
});

describe('toSessionMeta', () => {
  it('dates a finished run from when it finished', () => {
    // Not from `updatedAt`: archiving a run months later would otherwise move its
    // line to "just now".
    const meta = toSessionMeta(summary({ finishedAt: NOW - 3 * HOUR }), NOW);
    expect(meta).toBe('cortex/app · main · 3h ago');
  });

  it('dates a live run from when it started', () => {
    const meta = toSessionMeta(summary({ finishedAt: undefined, createdAt: NOW - HOUR }), NOW);
    expect(meta).toBe('cortex/app · main · 1h ago');
  });
});
