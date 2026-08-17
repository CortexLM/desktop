/**
 * PlansView: the crash on a response without `rows`.
 *
 * The bug: `setTasks(result.rows)` on a `db:query` response that carried no
 * `rows` left `tasks` as `undefined`, and the render path calls `.filter` /
 * `.length` / `.map` on it — so the whole view threw instead of showing an empty
 * list. The fix is `result?.rows ?? []`.
 *
 * This file lives outside the three view directories the coverage work targets;
 * it is here because the bug was listed as fixed-but-unguarded and PlansView had
 * no test of its own. Its `Workbench` test only ever rendered a stub of it.
 *
 * Scope note: `views/workspace/` is not owned by another agent (the concurrent
 * work is in `views/editor/` and `store/`), so adding a test file here is safe.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// ipc stub
// ---------------------------------------------------------------------------

const db = {
  query: vi.fn(),
  execute: vi.fn(),
};

vi.mock('../../../lib/ipc', () => ({
  ipc: { db },
}));

const { PlansView } = await import('../PlansView');

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  content: 'Write the migration',
  status: 'pending' as const,
  order: 1,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
  workspace_id: 'ws-1',
  ...overrides,
});

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  db.query.mockReset().mockResolvedValue({ rows: [] });
  db.execute.mockReset().mockResolvedValue({ changes: 1 });
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.restoreAllMocks();
});

describe('PlansView survives a query response without rows', () => {
  /**
   * Regression: `rows` absent from the response.
   *
   * A handler that answers `{ changes: 0 }`, or an envelope whose payload was
   * unwrapped one level too far, produces exactly this. Before the default, the
   * view threw on `tasks.filter(...)` during render — React unmounts the subtree,
   * so the user sees a blank panel rather than "No tasks yet".
   */
  it('renders the empty state when the response omits rows', async () => {
    db.query.mockResolvedValueOnce({} as unknown);

    render(<PlansView workspaceId="ws-1" />);

    await waitFor(() => expect(screen.getByText('No tasks yet')).toBeTruthy());
    // The crash surfaced as a console error from React before the panel vanished.
    expect(screen.queryByTestId('plans-error')).toBeNull();
  });

  it('renders the empty state when the response itself is undefined', async () => {
    db.query.mockResolvedValueOnce(undefined as unknown);

    // `result?.rows` — the optional chain is the other half of the guard. Without
    // it this throws a TypeError inside the try block and shows an error banner
    // for what is really an empty list.
    render(<PlansView workspaceId="ws-1" />);

    await waitFor(() => expect(screen.getByText('No tasks yet')).toBeTruthy());
  });

  it('renders the empty state when rows is null', async () => {
    db.query.mockResolvedValueOnce({ rows: null } as unknown);

    render(<PlansView workspaceId="ws-1" />);

    await waitFor(() => expect(screen.getByText('No tasks yet')).toBeTruthy());
  });

  it('still renders tasks when rows is present', async () => {
    db.query.mockResolvedValueOnce({ rows: [task({ content: 'Write the migration' })] });

    render(<PlansView workspaceId="ws-1" />);

    // The guard must not have turned every response into an empty list.
    await waitFor(() => expect(screen.getByText('Write the migration')).toBeTruthy());
    expect(screen.queryByText('No tasks yet')).toBeNull();
    expect(screen.getAllByTestId('plan-task')).toHaveLength(1);
  });

  it('reports a rejected query as an error, not as an empty list', async () => {
    db.query.mockRejectedValueOnce(new Error('no such table: tasks'));

    render(<PlansView workspaceId="ws-1" />);

    // An unreadable task list and an empty one must not look the same.
    await waitFor(() => expect(screen.getByTestId('plans-error')).toBeTruthy());
    expect(screen.getByText(/no such table: tasks/)).toBeTruthy();
  });

  it('quotes the reserved word `order` in the query it sends', async () => {
    render(<PlansView workspaceId="ws-1" />);

    await waitFor(() => expect(db.query).toHaveBeenCalledTimes(1));

    // `order` is a SQL reserved word: unquoted, SQLite rejects the statement and
    // every load fails. The quoting is easy to lose in a reformat, and the
    // failure mode is a view that never shows anything.
    const request = db.query.mock.calls[0][0] as { query: string; params: unknown[] };
    expect(request.query).toContain('"order"');
    expect(request.params).toEqual(['ws-1']);
  });
});
