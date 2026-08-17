/**
 * Update IPC Handlers
 *
 * Ces canaux ne font pas partie de `IPC_CHANNELS` car ils sont gérés
 * directement par l'auto-updater.
 */

import { ipcMain } from 'electron';
import { updateManager } from '../../updater';

export const UPDATE_CHANNELS = {
  CHECK: 'update:check',
  DOWNLOAD: 'update:download',
  INSTALL: 'update:install',
} as const;

type UpdateResult = { success: true } | { success: false; error: string };

/**
 * Exécute une action de l'updater en convertissant les erreurs en résultat
 */
async function runUpdateAction(action: () => Promise<void> | void): Promise<UpdateResult> {
  try {
    await action();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enregistre les handlers de mise à jour
 */
export function registerUpdateHandlers(): void {
  ipcMain.handle(UPDATE_CHANNELS.CHECK, () =>
    runUpdateAction(() => updateManager.checkForUpdates())
  );

  ipcMain.handle(UPDATE_CHANNELS.DOWNLOAD, () =>
    runUpdateAction(() => updateManager.downloadUpdate())
  );

  ipcMain.handle(UPDATE_CHANNELS.INSTALL, () =>
    runUpdateAction(() => updateManager.quitAndInstall())
  );
}

/**
 * Désenregistre les handlers de mise à jour
 */
export function unregisterUpdateHandlers(): void {
  Object.values(UPDATE_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
