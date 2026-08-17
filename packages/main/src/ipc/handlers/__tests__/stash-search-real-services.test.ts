/**
 * Integration tests: handlers against the REAL services.
 *
 * The sibling suite mocks the services to pin down the wire contract. This one
 * removes the mocks and runs the handlers against a real git repository and a
 * real directory tree, so the arguments the handlers pass are validated by the
 * services themselves rather than by a stub that would accept anything.
 *
 * That distinction matters here: several of these handlers exist purely to
 * reshape the renderer's flat payload into the positional signature the service
 * expects. A mock cannot tell you that `stash(['push', '-m', msg])` was built
 * correctly — only a real `git stash list` can.
 *
 * Skipped automatically when git is unavailable.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

const { registerGitStashHandlers, unregisterGitStashHandlers } = await import(
  '../git-stash-handlers'
);
const { registerSearchHandlers, unregisterSearchHandlers } = await import('../search-handlers');

const fakeEvent = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = registeredHandlers.get(channel);
  if (!handler) throw new Error(`No handler registered for "${channel}"`);
  return handler(fakeEvent, ...(args as [unknown]));
}

function expectOk<T>(response: unknown): T {
  const envelope = response as { success: boolean; data?: T; error?: { message: string } };
  if (!envelope.success) {
    throw new Error(`Expected success, got: ${envelope.error?.message ?? 'unknown error'}`);
  }
  return envelope.data as T;
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

let repo: string;

beforeAll(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-stash-'));

  if (HAS_GIT) {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: repo, stdio: 'ignore' });

    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    git('config', 'commit.gpgsign', 'false');

    await fs.writeFile(path.join(repo, 'tracked.txt'), 'original\n');
    await fs.writeFile(
      path.join(repo, 'source.ts'),
      ['// TODO: implement', 'export const value = 1;', '// TODO: test this'].join('\n')
    );
    git('add', '.');
    git('commit', '-q', '-m', 'initial');
  }

  resetElectronMock();
  registerGitStashHandlers();
  registerSearchHandlers();
});

afterAll(async () => {
  unregisterGitStashHandlers();
  unregisterSearchHandlers();
  await fs.rm(repo, { recursive: true, force: true });
});

// ===========================================================================

describe.skipIf(!HAS_GIT)('git stash handlers against a real repository', () => {
  it('reports an empty list on a clean repo', async () => {
    const { stashes } = expectOk<{ stashes: unknown[] }>(
      await invoke('git:stash-list', { repoPath: repo })
    );

    expect(stashes).toEqual([]);
  });

  it('save then list returns the stash the handler created', async () => {
    await fs.writeFile(path.join(repo, 'tracked.txt'), 'modified\n');

    expectOk(await invoke('git:stash-save', { repoPath: repo, message: 'my stash message' }));

    const { stashes } = expectOk<{ stashes: Array<{ index: number; message: string }> }>(
      await invoke('git:stash-list', { repoPath: repo })
    );

    // Proves the flat payload was turned into a correct `git stash push -m`.
    expect(stashes).toHaveLength(1);
    expect(stashes[0].message).toContain('my stash message');
    expect(stashes[0].index).toBe(0);

    // The working tree went back to HEAD.
    expect(await fs.readFile(path.join(repo, 'tracked.txt'), 'utf-8')).toBe('original\n');
  });

  it('show returns a diff with real counts', async () => {
    const { diff } = expectOk<{
      diff: { files: Array<{ path: string }>; totalAdditions: number; totalDeletions: number };
    }>(await invoke('git:stash-show', { repoPath: repo, stashIndex: 0 }));

    expect(diff.files.length).toBeGreaterThan(0);
    expect(diff.files.some((file) => file.path.endsWith('tracked.txt'))).toBe(true);
    expect(diff.totalAdditions).toBeGreaterThan(0);
  });

  it('pop restores the stashed content and empties the list', async () => {
    expectOk(await invoke('git:stash-pop', { repoPath: repo, stashIndex: 0 }));

    expect(await fs.readFile(path.join(repo, 'tracked.txt'), 'utf-8')).toBe('modified\n');

    const { stashes } = expectOk<{ stashes: unknown[] }>(
      await invoke('git:stash-list', { repoPath: repo })
    );
    expect(stashes).toEqual([]);
  });

  it('includeUntracked really stashes untracked files', async () => {
    await fs.writeFile(path.join(repo, 'untracked.txt'), 'new file\n');

    expectOk(
      await invoke('git:stash-save', {
        repoPath: repo,
        message: 'with untracked',
        includeUntracked: true,
      })
    );

    // The `-u` flag reached git: the untracked file is gone from the tree.
    await expect(fs.access(path.join(repo, 'untracked.txt'))).rejects.toThrow();

    expectOk(await invoke('git:stash-pop', { repoPath: repo, stashIndex: 0 }));
    await expect(fs.access(path.join(repo, 'untracked.txt'))).resolves.toBeUndefined();

    await fs.rm(path.join(repo, 'untracked.txt'));
  });

  it('drop removes the stash', async () => {
    await fs.writeFile(path.join(repo, 'tracked.txt'), 'to be dropped\n');
    expectOk(await invoke('git:stash-save', { repoPath: repo, message: 'droppable' }));

    expectOk(await invoke('git:stash-drop', { repoPath: repo, stashIndex: 0 }));

    const { stashes } = expectOk<{ stashes: unknown[] }>(
      await invoke('git:stash-list', { repoPath: repo })
    );
    expect(stashes).toEqual([]);
  });

  it('surfaces a real git failure as a failed envelope', async () => {
    const response = (await invoke('git:stash-show', { repoPath: repo, stashIndex: 99 })) as {
      success: boolean;
      error?: { message: string };
    };

    // No exception crosses the IPC boundary.
    expect(response.success).toBe(false);
    expect(response.error?.message).toBeTruthy();
  });

  it('reports a non-repository path as a failure rather than throwing', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-notrepo-'));

    try {
      const response = (await invoke('git:stash-list', { repoPath: outside })) as {
        success: boolean;
      };
      expect(response.success).toBe(false);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

// ===========================================================================

describe('search handlers against a real directory tree', () => {
  it('finds real matches and returns them under { results }', async () => {
    const { results } = expectOk<{
      results: Array<{ filePath: string; matches: Array<{ line: number }>; totalMatches: number }>;
    }>(await invoke('search:find', { rootPath: repo, query: 'TODO' }));

    const hit = results.find((r) => r.filePath.endsWith('source.ts'));
    expect(hit).toBeDefined();
    expect(hit!.totalMatches).toBe(2);
    // Line numbers are 1-based in the service.
    expect(hit!.matches.map((m) => m.line)).toEqual([1, 3]);
  });

  it('records the query in the history read by search:get-history', async () => {
    await invoke('search:find', { rootPath: repo, query: 'uniqueneedle' });

    const { history } = expectOk<{ history: string[] }>(await invoke('search:get-history'));

    expect(history).toContain('uniqueneedle');
  });

  it('honours caseSensitive', async () => {
    const sensitive = expectOk<{ results: unknown[] }>(
      await invoke('search:find', { rootPath: repo, query: 'todo', caseSensitive: true })
    );
    const insensitive = expectOk<{ results: unknown[] }>(
      await invoke('search:find', { rootPath: repo, query: 'todo', caseSensitive: false })
    );

    expect(sensitive.results).toHaveLength(0);
    expect(insensitive.results.length).toBeGreaterThan(0);
  });

  it('a dry-run replace reports counts without touching the file', async () => {
    const before = await fs.readFile(path.join(repo, 'source.ts'), 'utf-8');

    const { results } = expectOk<{ results: Array<{ replacements: number; preview?: string }> }>(
      await invoke('search:replace', {
        rootPath: repo,
        query: 'TODO',
        replacement: 'DONE',
        dryRun: true,
      })
    );

    const hit = results.find((r) => r.replacements > 0);
    expect(hit).toBeDefined();
    expect(hit!.preview).toBeTruthy();

    // The point of the default: the file is untouched.
    expect(await fs.readFile(path.join(repo, 'source.ts'), 'utf-8')).toBe(before);
  });

  it('a real replace writes the file', async () => {
    expectOk(
      await invoke('search:replace', {
        rootPath: repo,
        query: 'TODO',
        replacement: 'DONE',
        dryRun: false,
      })
    );

    const after = await fs.readFile(path.join(repo, 'source.ts'), 'utf-8');
    expect(after).toContain('DONE');
    expect(after).not.toContain('TODO');
  });

  it('reports an invalid regex as a failed envelope', async () => {
    const response = (await invoke('search:find', {
      rootPath: repo,
      query: '([unclosed',
      useRegex: true,
    })) as { success: boolean; error?: { message: string } };

    expect(response.success).toBe(false);
    expect(response.error?.message).toContain('Invalid regex');
  });
});
