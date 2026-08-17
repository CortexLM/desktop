/**
 * Git IPC Handlers
 */

import { ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  GitStatusRequestSchema,
  GitCommitRequestSchema,
  GitPushRequestSchema,
  GitPullRequestSchema,
  GitDiffRequestSchema,
  GitStageRequestSchema,
  GitUnstageRequestSchema,
  GitDiscardRequestSchema,
} from '@cortex-ide/shared';

import type {
  GitStatusRequest,
  GitStatusResponse,
  GitCommitRequest,
  GitCommitResponse,
  GitPushRequest,
  GitPushResponse,
  GitPullRequest,
  GitPullResponse,
  GitDiffRequest,
  GitDiffResponse,
  GitStageRequest,
  GitStageResponse,
  GitUnstageRequest,
  GitUnstageResponse,
  GitDiscardRequest,
  GitDiscardResponse,
} from '@cortex-ide/shared';

import { gitService } from '../../services/git-service';
import { createHandler } from './shared/handler-factory';

export const GIT_CHANNELS = [
  IPC_CHANNELS.GIT_STATUS,
  IPC_CHANNELS.GIT_COMMIT,
  IPC_CHANNELS.GIT_PUSH,
  IPC_CHANNELS.GIT_PULL,
  IPC_CHANNELS.GIT_DIFF,
  IPC_CHANNELS.GIT_STAGE,
  IPC_CHANNELS.GIT_UNSTAGE,
  IPC_CHANNELS.GIT_DISCARD,
] as const;

export const handleGitStatus = createHandler<GitStatusRequest, GitStatusResponse>(
  GitStatusRequestSchema,
  async (request) => gitService.status(request.repoPath)
);

export const handleGitCommit = createHandler<GitCommitRequest, GitCommitResponse>(
  GitCommitRequestSchema,
  async (request) => gitService.commit(request.repoPath, request.message, request.files)
);

export const handleGitPush = createHandler<GitPushRequest, GitPushResponse>(
  GitPushRequestSchema,
  async (request) => gitService.push(request.repoPath, request.remote, request.branch)
);

export const handleGitPull = createHandler<GitPullRequest, GitPullResponse>(
  GitPullRequestSchema,
  async (request) => {
    await gitService.pull(request.repoPath, request.remote, request.branch);
    return { success: true, filesChanged: 0 };
  }
);

export const handleGitDiff = createHandler<GitDiffRequest, GitDiffResponse>(
  GitDiffRequestSchema,
  async (request) => gitService.diff(request.repoPath, request.path, request.staged)
);

/**
 * Staging.
 *
 * Les deux handlers renvoient `{ files }` plutôt que `void` : `response.data`
 * doit rester déréférençable côté renderer. Un handler `void` produit
 * `{ success: true, data: undefined }`, et c'est exactement la classe de
 * désaccord de forme qui avait cassé les vues MCP (`response.server` au lieu de
 * `response.data.server`).
 *
 * Le service reçoit le tableau entier : un seul `git add` / `git reset` pour N
 * fichiers, donc un seul verrou d'index.
 */
export const handleGitStage = createHandler<GitStageRequest, GitStageResponse>(
  GitStageRequestSchema,
  async (request) => {
    await gitService.stage(request.repoPath, request.files);
    return { files: request.files };
  }
);

export const handleGitUnstage = createHandler<GitUnstageRequest, GitUnstageResponse>(
  GitUnstageRequestSchema,
  async (request) => {
    await gitService.unstage(request.repoPath, request.files);
    return { files: request.files };
  }
);

/**
 * Discard — la seule opération destructive du panneau.
 *
 * Le handler ne renvoie pas `{ files: request.files }` comme staging : ce que
 * discard a fait de chaque chemin n'est pas déductible de la requête. Un chemin
 * demandé peut avoir été restauré, supprimé, ou délibérément ignoré selon l'état
 * réel du dépôt au moment de l'appel — le service tranche, et le renvoie.
 *
 * `deleteUntracked` est transmis tel quel. Le schéma le défaut à `false`, donc
 * une requête qui l'omet ne supprime rien : le service ne peut supprimer que si
 * l'appelant l'a explicitement demandé, ET que git confirme que le chemin est
 * bien absent de HEAD.
 */
export const handleGitDiscard = createHandler<GitDiscardRequest, GitDiscardResponse>(
  GitDiscardRequestSchema,
  async (request) =>
    gitService.discard(request.repoPath, request.files, {
      deleteUntracked: request.deleteUntracked,
    })
);

/**
 * Enregistre les handlers git
 */
export function registerGitHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, handleGitStatus);
  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, handleGitCommit);
  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, handleGitPush);
  ipcMain.handle(IPC_CHANNELS.GIT_PULL, handleGitPull);
  ipcMain.handle(IPC_CHANNELS.GIT_DIFF, handleGitDiff);
  ipcMain.handle(IPC_CHANNELS.GIT_STAGE, handleGitStage);
  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE, handleGitUnstage);
  ipcMain.handle(IPC_CHANNELS.GIT_DISCARD, handleGitDiscard);
}

/**
 * Désenregistre les handlers git
 */
export function unregisterGitHandlers(): void {
  GIT_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
