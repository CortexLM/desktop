import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { diffForWorkspace, diffTotals } from '../session-diff';

const diff = vi.fn();
const status = vi.fn();

vi.mock('../git-service', () => ({
  gitService: {
    diff: (...args: unknown[]) => diff(...args),
    status: (...args: unknown[]) => status(...args),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('diffTotals', () => {
  it('sums an empty list to zeros', () => {
    expect(diffTotals([])).toEqual({ additions: 0, deletions: 0, files_changed: 0 });
  });

  it('sums additions and deletions across files', () => {
    expect(
      diffTotals([
        { path: 'a.ts', additions: 2, deletions: 1, diff: '' },
        { path: 'b.ts', additions: 3, deletions: 0, diff: '' },
      ]),
    ).toEqual({ additions: 5, deletions: 1, files_changed: 2 });
  });
});

describe('diffForWorkspace', () => {
  it('returns an empty list without a workspace root', async () => {
    await expect(diffForWorkspace(null)).resolves.toEqual([]);
    expect(diff).not.toHaveBeenCalled();
  });

  it('returns tracked diffs plus a synthesized untracked file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cortex-diff-'));
    try {
      await writeFile(join(root, 'new.ts'), 'one\ntwo\n', 'utf8');
      diff.mockResolvedValue({
        diffs: [{ path: 'old.ts', additions: 1, deletions: 1, diff: '@@' }],
      });
      status.mockResolvedValue({ files: [{ path: 'new.ts', status: 'untracked' }] });

      const files = await diffForWorkspace(root);
      expect(files).toEqual([
        { path: 'old.ts', additions: 1, deletions: 1, diff: '@@' },
        expect.objectContaining({ path: 'new.ts', additions: 2, deletions: 0 }),
      ]);
      expect(files[1]?.diff).toContain('+++ b/new.ts');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('skips binary and oversized untracked files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cortex-diff-'));
    try {
      await writeFile(join(root, 'bin.dat'), 'x\0y', 'utf8');
      await mkdir(join(root, 'nested'), { recursive: true });
      await writeFile(join(root, 'huge.txt'), 'a'.repeat(200_001), 'utf8');
      diff.mockResolvedValue({ diffs: [] });
      status.mockResolvedValue({
        files: [
          { path: 'bin.dat', status: 'untracked' },
          { path: 'huge.txt', status: 'untracked' },
        ],
      });
      await expect(diffForWorkspace(root)).resolves.toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('returns an empty list when git fails', async () => {
    diff.mockRejectedValue(new Error('not a repo'));
    status.mockRejectedValue(new Error('not a repo'));
    await expect(diffForWorkspace('/tmp')).resolves.toEqual([]);
  });
});
