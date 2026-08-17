/**
 * Instrumentation des handlers IPC — alimente `ipcMonitor` et
 * `performanceMonitor`.
 *
 * ---------------------------------------------------------------------------
 * Pourquoi ici, et pas dans `createHandler`
 * ---------------------------------------------------------------------------
 * `createHandler` ne connaît pas le nom du canal : il reçoit un schéma et un
 * handler, le canal n'apparaît qu'au moment de `ipcMain.handle(channel, ...)`.
 * Et trois domaines (`debug`, `terminal`, `update`) plus le handler de streaming
 * AI n'utilisent pas `createHandler` du tout — les instrumenter via la fabrique
 * les aurait laissés muets.
 *
 * Le point commun réel des 14 domaines est l'appel à `ipcMain.handle`. On
 * enveloppe donc ce point d'enregistrement le temps que les domaines
 * s'enregistrent, puis on restaure la méthode d'origine. Résultat : un seul
 * endroit, tous les canaux couverts, et aucun fichier de domaine à modifier.
 *
 * ---------------------------------------------------------------------------
 * Ce qui est enregistré — et ce qui ne l'est pas
 * ---------------------------------------------------------------------------
 * Enregistré : canal, direction, horodatage (posé par le moniteur), durée,
 * succès/échec.
 *
 * PAS enregistré : les payloads, ni même leur taille. Requêtes comme réponses
 * peuvent contenir du contenu de fichier, une clé d'API ou un diff entier, et le
 * panneau debug est affiché à l'écran. Les arguments ne sont jamais lus : ils
 * sont transmis au handler et c'est tout. Seules des données de forme (canal,
 * direction, durée, succès/échec) sortent d'ici.
 */

import { ipcMain } from 'electron';
import { logger } from '@cortex-ide/shared/logger';

import { ipcMonitor } from '../../../services/ipc-monitor';
import { performanceMonitor } from '../../../services/performance-monitor';
import { debugService } from '../../../services/debug-service';

type AnyIpcHandler = (event: unknown, ...args: unknown[]) => unknown;
type HandleFn = (channel: string, handler: AnyIpcHandler) => void;

/**
 * Canaux exclus de l'enregistrement.
 *
 * L'IPC Inspector recharge `debug:get-ipc-messages` et `debug:get-ipc-stats`
 * chaque seconde. Les enregistrer ferait que l'observateur remplit son propre
 * tampon : à 2 appels/s, le buffer de 1000 entrées ne contiendrait plus que du
 * polling au bout de ~8 minutes, et aurait évincé le trafic réel — exactement le
 * panneau vide qu'on cherche à corriger.
 *
 * Conséquence assumée : le trafic du panneau debug lui-même n'apparaît pas dans
 * l'Inspector. Ce sont des lectures d'état en mémoire, sans intérêt de
 * diagnostic.
 */
const EXCLUDED_PREFIXES = ['debug:'] as const;

function isExcluded(channel: string): boolean {
  return EXCLUDED_PREFIXES.some((prefix) => channel.startsWith(prefix));
}

/**
 * Seuil au-delà duquel un appel réussi mérite une métrique de performance.
 *
 * Pourquoi filtrer plutôt que tout enregistrer : `PerformancePanel` demande
 * `('debug:get-metrics', undefined, 500)` — sans catégorie — et son sélecteur
 * démarre sur `timing`. Mesuré sur ce dépôt : à partir de ~250 appels IPC
 * instrumentés, les métriques `timing` du profiler (startup, DB) sont
 * intégralement évincées de cette fenêtre de 500 et le graphique par défaut
 * redevient vide. Enregistrer chaque appel aurait donc cassé le panneau
 * Performance pour réparer l'Inspector.
 *
 * `ipcMonitor` conserve de son côté *tous* les appels avec leur durée : c'est lui
 * qui alimente l'IPC Inspector. Rien n'est perdu pour le diagnostic ; seule la
 * série tracée est réduite à ce qui a une valeur de signal.
 *
 * 16 ms ≈ une frame à 60 Hz : en dessous, l'appel n'est pas perceptible.
 */
const SLOW_CALL_THRESHOLD_MS = 16;

/**
 * Reconnaît un échec renvoyé sous forme d'enveloppe `IPCResponse`.
 *
 * `createHandler` ne laisse jamais passer d'exception : il renvoie
 * `{ success: false, error }`. Sans cette lecture, tous les échecs de validation
 * et d'exécution seraient comptés comme des succès.
 *
 * La présence de `error` est exigée en plus de `success === false` : certains
 * handlers renvoient légitimement `{ success: false }` sans erreur (export de
 * logs annulé par l'utilisateur, par exemple), ce qui n'est pas un échec IPC.
 */
function isEnvelopeFailure(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;

  const candidate = result as { success?: unknown; error?: unknown };
  return candidate.success === false && candidate.error != null;
}

/**
 * Enveloppe un handler pour mesurer et enregistrer son passage.
 *
 * La direction enregistrée est `'send'` : c'est ce que le moniteur stocke pour
 * un appel venu du renderer, et `debug-handlers` le traduit déjà en
 * `'renderer->main'` (la valeur sur laquelle le panneau filtre). On ne produit
 * donc pas de seconde traduction ici.
 */
function instrument(channel: string, handler: AnyIpcHandler): AnyIpcHandler {
  return async (event: unknown, ...args: unknown[]) => {
    // Lu à chaque appel, pas capturé à l'enregistrement : le réglage peut être
    // basculé à l'exécution depuis le panneau debug.
    const recording = debugService.getSettings().enableIpcMonitoring;

    if (!recording) {
      return handler(event, ...args);
    }

    const startedAt = performance.now();
    let failed = false;

    try {
      const result = await handler(event, ...args);
      failed = isEnvelopeFailure(result);
      return result;
    } catch (error) {
      failed = true;
      // Le message d'erreur, pas le payload : il vient du code, pas des
      // données utilisateur.
      logger.warn('ipc-instrumentation', `IPC handler threw on ${channel}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      const duration = performance.now() - startedAt;

      // Tous les appels vont au moniteur : c'est la source de l'IPC Inspector,
      // qui a son propre tampon circulaire de 1000 entrées.
      ipcMonitor.recordMessage(channel, 'send', duration);

      // Le panneau Performance, lui, ne reçoit que les appels notables — cf.
      // SLOW_CALL_THRESHOLD_MS.
      if (failed || duration >= SLOW_CALL_THRESHOLD_MS) {
        // Le moniteur n'a pas de champ succès/échec. La distinction est portée
        // par le nom de la métrique, qui est ce que le panneau affiche.
        performanceMonitor.recordMetric(
          'ipc',
          failed ? `${channel} (failed)` : channel,
          duration,
          'ms'
        );
      }
    }
  };
}

/**
 * Exécute `register` avec `ipcMain.handle` instrumenté.
 *
 * Le patch est retiré dans un `finally` : il ne doit pas survivre à
 * l'enregistrement, sinon un `ipcMain.handle` appelé plus tard (test, plugin)
 * serait enveloppé à son insu. Les handlers déjà enregistrés, eux, restent
 * instrumentés — c'est le but.
 */
export function withIpcInstrumentation(register: () => void): void {
  const target = ipcMain as unknown as { handle: HandleFn };
  const original = target.handle;

  target.handle = function patchedHandle(channel: string, handler: AnyIpcHandler) {
    const effective = isExcluded(channel) ? handler : instrument(channel, handler);
    return original.call(ipcMain, channel, effective);
  } as HandleFn;

  try {
    register();
  } finally {
    target.handle = original;
  }
}

/** Exposés pour les tests, qui vérifient l'exclusion et la détection d'échec. */
export const __testing = { isExcluded, isEnvelopeFailure, SLOW_CALL_THRESHOLD_MS };
