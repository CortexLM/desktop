import { test, expect } from '../fixtures/electron';
import { GitPage } from '../page-objects';

test.describe('Git Integration Tests', () => {
  let gitPage: GitPage;

  test.beforeEach(async ({ page }) => {
    gitPage = new GitPage(page);
    await page.waitForLoadState('domcontentloaded');
    await gitPage.openGitPanel();
  });

  test('should display git status', async ({ page }) => {
    await gitPage.refresh();
    
    // Verify git panel is visible
    await expect(page.locator('[data-testid="git-panel"]')).toBeVisible();
  });

  // Staging is wired up: `git:stage` / `git:unstage` are registered in
  // packages/main/src/ipc/handlers/git-handlers.ts, allowlisted in
  // packages/preload/src/index.ts, and called by GitPanel's `toggleStage`.
  // These two were `fixme` while `toggleStage` was a stub that only logged.
  //
  // Behavioural evidence that staging reaches git lives in
  // packages/main/src/ipc/handlers/__tests__/git-staging-real-repo.test.ts,
  // which reads the index back with `git status --porcelain`.
  /*
   * The `if (hasChanges)` guards these tests used to carry are gone.
   *
   * Each test now owns a freshly seeded repository (the `workspacePath` fixture),
   * so "the repo has changes" is a guaranteed precondition rather than a
   * coin flip decided by which spec ran first. Under the previously shared
   * fixture, `should commit changes` committed everything and left the repo
   * clean, so whichever tests ran after it took the `else` branch and passed
   * without asserting anything — the same failure mode that hid a broken
   * `toggleStage` behind `if (stagedFiles.length > 0)`.
   *
   * Asserting the precondition instead means a fixture that stops seeding
   * changes fails loudly here rather than quietly emptying these tests.
   */
  test('should stage and unstage files', async ({ page }) => {
    await gitPage.refresh();

    const changedFiles = await gitPage.getChangedFiles();
    expect(changedFiles.length).toBeGreaterThan(0);

    // Stage a file
    await gitPage.stageFile(changedFiles[0]);
    await page.waitForTimeout(500);

    const stagedFiles = await gitPage.getStagedFiles();
    expect(stagedFiles).toContain(changedFiles[0]);

    // Unstage the file
    await gitPage.unstageFile(stagedFiles[0]);
    await page.waitForTimeout(500);

    // The file comes back to the unstaged list: unstage is not a no-op.
    await expect
      .poll(() => gitPage.getChangedFiles(), { timeout: 15000 })
      .toContain(changedFiles[0]);
  });

  test('should stage all files', async ({ page }) => {
    await gitPage.refresh();

    const changedFiles = await gitPage.getChangedFiles();
    expect(changedFiles.length).toBeGreaterThan(0);

    await gitPage.stageAllFiles();
    await page.waitForTimeout(500);

    const stagedFiles = await gitPage.getStagedFiles();
    expect(stagedFiles.length).toBeGreaterThan(0);
    // Nothing is left behind in the unstaged list.
    await expect.poll(() => gitPage.getChangedFiles(), { timeout: 15000 }).toHaveLength(0);
  });

  /*
   * This is the test that used to poison the shared fixture: it commits
   * everything, so the repo it leaves behind is clean. That is now harmless —
   * the repo it wrecks is its own and is discarded with it.
   */
  test('should commit changes', async ({ page }) => {
    await gitPage.refresh();

    // Stage all files
    await gitPage.stageAllFiles();
    await page.waitForTimeout(500);

    const stagedFiles = await gitPage.getStagedFiles();
    expect(stagedFiles.length).toBeGreaterThan(0);

    // Commit
    const commitMessage = `E2E Test Commit - ${Date.now()}`;
    await gitPage.commit(commitMessage);

    // Verify commit succeeded (staged files should be empty)
    await page.waitForTimeout(1000);
    await gitPage.refresh();

    const newStagedFiles = await gitPage.getStagedFiles();
    expect(newStagedFiles.length).toBe(0);
  });

  test('should view file diff', async ({ page }) => {
    await gitPage.refresh();

    const changedFiles = await gitPage.getChangedFiles();
    expect(changedFiles.length).toBeGreaterThan(0);

    await gitPage.viewDiff(changedFiles[0]);

    // Verify diff viewer is visible
    await expect(page.locator('[data-testid="diff-viewer"]')).toBeVisible();
  });

  test('should display current branch', async ({ page }) => {
    const currentBranch = await gitPage.getCurrentBranch();
    
    expect(currentBranch).toBeTruthy();
    expect(typeof currentBranch).toBe('string');
  });

  test('should open branch selector', async ({ page }) => {
    await gitPage.openBranchSelector();
    
    // Verify branch list is visible
    await expect(page.locator('[data-testid="branch-list"]')).toBeVisible();
  });

  test('should handle refresh action', async ({ page }) => {
    await gitPage.refresh();
    
    // Wait for refresh to complete
    await page.waitForTimeout(1000);
    
    // Verify git panel still visible
    await expect(page.locator('[data-testid="git-panel"]')).toBeVisible();
  });

  /*
   * The clean state is now *produced* rather than waited for.
   *
   * As `if (!hasChanges)` this test could never run: the fixture always seeds
   * changes, so the guard was false on every execution and the assertion inside
   * was dead code. It only ever had a chance of running when another spec had
   * already committed the shared repo — i.e. exactly when the suite was leaking.
   *
   * Committing everything here reaches the same state deterministically, in this
   * test's own throwaway repo.
   */
  test('should show empty state when no changes', async ({ page }) => {
    await gitPage.refresh();
    expect(await gitPage.hasChanges()).toBe(true);

    await gitPage.stageAllFiles();
    await page.waitForTimeout(500);
    await gitPage.commit(`E2E clean state - ${Date.now()}`);

    await gitPage.refresh();

    // Verify empty state message
    await expect(page.locator('[data-testid="no-changes"]')).toBeVisible({ timeout: 15000 });
  });
});
