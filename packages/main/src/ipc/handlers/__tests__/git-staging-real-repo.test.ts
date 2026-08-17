/**
 * `git:stage` / `git:unstage` against a REAL git repository.
 *
 * Why not a `simple-git` mock: a mock can only tell you which arguments the
 * handler passed, which is precisely the thing that was never in doubt. It
 * cannot tell you that the index actually changed — `git add` on a mock returns
 * a resolved promise whether or not the pathspec was valid, whether or not the
 * `--` separator was there, and whether or not the repo even exists. Every
 * assertion below reads the state back out of git itself (`git status
 * --porcelain`, `git diff --cached`), so a handler that talks to git incorrectly
 * fails here.
 *
 * The sibling suites cover the wire contract with mocks
 * (`fs-editor-git-db-handlers.test.ts`) and the stash equivalent of this file is
 * `stash-search-real-services.test.ts`, which is the pattern followed here.
 *
 * Skipped automatically when git is unavailable.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

const { registerGitHandlers, unregisterGitHandlers } = await import('../git-handlers');

const fakeEvent = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = registeredHandlers.get(channel);
  if (!handler) throw new Error(`No handler registered for "${channel}"`);
  return handler(fakeEvent, ...(args as [unknown]));
}

/** Unwraps a success envelope, failing loudly on `{ success: false }`. */
function expectOk<T>(response: unknown): T {
  const envelope = response as { success: boolean; data?: T; error?: { message: string } };
  if (!envelope.success) {
    throw new Error(`Expected success, got: ${envelope.error?.message ?? 'unknown error'}`);
  }
  return envelope.data as T;
}

function expectFailure(response: unknown): { code: string; message: string } {
  const envelope = response as {
    success: boolean;
    error?: { code: string; message: string };
  };
  expect(envelope.success).toBe(false);
  expect(envelope.error).toBeDefined();
  return envelope.error!;
}

function gitAvailable(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const HAS_GIT = gitAvailable();

// ---------------------------------------------------------------------------
// Repo helpers — every read goes through the git CLI, never through the service
// under test.
// ---------------------------------------------------------------------------

const created: string[] = [];

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf-8' });
}

/** `git status --porcelain` as a path -> 2-char XY code map. */
function porcelain(repo: string): Record<string, string> {
  const out = git(repo, 'status', '--porcelain');
  const entries: Record<string, string> = {};

  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    // Format is exactly "XY <path>": the code is the first two columns.
    entries[line.slice(3).trim()] = line.slice(0, 2);
  }

  return entries;
}

/** Paths present in the index but differing from HEAD, i.e. what is staged. */
function stagedPaths(repo: string): string[] {
  return git(repo, 'diff', '--cached', '--name-only')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * A repo with one commit, a tracked+modified file, and an untracked file.
 * Mirrors the E2E fixture workspace (tests/e2e/global-setup.ts).
 */
async function makeRepo(options: { commit?: boolean } = {}): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-staging-'));
  created.push(repo);

  git(repo, 'init', '-q', '--initial-branch=main');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'user.name', 'Test');
  git(repo, 'config', 'commit.gpgsign', 'false');

  await fs.writeFile(path.join(repo, 'tracked.txt'), 'original\n');
  await fs.writeFile(path.join(repo, 'other.txt'), 'other original\n');

  if (options.commit !== false) {
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'initial');

    // One modified tracked file, one brand-new untracked file.
    await fs.writeFile(path.join(repo, 'tracked.txt'), 'modified\n');
    await fs.writeFile(path.join(repo, 'other.txt'), 'other modified\n');
    await fs.writeFile(path.join(repo, 'untracked.txt'), 'brand new\n');
  }

  return repo;
}

beforeAll(() => {
  resetElectronMock();
  registerGitHandlers();
});

afterAll(async () => {
  unregisterGitHandlers();
  await Promise.all(created.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('git:stage reaches the real index', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await makeRepo();
  });

  it('registers both staging channels', () => {
    expect(registeredHandlers.has('git:stage')).toBe(true);
    expect(registeredHandlers.has('git:unstage')).toBe(true);
  });

  it('stages a modified tracked file', async () => {
    // Precondition, read from git: modified in the worktree, not in the index.
    expect(porcelain(repo)['tracked.txt']).toBe(' M');
    expect(stagedPaths(repo)).toEqual([]);

    expectOk(await invoke('git:stage', { repoPath: repo, files: ['tracked.txt'] }));

    // The index moved. This is the assertion a simple-git mock cannot make.
    expect(stagedPaths(repo)).toEqual(['tracked.txt']);
    expect(porcelain(repo)['tracked.txt']).toBe('M ');
  });

  it('stages an untracked file, which becomes an addition', async () => {
    expect(porcelain(repo)['untracked.txt']).toBe('??');

    expectOk(await invoke('git:stage', { repoPath: repo, files: ['untracked.txt'] }));

    expect(porcelain(repo)['untracked.txt']).toBe('A ');
    expect(stagedPaths(repo)).toContain('untracked.txt');
  });

  it('stages several files in one call', async () => {
    expectOk(
      await invoke('git:stage', {
        repoPath: repo,
        files: ['tracked.txt', 'other.txt', 'untracked.txt'],
      })
    );

    expect(stagedPaths(repo).sort()).toEqual(['other.txt', 'tracked.txt', 'untracked.txt']);
  });

  it('leaves files it was not asked to stage alone', async () => {
    expectOk(await invoke('git:stage', { repoPath: repo, files: ['tracked.txt'] }));

    expect(stagedPaths(repo)).toEqual(['tracked.txt']);
    // Still merely modified / untracked in the worktree.
    expect(porcelain(repo)['other.txt']).toBe(' M');
    expect(porcelain(repo)['untracked.txt']).toBe('??');
  });

  it('stages a file inside a subdirectory', async () => {
    await fs.mkdir(path.join(repo, 'src'), { recursive: true });
    await fs.writeFile(path.join(repo, 'src', 'deep.ts'), 'export {};\n');

    expectOk(await invoke('git:stage', { repoPath: repo, files: ['src/deep.ts'] }));

    expect(stagedPaths(repo)).toContain('src/deep.ts');
  });

  it('stages a deletion', async () => {
    await fs.rm(path.join(repo, 'other.txt'));
    expect(porcelain(repo)['other.txt']).toBe(' D');

    expectOk(await invoke('git:stage', { repoPath: repo, files: ['other.txt'] }));

    expect(porcelain(repo)['other.txt']).toBe('D ');
  });

  it('returns the paths it acted on under data.files', async () => {
    // Shape guard. The MCP views once read `response.server` instead of
    // `response.data.server` and silently got `undefined`; the envelope is
    // asserted explicitly here so the renderer and the handler cannot drift.
    const response = (await invoke('git:stage', {
      repoPath: repo,
      files: ['tracked.txt'],
    })) as { success: boolean; data: { files: string[] } };

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ files: ['tracked.txt'] });
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('git:unstage reaches the real index', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await makeRepo();
  });

  it('returns a staged tracked file to modified-but-unstaged', async () => {
    expectOk(await invoke('git:stage', { repoPath: repo, files: ['tracked.txt'] }));
    expect(porcelain(repo)['tracked.txt']).toBe('M ');

    expectOk(await invoke('git:unstage', { repoPath: repo, files: ['tracked.txt'] }));

    expect(stagedPaths(repo)).toEqual([]);
    expect(porcelain(repo)['tracked.txt']).toBe(' M');
    // The worktree content is untouched: unstaging is not a discard.
    expect(await fs.readFile(path.join(repo, 'tracked.txt'), 'utf-8')).toBe('modified\n');
  });

  it('returns a staged UNTRACKED file to untracked, not to modified', async () => {
    // The case called out as a risk: a new file staged then unstaged must come
    // back as `??`, and must not vanish from the panel's list.
    expectOk(await invoke('git:stage', { repoPath: repo, files: ['untracked.txt'] }));
    expect(porcelain(repo)['untracked.txt']).toBe('A ');

    expectOk(await invoke('git:unstage', { repoPath: repo, files: ['untracked.txt'] }));

    expect(porcelain(repo)['untracked.txt']).toBe('??');
    expect(stagedPaths(repo)).toEqual([]);
  });

  it('does not delete the file when unstaging a new file', async () => {
    // `reset` must not behave like `rm`: the content has never been committed,
    // so losing it would be unrecoverable.
    expectOk(await invoke('git:stage', { repoPath: repo, files: ['untracked.txt'] }));
    expectOk(await invoke('git:unstage', { repoPath: repo, files: ['untracked.txt'] }));

    expect(await fs.readFile(path.join(repo, 'untracked.txt'), 'utf-8')).toBe('brand new\n');
  });

  it('keeps an unstaged new file visible in git:status as untracked', async () => {
    // What the panel actually renders. A file missing from `files` here would
    // disappear from the Changes list after a stage/unstage round trip.
    expectOk(await invoke('git:stage', { repoPath: repo, files: ['untracked.txt'] }));
    expectOk(await invoke('git:unstage', { repoPath: repo, files: ['untracked.txt'] }));

    const status = expectOk<{
      files: Array<{ path: string; status: string; staged: boolean }>;
    }>(await invoke('git:status', { repoPath: repo }));

    const entry = status.files.find((file) => file.path === 'untracked.txt');
    expect(entry).toEqual({ path: 'untracked.txt', status: 'untracked', staged: false });
  });

  it('unstages several files in one call', async () => {
    expectOk(
      await invoke('git:stage', {
        repoPath: repo,
        files: ['tracked.txt', 'other.txt', 'untracked.txt'],
      })
    );

    expectOk(
      await invoke('git:unstage', {
        repoPath: repo,
        files: ['tracked.txt', 'other.txt', 'untracked.txt'],
      })
    );

    expect(stagedPaths(repo)).toEqual([]);
    expect(porcelain(repo)['tracked.txt']).toBe(' M');
    expect(porcelain(repo)['other.txt']).toBe(' M');
    expect(porcelain(repo)['untracked.txt']).toBe('??');
  });

  it('unstages only the files named', async () => {
    expectOk(
      await invoke('git:stage', { repoPath: repo, files: ['tracked.txt', 'other.txt'] })
    );

    expectOk(await invoke('git:unstage', { repoPath: repo, files: ['tracked.txt'] }));

    expect(stagedPaths(repo)).toEqual(['other.txt']);
  });

  it('unstages a staged deletion without restoring the file', async () => {
    await fs.rm(path.join(repo, 'other.txt'));
    expectOk(await invoke('git:stage', { repoPath: repo, files: ['other.txt'] }));
    expect(porcelain(repo)['other.txt']).toBe('D ');

    expectOk(await invoke('git:unstage', { repoPath: repo, files: ['other.txt'] }));

    expect(porcelain(repo)['other.txt']).toBe(' D');
    await expect(fs.access(path.join(repo, 'other.txt'))).rejects.toThrow();
  });

  it('is a no-op that still succeeds on an already-unstaged file', async () => {
    expectOk(await invoke('git:unstage', { repoPath: repo, files: ['tracked.txt'] }));

    expect(porcelain(repo)['tracked.txt']).toBe(' M');
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('a filename that git would read as an option', () => {
  /*
   * The `--` separator in `git add -- <paths>` / `git reset HEAD -- <paths>` is
   * not a style choice. A file whose name starts with `-` is otherwise parsed as
   * an option, and for `reset` the consequence is destructive rather than merely
   * wrong:
   *
   *   git reset HEAD --hard     -> hard reset, worktree reverted to HEAD
   *   git reset HEAD -- --hard  -> unstages the file called "--hard"
   *
   * Measured by hand in a scratch repo before writing this: without the
   * separator, an unrelated uncommitted modification to `tracked.txt` was lost.
   *
   * An earlier version of this test used a file named `main` (same name as the
   * branch) and passed with or without the separator — git had already consumed
   * `HEAD` as the tree-ish, so `main` could only be a pathspec. That test proved
   * nothing. This one fails when the separator is removed.
   */
  const OPTION_LIKE = '--hard';

  it('stages a file whose name looks like an option', async () => {
    const repo = await makeRepo();
    await fs.writeFile(path.join(repo, OPTION_LIKE), 'looks like a flag\n');

    expectOk(await invoke('git:stage', { repoPath: repo, files: [OPTION_LIKE] }));

    expect(stagedPaths(repo)).toContain(OPTION_LIKE);
  });

  it('unstages it without hard-resetting the worktree', async () => {
    const repo = await makeRepo();
    await fs.writeFile(path.join(repo, OPTION_LIKE), 'looks like a flag\n');

    expectOk(
      await invoke('git:stage', { repoPath: repo, files: [OPTION_LIKE, 'tracked.txt'] })
    );
    expect(stagedPaths(repo).sort()).toEqual([OPTION_LIKE, 'tracked.txt'].sort());

    expectOk(await invoke('git:unstage', { repoPath: repo, files: [OPTION_LIKE] }));

    // The named file left the index...
    expect(porcelain(repo)[OPTION_LIKE]).toBe('??');
    // ...and nothing else was touched. A hard reset would have cleared this
    // staged entry and reverted the file on disk to 'original'.
    expect(stagedPaths(repo)).toEqual(['tracked.txt']);
    expect(await fs.readFile(path.join(repo, 'tracked.txt'), 'utf-8')).toBe('modified\n');
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('a repository with no commits yet', () => {
  it('stages and unstages before the first commit', async () => {
    // `git reset HEAD -- <path>` cannot work here: HEAD does not resolve until
    // the first commit exists. A new project is exactly when a user is most
    // likely to stage something, so the fallback path is exercised for real.
    const repo = await makeRepo({ commit: false });

    expectOk(await invoke('git:stage', { repoPath: repo, files: ['tracked.txt'] }));
    expect(porcelain(repo)['tracked.txt']).toBe('A ');

    expectOk(await invoke('git:unstage', { repoPath: repo, files: ['tracked.txt'] }));

    expect(porcelain(repo)['tracked.txt']).toBe('??');
    // Nothing was deleted along the way.
    expect(await fs.readFile(path.join(repo, 'tracked.txt'), 'utf-8')).toBe('original\n');
  });
});

// ===========================================================================

describe('validation and error handling', () => {
  it('rejects an empty file list', async () => {
    const error = expectFailure(
      await invoke('git:stage', { repoPath: '/tmp/whatever', files: [] })
    );
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing files key', async () => {
    const error = expectFailure(await invoke('git:stage', { repoPath: '/tmp/whatever' }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty path inside the list', async () => {
    // `git add ''` errors out, and an empty pathspec must never be allowed to
    // widen into "everything".
    const error = expectFailure(
      await invoke('git:unstage', { repoPath: '/tmp/whatever', files: [''] })
    );
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty repoPath', async () => {
    const error = expectFailure(await invoke('git:stage', { repoPath: '', files: ['a.txt'] }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-array files value', async () => {
    const error = expectFailure(
      await invoke('git:stage', { repoPath: '/tmp/whatever', files: 'a.txt' })
    );
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing payload entirely', async () => {
    const error = expectFailure(await invoke('git:unstage', undefined));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('does not touch git when validation fails', async () => {
    // The guard is worth pinning: a validation bug that fell through to
    // `git add` with a bad pathspec would be a write against a real repo.
    const repo = await makeRepo();
    const before = porcelain(repo);

    expectFailure(await invoke('git:stage', { repoPath: repo, files: [] }));

    expect(porcelain(repo)).toEqual(before);
  });

  it('surfaces a non-repository path as a failed envelope, not a throw', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-notrepo-'));
    created.push(outside);

    const error = expectFailure(
      await invoke('git:stage', { repoPath: outside, files: ['nope.txt'] })
    );

    expect(error.message).toBeTruthy();
  });

  it.skipIf(!HAS_GIT)('surfaces an unknown pathspec as a failed envelope', async () => {
    const repo = await makeRepo();

    const error = expectFailure(
      await invoke('git:stage', { repoPath: repo, files: ['does-not-exist.txt'] })
    );

    expect(error.message).toBeTruthy();
    // No exception crossed the IPC boundary, and the index is unchanged.
    expect(stagedPaths(repo)).toEqual([]);
  });
});
