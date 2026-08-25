/**
 * Reading a run's row back, and saying what went wrong.
 *
 * These are the two projections a run passes through on its way to a screen, and
 * both fail quietly when they are wrong: a mis-read row shows a run in the wrong
 * state, and a raw engine message shows the user something true and useless.
 */

import { describe, expect, it } from 'vitest';

import { explain, newRun, toEvent, toStatus, toSummary, type SessionRow } from '../session-rows';

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'session_1',
    workspace_id: '/repo',
    title: 'New session',
    model: null,
    provider: null,
    prompt: 'Fix the flaky auth test',
    status: 'review',
    runtime: 'local',
    repo: 'cortex/app',
    branch: 'main',
    additions: 12,
    deletions: 3,
    files_changed: 2,
    archived: 0,
    created_at: 1000,
    updated_at: 2000,
    started_at: 1100,
    finished_at: 1900,
    error: null,
    pull_request_url: null,
    ...overrides,
  };
}

describe('toStatus', () => {
  it('accepts the run states', () => {
    for (const status of ['queued', 'running', 'review', 'merged', 'failed', 'stopped']) {
      expect(toStatus(status)).toBe(status);
    }
  });

  it('falls back to queued for anything it does not know', () => {
    // A row written by a newer build must not make the whole list unreadable. The
    // run exists; showing it as queued is wrong in one field rather than fatal.
    expect(toStatus('teleported')).toBe('queued');
  });
});

describe('toSummary', () => {
  it('titles the run by its prompt', () => {
    // The prompt is what the user recognises. `title` holds "New session" for rows
    // written by the older chat path, which identifies nothing.
    expect(toSummary(row()).title).toBe('Fix the flaky auth test');
  });

  it('falls back to the stored title, then to a placeholder', () => {
    expect(toSummary(row({ prompt: null, title: 'Imported run' })).title).toBe('Imported run');
    expect(toSummary(row({ prompt: null, title: null })).title).toBe('Untitled session');
  });

  it('treats whitespace as absent rather than as a title', () => {
    expect(toSummary(row({ prompt: '   ', title: null })).title).toBe('Untitled session');
  });

  it('omits the optional fields rather than emitting nulls', () => {
    // The renderer distinguishes an absent branch from an empty one — the inbox
    // renders a dash for the first and would render nothing for the second.
    const summary = toSummary(
      row({ repo: null, branch: null, finished_at: null, error: null, pull_request_url: null }),
    );

    expect('repo' in summary).toBe(false);
    expect('branch' in summary).toBe(false);
    expect('finishedAt' in summary).toBe(false);
    expect('error' in summary).toBe(false);
    expect('pullRequestUrl' in summary).toBe(false);
  });

  it('reads archived as a boolean, not as the integer SQLite stores', () => {
    expect(toSummary(row({ archived: 1 })).archived).toBe(true);
    expect(toSummary(row({ archived: 0 })).archived).toBe(false);
  });

  it('defaults an unrecognised runtime to local', () => {
    // Local is the one runtime that always exists, so it is the safe answer for a
    // value the build does not know.
    expect(toSummary(row({ runtime: 'quantum' })).runtime).toBe('local');
    expect(toSummary(row({ runtime: null })).runtime).toBe('local');
    expect(toSummary(row({ runtime: 'cloud' })).runtime).toBe('cloud');
  });
});

describe('toEvent', () => {
  it('restores a timeline row into its discriminated form', () => {
    const event = toEvent({
      seq: 3,
      kind: 'tool',
      payload: JSON.stringify({ name: 'Edit', title: 'Edit src/index.ts', ok: true }),
      created_at: 4242,
    });

    expect(event).toEqual({
      kind: 'tool',
      at: 4242,
      name: 'Edit',
      title: 'Edit src/index.ts',
      ok: true,
    });
  });

  it('takes the timestamp from the row, not from the payload', () => {
    // `at` is a column so the timeline can be ordered in SQL. A payload carrying its
    // own `at` must not win, or a replayed event could claim any time it liked.
    const event = toEvent({
      seq: 0,
      kind: 'reply',
      payload: JSON.stringify({ text: 'done', at: 1 }),
      created_at: 999,
    });

    expect(event?.at).toBe(999);
  });

  it('drops a row whose payload will not parse', () => {
    // A payload truncated by a crash mid-write must not make the session
    // unopenable: the run happened, and the rest of it is still worth showing.
    expect(toEvent({ seq: 0, kind: 'reply', payload: '{"text":', created_at: 1 })).toBeNull();
  });

  it('drops a payload that is not an object', () => {
    expect(toEvent({ seq: 0, kind: 'reply', payload: '"just a string"', created_at: 1 })).toBeNull();
  });
});

describe('newRun', () => {
  it('prefers the request over the workspace binding', () => {
    // The user may have picked a repository the active workspace is not.
    const summary = newRun(
      'id',
      { prompt: 'go', runtime: 'local', repo: 'chosen/repo', branch: 'feature' },
      100,
      { id: 'workspace/repo', branch: 'main' },
    );

    expect(summary.repo).toBe('chosen/repo');
    expect(summary.branch).toBe('feature');
  });

  it('falls back to the binding, then to nothing', () => {
    const bound = newRun('id', { prompt: 'go', runtime: 'local' }, 100, {
      id: 'workspace/repo',
      branch: 'main',
    });
    expect(bound.repo).toBe('workspace/repo');
    expect(bound.branch).toBe('main');

    const unbound = newRun('id', { prompt: 'go', runtime: 'local' }, 100);
    expect('repo' in unbound).toBe(false);
    expect('branch' in unbound).toBe(false);
  });

  it('starts queued with no changes', () => {
    const summary = newRun('id', { prompt: 'go', runtime: 'cloud' }, 100);

    expect(summary.status).toBe('queued');
    expect(summary.additions).toBe(0);
    expect(summary.filesChanged).toBe(0);
    expect(summary.archived).toBe(false);
  });
});

describe('explain', () => {
  it('turns a missing provider into the fix', () => {
    // "No default AI provider configured" is true and says nothing about where a
    // provider is configured. This is the state a fresh install is in, so a dead end
    // here is a dead end in the one place the product has to work.
    const message = explain(new Error('No default AI provider configured'));

    expect(message).toMatch(/Settings/);
    expect(message).toMatch(/sign in/i);
  });

  it('adds where to look for an unavailable provider', () => {
    expect(explain(new Error('Provider "ollama" is not available'))).toMatch(
      /base URL in Settings/,
    );
  });

  it('adds where to enable a provider that is not registered', () => {
    expect(explain(new Error('Provider "grok" not found'))).toMatch(/Enable it in Settings/);
  });

  it('passes an unrecognised message through verbatim', () => {
    // A message we did not anticipate is still the best information available about
    // what went wrong; replacing it with generic copy would discard it.
    expect(explain(new Error('ECONNRESET'))).toBe('ECONNRESET');
  });

  it('stringifies a thrown non-error', () => {
    expect(explain('just a string')).toBe('just a string');
  });
});
