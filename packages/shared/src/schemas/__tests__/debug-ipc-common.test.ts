/**
 * Contrat des canaux debug et des payloads communs.
 *
 * Deux pièges concrets sont verrouillés ici :
 *
 * 1. `NoPayloadSchema` doit accepter `undefined`. `ipcRenderer.invoke(channel)`
 *    sans argument transmet `undefined`, qu'un `z.object({})` rejette
 *    (« expected object, received undefined ») : un canal parfaitement valide
 *    devient alors une erreur de validation.
 * 2. `maxLogSize` est plafonné à 10 000 côté schéma alors que `DebugSettings`
 *    le documente en **Mo**. Le service main, lui, le compte en **entrées**.
 *    Les bornes réelles du schéma sont donc assertées explicitement pour que la
 *    prochaine personne voie l'ambiguïté au lieu de la deviner.
 */

import { describe, expect, it } from 'vitest';

import { NoPayloadSchema, OptionalLimitSchema } from '../ipc-common';
import {
  DebugCategoriesSchema,
  DebugUpdateSettingsRequestSchema,
  LogLevelSchema,
} from '../debug';
import type { DebugSettings } from '../../types/debug';

describe('NoPayloadSchema', () => {
  it('accepte undefined (invoke sans argument)', () => {
    expect(NoPayloadSchema.parse(undefined)).toBeUndefined();
  });

  it('accepte null', () => {
    expect(NoPayloadSchema.parse(null)).toBeUndefined();
  });

  it('accepte un objet vide et le normalise en undefined', () => {
    expect(NoPayloadSchema.parse({})).toBeUndefined();
  });

  it('accepte un objet non vide (passthrough) sans le propager', () => {
    expect(NoPayloadSchema.parse({ stray: 1 })).toBeUndefined();
  });

  it.each([['une string', 'x'], ['un nombre', 42], ['un booléen', true]])(
    'rejette %s, qui signale un appel renderer erroné',
    (_label, value) => {
      expect(NoPayloadSchema.safeParse(value).success).toBe(false);
    }
  );
});

describe('OptionalLimitSchema', () => {
  it('laisse passer une limite entière positive', () => {
    expect(OptionalLimitSchema.parse(500)).toBe(500);
  });

  it('normalise undefined et null en undefined', () => {
    expect(OptionalLimitSchema.parse(undefined)).toBeUndefined();
    expect(OptionalLimitSchema.parse(null)).toBeUndefined();
  });

  it('accepte la borne haute 100 000 et rejette au-delà', () => {
    expect(OptionalLimitSchema.parse(100_000)).toBe(100_000);
    expect(OptionalLimitSchema.safeParse(100_001).success).toBe(false);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejette la limite %s',
    (limit) => {
      expect(OptionalLimitSchema.safeParse(limit).success).toBe(false);
    }
  );

  it('rejette une limite passée en string', () => {
    // `'500'` viendrait d'un champ de formulaire non converti ; `slice(-'500')`
    // ne lèverait pas mais renverrait un tableau vide.
    expect(OptionalLimitSchema.safeParse('500').success).toBe(false);
  });
});

describe('LogLevelSchema', () => {
  it('expose exactement les quatre niveaux', () => {
    expect([...LogLevelSchema.options].sort()).toEqual(['debug', 'error', 'info', 'warn']);
  });

  it("rejette 'warning', qui est un niveau de notification, pas de log", () => {
    expect(LogLevelSchema.safeParse('warning').success).toBe(false);
  });

  it('rejette les variantes de casse', () => {
    expect(LogLevelSchema.safeParse('ERROR').success).toBe(false);
  });
});

describe('DebugCategoriesSchema', () => {
  const ALL_CATEGORIES = {
    ipc: true,
    performance: true,
    network: true,
    database: true,
    ai: true,
    git: true,
  };

  it('exige les six catégories quand le schéma est complet', () => {
    expect(DebugCategoriesSchema.parse(ALL_CATEGORIES)).toEqual(ALL_CATEGORIES);

    const { git: _git, ...missingGit } = ALL_CATEGORIES;
    expect(DebugCategoriesSchema.safeParse(missingGit).success).toBe(false);
  });

  it('rejette une catégorie non booléenne', () => {
    expect(
      DebugCategoriesSchema.safeParse({ ...ALL_CATEGORIES, ipc: 'true' }).success
    ).toBe(false);
  });

  it('accepte un sous-ensemble en mode partial', () => {
    expect(DebugCategoriesSchema.partial().parse({ ipc: false })).toEqual({ ipc: false });
  });
});

describe('DebugUpdateSettingsRequestSchema', () => {
  it('accepte { enabled } seul — la forme envoyée par toggleDebugMode()', () => {
    expect(DebugUpdateSettingsRequestSchema.parse({ enabled: true })).toEqual({
      enabled: true,
    });
  });

  it('accepte un objet vide (aucun champ requis)', () => {
    expect(DebugUpdateSettingsRequestSchema.parse({})).toEqual({});
  });

  it('accepte un sous-ensemble de catégories sans exiger les six', () => {
    expect(
      DebugUpdateSettingsRequestSchema.parse({ categories: { ipc: false } })
    ).toEqual({ categories: { ipc: false } });
  });

  it('accepte la forme complète envoyée par SettingsPanel', () => {
    const full = {
      enabled: true,
      logLevel: 'debug',
      categories: {
        ipc: true,
        performance: false,
        network: true,
        database: false,
        ai: true,
        git: false,
      },
      maxLogSize: 10,
      logRotation: false,
    };

    expect(DebugUpdateSettingsRequestSchema.parse(full)).toEqual(full);
  });

  it('borne maxLogSize à [1, 10 000] entiers', () => {
    // Bornes réelles du schéma. `DebugSettings.maxLogSize` est documenté « in
    // MB » et le défaut du handler est 10 ; le service main compte des entrées
    // (défaut 10 000). Le plafond de 10 000 rend le champ ambigu : ce test fixe
    // ce qui passe la frontière IPC, il ne prétend pas trancher l'unité.
    expect(DebugUpdateSettingsRequestSchema.parse({ maxLogSize: 1 }).maxLogSize).toBe(1);
    expect(DebugUpdateSettingsRequestSchema.parse({ maxLogSize: 10_000 }).maxLogSize).toBe(
      10_000
    );

    for (const maxLogSize of [0, -5, 1.5, 10_001]) {
      expect(DebugUpdateSettingsRequestSchema.safeParse({ maxLogSize }).success).toBe(false);
    }
  });

  it('rejette un logLevel inconnu', () => {
    expect(
      DebugUpdateSettingsRequestSchema.safeParse({ logLevel: 'verbose' }).success
    ).toBe(false);
  });

  it('rejette enabled non booléen', () => {
    // `'false'` (string) est truthy : accepté, il activerait le mode debug en
    // croyant le désactiver.
    expect(DebugUpdateSettingsRequestSchema.safeParse({ enabled: 'false' }).success).toBe(
      false
    );
  });

  it('rejette une catégorie inconnue avec une valeur non booléenne', () => {
    expect(
      DebugUpdateSettingsRequestSchema.safeParse({ categories: { ipc: 1 } }).success
    ).toBe(false);
  });

  it('accepte le contrat DebugSettings complet moins les champs absents du schéma', () => {
    // Un `DebugSettings` réel (celui que `handleGetSettings` renvoie) doit
    // pouvoir être renvoyé tel quel à `debug:update-settings` : c'est ce que
    // fait le bouton Save de SettingsPanel.
    const settings: DebugSettings = {
      enabled: false,
      logLevel: 'info',
      categories: {
        ipc: true,
        performance: true,
        network: true,
        database: true,
        ai: true,
        git: true,
      },
      maxLogSize: 10,
      logRotation: true,
    };

    const parsed = DebugUpdateSettingsRequestSchema.parse(settings);
    expect(parsed).toEqual(settings);
  });
});
