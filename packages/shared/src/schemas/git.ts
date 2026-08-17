/**
 * Zod Schemas - Git
 */

import { z } from 'zod';

export const GitStatusRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
});

export const GitCommitRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  message: z.string().min(1, 'Commit message is required'),
  files: z.array(z.string()).optional(),
});

export const GitPushRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  remote: z.string().optional().default('origin'),
  branch: z.string().optional(),
});

export const GitPullRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  remote: z.string().optional().default('origin'),
  branch: z.string().optional(),
});

export const GitDiffRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  path: z.string().optional(),
  staged: z.boolean().optional().default(false),
});

/**
 * Staging (`git:stage` / `git:unstage`).
 *
 * `files` is a non-empty array rather than a single `path`: the panel stages one
 * file per checkbox but also has a "Stage All" action, and one `git add` with N
 * pathspecs is a single index lock instead of N sequential ones. A single-file
 * caller passes `[path]`.
 *
 * Empty strings are rejected element-wise: `git add ''` is an error in recent
 * Git, and an empty pathspec must not be allowed to widen into "everything".
 */
const StagingPathsSchema = z
  .array(z.string().min(1, 'File path cannot be empty'))
  .min(1, 'At least one file is required');

export const GitStageRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  files: StagingPathsSchema,
});

export const GitUnstageRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  files: StagingPathsSchema,
});

/**
 * Discard (`git:discard`).
 *
 * Same path shape as staging, and for the same reasons: a non-empty list, with
 * empty strings rejected element-wise so an empty pathspec can never widen into
 * "everything". On a destructive operation that widening would be catastrophic
 * rather than merely wrong.
 *
 * `deleteUntracked` defaults to `false`: the irreversible half of discard is
 * opt-in per call, so a request that forgets the flag deletes nothing. Callers
 * that mean it say so.
 */
export const GitDiscardRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  files: StagingPathsSchema,
  deleteUntracked: z.boolean().optional().default(false),
});
