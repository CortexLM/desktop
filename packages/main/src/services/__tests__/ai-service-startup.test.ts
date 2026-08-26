/**
 * `getAIService()` au démarrage à froid — les réglages PERSISTÉS s'appliquent.
 *
 * Bug d'origine, trouvé en enregistrant une démo : une clé enregistrée via
 * Settings était bien affichée (masquée) par `settings:get-providers`, mais
 * après un redémarrage tout run échouait avec « No model is configured ». Le
 * registry était construit par `fromEnv()` et seule une SAUVEGARDE via
 * `settings:set-provider` le reconfigurait — jamais le boot.
 *
 * Le contrat testé ici : la première construction du singleton rejoue
 * `toRegistryConfig()` (réglages > environnement), les suivantes n'y retouchent
 * pas, et un échec de lecture laisse un service utilisable (env-only).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const toRegistryConfig = vi.fn<() => Record<string, { apiKey?: string }>>();

vi.mock('../provider-settings-service', () => ({
  getProviderSettingsService: () => ({ toRegistryConfig }),
}));

import { getAIService, resetAIService } from '../ai-service';

beforeEach(() => {
  resetAIService();
  toRegistryConfig.mockReset();
  // validateRegistry() et le catch du factory parlent sur la console : sans
  // stub, chaque run affiche des warnings attendus comme s'ils étaient des
  // problèmes.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  resetAIService();
  vi.restoreAllMocks();
});

describe('getAIService — démarrage à froid', () => {
  it('applique les réglages stockés au registry à la première construction', () => {
    toRegistryConfig.mockReturnValue({ openrouter: { apiKey: 'sk-or-stored' } });

    const service = getAIService();

    expect(toRegistryConfig).toHaveBeenCalledTimes(1);
    expect(service.getRegisteredProviderIds()).toContain('openrouter');
  });

  it('ne relit pas les réglages aux appels suivants', () => {
    toRegistryConfig.mockReturnValue({});

    const first = getAIService();
    const second = getAIService();

    expect(second).toBe(first);
    expect(toRegistryConfig).toHaveBeenCalledTimes(1);
  });

  it('reste utilisable (env-only) quand la lecture des réglages échoue', () => {
    toRegistryConfig.mockImplementation(() => {
      throw new Error('userData indisponible');
    });

    // Ne doit pas jeter : un profil illisible ne doit pas empêcher l'app de
    // démarrer, seulement laisser le registry sur la config environnement.
    const service = getAIService();

    expect(Array.isArray(service.getRegisteredProviderIds())).toBe(true);
  });
});
