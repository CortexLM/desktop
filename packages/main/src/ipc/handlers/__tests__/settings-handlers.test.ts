/**
 * Le pont des réglages, mesuré de bout en bout.
 *
 * ---------------------------------------------------------------------------
 * Le critère de réussite
 * ---------------------------------------------------------------------------
 * Pas « le canal est enregistré », mais : saisir une clé, enregistrer, et voir
 * le service AI résoudre le provider — là où il levait
 * `Provider "anthropic" not found` (`ai-service.ts`, `createSession`).
 *
 * Le test central (`createSession` après Save) part donc d'un `AIService`
 * réellement dépourvu de provider anthropic, vérifie que `createSession`
 * échoue AVANT, appelle le vrai handler `settings:set-provider`, puis vérifie
 * que le même appel réussit APRÈS. Un test qui n'observe que « les réglages sont
 * sauvegardés » passerait sans que rien de tout cela soit vrai.
 *
 * `provider.isAvailable()` est stubbé, pas le registry : la résolution du
 * provider est ce qu'on mesure, et seule la requête réseau est hors de portée
 * d'un test unitaire.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AIProviderRegistry } from '@cortex-ide/ai-engine';
import type { IPCResponse } from '@cortex-ide/shared';
import type {
  GetProviderSettingsResponse,
  SetProviderResponse,
} from '@cortex-ide/shared';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';
import { AIService } from '../../../services/ai-service';
import {
  ProviderSettingsService,
  resetProviderSettingsService,
} from '../../../services/provider-settings-service';
import * as aiServiceModule from '../../../services/ai-service';
import * as settingsServiceModule from '../../../services/provider-settings-service';
import {
  registerSettingsHandlers,
  unregisterSettingsHandlers,
  handleGetProviders,
  handleSetProvider,
} from '../settings-handlers';

const SECRET = 'sk-ant-api03-HANDLER-TEST-SECRET-4242';

let dir: string;
let settings: ProviderSettingsService;
let aiService: AIService;

const ENV_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'GROK_API_KEY',
  'OLLAMA_HOST',
  'OLLAMA_ENABLED',
  'DEFAULT_AI_PROVIDER',
] as const;
let savedEnv: Record<string, string | undefined>;

/** Un event `IpcMainInvokeEvent` minimal — les handlers ne le lisent pas. */
const EVENT = {} as never;

beforeEach(() => {
  resetElectronMock();
  resetProviderSettingsService();

  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }

  dir = mkdtempSync(join(tmpdir(), 'cortex-settings-handlers-'));
  settings = new ProviderSettingsService(join(dir, 'provider-settings.json'));

  // Un registry vide, donc un service dans l'état exact du bug : aucune clé,
  // aucun provider résolvable.
  aiService = new AIService(new AIProviderRegistry());

  vi.spyOn(settingsServiceModule, 'getProviderSettingsService').mockReturnValue(settings);
  vi.spyOn(aiServiceModule, 'getAIService').mockReturnValue(aiService);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  aiService.cleanup();
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  resetProviderSettingsService();
});

/** Déballe une réponse d'enveloppe, en échouant explicitement sur un échec. */
function unwrap<T>(response: IPCResponse<T>): T {
  if (!response.success) {
    throw new Error(`handler failed: ${JSON.stringify(response.error)}`);
  }
  return response.data as T;
}

describe('enregistrement des canaux settings', () => {
  it('registers both channels', () => {
    registerSettingsHandlers();

    expect(registeredHandlers.has('settings:get-providers')).toBe(true);
    expect(registeredHandlers.has('settings:set-provider')).toBe(true);
  });

  it('removes both on unregister', () => {
    registerSettingsHandlers();
    unregisterSettingsHandlers();

    expect(registeredHandlers.has('settings:get-providers')).toBe(false);
    expect(registeredHandlers.has('settings:set-provider')).toBe(false);
  });
});

describe('LE critère : le chat résout le provider après un Save', () => {
  it('createSession fails before the save and succeeds after it', async () => {
    // ---- AVANT : l'état du bug, mesuré ----------------------------------
    await expect(aiService.createSession('anthropic')).rejects.toThrow(
      'Provider "anthropic" not found'
    );

    // ---- Le geste utilisateur : saisir une clé et enregistrer -----------
    const response = await handleSetProvider(EVENT, {
      id: 'anthropic',
      enabled: true,
      apiKey: SECRET,
    });
    const data = unwrap<SetProviderResponse>(response);

    expect(data.activeProviders).toContain('anthropic');

    // ---- APRÈS : le provider est résolu par le registry -----------------
    const provider = aiService
      .getAvailableProviders()
      .find((entry) => entry.id === 'anthropic');
    expect(provider).toBeDefined();

    // Seule la requête réseau est hors de portée ici : `isAvailable()` est ce
    // qui contacte le provider. La résolution, elle, est réelle.
    const resolved = new AIProviderRegistry().getProvider('anthropic');
    expect(resolved).toBeUndefined(); // un registry neuf ne résout rien

    vi.spyOn(
      Object.getPrototypeOf(
        // Le provider réellement construit par la reconfiguration.
        (aiService as unknown as { registry: AIProviderRegistry }).registry.getProvider(
          'anthropic'
        )!
      ),
      'isAvailable'
    ).mockResolvedValue(true);

    const session = await aiService.createSession('anthropic');
    expect(session.providerId).toBe('anthropic');
  });

  it('reports the provider as active in the response view', async () => {
    const data = unwrap<SetProviderResponse>(
      await handleSetProvider(EVENT, { id: 'anthropic', enabled: true, apiKey: SECRET })
    );

    const view = data.providers.find((p) => p.id === 'anthropic');
    // `active` est relu sur le registry, pas déduit de la requête.
    expect(view?.active).toBe(true);
    expect(view?.credentialSource).toBe('settings');
  });

  it('purges a provider from the registry when it is disabled', async () => {
    await handleSetProvider(EVENT, { id: 'anthropic', enabled: true, apiKey: SECRET });
    expect(aiService.getRegisteredProviderIds()).toContain('anthropic');

    const data = unwrap<SetProviderResponse>(
      await handleSetProvider(EVENT, { id: 'anthropic', enabled: false })
    );

    // `register()` étant additif, une reconfiguration sans purge laisserait
    // anthropic résolvable avec son ancienne clé.
    expect(data.activeProviders).not.toContain('anthropic');
    expect(aiService.getRegisteredProviderIds()).not.toContain('anthropic');
    await expect(aiService.createSession('anthropic')).rejects.toThrow(
      'Provider "anthropic" not found'
    );
  });

  it('resolves grok, the id the UI used to call xai', async () => {
    // Le décalage d'identifiants : l'UI parlait de `xai`, le registry connaît
    // `grok`. Un passe-plat naïf n'aurait jamais résolu ce provider.
    const data = unwrap<SetProviderResponse>(
      await handleSetProvider(EVENT, { id: 'grok', enabled: true, apiKey: SECRET })
    );

    expect(data.activeProviders).toContain('grok');
  });
});

describe('settings:get-providers', () => {
  it('lists every provider with the precedence it applies', async () => {
    const data = unwrap<GetProviderSettingsResponse>(
      await handleGetProviders(EVENT, undefined)
    );

    expect(data.precedence).toBe('settings-over-env');
    expect(data.providers.map((p) => p.id).sort()).toEqual([
      'anthropic',
      'grok',
      'ollama',
      'openai',
      'openrouter',
    ]);
  });

  it('accepts a call with no payload', async () => {
    // `ipcRenderer.invoke(channel)` transmet `undefined` : un `z.object({})`
    // strict le rejetterait et le panneau serait vide.
    const response = await handleGetProviders(EVENT, undefined);
    expect(response.success).toBe(true);
  });
});

describe('la clé ne fuite pas par le canal', () => {
  it('never returns the key in the set-provider response', async () => {
    const response = await handleSetProvider(EVENT, {
      id: 'anthropic',
      enabled: true,
      apiKey: SECRET,
    });

    expect(JSON.stringify(response)).not.toContain(SECRET);
    // Le masque, lui, est bien là.
    expect(JSON.stringify(response)).toContain('4242');
  });

  it('never returns the key in the get-providers response', async () => {
    await handleSetProvider(EVENT, { id: 'anthropic', enabled: true, apiKey: SECRET });

    const response = await handleGetProviders(EVENT, undefined);
    expect(JSON.stringify(response)).not.toContain(SECRET);
  });

  it('keeps the key out of a validation error', async () => {
    // Le chemin d'erreur est le plus dangereux : un message qui interpole la
    // valeur reçue mettrait la clé dans les `issues` renvoyées au renderer, où
    // elles finissent dans un log ou un rapport de bug.
    const response = await handleSetProvider(EVENT, {
      id: 'not-a-provider',
      enabled: true,
      apiKey: SECRET,
    });

    expect(response.success).toBe(false);
    expect(JSON.stringify(response)).not.toContain(SECRET);
  });

  it('keeps the key out of the console on the happy path', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handleSetProvider(EVENT, { id: 'anthropic', enabled: true, apiKey: SECRET });

    const output = [errorSpy, logSpy, warnSpy]
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map(String).join(' '))
      .join('\n');

    expect(output).not.toContain(SECRET);
    // Même un préfixe suffit à identifier la clé et son compte.
    expect(output).not.toContain(SECRET.slice(0, 12));
  });
});

describe('validation du payload', () => {
  it('rejects an unknown provider id', async () => {
    const response = await handleSetProvider(EVENT, { id: 'pied-piper', enabled: true });
    expect(response.success).toBe(false);
  });

  it('rejects a non-boolean enabled', async () => {
    const response = await handleSetProvider(EVENT, { id: 'anthropic', enabled: 'yes' });
    expect(response.success).toBe(false);
  });

  it('rejects an oversized key rather than writing it to disk', async () => {
    const response = await handleSetProvider(EVENT, {
      id: 'anthropic',
      enabled: true,
      apiKey: 'x'.repeat(5000),
    });

    expect(response.success).toBe(false);
    expect(aiService.getRegisteredProviderIds()).not.toContain('anthropic');
  });
});
