/**
 * The diff a run shows, read from the repository.
 *
 * Git is the only authority on what the working tree holds — the agent's own
 * additions/deletions counts double-count repeated edits and keep counting
 * reverted ones. Split from `SessionService` so the service stays within reach
 * of a reader: this file owns "what changed", the service owns "what happened".
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SessionDiffFile } from '@cortex-ide/shared';

import { gitService } from './git-service';

/** Files larger than this are skipped rather than previewed. */
const MAX_PREVIEW_BYTES = 200_000;

/**
 * Every change in the workspace, tracked and untracked.
 *
 * `git diff` only covers tracked files, and the most common thing an agent run
 * produces is a NEW file — which would leave the Changes tab claiming "no
 * changes" about a run that plainly made one. Untracked files get a synthesized
 * all-additions diff instead.
 */
export async function diffForWorkspace(root: string | null): Promise<SessionDiffFile[]> {
  if (!root) return [];

  try {
    const [diff, status] = await Promise.all([gitService.diff(root), gitService.status(root)]);

    const tracked = diff.diffs.map((file) => ({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      diff: file.diff,
    }));

    const untracked = await Promise.all(
      status.files
        .filter((file) => file.status === 'untracked')
        .map((file) => untrackedDiff(root, file.path)),
    );

    return [...tracked, ...untracked.filter((file) => file !== null)];
  } catch {
    // Not a repository, or git failed. An empty change list is the honest answer
    // — better than failing to open the session over it.
    return [];
  }
}

/** A unified diff for a file git does not track yet: every line an addition. */
async function untrackedDiff(root: string, path: string): Promise<SessionDiffFile | null> {
  try {
    const raw = await readFile(join(root, path), 'utf8');
    // Binary or enormous content would flood a viewer that shows a few lines.
    if (raw.includes('\0') || raw.length > MAX_PREVIEW_BYTES) return null;

    const lines = raw.length === 0 ? [] : raw.replace(/\n$/, '').split('\n');
    const body = lines.map((line) => `+${line}`).join('\n');
    return {
      path,
      additions: lines.length,
      deletions: 0,
      diff: `--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines.length} @@\n${body}`,
    };
  } catch {
    return null;
  }
}

/** The totals the inbox shows, summed over one run's files. */
export function diffTotals(files: readonly SessionDiffFile[]): Record<string, number> {
  return {
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0),
    files_changed: files.length,
  };
}
