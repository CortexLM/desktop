/**
 * Accès à l'API preload et normalisation des réponses IPC.
 *
 * Toutes les façades de domaine passent par ici : `getAPI()` pour atteindre le
 * bridge preload, `unwrapResponse()` pour convertir une `IPCResponse` en valeur
 * ou en exception.
 */

import type { CortexAPI } from '../../../../preload/src/index';
import type { IPCResponse } from '@cortex-ide/shared';

/**
 * Erreur levée lorsqu'un handler IPC répond en échec.
 *
 * `code` reprend le `ErrorCode` du process main, ce qui permet au renderer de
 * réagir différemment selon la cause (fichier absent, permission, ...).
 */
export class IPCError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'IPCError';
  }
}

/**
 * Récupère le bridge preload exposé sur `window.cortex`
 *
 * @throws {Error} si le preload n'a pas été chargé
 */
export function getAPI(): CortexAPI {
  if (!window.cortex) {
    throw new Error('Cortex API not available. Make sure preload script is loaded.');
  }
  return window.cortex;
}

/**
 * Déballe une réponse IPC.
 *
 * @throws {IPCError} si la réponse est un échec
 */
export function unwrapResponse<T>(response: IPCResponse<T>): T {
  if (response.success) {
    return response.data;
  }

  throw new IPCError(response.error.code, response.error.message, response.error.details);
}
