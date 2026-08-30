/**
 * The open folder on This PC: list it for the composer, or pick a new one.
 *
 * Paths stay in main. The renderer only sees a repository id (the folder name).
 */

import { basename } from 'node:path';

import type { RepositoryOption } from '@cortex-ide/shared';

import { gitService } from './git-service';
import { activeWorkspaceManager, activeWorkspacePath } from './active-workspace';
import { pickLocalFolder } from './session-this-pc';

export interface RepoBinding {
  id: string;
  path: string;
  branch?: string;
}

export async function activeRepoBinding(): Promise<RepoBinding | undefined> {
  const path = await activeWorkspacePath();
  if (!path) return undefined;
  return { id: basename(path), path };
}

export async function listBoundRepositories(): Promise<RepositoryOption[]> {
  const binding = await activeRepoBinding();
  if (!binding) return [];
  try {
    return [await describeGitFolder(binding)];
  } catch {
    return [{ id: binding.id, name: binding.id, worktree: binding.id, branches: [], dirty: false }];
  }
}

async function describeGitFolder(binding: RepoBinding): Promise<RepositoryOption> {
  const [status, branchSummary] = await Promise.all([
    gitService.status(binding.path),
    gitService.branches(binding.path),
  ]);
  return {
    id: binding.id,
    name: binding.id,
    branch: status.branch,
    worktree: binding.id,
    branches: branchSummary.all.filter((name) => !name.startsWith('remotes/')),
    dirty: !status.isClean,
  };
}

export async function openBoundWorkspace(): Promise<{
  cancelled: boolean;
  repositories: RepositoryOption[];
}> {
  const path = await pickLocalFolder();
  if (!path) {
    return { cancelled: true, repositories: await listBoundRepositories() };
  }

  const manager = await activeWorkspaceManager();
  const workspace = await manager.addWorkspace(path);
  await manager.switchWorkspace(workspace.id);
  return { cancelled: false, repositories: await listBoundRepositories() };
}
