/**
 * Git Stash IPC Handlers
 *
 * Sert les canaux `git:stash-*` consommés par `GitStashPanel` via
 * `window.ipc`. Distinct de `git-handlers.ts`, qui sert les canaux
 * `git:status` / `git:commit` / ... exposés par la façade `window.cortex.git`.
 *
 * Les handlers ne font que traduire le payload à plat envoyé par le renderer
 * vers la signature de `GitStashService` ; toute la logique git reste dans le
 * service.
 */

import { ipcMain } from 'electron';

import {
  StashListRequestSchema,
  StashShowRequestSchema,
  StashSaveRequestSchema,
  StashApplyRequestSchema,
  StashPopRequestSchema,
  StashDropRequestSchema,
  StashBranchRequestSchema,
} from '@cortex-ide/shared';

import type {
  StashListRequest,
  StashShowRequest,
  StashSaveRequest,
  StashApplyRequest,
  StashPopRequest,
  StashDropRequest,
  StashBranchRequest,
} from '@cortex-ide/shared';

import { getGitStashService, type StashEntry, type StashDiff } from '../../services/git-stash-service';
import { createHandler } from './shared/handler-factory';

/**
 * Noms de canaux.
 *
 * Absents de `IPC_CHANNELS` (qui ne couvre que les canaux de la façade
 * `window.cortex`) : ils sont déclarés ici et repris à l'identique dans
 * l'allowlist du preload.
 */
export const GIT_STASH_CHANNELS = [
  'git:stash-list',
  'git:stash-show',
  'git:stash-save',
  'git:stash-apply',
  'git:stash-pop',
  'git:stash-drop',
  'git:stash-branch',
] as const;

/**
 * Formes de réponse.
 *
 * `GitStashPanel` lit `response.data.stashes` et `response.data.diff` : les
 * valeurs du service sont donc encapsulées sous une clé nommée, jamais
 * renvoyées nues. Les mutations renvoient un objet vide plutôt que `undefined`
 * pour que `response.data` reste déréférençable côté renderer.
 */
export interface StashListResponse {
  stashes: StashEntry[];
}

export interface StashShowResponse {
  diff: StashDiff;
}

export type StashMutationResponse = Record<string, never>;

const EMPTY: StashMutationResponse = {};

export const handleStashList = createHandler<StashListRequest, StashListResponse>(
  StashListRequestSchema,
  async (request) => ({ stashes: await getGitStashService().list(request.repoPath) })
);

export const handleStashShow = createHandler<StashShowRequest, StashShowResponse>(
  StashShowRequestSchema,
  async (request) => ({
    diff: await getGitStashService().show(request.repoPath, request.stashIndex),
  })
);

export const handleStashSave = createHandler<StashSaveRequest, StashMutationResponse>(
  StashSaveRequestSchema,
  async (request) => {
    // Le renderer envoie les options à plat, le service les attend groupées.
    await getGitStashService().save(request.repoPath, request.message, {
      includeUntracked: request.includeUntracked,
      keepIndex: request.keepIndex,
    });

    return EMPTY;
  }
);

export const handleStashApply = createHandler<StashApplyRequest, StashMutationResponse>(
  StashApplyRequestSchema,
  async (request) => {
    await getGitStashService().apply(request.repoPath, request.stashIndex);
    return EMPTY;
  }
);

export const handleStashPop = createHandler<StashPopRequest, StashMutationResponse>(
  StashPopRequestSchema,
  async (request) => {
    await getGitStashService().pop(request.repoPath, request.stashIndex);
    return EMPTY;
  }
);

export const handleStashDrop = createHandler<StashDropRequest, StashMutationResponse>(
  StashDropRequestSchema,
  async (request) => {
    await getGitStashService().drop(request.repoPath, request.stashIndex);
    return EMPTY;
  }
);

export const handleStashBranch = createHandler<StashBranchRequest, StashMutationResponse>(
  StashBranchRequestSchema,
  async (request) => {
    await getGitStashService().branch(request.repoPath, request.branchName, request.stashIndex);
    return EMPTY;
  }
);

/**
 * Enregistre les handlers git stash
 */
export function registerGitStashHandlers(): void {
  ipcMain.handle('git:stash-list', handleStashList);
  ipcMain.handle('git:stash-show', handleStashShow);
  ipcMain.handle('git:stash-save', handleStashSave);
  ipcMain.handle('git:stash-apply', handleStashApply);
  ipcMain.handle('git:stash-pop', handleStashPop);
  ipcMain.handle('git:stash-drop', handleStashDrop);
  ipcMain.handle('git:stash-branch', handleStashBranch);
}

/**
 * Désenregistre les handlers git stash
 */
export function unregisterGitStashHandlers(): void {
  GIT_STASH_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));

  // Les instances simple-git sont mises en cache par repo : les libérer évite
  // de garder des handles sur des repos qui ne sont plus ouverts.
  getGitStashService().clearCache();
}
