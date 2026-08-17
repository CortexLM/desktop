/**
 * `ProviderSettingsService` — persistance, précédence, et non-fuite de la clé.
 *
 * Trois propriétés, dans l'ordre de ce qui casse le plus silencieusement :
 *
 *   1. La clé ne sort jamais vers le renderer. `toView()` est le seul chemin
 *      main -> renderer, et aucun de ses champs ne doit contenir la clé.
 *   2. La précédence réglages > environnement, dans les deux sens, avec la
 *      provenance annoncée (`credentialSource`) conforme à la clé réellement
 *      utilisée par `toRegistryConfig()`.
 *   3. Un `set` sans `apiKey` conserve la clé stockée. L'UI ne connaît jamais la
 *      clé, donc elle ne peut pas la renvoyer : sans cette règle, tout Save fait
 *      pour basculer `enabled` l'effacerait.
 *
 * Le service écrit dans un fichier temporaire, jamais dans `userData` : le test
 * doit pouvoir lire l'octet posé sur disque pour vérifier qu'il ne contient pas
 * la clé en clair.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { safeStorageMock } from '../../../../../test/electron-mock';
import { ProviderSettingsService, maskApiKey } from '../provider-settings-service';

/** Clé de forme réaliste : une recherche de sous-chaîne ne peut pas passer par chance. */
const SECRET = 'sk-ant-api03-REAL-LOOKING-SECRET-VALUE-4242';

let dir: string;
let filePath: string;
let service: ProviderSettingsService;

/** Variables d'environnement à restaurer après chaque test. */
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

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cortex-provider-settings-'));
  filePath = join(dir, 'provider-settings.json');
  service = new ProviderSettingsService(filePath);

  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }

  safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Le contenu brut du fichier de réglages, tel qu'il est sur le disque. */
const rawFile = (): string => readFileSync(filePath, 'utf8');

describe('maskApiKey', () => {
  it('keeps a recognisable prefix and the last four characters', () => {
    expect(maskApiKey(SECRET)).toBe('sk-…4242');
  });

  it('masks a short key entirely rather than half-revealing it', () => {
    // 8 caractères ou moins : « sk-…4242 » révélerait presque tout.
    expect(maskApiKey('sk-12345')).toBe('…');
    expect(maskApiKey('')).toBe('');
  });

  it('never returns the key itself', () => {
    expect(maskApiKey(SECRET)).not.toContain('REAL-LOOKING-SECRET');
  });
});

describe('ProviderSettingsService — la clé ne revient pas au renderer', () => {
  it('exposes a mask but no key in toView()', () => {
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });

    const views = service.toView(['anthropic']);
    const anthropic = views.find((v) => v.id === 'anthropic');

    expect(anthropic?.maskedApiKey).toBe('sk-…4242');
    // La propriété n'existe pas dans le contrat, et rien ne doit l'y avoir mise.
    expect(anthropic).not.toHaveProperty('apiKey');
    // Test de fuite structurel : la clé n'apparaît nulle part dans la vue,
    // quel que soit le champ.
    expect(JSON.stringify(views)).not.toContain(SECRET);
  });

  it('keeps the key out of the serialised view for every provider', () => {
    service.setProvider({ id: 'openai', enabled: true, apiKey: SECRET });
    service.setProvider({ id: 'grok', enabled: true, apiKey: `${SECRET}-grok` });

    expect(JSON.stringify(service.toView([]))).not.toContain('REAL-LOOKING-SECRET');
  });
});

describe('ProviderSettingsService — stockage sur disque', () => {
  it('encrypts the key at rest when safeStorage is available', () => {
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });

    expect(safeStorageMock.encryptString).toHaveBeenCalled();
    expect(rawFile()).not.toContain(SECRET);
    expect(rawFile()).toContain('apiKeyEnc');
  });

  it('round-trips the key through a fresh service instance', () => {
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });

    // Instance neuve : le cache mémoire ne peut pas expliquer le résultat.
    const reloaded = new ProviderSettingsService(filePath);
    expect(reloaded.toRegistryConfig().anthropic?.apiKey).toBe(SECRET);
  });

  it('falls back to plaintext in a 0600 file when encryption is unavailable', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });

    // Recul assumé et documenté : hors de portée du renderer, mais en clair.
    expect(rawFile()).toContain(SECRET);
    // Ce qui rend ce recul acceptable : lisible par le seul propriétaire.
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it('writes the settings file 0600 even when encrypted', () => {
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it('survives a corrupt settings file instead of throwing', () => {
    writeFileSync(filePath, '{ not json', 'utf8');

    const fresh = new ProviderSettingsService(filePath);
    // Un fichier illisible doit dégrader vers « aucun réglage », pas planter le
    // démarrage du process main.
    expect(fresh.toView([])).toHaveLength(5);
  });
});

describe('ProviderSettingsService — précédence réglages > environnement', () => {
  it('prefers the saved key over the environment variable', () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-should-lose';
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });

    expect(service.toRegistryConfig().anthropic?.apiKey).toBe(SECRET);

    const view = service.toView([]).find((v) => v.id === 'anthropic');
    expect(view?.credentialSource).toBe('settings');
    // La variable reste annoncée : « elle existe mais votre réglage la
    // remplace » est une information, son absence est un piège.
    expect(view?.envKeyPresent).toBe(true);
    expect(view?.envVar).toBe('ANTHROPIC_API_KEY');
  });

  it('uses the environment on first launch, with no settings saved', () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-wins-by-default';

    expect(service.toRegistryConfig().anthropic?.apiKey).toBe('env-key-wins-by-default');

    const view = service.toView([]).find((v) => v.id === 'anthropic');
    expect(view?.credentialSource).toBe('env');
    expect(view?.enabled).toBe(true);
  });

  it('falls back to the environment key when a provider is enabled without one', () => {
    process.env.OPENAI_API_KEY = 'env-openai';
    service.setProvider({ id: 'openai', enabled: true });

    expect(service.toRegistryConfig().openai?.apiKey).toBe('env-openai');
    expect(service.toView([]).find((v) => v.id === 'openai')?.credentialSource).toBe('env');
  });

  it('honours an explicit disable even when the environment has a key', () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';
    service.setProvider({ id: 'anthropic', enabled: false });

    // Décocher doit désactiver. Sinon l'utilisateur ne peut pas éteindre un
    // provider que son shell active.
    expect(service.toRegistryConfig().anthropic).toBeUndefined();
    expect(service.toView([]).find((v) => v.id === 'anthropic')?.enabled).toBe(false);
  });

  it('names no environment variable when none provides a key', () => {
    // `envVar` décrit la variable qui FOURNIT une clé (cf. le contrat dans
    // `types/ipc/settings.ts`), pas celle qu'on pourrait définir. La nommer
    // toujours ferait dire à l'UI « une variable existe » alors qu'il n'y en a
    // aucune — le symétrique exact du piège qu'on cherche à éviter.
    const view = service.toView([]).find((v) => v.id === 'anthropic');
    expect(view?.credentialSource).toBe('none');
    expect(view?.envVar).toBeUndefined();
    expect(view?.envKeyPresent).toBe(false);
  });

  it('names the environment variable when it is the one in use', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-from-the-environment-9999';

    const view = service.toView([]).find((v) => v.id === 'anthropic');
    expect(view?.credentialSource).toBe('env');
    expect(view?.envVar).toBe('ANTHROPIC_API_KEY');
  });
});

describe('ProviderSettingsService — sémantique de apiKey', () => {
  it('keeps the stored key when apiKey is absent from the request', () => {
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });
    // Un Save déclenché pour basculer enabled, sans toucher au champ clé.
    service.setProvider({ id: 'anthropic', enabled: false });
    service.setProvider({ id: 'anthropic', enabled: true });

    expect(service.toRegistryConfig().anthropic?.apiKey).toBe(SECRET);
  });

  it('clears the stored key on an empty string', () => {
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: '' });

    expect(service.toRegistryConfig().anthropic).toBeUndefined();
    expect(service.toView([]).find((v) => v.id === 'anthropic')?.maskedApiKey).toBeUndefined();
  });

  it('trims surrounding whitespace from a pasted key', () => {
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: `  ${SECRET}\n` });
    expect(service.toRegistryConfig().anthropic?.apiKey).toBe(SECRET);
  });
});

describe('ProviderSettingsService — active reflète le registry', () => {
  it('marks a provider active only when the registry resolves it', () => {
    service.setProvider({ id: 'anthropic', enabled: true, apiKey: SECRET });

    const before = service.toView([]).find((v) => v.id === 'anthropic');
    expect(before?.active).toBe(false);

    const after = service.toView(['anthropic']).find((v) => v.id === 'anthropic');
    expect(after?.active).toBe(true);
  });
});
