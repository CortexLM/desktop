/**
 * Contrat des schémas de réglages providers.
 *
 * `settings:set-provider` est le seul canal du dépôt où une clé d'API en clair
 * traverse la frontière IPC, depuis le process le moins fiable. Ce qui est
 * verrouillé ici :
 *
 * 1. `GetProviderSettingsRequestSchema` doit accepter `undefined`.
 *    `ipcRenderer.invoke(channel)` sans argument transmet `undefined`, qu'un
 *    `z.object({})` strict rejetterait — le canal deviendrait une erreur de
 *    validation alors qu'il est correct. Le `.transform()` en sortie est le
 *    point qui rendait ce fichier non couvert : il ne s'exécute que si quelqu'un
 *    parse effectivement le schéma.
 *
 * 2. La distinction absent / chaîne vide sur `apiKey`. L'UI ne connaît jamais la
 *    clé courante, donc elle ne peut pas la renvoyer : `undefined` doit signifier
 *    « garde la clé stockée » et `''` « efface-la ». Confondre les deux fait
 *    qu'un Save depuis un autre onglet effacerait la clé.
 *
 * 3. Les bornes de longueur, qui sont des garde-fous contre un renderer
 *    compromis poussant un blob dans le fichier de réglages — pas une validation
 *    de format.
 *
 * 4. Qu'aucun message d'erreur n'interpole la valeur reçue : les `issues` Zod
 *    remontent au renderer via `toErrorResponse` et peuvent finir dans un log.
 *    Une clé d'API ne doit pas fuiter par le chemin d'erreur.
 */

import { describe, expect, it } from 'vitest';

import {
  GetProviderSettingsRequestSchema,
  ProviderIdSchema,
  SetProviderRequestSchema,
} from '../settings';

describe('GetProviderSettingsRequestSchema', () => {
  it('accepte undefined (invoke sans argument) et normalise en objet vide', () => {
    expect(GetProviderSettingsRequestSchema.parse(undefined)).toEqual({});
  });

  it('accepte null', () => {
    expect(GetProviderSettingsRequestSchema.parse(null)).toEqual({});
  });

  it('accepte un objet et le normalise en objet vide', () => {
    // Le `.transform()` jette le contenu : un renderer qui enverrait des champs
    // en plus ne peut pas influencer la lecture.
    expect(GetProviderSettingsRequestSchema.parse({ sneaky: 'value' })).toEqual({});
  });

  it('rejette les scalaires', () => {
    expect(GetProviderSettingsRequestSchema.safeParse('nope').success).toBe(false);
    expect(GetProviderSettingsRequestSchema.safeParse(42).success).toBe(false);
  });
});

describe('ProviderIdSchema', () => {
  it('accepte les cinq providers supportés', () => {
    for (const id of ['openai', 'anthropic', 'openrouter', 'ollama', 'grok']) {
      expect(ProviderIdSchema.parse(id)).toBe(id);
    }
  });

  it('rejette un provider inconnu', () => {
    expect(ProviderIdSchema.safeParse('gemini').success).toBe(false);
  });
});

describe('SetProviderRequestSchema', () => {
  it('exige id et enabled', () => {
    expect(SetProviderRequestSchema.safeParse({ id: 'openai' }).success).toBe(false);
    expect(SetProviderRequestSchema.safeParse({ enabled: true }).success).toBe(false);
  });

  it('accepte une requête minimale sans apiKey', () => {
    const parsed = SetProviderRequestSchema.parse({ id: 'openai', enabled: true });
    // `undefined` et non `''` : l'absence doit rester distinguable de l'effacement.
    expect(parsed.apiKey).toBeUndefined();
  });

  it('distingue apiKey absente de apiKey vide', () => {
    const absent = SetProviderRequestSchema.parse({ id: 'grok', enabled: true });
    const cleared = SetProviderRequestSchema.parse({ id: 'grok', enabled: true, apiKey: '' });

    expect(absent.apiKey).toBeUndefined();
    expect(cleared.apiKey).toBe('');
  });

  it('ne coupe pas les espaces de la clé', () => {
    // Couper silencieusement modifierait ce que l'utilisateur a saisi ; c'est au
    // service de le faire explicitement.
    const parsed = SetProviderRequestSchema.parse({
      id: 'anthropic',
      enabled: true,
      apiKey: '  sk-ant-abc  ',
    });
    expect(parsed.apiKey).toBe('  sk-ant-abc  ');
  });

  it('accepte une clé de 4096 caractères et rejette 4097', () => {
    const base = { id: 'openai' as const, enabled: true };
    expect(SetProviderRequestSchema.safeParse({ ...base, apiKey: 'k'.repeat(4096) }).success).toBe(
      true
    );
    expect(SetProviderRequestSchema.safeParse({ ...base, apiKey: 'k'.repeat(4097) }).success).toBe(
      false
    );
  });

  it('borne baseUrl à 2048 et defaultModel à 256', () => {
    const base = { id: 'ollama' as const, enabled: true };
    expect(SetProviderRequestSchema.safeParse({ ...base, baseUrl: 'u'.repeat(2048) }).success).toBe(
      true
    );
    expect(SetProviderRequestSchema.safeParse({ ...base, baseUrl: 'u'.repeat(2049) }).success).toBe(
      false
    );
    expect(
      SetProviderRequestSchema.safeParse({ ...base, defaultModel: 'm'.repeat(256) }).success
    ).toBe(true);
    expect(
      SetProviderRequestSchema.safeParse({ ...base, defaultModel: 'm'.repeat(257) }).success
    ).toBe(false);
  });

  it('n\'accepte pas un format de clé imposé', () => {
    // Volontaire : les préfixes varient (`sk-`, `sk-ant-`, `xai-`…) et rejeter
    // sur un motif casserait un provider dès qu'il change de convention.
    const parsed = SetProviderRequestSchema.parse({
      id: 'openrouter',
      enabled: true,
      apiKey: 'no-recognisable-prefix',
    });
    expect(parsed.apiKey).toBe('no-recognisable-prefix');
  });

  it('ne fait jamais fuiter la clé dans un message d\'erreur', () => {
    const secret = 'sk-super-secret-key-value';
    const result = SetProviderRequestSchema.safeParse({
      id: 'openai',
      enabled: 'not-a-boolean',
      apiKey: secret,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).not.toContain(secret);
    }
  });
});
