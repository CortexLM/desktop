/**
 * Traductions des échecs du compte Cortex vers le vocabulaire de l'UI.
 *
 * Séparé du service : ce sont des fonctions pures sur des erreurs, et le
 * service est déjà occupé par le cycle de vie (fichier de session, écouteurs,
 * flux d'appareil).
 */

import {
  isCortexApiError,
  isCortexDeviceFlowError,
} from '@cortex-ide/cortex-api';
import type { CortexDeviceStatus } from '@cortex-ide/shared';

/**
 * Le jeton est-il refusé, plutôt que l'API injoignable ?
 *
 * La distinction décide s'il faut effacer la session au démarrage. La confondre
 * dans un sens déconnecte à chaque coupure réseau ; dans l'autre, elle laisse
 * une UI connectée dont chaque appel échoue. `CortexApiError.isAuthFailure`
 * porte déjà la règle (401, `AUTH_REQUIRED`, `INVALID_SESSION`).
 */
export function isAuthFailure(error: unknown): boolean {
  return isCortexApiError(error) && error.isAuthFailure;
}

/** Traduit l'échec d'un flux d'appareil vers le vocabulaire de l'UI. */
export function toDeviceStatus(error: unknown): CortexDeviceStatus {
  if (isCortexDeviceFlowError(error)) {
    if (error.code === 'access_denied') return { kind: 'denied' };
    if (error.code === 'expired_token') return { kind: 'expired' };
  }

  // Le service v1 a retiré les routes `/auth/*` : le démarrage répond en
  // problem+json `not_found`. C'est un changement de contrat côté serveur, pas
  // une panne — le dire tel quel, avec l'issue de secours qui marche.
  if (isCortexApiError(error) && error.code === 'not_found') {
    return {
      kind: 'error',
      message:
        'Sign-in is unavailable: the account service has retired this endpoint. ' +
        'Local sessions with your own provider key keep working from Settings.',
    };
  }

  return { kind: 'error', message: describeError(error) };
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
