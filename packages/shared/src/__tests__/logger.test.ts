/**
 * Contrat du logger partagé.
 *
 * `logger` est le seul export de `@cortex-ide/shared` importé depuis les tests
 * d'autres packages (les handlers debug s'en servent pour `debug:get-logs`),
 * donc c'est la surface la plus exposée du package.
 *
 * Deux comportements méritent une garde et n'apparaissent nulle part dans les
 * types : le buffer est **borné** (il évince les plus anciennes entrées au lieu
 * de croître indéfiniment), et `error()` synthétise une pile même quand
 * l'argument reçu n'est pas une `Error` — ce que font régulièrement les
 * appelants qui `throw` une string ou un objet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger, logger } from '../logger';
import type { LogEntry } from '../types/debug';

/** Le buffer interne est un `private` sans accesseur : `maxLogs` est lu ici. */
const MAX_LOGS = 10_000;

describe('Logger', () => {
  beforeEach(() => {
    logger.clear();
  });

  afterEach(() => {
    logger.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('singleton', () => {
    it('getInstance() renvoie toujours la même instance', () => {
      expect(Logger.getInstance()).toBe(Logger.getInstance());
    });

    it("l'export `logger` EST cette instance", () => {
      // Si `logger` était une seconde instance, les logs écrits par un package
      // seraient invisibles depuis `debug:get-logs`, qui lit le singleton.
      expect(logger).toBe(Logger.getInstance());
    });

    it('partage le buffer entre les références', () => {
      Logger.getInstance().info('cat', 'via getInstance');
      expect(logger.getLogs()).toHaveLength(1);
    });
  });

  describe('niveaux', () => {
    it.each([
      ['debug', (c: string, m: string) => logger.debug(c, m)],
      ['info', (c: string, m: string) => logger.info(c, m)],
      ['warn', (c: string, m: string) => logger.warn(c, m)],
    ] as const)('%s enregistre une entrée à ce niveau', (level, call) => {
      call('cat', 'message');

      const [entry] = logger.getLogs();
      expect(entry.level).toBe(level);
      expect(entry.category).toBe('cat');
      expect(entry.message).toBe('message');
    });

    it('error enregistre au niveau error', () => {
      logger.error('cat', 'boom');
      expect(logger.getLogs()[0].level).toBe('error');
    });

    it('conserve la donnée de contexte transmise', () => {
      logger.info('cat', 'msg', { requestId: 7 });
      expect(logger.getLogs()[0].data).toEqual({ requestId: 7 });
    });

    it("laisse `data` à undefined quand l'appelant n'en fournit pas", () => {
      logger.info('cat', 'msg');
      expect(logger.getLogs()[0].data).toBeUndefined();
    });
  });

  describe('forme des entrées', () => {
    it('produit un id unique par entrée', () => {
      for (let i = 0; i < 200; i += 1) {
        logger.info('cat', `msg ${i}`);
      }

      const ids = new Set(logger.getLogs().map((entry) => entry.id));
      // Un id dupliqué casse la clé React de la table de logs du panneau debug.
      expect(ids.size).toBe(200);
    });

    it('horodate avec un timestamp numérique cohérent', () => {
      const before = Date.now();
      logger.info('cat', 'msg');
      const after = Date.now();

      const { timestamp } = logger.getLogs()[0];
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("marque la source 'main' hors renderer", () => {
      // La détection lit `'window' in globalThis`. L'environnement de ce projet
      // vitest est `node`, donc pas de window : la source doit être 'main'.
      logger.info('cat', 'msg');
      expect(logger.getLogs()[0].source).toBe('main');
    });

    it("marque la source 'renderer' quand un window existe", () => {
      vi.stubGlobal('window', {});
      try {
        logger.info('cat', 'msg');
        expect(logger.getLogs()[0].source).toBe('renderer');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('error() et la pile', () => {
    it("réutilise la pile de l'Error reçue", () => {
      const error = new Error('original');
      error.stack = 'STACK-FROM-ERROR';

      logger.error('cat', 'échec', error);

      const [entry] = logger.getLogs();
      expect(entry.stack).toBe('STACK-FROM-ERROR');
      expect(entry.data).toBe(error);
    });

    it("synthétise une pile quand l'argument n'est pas une Error", () => {
      // Cas réel : `throw 'string'` ou un rejet de promesse non-Error. Sans
      // cette branche, `entry.stack` serait undefined et le panneau debug
      // n'aurait aucun site d'appel à montrer.
      logger.error('cat', 'échec', 'juste une string');

      const [entry] = logger.getLogs();
      expect(entry.stack).toBeDefined();
      expect(entry.stack).toContain('Error');
      expect(entry.data).toBe('juste une string');
    });

    it('synthétise une pile quand aucun argument d’erreur n’est fourni', () => {
      logger.error('cat', 'échec');
      expect(logger.getLogs()[0].stack).toBeDefined();
    });

    it('ne synthétise PAS de pile pour les autres niveaux', () => {
      logger.warn('cat', 'attention');
      expect(logger.getLogs()[0].stack).toBeUndefined();
    });
  });

  describe('buffer borné', () => {
    it(`évince les plus anciennes entrées au-delà de ${MAX_LOGS}`, () => {
      for (let i = 0; i < MAX_LOGS + 5; i += 1) {
        logger.info('cat', `msg ${i}`);
      }

      const logs = logger.getLogs();
      // Le plafond est ce qui empêche le process main de fuir en mémoire sur une
      // session longue.
      expect(logs).toHaveLength(MAX_LOGS);
      // Les 5 premières sont parties, la dernière est là.
      expect(logs[0].message).toBe('msg 5');
      expect(logs[logs.length - 1].message).toBe(`msg ${MAX_LOGS + 4}`);
    });
  });

  describe('getLogs()', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i += 1) {
        logger.info('cat', `msg ${i}`);
      }
    });

    it('renvoie tout sans limite', () => {
      expect(logger.getLogs()).toHaveLength(5);
    });

    it('renvoie les N plus RÉCENTES avec une limite', () => {
      // `slice(-limit)`, pas `slice(0, limit)` : le panneau debug affiche la
      // queue. Inverser les deux montrerait les logs les plus vieux.
      expect(logger.getLogs(2).map((l) => l.message)).toEqual(['msg 3', 'msg 4']);
    });

    it('tolère une limite supérieure au nombre d’entrées', () => {
      expect(logger.getLogs(100)).toHaveLength(5);
    });

    it('renvoie une copie, pas le buffer interne', () => {
      const logs = logger.getLogs();
      logs.push({} as LogEntry);
      // Muter le retour ne doit pas corrompre l'état du logger.
      expect(logger.getLogs()).toHaveLength(5);
    });
  });

  describe('clear()', () => {
    it('vide le buffer', () => {
      logger.info('cat', 'msg');
      logger.clear();
      expect(logger.getLogs()).toEqual([]);
    });
  });

  describe('onLog()', () => {
    it('notifie les abonnés avec l’entrée complète', () => {
      const received: LogEntry[] = [];
      const unsubscribe = logger.onLog((entry) => received.push(entry));

      logger.info('cat', 'msg');

      expect(received).toHaveLength(1);
      expect(received[0].message).toBe('msg');
      unsubscribe();
    });

    it('notifie tous les abonnés', () => {
      const first = vi.fn();
      const second = vi.fn();
      const off1 = logger.onLog(first);
      const off2 = logger.onLog(second);

      logger.info('cat', 'msg');

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      off1();
      off2();
    });

    it('cesse de notifier après désabonnement', () => {
      const listener = vi.fn();
      const unsubscribe = logger.onLog(listener);

      logger.info('cat', 'avant');
      unsubscribe();
      logger.info('cat', 'après');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('dédoublonne un même listener enregistré deux fois', () => {
      // Le stockage est un `Set` : un composant qui s'abonne deux fois par
      // erreur ne doit pas recevoir de doublons.
      const listener = vi.fn();
      const off1 = logger.onLog(listener);
      const off2 = logger.onLog(listener);

      logger.info('cat', 'msg');

      expect(listener).toHaveBeenCalledTimes(1);
      off1();
      off2();
    });
  });

  describe('filter()', () => {
    beforeEach(() => {
      logger.info('ipc', 'info ipc');
      logger.warn('ipc', 'warn ipc');
      logger.error('db', 'error db');
      logger.debug('db', 'debug db');
    });

    it('filtre par niveau', () => {
      expect(logger.filter({ level: 'warn' }).map((l) => l.message)).toEqual(['warn ipc']);
    });

    it('filtre par catégorie', () => {
      expect(logger.filter({ category: 'db' })).toHaveLength(2);
    });

    it('combine niveau et catégorie en ET', () => {
      expect(logger.filter({ level: 'info', category: 'db' })).toHaveLength(0);
      expect(logger.filter({ level: 'info', category: 'ipc' })).toHaveLength(1);
    });

    it('filtre par source', () => {
      expect(logger.filter({ source: 'main' })).toHaveLength(4);
      expect(logger.filter({ source: 'renderer' })).toHaveLength(0);
    });

    it('filtre par `since` inclusivement', () => {
      const logs = logger.getLogs();
      const cutoff = logs[0].timestamp;

      // `log.timestamp < since` est exclu : une entrée pile sur la borne reste.
      expect(logger.filter({ since: cutoff }).length).toBeGreaterThanOrEqual(1);
      expect(logger.filter({ since: cutoff + 10_000 })).toHaveLength(0);
    });

    it('renvoie tout avec un critère vide', () => {
      expect(logger.filter({})).toHaveLength(4);
    });
  });

  describe('sortie console', () => {
    it('reste silencieux hors mode développement', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DEBUG', '');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('cat', 'msg');

      // Un logger bavard en production pollue stdout du process main.
      expect(spy).not.toHaveBeenCalled();
    });

    it("écrit sur console.log en NODE_ENV=development", () => {
      vi.stubEnv('NODE_ENV', 'development');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('cat', 'msg', { a: 1 });

      expect(spy).toHaveBeenCalledWith('[INFO] [cat]', 'msg', { a: 1 });
    });

    it("écrit aussi quand DEBUG=true seul est positionné", () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DEBUG', 'true');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.debug('cat', 'msg');

      expect(spy).toHaveBeenCalled();
    });

    it('route warn vers console.warn et error vers console.error', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.warn('cat', 'attention');
      logger.error('cat', 'échec', new Error('e'));

      expect(warnSpy).toHaveBeenCalledWith('[WARN] [cat]', 'attention', '');
      expect(errorSpy).toHaveBeenCalledWith('[ERROR] [cat]', 'échec', expect.any(Error));
    });

    it('imprime la pile en second appel quand elle existe', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('e');
      error.stack = 'THE-STACK';
      logger.error('cat', 'échec', error);

      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenLastCalledWith('THE-STACK');
    });

    it("remplace une donnée absente par '' plutôt que d'afficher undefined", () => {
      vi.stubEnv('NODE_ENV', 'development');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('cat', 'msg');

      expect(spy).toHaveBeenCalledWith('[INFO] [cat]', 'msg', '');
    });
  });
});
