/**
 * Cortex IPC Handlers — l'accès du renderer au compte et au catalogue.
 *
 * Ces canaux existent parce que le renderer ne peut physiquement pas appeler
 * l'API : chargé depuis `file://`, son origine est opaque et le contrôle CORS
 * rejette la requête avant l'envoi (cf. `services/cortex-account-service.ts`).
 *
 * L'asymétrie du contrat est la même que pour les réglages de providers :
 *
 *   renderer -> main : « démarre un flux », « déconnecte-moi ». Aucun secret.
 *   main -> renderer : l'identité et le catalogue. Jamais de jeton, jamais le
 *                      `device_code` (qui est échangeable contre un jeton).
 *
 * Il n'y a délibérément pas de canal « sonde le flux d'appareil » : la boucle
 * tourne dans main et le renderer apprend l'issue par
 * `event:cortex-device-status`. Un canal de sondage rendrait le renderer
 * responsable du rythme, alors que RFC 8628 impose ce rythme au client — et
 * `slow_down` deviendrait sa charge à gérer.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

import { IPC_CHANNELS } from '@cortex-ide/shared';
import type {
  CortexAccountState,
  CortexDeviceStartResponse,
  CortexListModelsResponse,
} from '@cortex-ide/shared';

import { getCortexAccountService } from '../../services/cortex-account-service';
import { createHandler } from './shared/handler-factory';

export const CORTEX_CHANNELS = [
  IPC_CHANNELS.CORTEX_GET_STATE,
  IPC_CHANNELS.CORTEX_LIST_MODELS,
  IPC_CHANNELS.CORTEX_DEVICE_START,
  IPC_CHANNELS.CORTEX_DEVICE_CANCEL,
  IPC_CHANNELS.CORTEX_OPEN_VERIFICATION,
  IPC_CHANNELS.CORTEX_SIGN_OUT,
] as const;

/**
 * Aucun de ces canaux ne prend de paramètre.
 *
 * `.optional()` parce que `ipcRenderer.invoke(channel)` sans argument fait
 * arriver `undefined` côté main, et un schéma d'objet strict le rejetterait —
 * le même piège que `GetProviderSettingsRequestSchema` avait dû corriger.
 */
const NoPayloadSchema = z.object({}).optional().transform(() => ({}) as Record<string, never>);

export const handleGetState = createHandler<Record<string, never>, CortexAccountState>(
  NoPayloadSchema,
  async () => getCortexAccountService().state(),
);

export const handleListModels = createHandler<Record<string, never>, CortexListModelsResponse>(
  NoPayloadSchema,
  async () => getCortexAccountService().listModels(),
);

export const handleDeviceStart = createHandler<
  Record<string, never>,
  CortexDeviceStartResponse
>(NoPayloadSchema, async () => getCortexAccountService().startDeviceFlow());

export const handleDeviceCancel = createHandler<Record<string, never>, { cancelled: true }>(
  NoPayloadSchema,
  async () => {
    getCortexAccountService().cancelDeviceFlow();
    return { cancelled: true };
  },
);

export const handleOpenVerification = createHandler<
  Record<string, never>,
  { opened: boolean }
>(NoPayloadSchema, async () => getCortexAccountService().openVerificationPage());

export const handleSignOut = createHandler<Record<string, never>, CortexAccountState>(
  NoPayloadSchema,
  async () => getCortexAccountService().signOut(),
);

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

let eventCleanup: (() => void) | undefined;

/**
 * Relaie les événements du service vers le renderer.
 *
 * Diffusé à toutes les fenêtres : la session de compte est globale au process,
 * donc une seconde fenêtre doit voir la connexion faite depuis la première.
 */
export function setupCortexEvents(): () => void {
  const service = getCortexAccountService();

  const offDevice = service.onDeviceStatus((status) => {
    broadcast(IPC_CHANNELS.EVENT_CORTEX_DEVICE_STATUS, { status });
  });
  const offAccount = service.onAccountChanged((state) => {
    broadcast(IPC_CHANNELS.EVENT_CORTEX_ACCOUNT_CHANGED, state);
  });

  return () => {
    offDevice();
    offAccount();
  };
}

export function registerCortexHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CORTEX_GET_STATE, handleGetState);
  ipcMain.handle(IPC_CHANNELS.CORTEX_LIST_MODELS, handleListModels);
  ipcMain.handle(IPC_CHANNELS.CORTEX_DEVICE_START, handleDeviceStart);
  ipcMain.handle(IPC_CHANNELS.CORTEX_DEVICE_CANCEL, handleDeviceCancel);
  ipcMain.handle(IPC_CHANNELS.CORTEX_OPEN_VERIFICATION, handleOpenVerification);
  ipcMain.handle(IPC_CHANNELS.CORTEX_SIGN_OUT, handleSignOut);

  eventCleanup?.();
  eventCleanup = setupCortexEvents();
}

export function unregisterCortexHandlers(): void {
  CORTEX_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
  eventCleanup?.();
  eventCleanup = undefined;
}
