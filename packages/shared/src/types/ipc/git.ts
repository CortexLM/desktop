/**
 * Types IPC - Git
 */

export interface GitStatusRequest {
  repoPath: string;
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
}

export interface GitStatusResponse {
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  isClean: boolean;
}

export interface GitCommitRequest {
  repoPath: string;
  message: string;
  files?: string[];
}

export interface GitCommitResponse {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface GitPushRequest {
  repoPath: string;
  remote?: string;
  branch?: string;
}

export interface GitPushResponse {
  success: boolean;
  pushed: number;
}

export interface GitPullRequest {
  repoPath: string;
  remote?: string;
  branch?: string;
}

export interface GitPullResponse {
  success: boolean;
  filesChanged: number;
}

export interface GitDiffRequest {
  repoPath: string;
  path?: string;
  staged?: boolean;
}

export interface GitDiffResponse {
  diffs: Array<{
    path: string;
    diff: string;
    additions: number;
    deletions: number;
  }>;
}

/**
 * Staging requests (`git:stage` / `git:unstage`).
 *
 * `files` is always a list, even for the single-file case, so one shape serves
 * both a checkbox toggle and "Stage All".
 */
export interface GitStageRequest {
  repoPath: string;
  files: string[];
}

export type GitUnstageRequest = GitStageRequest;

/**
 * Staging responses.
 *
 * `files` echoes the paths that were acted on. The renderer re-reads
 * `git:status` for the authoritative state, so this exists to keep
 * `response.data` a dereferenceable object rather than `undefined` — the same
 * mistake that broke the MCP views, which read `response.server` instead of
 * `response.data.server`.
 */
export interface GitStageResponse {
  files: string[];
}

export type GitUnstageResponse = GitStageResponse;

/**
 * Discard request (`git:discard`).
 *
 * `deleteUntracked` gates the one irreversible half of this operation.
 *
 * "Discarding" is two different operations wearing one word:
 *
 *   - a file present in HEAD is *restored* from HEAD. Recoverable: the content
 *     is in the object database.
 *   - a file absent from HEAD (untracked `??`, or staged-new `A `) has never
 *     been committed, so there is nothing to restore to. Discarding it can only
 *     mean *deleting it from disk*, and nothing recovers it — not `reflog`, not
 *     `fsck --lost-found`, because it was never written to the object database.
 *
 * The flag defaults to `false` so the destructive half is opt-in per call. Bulk
 * discard leaves it `false` and never deletes; a single-file discard of a
 * not-in-HEAD file passes `true` after its own confirmation.
 *
 * It is a second lock, not the only one: the main process re-derives every
 * path's state from live `git status` and never trusts the caller's label. The
 * renderer's status is up to 5s stale (GitPanel polls), and acting on a stale
 * "modified" label would mean deleting a file the user last saw as recoverable.
 */
export interface GitDiscardRequest {
  repoPath: string;
  files: string[];
  deleteUntracked?: boolean;
}

/**
 * Discard response.
 *
 * The three buckets are reported separately because the caller cannot infer
 * them: which half of `discard` a path took depends on live repository state,
 * not on what the renderer believed when it built the request.
 *
 * `skipped` carries a reason per path rather than being silently dropped — a
 * path excluded because it turned out to be untracked is a fact the user needs,
 * since it means their click did nothing.
 */
export interface GitDiscardResponse {
  /** Paths restored from HEAD. Index and worktree both reset to HEAD. */
  restored: string[];
  /** Paths removed from disk. Never in HEAD, so nothing recovers these. */
  deleted: string[];
  /** Paths deliberately not acted on. */
  skipped: Array<{
    path: string;
    reason: 'untracked-not-confirmed' | 'unchanged' | 'directory';
  }>;
}
