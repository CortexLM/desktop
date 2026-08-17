import { test, expect } from '../fixtures';

/**
 * Database-backed persistence, exercised through the UI.
 *
 * ## Why this file exists
 *
 * The suite ran 93 green tests while the SQLite addon was completely broken.
 * `better-sqlite3` was compiled for Node's ABI (137) but loaded by Electron
 * (ABI 128), so `new Database()` threw on every boot. The main process caught
 * it and logged "Database initialization failed", then carried on — the window
 * opened, every view rendered, and every navigation assertion passed.
 *
 * That is because the view tests assert a panel is visible and stop there. A
 * visible panel says nothing about whether its data layer works. Nothing in the
 * suite ever wrote a row and read it back, so a total loss of persistence was
 * invisible to a fully green run.
 *
 * These tests close that gap. Plans is the one feature that goes through
 * `ipc.db` (see PlansView's query/execute calls) rather than the filesystem, so
 * it is the honest probe for the SQLite path: create a task, reload the window,
 * and require it to still be there. Under the ABI mismatch this fails, which is
 * the point.
 */
test.describe('Database persistence', () => {
  /** Unique per run so a leftover row from an earlier run cannot fake a pass. */
  const taskContent = () => `e2e-persist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  test.beforeEach(async ({ page }) => {
    await page.click('[data-testid="sidebar-plans"]');
    await expect(page.locator('[data-testid="plans-view"]')).toBeVisible();
  });

  test('surfaces no database error when opening plans', async ({ page }) => {
    // The DB error banner is the UI's own report that its data layer is broken.
    // With the ABI mismatch, reads fail and this is populated.
    await expect(page.locator('[data-testid="plans-error"]')).toHaveCount(0);
  });

  /*
   * FIXED (was `fixme`): creating a task used to fail every time with
   * "Execute failed: Constraint violation - FOREIGN KEY constraint failed", so
   * Plans could not save anything, for any user.
   *
   * The cause was two stores for one entity: `tasks.workspace_id` is
   * `NOT NULL REFERENCES workspaces(id)` and the renderer supplies the open
   * folder path as that value (`<PlansView workspaceId={workspacePath ??
   * 'default'} />`), but `WorkspaceManager` persisted workspaces to
   * `workspaces.json` and never to SQLite — so the referenced row could not
   * exist.
   *
   * Fixed main-side, keeping the FK (and its cascade):
   *   - workspaces now live in SQLite, keyed by their path, which is the only
   *     identifier the renderer has (`migrations/004_workspace_identity.ts`);
   *   - `WorkspaceManager` reads and writes that table and imports any existing
   *     `workspaces.json` once, keeping the file as `.migrated`;
   *   - a `BEFORE INSERT` trigger registers the workspace on first write, which
   *     covers a folder opened through `WorkspaceSelector` (it only writes
   *     `localStorage`, so main is never told).
   *
   * The assertions below are unchanged.
   */
  test('persists a created task across a window reload', async ({ page }) => {
    const content = taskContent();

    await page.fill('[data-testid="new-task-input"]', content);
    await page.click('[data-testid="add-task"]');

    // Present in the live view first — this only proves local state.
    await expect(page.locator('[data-testid="plan-task"]', { hasText: content })).toHaveCount(1);

    // The reload is what makes this a persistence test: it drops all renderer
    // state, so the task can only come back if it reached SQLite and was read
    // out again.
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.click('[data-testid="sidebar-plans"]');
    await expect(page.locator('[data-testid="plans-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-task"]', { hasText: content })).toHaveCount(1);
  });

  // Was blocked by the same FK bug documented above.
  test('persists a status change across a window reload', async ({ page }) => {
    const content = taskContent();

    await page.fill('[data-testid="new-task-input"]', content);
    await page.click('[data-testid="add-task"]');

    const task = page.locator('[data-testid="plan-task"]', { hasText: content });
    await expect(task).toHaveAttribute('data-task-status', 'pending');

    // Toggling writes an UPDATE through ipc.db.execute.
    await task.getByRole('checkbox').click();
    await expect(task).toHaveAttribute('data-task-status', 'completed');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.click('[data-testid="sidebar-plans"]');
    await expect(page.locator('[data-testid="plans-view"]')).toBeVisible();

    await expect(
      page.locator('[data-testid="plan-task"]', { hasText: content })
    ).toHaveAttribute('data-task-status', 'completed');
  });
});
