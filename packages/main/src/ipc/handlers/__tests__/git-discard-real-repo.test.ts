/**
 * `git:discard` against a REAL git repository.
 *
 * Why not a `simple-git` mock: this is the only destructive operation in the
 * panel, and the thing that must be proved is that a file is *gone from disk* —
 * or, for a tracked file, that it is *still there*. A mock resolves whichever
 * promise it is asked for; it cannot distinguish `git checkout HEAD -- f` from
 * `rm -rf f`. Every assertion below reads state back through the git CLI
 * (`git status --porcelain`, `git diff --cached`, `git show`) or through
 * `fs.access`, never through the service under test.
 *
 * Sibling of `git-staging-real-repo.test.ts`, same conventions.
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

interface DiscardResult {
  restored: string[];
  deleted: string[];
  skipped: Array<{ path: string; reason: string }>;
}

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
// Repo helpers — every read goes through the git CLI or the filesystem, never
// through the service under test.
// ---------------------------------------------------------------------------

const created: string[] = [];

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf-8' });
}

/** `git status --porcelain` as a path -> 2-char XY code map. */
function porcelain(repo: string): Record<string, string> {
  const out = git(repo, 'status', '--porcelain', '-uall');
  const entries: Record<string, string> = {};

  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    entries[line.slice(3).trim()] = line.slice(0, 2);
  }

  return entries;
}

function stagedPaths(repo: string): string[] {
  return git(repo, 'diff', '--cached', '--name-only')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function read(repo: string, file: string): Promise<string> {
  return fs.readFile(path.join(repo, file), 'utf-8');
}

/**
 * A repo with one commit, a modified tracked file, and an untracked file.
 *
 * `committed` / `modified` / `brand new` are distinct strings so an assertion
 * can tell *which* version a file holds, not merely that it changed.
 */
async function makeRepo(options: { commit?: boolean } = {}): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-discard-'));
  created.push(repo);

  git(repo, 'init', '-q', '--initial-branch=main');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'user.name', 'Test');
  git(repo, 'config', 'commit.gpgsign', 'false');

  await fs.writeFile(path.join(repo, 'tracked.txt'), 'committed\n');
  await fs.writeFile(path.join(repo, 'other.txt'), 'other committed\n');

  if (options.commit !== false) {
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'initial');

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

describe.skipIf(!HAS_GIT)('git:discard restores a tracked file', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await makeRepo();
  });

  it('registers the channel', () => {
    expect(registeredHandlers.has('git:discard')).toBe(true);
  });

  it('reverts a modified tracked file to its committed content', async () => {
    expect(porcelain(repo)['tracked.txt']).toBe(' M');
    expect(await read(repo, 'tracked.txt')).toBe('modified\n');

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['tracked.txt'] })
    );

    // Content came back from HEAD, read from disk.
    expect(await read(repo, 'tracked.txt')).toBe('committed\n');
    expect(porcelain(repo)['tracked.txt']).toBeUndefined();
    expect(result.restored).toEqual(['tracked.txt']);
    expect(result.deleted).toEqual([]);
  });

  it('does NOT delete a tracked file from disk', async () => {
    // The counterpart to the untracked-deletion test below: the two halves of
    // discard must not be confused, and this is the direction that would lose a
    // file the user only meant to revert.
    await invoke('git:discard', { repoPath: repo, files: ['tracked.txt'] });

    expect(await exists(path.join(repo, 'tracked.txt'))).toBe(true);
  });

  it('leaves files it was not asked to discard alone', async () => {
    expectOk(await invoke('git:discard', { repoPath: repo, files: ['tracked.txt'] }));

    // `other.txt` is still modified, `untracked.txt` still present.
    expect(porcelain(repo)['other.txt']).toBe(' M');
    expect(await read(repo, 'other.txt')).toBe('other modified\n');
    expect(await exists(path.join(repo, 'untracked.txt'))).toBe(true);
  });

  it('restores a file inside a subdirectory', async () => {
    await fs.mkdir(path.join(repo, 'src'), { recursive: true });
    await fs.writeFile(path.join(repo, 'src', 'deep.ts'), 'v1\n');
    git(repo, 'add', 'src/deep.ts');
    git(repo, 'commit', '-q', '-m', 'add deep');
    await fs.writeFile(path.join(repo, 'src', 'deep.ts'), 'v2\n');

    expectOk(await invoke('git:discard', { repoPath: repo, files: ['src/deep.ts'] }));

    expect(await read(repo, 'src/deep.ts')).toBe('v1\n');
  });

  it('restores a deleted tracked file', async () => {
    await fs.rm(path.join(repo, 'other.txt'));
    expect(porcelain(repo)['other.txt']).toBe(' D');

    expectOk(await invoke('git:discard', { repoPath: repo, files: ['other.txt'] }));

    expect(await exists(path.join(repo, 'other.txt'))).toBe(true);
    expect(await read(repo, 'other.txt')).toBe('other committed\n');
  });

  it('restores several files in one call', async () => {
    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['tracked.txt', 'other.txt'] })
    );

    expect(await read(repo, 'tracked.txt')).toBe('committed\n');
    expect(await read(repo, 'other.txt')).toBe('other committed\n');
    expect(result.restored.sort()).toEqual(['other.txt', 'tracked.txt']);
  });

  it('accepts a bare string as well as an array', async () => {
    // `discard` was widened to `string | string[]` like stage/unstage. The
    // handler always sends an array, so the string form is exercised through
    // the service directly.
    const { gitService } = await import('../../../services/git-service');

    const result = await gitService.discard(repo, 'tracked.txt');

    expect(result.restored).toEqual(['tracked.txt']);
    expect(await read(repo, 'tracked.txt')).toBe('committed\n');
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('git:discard and the index', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await makeRepo();
  });

  it('restores a STAGED file all the way to HEAD, not to the index', async () => {
    /*
     * The measured trap. `git checkout -- <path>` restores from the INDEX:
     *
     *   index = "staged B", worktree = "worktree C"
     *   git checkout -- tracked.txt   -> worktree becomes "staged B", status M
     *   git checkout HEAD -- tracked.txt -> worktree AND index become
     *                                       "committed", status clean
     *
     * With the plain form, a "discard" would leave the file still modified with
     * respect to HEAD and still staged — the user asked to throw the changes
     * away and half of them would survive. `HEAD --` is why this test passes.
     */
    await fs.writeFile(path.join(repo, 'tracked.txt'), 'staged B\n');
    git(repo, 'add', 'tracked.txt');
    await fs.writeFile(path.join(repo, 'tracked.txt'), 'worktree C\n');
    expect(porcelain(repo)['tracked.txt']).toBe('MM');

    expectOk(await invoke('git:discard', { repoPath: repo, files: ['tracked.txt'] }));

    // Worktree is on HEAD...
    expect(await read(repo, 'tracked.txt')).toBe('committed\n');
    // ...and so is the index: nothing staged remains.
    expect(stagedPaths(repo)).toEqual([]);
    expect(porcelain(repo)['tracked.txt']).toBeUndefined();
    // Read the index blob explicitly, since "no staged paths" could also mean
    // an empty index.
    expect(git(repo, 'show', ':tracked.txt')).toBe('committed\n');
  });

  it('restores a staged deletion, bringing the file back', async () => {
    await fs.rm(path.join(repo, 'other.txt'));
    git(repo, 'add', 'other.txt');
    expect(porcelain(repo)['other.txt']).toBe('D ');

    expectOk(await invoke('git:discard', { repoPath: repo, files: ['other.txt'] }));

    expect(await exists(path.join(repo, 'other.txt'))).toBe(true);
    expect(await read(repo, 'other.txt')).toBe('other committed\n');
    expect(stagedPaths(repo)).toEqual([]);
  });

  it('does not need a separate unstage step', async () => {
    // One git invocation does both. Checked by asserting the end state rather
    // than the call count: an unstage-then-checkout sequence would have a
    // window where the index is on HEAD but the worktree is not.
    git(repo, 'add', 'tracked.txt');

    expectOk(await invoke('git:discard', { repoPath: repo, files: ['tracked.txt'] }));

    expect(porcelain(repo)['tracked.txt']).toBeUndefined();
    expect(stagedPaths(repo)).toEqual([]);
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('git:discard on a file absent from HEAD', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await makeRepo();
  });

  it('refuses to touch an untracked file without deleteUntracked', async () => {
    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['untracked.txt'] })
    );

    // Still on disk, still untracked, and reported as skipped rather than
    // silently ignored.
    expect(await exists(path.join(repo, 'untracked.txt'))).toBe(true);
    expect(await read(repo, 'untracked.txt')).toBe('brand new\n');
    expect(porcelain(repo)['untracked.txt']).toBe('??');
    expect(result.deleted).toEqual([]);
    expect(result.restored).toEqual([]);
    expect(result.skipped).toEqual([
      { path: 'untracked.txt', reason: 'untracked-not-confirmed' },
    ]);
  });

  it('DELETES an untracked file from disk with deleteUntracked', async () => {
    // The load-bearing assertion of this whole file: `git checkout` cannot
    // discard a file it has never seen (measured: rc=1, "pathspec did not match
    // any file(s) known to git"), so discarding one can only mean removing it.
    expect(await exists(path.join(repo, 'untracked.txt'))).toBe(true);

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['untracked.txt'],
        deleteUntracked: true,
      })
    );

    expect(await exists(path.join(repo, 'untracked.txt'))).toBe(false);
    expect(porcelain(repo)['untracked.txt']).toBeUndefined();
    expect(result.deleted).toEqual(['untracked.txt']);
    expect(result.restored).toEqual([]);
  });

  it('deletes an untracked file in a subdirectory without removing the directory', async () => {
    await fs.mkdir(path.join(repo, 'newdir'), { recursive: true });
    await fs.writeFile(path.join(repo, 'newdir', 'deep.txt'), 'deep\n');
    // `status -uall` lists the file, not the directory — which is also what
    // simple-git's status() reports, so the panel and the classifier agree.
    expect(porcelain(repo)['newdir/deep.txt']).toBe('??');

    expectOk(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['newdir/deep.txt'],
        deleteUntracked: true,
      })
    );

    expect(await exists(path.join(repo, 'newdir', 'deep.txt'))).toBe(false);
    expect(await exists(path.join(repo, 'newdir'))).toBe(true);
  });

  it('deletes a STAGED-NEW file and clears its index entry', async () => {
    // `A ` is absent from HEAD just as much as `??` is, so its content is
    // equally unrecoverable. `fs.rm` alone would leave a phantom `D ` entry in
    // the index, so this goes through `git rm -f`.
    await fs.writeFile(path.join(repo, 'staged-new.txt'), 'never committed\n');
    git(repo, 'add', 'staged-new.txt');
    expect(porcelain(repo)['staged-new.txt']).toBe('A ');

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['staged-new.txt'],
        deleteUntracked: true,
      })
    );

    expect(await exists(path.join(repo, 'staged-new.txt'))).toBe(false);
    // No leftover index entry.
    expect(porcelain(repo)['staged-new.txt']).toBeUndefined();
    expect(stagedPaths(repo)).toEqual([]);
    expect(result.deleted).toEqual(['staged-new.txt']);
  });

  it('refuses a staged-new file without deleteUntracked', async () => {
    await fs.writeFile(path.join(repo, 'staged-new.txt'), 'never committed\n');
    git(repo, 'add', 'staged-new.txt');

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['staged-new.txt'] })
    );

    expect(await exists(path.join(repo, 'staged-new.txt'))).toBe(true);
    expect(result.skipped).toEqual([
      { path: 'staged-new.txt', reason: 'untracked-not-confirmed' },
    ]);
  });

  it('deletes a staged-new file that was modified again afterwards (AM)', async () => {
    await fs.writeFile(path.join(repo, 'am.txt'), 'v1\n');
    git(repo, 'add', 'am.txt');
    await fs.writeFile(path.join(repo, 'am.txt'), 'v2\n');
    expect(porcelain(repo)['am.txt']).toBe('AM');

    expectOk(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['am.txt'],
        deleteUntracked: true,
      })
    );

    expect(await exists(path.join(repo, 'am.txt'))).toBe(false);
    expect(porcelain(repo)['am.txt']).toBeUndefined();
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('deleteUntracked is per-call, and git has the last word', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await makeRepo();
  });

  it('restores tracked and skips untracked in the same mixed call', async () => {
    // What "Discard All" sends: `deleteUntracked` false, and the request may
    // still name an untracked path. The tracked half must land, the untracked
    // half must survive.
    const result = expectOk<DiscardResult>(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['tracked.txt', 'other.txt', 'untracked.txt'],
        deleteUntracked: false,
      })
    );

    expect(await read(repo, 'tracked.txt')).toBe('committed\n');
    expect(await read(repo, 'other.txt')).toBe('other committed\n');
    expect(await exists(path.join(repo, 'untracked.txt'))).toBe(true);
    expect(result.restored.sort()).toEqual(['other.txt', 'tracked.txt']);
    expect(result.deleted).toEqual([]);
    expect(result.skipped).toEqual([
      { path: 'untracked.txt', reason: 'untracked-not-confirmed' },
    ]);
  });

  it('does not delete a TRACKED file even when deleteUntracked is true', async () => {
    // The flag permits deletion; git decides whether a path qualifies. A
    // tracked file is in HEAD, so it is restored regardless of the flag —
    // otherwise a single confirmed untracked deletion in a batch would put
    // every other path in the batch at risk.
    expectOk(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['tracked.txt', 'untracked.txt'],
        deleteUntracked: true,
      })
    );

    expect(await exists(path.join(repo, 'tracked.txt'))).toBe(true);
    expect(await read(repo, 'tracked.txt')).toBe('committed\n');
    expect(await exists(path.join(repo, 'untracked.txt'))).toBe(false);
  });

  it('ignores a stale "modified" label when the file is really untracked', async () => {
    // The renderer polls every 5s, so its label can be out of date. Here the
    // caller believes `ghost.txt` is a tracked modification; git says it is
    // untracked. Trusting the caller would delete it. State is re-derived from
    // git, so it is skipped instead.
    await fs.writeFile(path.join(repo, 'ghost.txt'), 'never committed\n');

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['ghost.txt'] })
    );

    expect(await exists(path.join(repo, 'ghost.txt'))).toBe(true);
    expect(result.skipped).toEqual([{ path: 'ghost.txt', reason: 'untracked-not-confirmed' }]);
  });

  it('restores a file the caller wrongly believed was untracked', async () => {
    // The mirror case: `deleteUntracked: true` on a path that is actually
    // tracked. Deleting it would be the destructive misreading; it is restored.
    expectOk(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['tracked.txt'],
        deleteUntracked: true,
      })
    );

    expect(await exists(path.join(repo, 'tracked.txt'))).toBe(true);
    expect(await read(repo, 'tracked.txt')).toBe('committed\n');
  });

  it('skips a clean file rather than touching it', async () => {
    git(repo, 'checkout', 'HEAD', '--', 'other.txt');
    expect(porcelain(repo)['other.txt']).toBeUndefined();

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['other.txt'] })
    );

    // A clean tracked file is still in HEAD, so it is "restored" — a no-op that
    // cannot lose anything.
    expect(result.restored).toEqual(['other.txt']);
    expect(await read(repo, 'other.txt')).toBe('other committed\n');
  });

  it('skips a path that does not exist at all', async () => {
    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['nope.txt'] })
    );

    expect(result).toEqual({
      restored: [],
      deleted: [],
      skipped: [{ path: 'nope.txt', reason: 'unchanged' }],
    });
  });

  it('treats a plain directory path as inert', async () => {
    // `status -uall` enumerates files, never plain directories, and `ls-tree -r
    // --name-only` returns the files under a directory rather than the directory
    // itself — so a plain directory matches neither bucket.
    await fs.mkdir(path.join(repo, 'newdir'), { recursive: true });
    await fs.writeFile(path.join(repo, 'newdir', 'deep.txt'), 'deep\n');

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['newdir'],
        deleteUntracked: true,
      })
    );

    expect(result.deleted).toEqual([]);
    expect(await exists(path.join(repo, 'newdir', 'deep.txt'))).toBe(true);
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('a nested git repository', () => {
  /*
   * The one path by which a DIRECTORY reaches discard. `git status` collapses a
   * nested repository into a single `?? nested/` entry — even with `-uall`,
   * because git does not descend into another repository. Measured, and
   * `simple-git.status()` reports `not_added: ['nested/']`, so the panel renders
   * that row with a "Delete" button next to it.
   *
   * Deleting it would mean recursively erasing an entire repository from a click
   * presented as acting on one file. It is refused explicitly.
   */
  async function repoWithNested(): Promise<string> {
    const repo = await makeRepo();
    const nested = path.join(repo, 'nested');
    await fs.mkdir(nested, { recursive: true });
    git(nested, 'init', '-q', '--initial-branch=main');
    await fs.writeFile(path.join(nested, 'inner.txt'), 'inner\n');
    return repo;
  }

  it('is reported by git as a single directory entry', async () => {
    // The premise, measured rather than assumed: if git ever started listing the
    // files inside, the guard below would be dead code.
    const repo = await repoWithNested();

    expect(porcelain(repo)['nested/']).toBe('??');
    expect(porcelain(repo)['nested/inner.txt']).toBeUndefined();
  });

  it('refuses to delete it even with deleteUntracked', async () => {
    const repo = await repoWithNested();

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['nested/'],
        deleteUntracked: true,
      })
    );

    expect(result.deleted).toEqual([]);
    expect(result.skipped).toEqual([{ path: 'nested/', reason: 'directory' }]);
    // Everything inside survived, including the nested repo's own git dir.
    expect(await exists(path.join(repo, 'nested', 'inner.txt'))).toBe(true);
    expect(await exists(path.join(repo, 'nested', '.git'))).toBe(true);
  });

  it('still discards a real file named in the same call', async () => {
    // The refusal must not take the rest of the request down with it.
    const repo = await repoWithNested();

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['tracked.txt', 'nested/'],
        deleteUntracked: true,
      })
    );

    expect(result.restored).toEqual(['tracked.txt']);
    expect(await read(repo, 'tracked.txt')).toBe('committed\n');
    expect(await exists(path.join(repo, 'nested', 'inner.txt'))).toBe(true);
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('a filename that git would read as an option', () => {
  /*
   * The `--` separator in `git checkout HEAD -- <paths>` is a safety mechanism,
   * and for checkout the failure is *silent and maximal*. Measured on git 2.43
   * in a scratch repo, with an unrelated uncommitted modification present:
   *
   *   git checkout '-f'       -> rc=0, EVERY uncommitted worktree change lost
   *                              (`-f` is parsed as `--force`)
   *   git checkout HEAD '-f'  -> rc=0, same destruction: a tree-ish does not
   *                              protect the pathspec position
   *   git checkout -- '-f'    -> rc=0, only the file named `-f` is restored
   *
   * This is worse than the `git reset HEAD --hard` precedent, which at least
   * failed loudly with "unknown option". Here git exits 0 and reports nothing.
   *
   * `-f` rather than `--hard`: `git checkout --hard` errors out as an unknown
   * option, so a test built on it would pass with or without the separator and
   * prove nothing — the same way an earlier staging test used a file named
   * `main` and was hollow. `-f` is a real checkout flag, so removing the
   * separator from the service turns these tests red.
   */
  const OPTION_LIKE = '-f';

  async function repoWithOptionLikeFile(): Promise<string> {
    const repo = await makeRepo();
    await fs.writeFile(path.join(repo, OPTION_LIKE), 'flag committed\n');
    git(repo, 'add', '--', OPTION_LIKE);
    git(repo, 'commit', '-q', '-m', 'add option-like file');
    await fs.writeFile(path.join(repo, OPTION_LIKE), 'flag modified\n');
    return repo;
  }

  it('restores it without force-discarding the rest of the worktree', async () => {
    const repo = await repoWithOptionLikeFile();
    // `tracked.txt` carries unrelated uncommitted work that must survive.
    expect(await read(repo, 'tracked.txt')).toBe('modified\n');

    expectOk(await invoke('git:discard', { repoPath: repo, files: [OPTION_LIKE] }));

    // The named file was restored...
    expect(await read(repo, OPTION_LIKE)).toBe('flag committed\n');
    // ...and the unrelated modification is untouched. Without `--`, this reads
    // 'committed\n' and `other.txt` is reverted too.
    expect(await read(repo, 'tracked.txt')).toBe('modified\n');
    expect(await read(repo, 'other.txt')).toBe('other modified\n');
    expect(porcelain(repo)['tracked.txt']).toBe(' M');
  });

  it('does not let an option-like path wipe a staged change elsewhere', async () => {
    const repo = await repoWithOptionLikeFile();
    git(repo, 'add', 'other.txt');
    expect(stagedPaths(repo)).toEqual(['other.txt']);

    expectOk(await invoke('git:discard', { repoPath: repo, files: [OPTION_LIKE] }));

    // A `--force` checkout would have cleared this staged entry.
    expect(stagedPaths(repo)).toEqual(['other.txt']);
  });

  it('deletes an untracked file whose name looks like an option', async () => {
    const repo = await makeRepo();
    await fs.writeFile(path.join(repo, OPTION_LIKE), 'untracked flag\n');
    expect(porcelain(repo)[OPTION_LIKE]).toBe('??');

    expectOk(
      await invoke('git:discard', {
        repoPath: repo,
        files: [OPTION_LIKE],
        deleteUntracked: true,
      })
    );

    expect(await exists(path.join(repo, OPTION_LIKE))).toBe(false);
    // And nothing else went with it.
    expect(await read(repo, 'tracked.txt')).toBe('modified\n');
  });

  it('deletes a staged-new file whose name looks like an option', async () => {
    // Goes through `git rm -f -- <path>`, which needs the separator too.
    const repo = await makeRepo();
    await fs.writeFile(path.join(repo, OPTION_LIKE), 'staged flag\n');
    git(repo, 'add', '--', OPTION_LIKE);

    expectOk(
      await invoke('git:discard', {
        repoPath: repo,
        files: [OPTION_LIKE],
        deleteUntracked: true,
      })
    );

    expect(await exists(path.join(repo, OPTION_LIKE))).toBe(false);
    expect(await read(repo, 'tracked.txt')).toBe('modified\n');
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('filenames git would quote in porcelain output', () => {
  /*
   * `git status --porcelain` (no `-z`) escapes and quotes non-ASCII and
   * space/quote-bearing paths: `?? "na\303\257ve.txt"`. Classifying against that
   * output would never match the requested path `naïve.txt`, so such a file
   * would be silently skipped. Measured: `-z` emits the literal bytes.
   */
  it.each(['naïve.txt', 'with space.txt', 'quote"file.txt'])(
    'discards %j correctly',
    async (name) => {
      const repo = await makeRepo();
      await fs.writeFile(path.join(repo, name), 'v1\n');
      git(repo, 'add', '--', name);
      git(repo, 'commit', '-q', '-m', 'add odd name');
      await fs.writeFile(path.join(repo, name), 'v2\n');

      const result = expectOk<DiscardResult>(
        await invoke('git:discard', { repoPath: repo, files: [name] })
      );

      expect(result.restored).toEqual([name]);
      expect(await read(repo, name)).toBe('v1\n');
    }
  );

  it('deletes an untracked file with a quoted-looking name', async () => {
    const repo = await makeRepo();
    await fs.writeFile(path.join(repo, 'naïve untracked.txt'), 'new\n');

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['naïve untracked.txt'],
        deleteUntracked: true,
      })
    );

    expect(result.deleted).toEqual(['naïve untracked.txt']);
    expect(await exists(path.join(repo, 'naïve untracked.txt'))).toBe(false);
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('a repository with no commits yet', () => {
  it('deletes a staged file when HEAD is unborn', async () => {
    // Nothing is in HEAD because HEAD does not resolve, so every path is in the
    // not-in-HEAD class and needs the flag.
    const repo = await makeRepo({ commit: false });
    git(repo, 'add', 'tracked.txt');
    expect(porcelain(repo)['tracked.txt']).toBe('A ');

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', {
        repoPath: repo,
        files: ['tracked.txt'],
        deleteUntracked: true,
      })
    );

    expect(result.deleted).toEqual(['tracked.txt']);
    expect(await exists(path.join(repo, 'tracked.txt'))).toBe(false);
  });

  it('refuses without the flag when HEAD is unborn', async () => {
    const repo = await makeRepo({ commit: false });

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['tracked.txt'] })
    );

    // Never committed and never restorable: the safe answer is to do nothing.
    expect(result.skipped).toEqual([
      { path: 'tracked.txt', reason: 'untracked-not-confirmed' },
    ]);
    expect(await exists(path.join(repo, 'tracked.txt'))).toBe(true);
  });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('a merge conflict', () => {
  it('resolves a conflicted file to the HEAD side', async () => {
    const repo = await makeRepo();
    git(repo, 'checkout', 'HEAD', '--', 'tracked.txt', 'other.txt');
    await fs.rm(path.join(repo, 'untracked.txt'));

    git(repo, 'checkout', '-q', '-b', 'side');
    await fs.writeFile(path.join(repo, 'tracked.txt'), 'side change\n');
    git(repo, 'commit', '-q', '-am', 'side');
    git(repo, 'checkout', '-q', 'main');
    await fs.writeFile(path.join(repo, 'tracked.txt'), 'main change\n');
    git(repo, 'commit', '-q', '-am', 'main change');

    try {
      git(repo, 'merge', 'side');
    } catch {
      // Expected: the merge conflicts.
    }
    expect(porcelain(repo)['tracked.txt']).toBe('UU');

    expectOk(await invoke('git:discard', { repoPath: repo, files: ['tracked.txt'] }));

    // The conflict markers are gone and the file holds HEAD's version.
    expect(await read(repo, 'tracked.txt')).toBe('main change\n');
    expect(porcelain(repo)['tracked.txt']).toBeUndefined();
  });
});

// ===========================================================================

describe('validation and error handling', () => {
  it('rejects an empty file list', async () => {
    const error = expectFailure(
      await invoke('git:discard', { repoPath: '/tmp/whatever', files: [] })
    );
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty path inside the list', async () => {
    // An empty pathspec must never be allowed to widen into "everything" — on a
    // destructive operation that would be a repo-wide revert.
    const error = expectFailure(
      await invoke('git:discard', { repoPath: '/tmp/whatever', files: [''] })
    );
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing files key', async () => {
    const error = expectFailure(await invoke('git:discard', { repoPath: '/tmp/whatever' }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty repoPath', async () => {
    const error = expectFailure(await invoke('git:discard', { repoPath: '', files: ['a.txt'] }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-boolean deleteUntracked', async () => {
    // A truthy string must not be coerced into permission to delete.
    const error = expectFailure(
      await invoke('git:discard', {
        repoPath: '/tmp/whatever',
        files: ['a.txt'],
        deleteUntracked: 'yes',
      })
    );
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing payload entirely', async () => {
    const error = expectFailure(await invoke('git:discard', undefined));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it.skipIf(!HAS_GIT)('does not touch the repo when validation fails', async () => {
    const repo = await makeRepo();
    const before = porcelain(repo);

    expectFailure(await invoke('git:discard', { repoPath: repo, files: [] }));

    expect(porcelain(repo)).toEqual(before);
    expect(await exists(path.join(repo, 'untracked.txt'))).toBe(true);
  });

  it('surfaces a non-repository path as a failed envelope, not a throw', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-notrepo-'));
    created.push(outside);

    const error = expectFailure(
      await invoke('git:discard', { repoPath: outside, files: ['nope.txt'] })
    );

    expect(error.message).toBeTruthy();
  });

  it.skipIf(!HAS_GIT)('defaults deleteUntracked to false when omitted', async () => {
    // The schema default is the outer lock. If it ever flipped to `true`, every
    // request that omits the flag would start deleting.
    const repo = await makeRepo();

    const result = expectOk<DiscardResult>(
      await invoke('git:discard', { repoPath: repo, files: ['untracked.txt'] })
    );

    expect(result.deleted).toEqual([]);
    expect(await exists(path.join(repo, 'untracked.txt'))).toBe(true);
  });

  it.skipIf(!HAS_GIT)('returns the three buckets under data', async () => {
    // Shape guard, same reason as the staging suite: the MCP views once read
    // `response.server` instead of `response.data.server`.
    const repo = await makeRepo();

    const response = (await invoke('git:discard', {
      repoPath: repo,
      files: ['tracked.txt', 'untracked.txt'],
    })) as { success: boolean; data: DiscardResult };

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      restored: ['tracked.txt'],
      deleted: [],
      skipped: [{ path: 'untracked.txt', reason: 'untracked-not-confirmed' }],
    });
  });
});
