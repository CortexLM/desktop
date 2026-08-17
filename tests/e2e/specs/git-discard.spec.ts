import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect } from '../fixtures/electron';
import { GitPage } from '../page-objects';

/**
 * Discard, end to end, against the real filesystem.
 *
 * ## Why this file is separate from git.spec.ts
 *
 * Every test here mutates or destroys files in the workspace. That is only safe
 * to assert on because each test now owns a private workspace (`workspacePath`
 * fixture) — under the previously shared fixture repo, a test that deletes
 * `untracked.txt` would have removed it for whichever worker ran next.
 *
 * ## What these prove that the unit tests cannot
 *
 * `git-discard-real-repo.test.ts` proves the *service* deletes and restores
 * correctly. It says nothing about whether the button is wired to it, or whether
 * the confirmation exists. A discard path wired up without its confirmation is
 * worse than no discard at all: the button becomes live and destroys work with no
 * friction. These tests assert the dialog appears, assert its wording, and read
 * the result back with `node:fs` from the test process — never through the app.
 */
test.describe('Git discard', () => {
  let gitPage: GitPage;

  test.beforeEach(async ({ page }) => {
    gitPage = new GitPage(page);
    await page.waitForLoadState('domcontentloaded');
    await gitPage.openGitPanel();
    await gitPage.refresh();
  });

  /*
   * The fixture seeds README.md as modified and untracked.txt as untracked, so
   * these preconditions are guaranteed rather than hoped for. They are asserted
   * instead of used as `if` guards on purpose: a guard that turns false silently
   * converts every test below into a no-op that still reports green.
   */
  test('the panel offers restore for a tracked file and delete for an untracked one', async () => {
    const changed = await gitPage.getChangedFiles();
    expect(changed).toContain('README.md');
    expect(changed).toContain('untracked.txt');

    // Tracked: "Discard changes" only. Untracked: "Delete" only.
    expect(await gitPage.rowControls('README.md')).toEqual({ discard: 1, delete: 0 });
    expect(await gitPage.rowControls('untracked.txt')).toEqual({ discard: 0, delete: 1 });
  });

  test('discarding a tracked file restores it and does NOT remove it from disk', async ({
    page,
    workspacePath,
  }) => {
    const readme = join(workspacePath, 'README.md');
    expect(readFileSync(readme, 'utf8')).toContain('modified');

    const message = gitPage.armConfirm(true);
    await gitPage.clickDiscard('README.md');

    // The confirmation must name the operation. "restored" and "committed"
    // describe a revert; the word "delete" must not appear for a tracked file.
    const text = await message;
    expect(text).toContain('README.md');
    expect(text).toContain('restored to its last committed version');
    expect(text).not.toContain('removed from disk');

    // Read back from disk, not from the panel.
    await expect
      .poll(() => readFileSync(readme, 'utf8'), { timeout: 15000 })
      .not.toContain('modified');

    // The file itself survives: this is a restore, not a deletion.
    expect(existsSync(readme)).toBe(true);
    expect(readFileSync(readme, 'utf8')).toContain('# E2E fixture workspace');

    // And it leaves the panel's changed list, since it now matches HEAD.
    await expect
      .poll(() => gitPage.getChangedFiles(), { timeout: 15000 })
      .not.toContain('README.md');

    // The untracked file was not collateral damage.
    expect(existsSync(join(workspacePath, 'untracked.txt'))).toBe(true);
    await page.waitForTimeout(100);
  });

  test('deleting an untracked file removes it from disk', async ({ workspacePath }) => {
    const untracked = join(workspacePath, 'untracked.txt');
    expect(existsSync(untracked)).toBe(true);

    const message = gitPage.armConfirm(true);
    await gitPage.clickDelete('untracked.txt');

    // For an untracked file the wording must say deletion, and must not promise
    // a restore that cannot happen — nothing recovers this content.
    const text = await message;
    expect(text).toContain('untracked.txt');
    expect(text).toContain('never been committed');
    expect(text).toContain('removed from disk permanently');

    // The claim worth proving on a destructive path: the file is gone from disk.
    await expect.poll(() => existsSync(untracked), { timeout: 15000 }).toBe(false);

    // The tracked file was not touched by the deletion.
    expect(existsSync(join(workspacePath, 'README.md'))).toBe(true);
    expect(readFileSync(join(workspacePath, 'README.md'), 'utf8')).toContain('modified');
  });

  /*
   * The mutation this catches: removing the `confirm()` call. With the
   * confirmation gone, the discard proceeds on click and the file changes anyway,
   * so this test fails — which is the whole point of having it.
   */
  test('cancelling the confirmation leaves a tracked file modified', async ({ workspacePath }) => {
    const readme = join(workspacePath, 'README.md');
    const before = readFileSync(readme, 'utf8');
    expect(before).toContain('modified');

    const message = gitPage.armConfirm(false);
    await gitPage.clickDiscard('README.md');
    expect(await message).toContain('README.md');

    // Nothing happened. Waiting past a plausible IPC round trip so this asserts
    // "still unchanged", not "not changed yet".
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(readFileSync(readme, 'utf8')).toBe(before);
    expect(await gitPage.getChangedFiles()).toContain('README.md');
  });

  test('cancelling the confirmation leaves an untracked file on disk', async ({
    workspacePath,
  }) => {
    const untracked = join(workspacePath, 'untracked.txt');

    const message = gitPage.armConfirm(false);
    await gitPage.clickDelete('untracked.txt');
    expect(await message).toContain('untracked.txt');

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(existsSync(untracked)).toBe(true);
    expect(readFileSync(untracked, 'utf8')).toBe('untracked\n');
  });

  /*
   * Discard All excludes untracked files. The confirmation has to say so, and
   * the untracked file has to survive — the asymmetry is that a restored tracked
   * file is recoverable from the object database while a deleted untracked file
   * is not, and a bulk action is precisely where nobody reads each name.
   */
  test('Discard All restores tracked files and leaves untracked ones alone', async ({
    workspacePath,
  }) => {
    // A second modified tracked file, so "all" means more than one.
    const tracked = join(workspacePath, 'tracked-file.ts');
    writeFileSync(tracked, 'export const tracked = "locally changed";\n');
    await gitPage.refresh();

    await expect.poll(() => gitPage.getChangedFiles(), { timeout: 15000 }).toContain(
      'tracked-file.ts'
    );

    const message = gitPage.armConfirm(true);
    await gitPage.clickDiscardAll();
    const text = await message;

    // Names the count, lists the files, and states that untracked files are
    // excluded rather than leaving that a surprise.
    expect(text).toContain('2 files');
    expect(text).toContain('README.md');
    expect(text).toContain('tracked-file.ts');
    expect(text).toContain('1 untracked file');
    expect(text).toContain('left alone');

    await expect
      .poll(() => readFileSync(tracked, 'utf8'), { timeout: 15000 })
      .toContain('export const tracked = true;');
    expect(readFileSync(join(workspacePath, 'README.md'), 'utf8')).not.toContain('modified');

    // The untracked file is still there. This is the assertion that would fail
    // if "discard all" were ever widened to include untracked files.
    expect(existsSync(join(workspacePath, 'untracked.txt'))).toBe(true);
  });

  test('Discard All is disabled when only untracked files remain', async ({ workspacePath }) => {
    // Restore the one modified tracked file, leaving only untracked.txt.
    const message = gitPage.armConfirm(true);
    await gitPage.clickDiscard('README.md');
    await message;

    await expect
      .poll(() => gitPage.getChangedFiles(), { timeout: 15000 })
      .not.toContain('README.md');

    // Untracked files are not discardable in bulk, so an enabled button here
    // would be a control that cannot do anything.
    expect(await gitPage.getChangedFiles()).toContain('untracked.txt');
    expect(await gitPage.isDiscardAllEnabled()).toBe(false);
    expect(existsSync(join(workspacePath, 'untracked.txt'))).toBe(true);
  });
});
