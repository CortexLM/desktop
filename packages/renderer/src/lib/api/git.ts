/**
 * Façade git
 */

import type {
  GitStatusResponse,
  GitCommitResponse,
  GitPushResponse,
  GitDiffResponse,
} from '@cortex-ide/shared';

import { getAPI, unwrapResponse } from './client';

export const git = {
  /**
   * État du dépôt (branche, fichiers modifiés, ahead/behind)
   */
  async status(repoPath: string): Promise<GitStatusResponse> {
    return unwrapResponse(await getAPI().git.status({ repoPath }));
  },

  /**
   * Crée un commit
   *
   * @param files restreint le commit à ces fichiers ; sinon tout l'index
   */
  async commit(repoPath: string, message: string, files?: string[]): Promise<GitCommitResponse> {
    return unwrapResponse(await getAPI().git.commit({ repoPath, message, files }));
  },

  /**
   * Pousse vers le remote
   */
  async push(repoPath: string, remote?: string, branch?: string): Promise<GitPushResponse> {
    return unwrapResponse(await getAPI().git.push({ repoPath, remote, branch }));
  },

  /**
   * Diff du dépôt ou d'un fichier
   */
  async diff(repoPath: string, path?: string, staged?: boolean): Promise<GitDiffResponse> {
    return unwrapResponse(await getAPI().git.diff({ repoPath, path, staged }));
  },
};
