import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect } from '../fixtures/electron';

/**
 * Tests for the test harness.
 *
 * Both isolations here were added to fix real leaks, and both are the kind of
 * thing that silently regresses: if `--user-data-dir` were dropped from the
 * launch args, or the workspace went back to being suite-wide, nothing else in
 * the suite would fail loudly. It would just start reporting green for tests
 * that no longer run, which is how the shared fixture hid hollow tests in the
 * first place.
 *
 * These tests are written to fail if either isolation is removed.
 */
test.describe('E2E harness isolation', () => {
  /*
   * userData isolation.
   *
   * The pair below is the mechanism: the first test writes a marker into
   * localStorage, the second requires it to be absent. With one shared userData
   * directory (the default /root/.config/Electron), the marker survives into the
   * next launch and the second test fails. That leak is exactly what made
   * 'should manage multiple tabs' count 4 tabs instead of 3.
   *
   * Order-dependent by construction, hence `test.describe.serial`.
   */
  test.describe.serial('userData does not carry over between launches', () => {
    const MARKER = 'cortex-e2e:isolation-marker';

    /*
     * Deliberately assertion-light: this test's job is to leave a marker
     * behind, and the *next* test is the detector.
     *
     * Measured while mutation-testing: an earlier version asserted
     * `existsSync(userDataDir/'Local Storage')` here too. Removing
     * `--user-data-dir` made that assertion fail, and because the block is
     * `serial`, Playwright then SKIPPED the detector entirely — so the pair
     * never got to observe the leak it exists to observe. Any assertion added
     * here that can fail under the mutation disarms the detector, so the
     * directory checks live in their own test below.
     */
    test('writes a localStorage marker', async ({ page }) => {
      await page.evaluate((key) => window.localStorage.setItem(key, 'written'), MARKER);
      expect(await page.evaluate((key) => window.localStorage.getItem(key), MARKER)).toBe(
        'written'
      );
    });

    test('does not see the previous launch marker', async ({ page }) => {
      expect(await page.evaluate((key) => window.localStorage.getItem(key), MARKER)).toBeNull();
    });
  });

  test('userData is a private directory holding this launch state', async ({
    electronApp,
    userDataDir,
  }) => {
    const reported = await electronApp.evaluate(async ({ app }) => app.getPath('userData'));

    // Not merely passed on the command line — the app resolved it.
    expect(reported).toBe(userDataDir);
    // And it is per-test, so it cannot be the shared default.
    expect(reported).not.toBe('/root/.config/Electron');
    expect(reported).toContain('cortex-e2e-udd-');

    // The SQLite database lives here, which is why database-persistence.spec.ts
    // starts from an empty DB rather than inheriting rows from other specs.
    expect(existsSync(join(userDataDir, 'cortex-ide.db'))).toBe(true);
    // And localStorage, which is what the leak pair above exercises.
    expect(existsSync(join(userDataDir, 'Local Storage'))).toBe(true);
  });

  /*
   * Git fixture isolation.
   *
   * Same shape: one test wrecks the repo, the next requires a pristine one. Under
   * the shared fixture this second test fails — and that is not hypothetical,
   * it is what git.spec.ts's "should commit changes" does to every spec that
   * runs after it.
   */
  test.describe.serial('the git fixture is rebuilt for each test', () => {
    test('destroys its own workspace state', async ({ workspacePath }) => {
      expect(existsSync(join(workspacePath, 'untracked.txt'))).toBe(true);

      rmSync(join(workspacePath, 'untracked.txt'));
      writeFileSync(join(workspacePath, 'README.md'), 'wrecked by the previous test\n');
      writeFileSync(join(workspacePath, 'extra-file.txt'), 'left behind\n');
    });

    test('gets a pristine workspace regardless', async ({ workspacePath }) => {
      // A different directory to begin with.
      expect(existsSync(join(workspacePath, 'extra-file.txt'))).toBe(false);

      // Seeded exactly as the specs expect: one modified tracked file, one
      // untracked file.
      expect(existsSync(join(workspacePath, 'untracked.txt'))).toBe(true);
      const readme = readFileSync(join(workspacePath, 'README.md'), 'utf8');
      expect(readme).toContain('# E2E fixture workspace');
      expect(readme).toContain('modified');
      expect(readme).not.toContain('wrecked');
    });
  });

  test('each test gets its own workspace path', async ({ workspacePath }) => {
    expect(workspacePath).toContain('cortex-e2e-ws-');
    // A real repo with a commit, which is what the branch/status/diff views need.
    expect(existsSync(join(workspacePath, '.git'))).toBe(true);
  });
});
