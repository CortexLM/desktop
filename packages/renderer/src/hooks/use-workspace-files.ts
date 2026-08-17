/**
 * Workspace file index for the command palette's file search.
 *
 * The `fs:readDir` IPC handler supports `recursive: true`, but it walks
 * everything — `node_modules`, `.git`, build output — and runs a `stat` per
 * entry. On a real project that is hundreds of thousands of round-tripped
 * entries and takes long enough to look broken.
 *
 * So this walks breadth-first with the non-recursive call, skips the
 * directories nobody wants to open by name, and stops at hard limits. Breadth
 * first matters: if the cap is reached, what you keep is the shallow files near
 * the project root, which is what people search for.
 */

import * as React from 'react';
import { useErrorHandler } from './use-error-handler';

export interface IndexedFile {
  /** Absolute path. */
  path: string;
  /** File name including extension. */
  name: string;
  /** Path relative to the workspace root, shown as the secondary line. */
  relativePath: string;
}

/** Directories skipped wholesale: huge, generated, or not user-editable. */
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'dist',
  'build',
  'out',
  'target',
  'coverage',
  '.gradle',
  '.idea',
  '.vscode-test',
  'vendor',
  'Pods',
]);

/** Enough to cover any real project, low enough to stay responsive. */
const MAX_FILES = 20_000;
const MAX_DIRECTORIES = 4_000;
const MAX_DEPTH = 12;

interface QueueEntry {
  path: string;
  depth: number;
}

interface RawEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
}

/**
 * Walks the workspace and returns its files.
 *
 * Symlinks are listed but never descended into, since a link pointing at an
 * ancestor would send the walk in circles.
 */
export async function indexWorkspaceFiles(
  rootPath: string,
  signal?: AbortSignal
): Promise<{ files: IndexedFile[]; truncated: boolean }> {
  const files: IndexedFile[] = [];
  const queue: QueueEntry[] = [{ path: rootPath, depth: 0 }];
  const visited = new Set<string>([rootPath]);

  let directoriesScanned = 0;
  let truncated = false;

  while (queue.length > 0) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    if (files.length >= MAX_FILES || directoriesScanned >= MAX_DIRECTORIES) {
      truncated = true;
      break;
    }

    // Read a slice of the current level in parallel: the walk is dominated by
    // IPC latency, so batching cuts indexing time substantially.
    const batch = queue.splice(0, 12);
    directoriesScanned += batch.length;

    const results = await Promise.all(
      batch.map(async (entry) => ({
        entry,
        children: await safeReadDir(entry.path),
      }))
    );

    for (const { entry, children } of results) {
      for (const child of children) {
        if (child.type === 'directory') {
          if (entry.depth + 1 > MAX_DEPTH) continue;
          if (IGNORED_DIRECTORIES.has(child.name)) continue;
          if (visited.has(child.path)) continue;

          visited.add(child.path);
          queue.push({ path: child.path, depth: entry.depth + 1 });
          continue;
        }

        if (child.type !== 'file') continue;
        if (files.length >= MAX_FILES) {
          truncated = true;
          break;
        }

        files.push({
          path: child.path,
          name: child.name,
          relativePath: toRelativePath(child.path, rootPath),
        });
      }
    }
  }

  return { files, truncated };
}

/**
 * Reads one directory, treating failure as empty.
 *
 * A permission error on one subdirectory shouldn't abort the whole index; the
 * palette is more useful with most of the tree than with none of it.
 */
async function safeReadDir(dirPath: string): Promise<RawEntry[]> {
  try {
    const response = await window.cortex.fs.readDir({ path: dirPath, recursive: false });
    if (!response?.success || !response.data?.entries) return [];
    return response.data.entries as RawEntry[];
  } catch {
    return [];
  }
}

function toRelativePath(fullPath: string, rootPath: string): string {
  if (!fullPath.startsWith(rootPath)) return fullPath;
  return fullPath.slice(rootPath.length).replace(/^[\\/]/, '');
}

export interface WorkspaceFilesState {
  files: IndexedFile[];
  isLoading: boolean;
  /** True when limits were hit, so the UI can say the list is partial. */
  truncated: boolean;
  refresh: () => void;
}

/**
 * Indexes the workspace once `enabled` turns true.
 *
 * Gated rather than eager so startup isn't spent walking a tree the user may
 * never search. The palette flips `enabled` the first time it opens.
 */
export function useWorkspaceFiles(
  workspacePath: string | null,
  enabled: boolean
): WorkspaceFilesState {
  const [files, setFiles] = React.useState<IndexedFile[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [truncated, setTruncated] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const { handleError } = useErrorHandler();

  React.useEffect(() => {
    if (!enabled || !workspacePath) return;

    const controller = new AbortController();
    setIsLoading(true);

    indexWorkspaceFiles(workspacePath, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setFiles(result.files);
        setTruncated(result.truncated);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;

        handleError(error, {
          title: 'Could not index workspace files',
          retry: () => setRefreshToken((value) => value + 1),
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [workspacePath, enabled, refreshToken, handleError]);

  const refresh = React.useCallback(() => setRefreshToken((value) => value + 1), []);

  return { files, isLoading, truncated, refresh };
}
