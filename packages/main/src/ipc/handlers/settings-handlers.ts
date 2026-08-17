/**
 * Settings IPC Handlers — le pont entre les réglages de l'UI et le registry AI.
 *
 * Deux canaux, asymétriques par conception :
 *
 *   `settings:get-providers` — main -> renderer. Ne renvoie JAMAIS de clé, juste
 *                              un masque et la provenance de la clé effective.
 *   `settings:set-provider`  — renderer -> main. Le seul endroit du dépôt où une
 *                              clé en clair traverse l'IPC, et seulement dans ce
 *                              sens.
 *
 * `set-provider` fait deux choses, dans cet ordre, et les deux comptent :
 *   1. persister le réglage,
 *   2. RECONSTRUIRE le registry.
 *
 * Sans (2), le réglage est bien enregistré et le service ne le voit jamais —
 * c'est le bug d'origine, et c'est exactement ce qu'un test « les réglages sont
 * sauvegardés » laisse passer. La réponse renvoie donc `activeProviders`, relu
 * sur le registry après reconstruction, pour que le succès soit vérifiable et
 * pas seulement annoncé.
 *
 * Forme de l'enveloppe : `{ success, data }` via `createHandler`. Les vues
 * lisent `response.data.providers` — un désaccord sur ce point (`response.server`
 * au lieu de `response.data.server`) a déjà cassé une feature entière ici.
 */

import { ipcMain } from 'electron';

import {
  GetProviderSettingsRequestSchema,
  SetProviderRequestSchema,
  IPC_CHANNELS,
} from '@cortex-ide/shared';
import type {
  GetProviderSettingsResponse,
  ProviderId,
  SetProviderRequest,
  SetProviderResponse,
} from '@cortex-ide/shared';

import { getAIService } from '../../services/ai-service';
import { getProviderSettingsService } from '../../services/provider-settings-service';
import { createHandler } from './shared/handler-factory';

export const SETTINGS_CHANNELS = [
  IPC_CHANNELS.SETTINGS_GET_PROVIDERS,
  IPC_CHANNELS.SETTINGS_SET_PROVIDER,
] as const;

/**
 * Précédence annoncée au renderer.
 *
 * Exposée plutôt que codée en dur côté UI : deux descriptions de la même règle
 * qui divergent sont pires qu'aucune.
 */
const PRECEDENCE = 'settings-over-env' as const;

export const handleGetProviders = createHandler<
  Record<string, never>,
  GetProviderSettingsResponse
>(GetProviderSettingsRequestSchema, async () => {
  const settings = getProviderSettingsService();
  // Mesuré sur le registry réel, pas déduit des réglages.
  const activeIds = getAIService().getRegisteredProviderIds();

  return {
    providers: settings.toView(activeIds),
    precedence: PRECEDENCE,
  };
});

export const handleSetProvider = createHandler<SetProviderRequest, SetProviderResponse>(
  SetProviderRequestSchema,
  async (request) => {
    const settings = getProviderSettingsService();

    settings.setProvider(request);

    // LA ligne qui répare le bug : sans elle le réglage est persisté et le
    // registry garde les providers du démarrage.
    const activeIds = getAIService().applyRegistryConfig(settings.toRegistryConfig());

    return {
      providers: settings.toView(activeIds),
      activeProviders: activeIds as ProviderId[],
    };
  }
);

/**
 * Enregistre les handlers settings
 */
export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_PROVIDERS, handleGetProviders);
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_PROVIDER, handleSetProvider);
}

/**
 * Désenregistre les handlers settings
 */
export function unregisterSettingsHandlers(): void {
  SETTINGS_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
