/**
 * The disposable workspace each E2E test operates on.
 *
 * ## Why this is per-test and not per-suite
 *
 * This used to be built once in `global-setup` and shared by all four Playwright
 * workers. A shared Git repository makes execution order part of the contract:
 * `git.spec.ts`'s "should commit changes" stages and commits *everything* in the
 * fixture, so whichever specs run after it observe a clean repo. Their bodies are
 * guarded by `if (hasChanges)` / `if (changedFiles.length > 0)`, so they do not
 * fail — they pass without asserting anything. That is the worse failure mode:
 * under parallel load the suite reports green for tests that never ran.
 *
 * A fresh repo per test removes the ordering dependency entirely rather than
 * papering over it. Measured cost: ~9 ms for the mkdir + `git init` + `add` +
 * `commit`, against a ~1.5 s Electron launch that every test already pays.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Creates a seeded Git workspace and returns its path.
 *
 * The seeded state is what the specs are written against: one commit, one
 * modified tracked file (`README.md`) and one untracked file (`untracked.txt`),
 * so the Git panel shows changes rather than its clean-state empty view.
 */
export function createFixtureWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'cortex-e2e-ws-'));

  // Files the editor/explorer specs open by name. Keep this list in sync with
  // the filenames referenced in tests/e2e/specs/editor.spec.ts.
  writeFileSync(join(root, 'test-file.ts'), 'export const greeting = "hello";\n');
  writeFileSync(join(root, 'test.ts'), 'export const value = 1;\n');
  writeFileSync(join(root, 'file1.ts'), 'export const one = 1;\n');
  writeFileSync(join(root, 'file2.ts'), 'export const two = 2;\n');
  writeFileSync(join(root, 'file3.ts'), 'export const three = 3;\n');
  writeFileSync(join(root, 'persistence-test.ts'), 'export const persisted = true;\n');
  writeFileSync(join(root, 'tracked-file.ts'), 'export const tracked = true;\n');
  writeFileSync(join(root, 'README.md'), '# E2E fixture workspace\n');
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'index.ts'), 'export {};\n');

  // A real Git repo with one commit, so branch/status/diff views have something
  // to show. `-c` keeps this out of any global Git config.
  const git = (args: string) =>
    execSync(`git ${args}`, {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

  try {
    git('init --initial-branch=main');
    git('-c user.email=e2e@cortex.test -c user.name="Cortex E2E" add .');
    git(
      '-c user.email=e2e@cortex.test -c user.name="Cortex E2E" commit -m "Initial fixture commit"'
    );

    // Leave one modified and one untracked file so the Git panel shows changes
    // rather than its clean-state empty view.
    writeFileSync(join(root, 'README.md'), '# E2E fixture workspace\n\nmodified\n');
    writeFileSync(join(root, 'untracked.txt'), 'untracked\n');
  } catch (error) {
    console.warn(
      '⚠️  Could not initialise the fixture Git repo; Git specs will see the empty state:',
      error instanceof Error ? error.message : error
    );
  }

  return root;
}

/**
 * Removes a disposable directory created for one test.
 *
 * `maxRetries` covers the userData case: Electron has just been asked to close,
 * and on a slow machine a Crashpad handler or a cache writer can still hold a
 * file open for a few milliseconds after `app.close()` resolves. Cleanup is
 * best-effort by design — a leftover temp directory is noise, whereas throwing
 * here would fail a test that has already passed.
 */
export function removeFixtureDir(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    console.warn(
      `⚠️  Could not remove the fixture directory ${path}:`,
      error instanceof Error ? error.message : error
    );
  }
}
