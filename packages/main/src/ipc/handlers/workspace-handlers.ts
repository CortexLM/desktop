/**
 * Workspace IPC Handlers
 *
 * Sert les canaux `workspace:*` consommés par `WorkspaceSwitcher` via
 * `window.ipc`, en s'appuyant sur `WorkspaceManager`.
 *
 * Deux points structurels :
 *
 * 1. `WorkspaceManager` doit être `initialize()` avant tout usage, sinon la
 *    liste est vide même quand `workspaces.json` existe. L'initialisation est
 *    faite paresseusement, une seule fois, et partagée entre appels concurrents.
 * 2. Le manager émet `workspace-switched` sur son propre EventEmitter. Personne
 *    ne le relayait au renderer, alors que le preload autorise déjà
 *    `event:workspace-switched` et que `WorkspaceSwitcher` s'y abonne pour se
 *    rafraîchir. Le pont est établi ici.
 */

import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

import {
  NoPayloadSchema,
  WorkspaceSwitchRequestSchema,
  WorkspaceAddRequestSchema,
  WorkspaceRemoveRequestSchema,
} from '@cortex-ide/shared';

import type {
  NoPayload,
  Workspace,
  WorkspaceSwitchRequest,
  WorkspaceAddRequest,
  WorkspaceRemoveRequest,
} from '@cortex-ide/shared';

import { getWorkspaceManager, type WorkspaceManager } from '../../services/workspace-manager';
import { createHandler } from './shared/handler-factory';

export const WORKSPACE_CHANNELS = [
  'workspace:list',
  'workspace:switch',
  'workspace:add',
  'workspace:remove',
  'workspace:open-dialog',
] as const;

/** Canal d'événement relayé au renderer quand le workspace actif change. */
export const WORKSPACE_SWITCHED_EVENT = 'event:workspace-switched';

// ============================================================================
// Formes de réponse
// ============================================================================

/**
 * `WorkspaceSwitcher` lit `response.data.workspaces` et `response.data.activeId`.
 *
 * `activeId` est l'identifiant, pas l'entité : le composant résout lui-même le
 * workspace correspondant dans la liste.
 */
export interface WorkspaceListResponse {
  workspaces: Workspace[];
  activeId: string | null;
}

export interface WorkspaceAddResponse {
  workspace: Workspace;
}

/** `path` est absent quand l'utilisateur annule la boîte de dialogue native. */
export interface WorkspaceOpenDialogResponse {
  path?: string;
}

export type WorkspaceMutationResponse = Record<string, never>;

const EMPTY: WorkspaceMutationResponse = {};

// ============================================================================
// Accès au manager
// ============================================================================

let managerPromise: Promise<WorkspaceManager> | null = null;
let switchedListener: ((workspaceId: string) => void) | null = null;

/**
 * Récupère le manager, initialisé et abonné.
 *
 * `initialize()` lit `workspaces.json` : l'oublier donnerait une liste vide
 * alors que des workspaces sont enregistrés. La promesse est mémoïsée pour que
 * deux invokes concurrents ne lancent pas deux lectures.
 */
async function manager(): Promise<WorkspaceManager> {
  if (!managerPromise) {
    managerPromise = (async () => {
      const instance = getWorkspaceManager(app.getPath('userData'));
      await instance.initialize();

      // Relais vers le renderer. Enregistré ici plutôt que dans `register()`
      // parce que le manager n'existe qu'après résolution du dataDir.
      switchedListener = (workspaceId: string) => {
        for (const window of BrowserWindow.getAllWindows()) {
          if (!window.isDestroyed()) {
            window.webContents.send(WORKSPACE_SWITCHED_EVENT, { workspaceId });
          }
        }
      };
      instance.on('workspace-switched', switchedListener);

      return instance;
    })();

    // Un échec d'initialisation ne doit pas être mémoïsé : le prochain appel
    // doit pouvoir réessayer (dossier créé entre-temps, droits corrigés).
    managerPromise.catch(() => {
      managerPromise = null;
    });
  }

  return managerPromise;
}

// ============================================================================
// Handlers
// ============================================================================

export const handleWorkspaceList = createHandler<NoPayload, WorkspaceListResponse>(
  NoPayloadSchema,
  async () => {
    const instance = await manager();

    return {
      workspaces: instance.listWorkspaces(),
      activeId: instance.getActiveWorkspace()?.id ?? null,
    };
  }
);

export const handleWorkspaceSwitch = createHandler<
  WorkspaceSwitchRequest,
  WorkspaceMutationResponse
>(WorkspaceSwitchRequestSchema, async (request) => {
  const instance = await manager();
  await instance.switchWorkspace(request.workspaceId);
  return EMPTY;
});

export const handleWorkspaceAdd = createHandler<WorkspaceAddRequest, WorkspaceAddResponse>(
  WorkspaceAddRequestSchema,
  async (request) => {
    const instance = await manager();
    return { workspace: await instance.addWorkspace(request.path, request.name) };
  }
);

export const handleWorkspaceRemove = createHandler<
  WorkspaceRemoveRequest,
  WorkspaceMutationResponse
>(WorkspaceRemoveRequestSchema, async (request) => {
  const instance = await manager();
  await instance.removeWorkspace(request.workspaceId);
  return EMPTY;
});

/**
 * Fenêtre appelante, quand elle peut être résolue.
 *
 * `fromWebContents` est encapsulé : ne pas pouvoir rattacher la boîte de
 * dialogue à un parent n'est pas une raison d'échouer l'ouverture — on retombe
 * sur une boîte non modale.
 */
function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  try {
    return BrowserWindow.fromWebContents(event.sender) ?? null;
  } catch {
    return null;
  }
}

export const handleWorkspaceOpenDialog = createHandler<NoPayload, WorkspaceOpenDialogResponse>(
  NoPayloadSchema,
  async (_request, event) => {
    const options = {
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>,
      title: 'Open Workspace',
    };

    // Rattache la boîte de dialogue à la fenêtre appelante quand elle est
    // connue, pour qu'elle soit modale au bon parent.
    const parent = senderWindow(event);

    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);

    // Annulation : `path` reste absent, le renderer n'enchaîne pas sur
    // `workspace:add`.
    if (result.canceled || result.filePaths.length === 0) {
      return {};
    }

    return { path: result.filePaths[0] };
  }
);

/**
 * Enregistre les handlers workspace
 */
export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:list', handleWorkspaceList);
  ipcMain.handle('workspace:switch', handleWorkspaceSwitch);
  ipcMain.handle('workspace:add', handleWorkspaceAdd);
  ipcMain.handle('workspace:remove', handleWorkspaceRemove);
  ipcMain.handle('workspace:open-dialog', handleWorkspaceOpenDialog);
}

/**
 * Désenregistre les handlers workspace
 */
export function unregisterWorkspaceHandlers(): void {
  WORKSPACE_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));

  // Détache le relais d'événement : sans ça, un re-register empilerait un
  // second listener et le renderer recevrait chaque switch en double.
  if (switchedListener && managerPromise) {
    const listener = switchedListener;
    managerPromise
      .then((instance) => instance.off('workspace-switched', listener))
      .catch(() => {
        // Le manager n'a jamais été initialisé : rien à détacher.
      });
  }

  switchedListener = null;
  managerPromise = null;
}
