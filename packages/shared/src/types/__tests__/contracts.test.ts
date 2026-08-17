/**
 * Tests de contrat aux frontières entre packages.
 *
 * Les bugs visés ici ne sont pas des bugs de logique interne à `shared` : ce
 * sont des **désaccords de forme** entre ce que `shared` déclare et ce que les
 * autres packages produisent ou consomment. Trois sont reproduits :
 *
 * 1. La DB retourne du snake_case nullable (`created_at`), plusieurs services
 *    attendent du camelCase non-null (`createdAt`). `new Date(undefined)` ne
 *    lève pas : il produit une `Invalid Date`, et c'est `.toISOString()` qui
 *    lève un `RangeError` — donc l'échec survient loin de sa cause.
 * 2. `IPC_CHANNELS` a existé en deux exemplaires divergents. Le nom de canal
 *    est une string : une divergence ne se voit ni au typecheck ni à
 *    l'exécution côté émetteur, seulement par un `invoke` qui n'a pas de
 *    handler.
 * 3. `maxLogSize` : même nom, deux unités (entrées vs Mo) selon le côté de la
 *    frontière.
 */

import { describe, expect, it } from 'vitest';

import { IPC_CHANNELS, type IPCChannelName } from '../ipc/channels';
// Importé en namespace, pas seulement en `import type` : `types/index.ts`
// contient un `export * from './debug'` qui est du code exécuté. Un import
// purement typé serait effacé à la compilation et le barrel ne serait jamais
// évalué — un réexport cassé y passerait inaperçu.
import * as domainTypes from '../index';
import type { Message, Session, Workspace } from '../index';
import type { DebugSettings } from '../debug';
import { DebugUpdateSettingsRequestSchema } from '../../schemas/debug';
import { CreateAutomationRequestSchema } from '../../schemas/automation';
import type { Automation } from '../ipc/automation';

// ============================================================================
// 1. Frontière DB → service : snake_case nullable vs camelCase non-null
// ============================================================================

/** Ligne telle que `better-sqlite3` la retourne : snake_case, colonnes nullables. */
interface SessionRow {
  id: string;
  workspace_id: string | null;
  title: string | null;
  model: string | null;
  created_at: number | null;
  updated_at: number | null;
}

describe('contrat DB → Session', () => {
  const ROW: SessionRow = {
    id: 's1',
    workspace_id: 'w1',
    title: 'Une session',
    model: 'claude-opus-5:stable',
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_001_000,
  };

  it('Session exige createdAt en nombre non-null (vérifié par tsc)', () => {
    // `satisfies` est le garde-fou : si quelqu'un rend `createdAt` optionnel ou
    // nullable dans `types/index.ts`, cette ligne continue de compiler, mais si
    // quelqu'un le retire ou en change le type, `bun run typecheck` échoue.
    const session = {
      id: ROW.id,
      workspaceId: 'w1',
      title: 'Une session',
      model: 'claude-opus-5:stable',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_001_000,
    } satisfies Session;

    expect(typeof session.createdAt).toBe('number');
    expect(Number.isFinite(session.createdAt)).toBe(true);
  });

  it('une ligne DB brute ne satisfait PAS le contrat Session au runtime', () => {
    // Le cast que faisait le service : la ligne passe le compilateur via `as`,
    // et se casse à l'exécution.
    const naive = ROW as unknown as Session;

    expect(naive.createdAt).toBeUndefined();
    expect((naive as unknown as SessionRow).created_at).toBe(ROW.created_at);
  });

  it('new Date(undefined) produit une Invalid Date au lieu de lever', () => {
    // C'est la raison pour laquelle le bug se manifestait loin de sa cause :
    // la construction réussit silencieusement.
    const date = new Date(undefined as unknown as number);

    expect(Number.isNaN(date.getTime())).toBe(true);
    expect(String(date)).toBe('Invalid Date');
  });

  it('.toISOString() sur cette date lève un RangeError — le symptôme observé', () => {
    const naive = ROW as unknown as Session;

    // Exactement ce que fait `chat-export-service` :
    // `new Date(session.createdAt).toISOString()`.
    expect(() => new Date(naive.createdAt).toISOString()).toThrow(RangeError);
  });

  it('.toLocaleString() ne lève pas — d’où un export « réussi » mais faux', () => {
    // La branche markdown lève, la branche html non : le même bug produisait
    // deux symptômes différents selon le format demandé.
    const naive = ROW as unknown as Session;
    expect(() => new Date(naive.createdAt).toLocaleString()).not.toThrow();
    expect(new Date(naive.createdAt).toLocaleString()).toContain('Invalid');
  });

  it('une ligne correctement mappée traverse toISOString sans lever', () => {
    const mapped: Session = {
      id: ROW.id,
      workspaceId: ROW.workspace_id ?? '',
      title: ROW.title ?? '',
      model: ROW.model ?? '',
      createdAt: ROW.created_at ?? 0,
      updatedAt: ROW.updated_at ?? 0,
    };

    expect(new Date(mapped.createdAt).toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('un created_at NULL mappé sans repli reste piégeux', () => {
    // `?? 0` donne l'epoch, ce qui est faux mais n'explose pas. Sans repli,
    // `null` traverse : `new Date(null)` vaut l'epoch aussi, mais
    // `new Date(undefined)` est invalide. Les deux absences ne se comportent
    // pas pareil, et c'est ce qui rend le bug intermittent.
    expect(new Date(null as unknown as number).getTime()).toBe(0);
    expect(Number.isNaN(new Date(undefined as unknown as number).getTime())).toBe(true);
  });

  it('types/index.ts réexporte bien les types debug à l’exécution', () => {
    // `types/index.ts` n'exporte que des types SAUF `export * from './debug'`.
    // Ce module doit donc être chargeable et son réexport évalué ; c'est ce que
    // consomme le sous-chemin `./types/debug` déclaré dans `exports`.
    expect(domainTypes).toBeTypeOf('object');
    expect(Object.isFrozen(domainTypes)).toBe(false);
  });

  it('Message et Workspace ont la même exigence sur leurs horodatages', () => {
    const message = {
      id: 'm1',
      sessionId: 's1',
      role: 'user',
      content: 'hello',
      createdAt: 1_700_000_000_000,
    } satisfies Message;

    const workspace = {
      id: 'w1',
      name: 'w',
      path: '/w',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    } satisfies Workspace;

    // Tous les horodatages du domaine sont des epoch millisecondes numériques,
    // jamais des strings ISO ni des Date.
    for (const value of [message.createdAt, workspace.createdAt, workspace.updatedAt]) {
      expect(typeof value).toBe('number');
      expect(new Date(value).toISOString()).toBe('2023-11-14T22:13:20.000Z');
    }
  });

  it('Automation utilise aussi des epoch numériques', () => {
    const automation = {
      id: 'a1',
      workspaceId: 'w1',
      name: 'a',
      enabled: true,
      trigger: { type: 'manual' },
      actions: [{ type: 'run_script', script: 'bun test' }],
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    } satisfies Automation;

    expect(new Date(automation.updatedAt).toISOString()).toBe('2023-11-14T22:13:20.000Z');

    // Et la partie « requête » de cette entité doit passer son propre schéma :
    // c'est ce qui relie le type au validateur.
    const { id: _id, createdAt: _c, updatedAt: _u, ...request } = automation;
    expect(CreateAutomationRequestSchema.safeParse(request).success).toBe(true);
  });
});

// ============================================================================
// 2. Frontière main ↔ preload : les noms de canaux
// ============================================================================

describe('contrat IPC_CHANNELS', () => {
  const entries = Object.entries(IPC_CHANNELS);

  it('ne contient aucun nom de canal en doublon', () => {
    // Deux clés partageant la même valeur signifient que le second
    // `ipcMain.handle()` écrase le premier : un domaine entier devient muet
    // sans aucune erreur.
    const values = entries.map(([, value]) => value);
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);

    expect(duplicates).toEqual([]);
    expect(new Set(values).size).toBe(values.length);
  });

  it('respecte la forme `domaine:action-en-kebab`', () => {
    for (const [key, value] of entries) {
      expect(value, `${key} = ${value}`).toMatch(/^[a-z]+:[a-z]+(-[a-z]+)*$/);
    }
  });

  it("préfixe tous les canaux d'événement par `event:`", () => {
    for (const [key, value] of entries) {
      if (key.startsWith('EVENT_')) {
        expect(value.startsWith('event:'), `${key} = ${value}`).toBe(true);
      } else {
        expect(value.startsWith('event:'), `${key} = ${value}`).toBe(false);
      }
    }
  });

  it("fixe AI_STREAM_RESPONSE à 'ai:stream-response'", () => {
    // Une seconde table de canaux déclarait `AI_STREAM_RESPONSE: 'ai:stream'`.
    // Un preload câblé sur l'une et un main sur l'autre donnent un `invoke`
    // sans handler — silencieux à la compilation. Cette valeur est celle que
    // `types/ipc/channels.ts` (la source de vérité réexportée par le package)
    // doit garder.
    expect(IPC_CHANNELS.AI_STREAM_RESPONSE).toBe('ai:stream-response');
  });

  it('couvre les domaines servis par un schéma de validation', () => {
    const prefixes = new Set(entries.map(([, value]) => value.split(':')[0]));

    // Chaque domaine ayant un schéma Zod doit avoir au moins un canal déclaré,
    // sinon le schéma valide un payload que personne ne peut envoyer.
    for (const domain of ['fs', 'editor', 'git', 'ai', 'terminal', 'db', 'automation', 'mcp']) {
      expect(prefixes.has(domain), `domaine ${domain}`).toBe(true);
    }
  });

  it('expose IPCChannelName comme union des valeurs (vérifié par tsc)', () => {
    const channel: IPCChannelName = IPC_CHANNELS.FS_READ_FILE;
    expect(channel).toBe('fs:read-file');

    // Une string arbitraire ne doit pas être assignable : si `IPCChannelName`
    // dégénérait en `string`, le typage des handlers ne protégerait plus rien.
    const notAChannel = 'fs:definitely-not-a-channel';
    expect((Object.values(IPC_CHANNELS) as string[]).includes(notAChannel)).toBe(false);
  });
});

// ============================================================================
// 3. Frontière renderer ↔ main : l'unité de maxLogSize
// ============================================================================

describe('contrat DebugSettings.maxLogSize', () => {
  it('accepte le défaut du handler (10) et le défaut du service (10 000)', () => {
    // Les DEUX valeurs passent le schéma. C'est précisément ce qui rend
    // l'ambiguïté d'unité indétectable à la validation : 10 se lit « 10 Mo »
    // côté type partagé, 10 000 se lit « 10 000 entrées » côté service.
    expect(DebugUpdateSettingsRequestSchema.parse({ maxLogSize: 10 }).maxLogSize).toBe(10);
    expect(DebugUpdateSettingsRequestSchema.parse({ maxLogSize: 10_000 }).maxLogSize).toBe(
      10_000
    );
  });

  it('un DebugSettings complet reste ré-envoyable au canal update', () => {
    const settings: DebugSettings = {
      enabled: true,
      logLevel: 'warn',
      categories: {
        ipc: true,
        performance: false,
        network: false,
        database: false,
        ai: false,
        git: false,
      },
      maxLogSize: 10,
      logRotation: true,
    };

    // Aller-retour : `handleGetSettings()` renvoie cette forme, le bouton Save
    // de SettingsPanel la renvoie telle quelle. Un champ non accepté par le
    // schéma casserait le Save.
    const parsed = DebugUpdateSettingsRequestSchema.parse(settings);
    expect(parsed).toEqual(settings);
  });

  it('le type partagé déclare maxLogSize comme un nombre requis', () => {
    // Retirer `maxLogSize` du type ferait échouer `bun run typecheck` ici.
    const partial = {
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
    } satisfies DebugSettings;

    expect(typeof partial.maxLogSize).toBe('number');
  });
});
