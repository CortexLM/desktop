import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitService } from '../git-service';

// Mock simple-git
//
// `vi.mock` is hoisted above the imports, so the spies its factory closes over
// must be created inside `vi.hoisted` — plain `const`s above would still be in
// their temporal dead zone when the factory runs.
const {
  mockStatus,
  mockCommit,
  mockPush,
  mockPull,
  mockDiff,
  mockBranch,
  mockCheckoutLocalBranch,
  mockCheckout,
  mockLog,
  mockAdd,
  mockReset,
} = vi.hoisted(() => ({
  mockStatus: vi.fn(),
  mockCommit: vi.fn(),
  mockPush: vi.fn(),
  mockPull: vi.fn(),
  mockDiff: vi.fn(),
  mockBranch: vi.fn(),
  mockCheckoutLocalBranch: vi.fn(),
  mockCheckout: vi.fn(),
  mockLog: vi.fn(),
  mockAdd: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('simple-git', () => ({
  default: () => ({
    status: mockStatus,
    commit: mockCommit,
    push: mockPush,
    pull: mockPull,
    diff: mockDiff,
    branch: mockBranch,
    checkoutLocalBranch: mockCheckoutLocalBranch,
    checkout: mockCheckout,
    log: mockLog,
    add: mockAdd,
    reset: mockReset,
  }),
}));

describe('GitService', () => {
  let service: GitService;

  beforeEach(() => {
    service = new GitService();
    // `mockReset` (not `mockClear`): clearing only drops recorded calls and
    // leaves queued `mockResolvedValueOnce` implementations behind, so an unused
    // one from a previous test would be consumed by the next.
    mockStatus.mockReset();
    mockCommit.mockReset();
    mockPush.mockReset();
    mockPull.mockReset();
    mockDiff.mockReset();
    mockBranch.mockReset();
    mockCheckoutLocalBranch.mockReset();
    mockCheckout.mockReset();
    mockLog.mockReset();
    mockAdd.mockReset();
    mockReset.mockReset();
  });

  describe('status', () => {
    it('should return git status with files', async () => {
      mockStatus.mockResolvedValueOnce({
        current: 'main',
        ahead: 2,
        behind: 0,
        staged: ['src/file1.ts'],
        created: ['src/file2.ts'],
        deleted: ['src/old.ts'],
        renamed: [{ from: 'old.ts', to: 'new.ts' }],
        modified: ['src/file3.ts'],
        not_added: ['src/untracked.ts'],
        isClean: () => false,
      });

      const status = await service.status('/repo');

      expect(status.branch).toBe('main');
      expect(status.ahead).toBe(2);
      expect(status.behind).toBe(0);
      expect(status.isClean).toBe(false);
      expect(status.files.length).toBeGreaterThan(0);
      
      const stagedFile = status.files.find(f => f.path === 'src/file1.ts');
      expect(stagedFile?.staged).toBe(true);
      expect(stagedFile?.status).toBe('modified');
      
      const untrackedFile = status.files.find(f => f.path === 'src/untracked.ts');
      expect(untrackedFile?.status).toBe('untracked');
      expect(untrackedFile?.staged).toBe(false);
    });

    it('should handle clean status', async () => {
      mockStatus.mockResolvedValueOnce({
        current: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        created: [],
        deleted: [],
        renamed: [],
        modified: [],
        not_added: [],
        isClean: () => true,
      });

      const status = await service.status('/repo');

      expect(status.isClean).toBe(true);
      expect(status.files).toEqual([]);
    });

    it('should handle unknown branch', async () => {
      mockStatus.mockResolvedValueOnce({
        current: null,
        ahead: 0,
        behind: 0,
        staged: [],
        created: [],
        deleted: [],
        renamed: [],
        modified: [],
        not_added: [],
        isClean: () => true,
      });

      const status = await service.status('/repo');

      expect(status.branch).toBe('unknown');
    });
  });

  describe('commit', () => {
    it('should create commit with all files', async () => {
      mockCommit.mockResolvedValueOnce({ commit: 'abc123' });
      mockLog.mockResolvedValueOnce({
        latest: {
          hash: 'abc123',
          message: 'Test commit',
          author_name: 'Test User',
          date: '2024-01-01T00:00:00Z',
        },
      });

      const result = await service.commit('/repo', 'Test commit');

      expect(mockAdd).toHaveBeenCalledWith('.');
      expect(mockCommit).toHaveBeenCalledWith('Test commit');
      expect(result.hash).toBe('abc123');
      expect(result.message).toBe('Test commit');
      expect(result.author).toBe('Test User');
    });

    it('should create commit with specific files', async () => {
      mockCommit.mockResolvedValueOnce({ commit: 'def456' });
      mockLog.mockResolvedValueOnce({
        latest: {
          hash: 'def456',
          message: 'Partial commit',
          author_name: 'Test User',
          date: '2024-01-01T00:00:00Z',
        },
      });

      const files = ['src/file1.ts', 'src/file2.ts'];
      await service.commit('/repo', 'Partial commit', files);

      expect(mockAdd).toHaveBeenCalledWith(files);
    });

    it('should throw error if commit info not retrieved', async () => {
      mockCommit.mockResolvedValueOnce({ commit: 'abc123' });
      mockLog.mockResolvedValueOnce({ latest: null });

      // `.rejects` takes the promise itself, not a function returning one.
      await expect(service.commit('/repo', 'Test')).rejects.toThrow(
        'Failed to retrieve commit information'
      );
    });
  });

  describe('push', () => {
    it('should push to remote with default branch', async () => {
      mockStatus.mockResolvedValueOnce({ current: 'main' });
      mockPush.mockResolvedValueOnce({ pushed: [{ local: 'main', remote: 'main' }] });

      const result = await service.push('/repo');

      expect(mockPush).toHaveBeenCalledWith('origin', 'main');
      expect(result.success).toBe(true);
      expect(result.pushed).toBe(1);
    });

    it('should push to specific remote and branch', async () => {
      mockPush.mockResolvedValueOnce({ pushed: [{ local: 'feature', remote: 'feature' }] });

      const result = await service.push('/repo', 'upstream', 'feature');

      expect(mockPush).toHaveBeenCalledWith('upstream', 'feature');
      expect(result.success).toBe(true);
    });

    it('should handle push with no changes', async () => {
      mockPush.mockResolvedValueOnce({ pushed: [] });

      const result = await service.push('/repo', 'origin', 'main');

      expect(result.success).toBe(true);
      expect(result.pushed).toBe(0);
    });
  });

  describe('pull', () => {
    it('should pull from remote', async () => {
      mockPull.mockResolvedValueOnce({});

      await service.pull('/repo');

      expect(mockPull).toHaveBeenCalledWith('origin');
    });

    it('should pull from specific remote and branch', async () => {
      mockPull.mockResolvedValueOnce({});

      await service.pull('/repo', 'upstream', 'develop');

      expect(mockPull).toHaveBeenCalledWith('upstream', 'develop');
    });
  });

  describe('diff', () => {
    it('should get diff for unstaged changes', async () => {
      const diffOutput = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+line2
-line3
 line4`;

      mockDiff.mockResolvedValueOnce(diffOutput);

      const result = await service.diff('/repo');

      expect(mockDiff).toHaveBeenCalledWith();
      expect(result.diffs.length).toBe(1);
      expect(result.diffs[0].path).toBe('file.ts');
      expect(result.diffs[0].additions).toBe(1);
      expect(result.diffs[0].deletions).toBe(1);
    });

    it('should get diff for staged changes', async () => {
      mockDiff.mockResolvedValueOnce('');

      await service.diff('/repo', undefined, true);

      expect(mockDiff).toHaveBeenCalledWith(['--cached']);
    });

    it('should get diff for specific file', async () => {
      mockDiff.mockResolvedValueOnce('');

      await service.diff('/repo', 'src/test.ts');

      expect(mockDiff).toHaveBeenCalledWith(['src/test.ts']);
    });

    it('should handle empty diff', async () => {
      mockDiff.mockResolvedValueOnce('');

      const result = await service.diff('/repo');

      expect(result.diffs).toEqual([]);
    });
  });

  describe('branches', () => {
    it('should list all branches', async () => {
      const branchSummary = {
        current: 'main',
        all: ['main', 'feature', 'remotes/origin/main'],
        branches: {
          main: { current: true, name: 'main' },
          feature: { current: false, name: 'feature' },
        },
      };

      mockBranch.mockResolvedValueOnce(branchSummary);

      const result = await service.branches('/repo');

      expect(result.current).toBe('main');
      expect(result.all.length).toBeGreaterThan(0);
    });
  });

  describe('createBranch', () => {
    it('should create and checkout new branch', async () => {
      mockCheckoutLocalBranch.mockResolvedValueOnce({});

      await service.createBranch('/repo', 'feature/new');

      expect(mockCheckoutLocalBranch).toHaveBeenCalledWith('feature/new');
    });

    it('should create branch without checkout', async () => {
      mockBranch.mockResolvedValueOnce({});

      await service.createBranch('/repo', 'feature/new', false);

      expect(mockBranch).toHaveBeenCalledWith(['feature/new']);
    });
  });

  describe('checkout', () => {
    it('should checkout existing branch', async () => {
      mockCheckout.mockResolvedValueOnce({});

      await service.checkout('/repo', 'develop');

      expect(mockCheckout).toHaveBeenCalledWith('develop');
    });
  });

  describe('log', () => {
    it('should get commit history', async () => {
      const logResult = {
        latest: {
          hash: 'abc123',
          message: 'Latest commit',
          author_name: 'User',
          date: '2024-01-01',
        },
        all: [],
        total: 10,
      };

      mockLog.mockResolvedValueOnce(logResult);

      const result = await service.log('/repo', 25);

      expect(mockLog).toHaveBeenCalledWith({ maxCount: 25 });
      expect(result.latest?.hash).toBe('abc123');
    });

    it('should use default max count', async () => {
      mockLog.mockResolvedValueOnce({ all: [], total: 0 });

      await service.log('/repo');

      expect(mockLog).toHaveBeenCalledWith({ maxCount: 50 });
    });
  });

  /*
   * `discard` is deliberately NOT tested here.
   *
   * It is the one destructive operation in this service, and it decides what to
   * do per path by interrogating the real repository (`status --porcelain -z
   * -uall`, `ls-tree HEAD`) rather than trusting the caller's label. A mocked
   * `simple-git` can only replay whatever those probes are stubbed to return,
   * so a mock test would assert its own fixture: it cannot show that an
   * untracked file actually left the disk, nor that a tracked one did not.
   * That is exactly the claim worth proving on a destructive path.
   *
   * The behavioural evidence lives in
   * `src/ipc/handlers/__tests__/git-discard-real-repo.test.ts` (48 tests), which
   * drives the handler against real temporary repositories and reads the result
   * back with `git status --porcelain`, `git ls-tree` and direct `fs` probes —
   * never through the service under test.
   */

  /*
   * Staging.
   *
   * These pin the argument vectors only. What they cannot show is that the index
   * actually moved — a mocked `add` resolves whether or not the pathspec was
   * valid. The behavioural evidence lives in
   * `src/ipc/handlers/__tests__/git-staging-real-repo.test.ts`, which drives the
   * handlers against a real repository and reads the result back with
   * `git status --porcelain`.
   *
   * The `--` separator is the reason these assertions are worth being exact
   * about: a file named `--hard` turns `git reset HEAD --hard` into a destructive
   * hard reset (verified by hand — an unrelated uncommitted change was lost).
   */
  describe('stage', () => {
    it('should stage a single file behind the -- separator', async () => {
      mockAdd.mockResolvedValueOnce({});

      await service.stage('/repo', 'src/file.ts');

      expect(mockAdd).toHaveBeenCalledWith(['--', 'src/file.ts']);
    });

    it('should stage several files in one call', async () => {
      mockAdd.mockResolvedValueOnce({});

      await service.stage('/repo', ['a.ts', 'b.ts']);

      expect(mockAdd).toHaveBeenCalledWith(['--', 'a.ts', 'b.ts']);
      // One invocation, not one per file: a single index lock.
      expect(mockAdd).toHaveBeenCalledTimes(1);
    });

    it('should keep an option-like filename as a path', async () => {
      mockAdd.mockResolvedValueOnce({});

      await service.stage('/repo', ['--hard']);

      expect(mockAdd).toHaveBeenCalledWith(['--', '--hard']);
    });
  });

  describe('unstage', () => {
    it('should unstage a single file behind the -- separator', async () => {
      mockReset.mockResolvedValueOnce({});

      await service.unstage('/repo', 'src/file.ts');

      expect(mockReset).toHaveBeenCalledWith(['HEAD', '--', 'src/file.ts']);
    });

    it('should unstage several files in one call', async () => {
      mockReset.mockResolvedValueOnce({});

      await service.unstage('/repo', ['a.ts', 'b.ts']);

      expect(mockReset).toHaveBeenCalledWith(['HEAD', '--', 'a.ts', 'b.ts']);
      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('should not let an option-like filename become a reset flag', async () => {
      mockReset.mockResolvedValueOnce({});

      await service.unstage('/repo', ['--hard']);

      // Without the separator this is `git reset HEAD --hard`.
      expect(mockReset).toHaveBeenCalledWith(['HEAD', '--', '--hard']);
    });

    it('should propagate a git failure rather than swallowing it', async () => {
      mockReset.mockRejectedValueOnce(new Error('fatal: not a git repository'));

      await expect(service.unstage('/repo', 'a.ts')).rejects.toThrow(
        'fatal: not a git repository'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear specific repo cache', () => {
      service.clearCache('/repo1');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should clear all cache', () => {
      service.clearCache();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
