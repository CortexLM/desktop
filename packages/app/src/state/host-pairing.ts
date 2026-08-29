/**
 * Host pairing code is shown once. The service stores a hash; this client
 * never persists the code or any hash. A live 404 stays `not_found`.
 */

import { pairCodeHost } from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import { isRouteMissing } from './surface-error.ts';

let held: string | undefined;

/**
 * Asks the service for a pairing code.
 *
 * `undefined` means only one thing: this backend has no pairing route. Every other
 * failure is rethrown, because it previously collapsed every error into `undefined`
 * and the caller reported all of them as "pairing is not available" — including a
 * network drop, which is neither true nor actionable.
 */
export async function requestHostPairing(): Promise<string | undefined> {
  const client = botClient();
  if (!client) return undefined;
  try {
    const pairing = await pairCodeHost(client);
    rememberPairingCode(pairing.pairing_code);
    return pairing.pairing_code;
  } catch (error) {
    if (isRouteMissing(error)) return undefined;
    throw error;
  }
}

/** Hold a code in memory only. Never write it to persist or logs. */
export function rememberPairingCode(code: string): void {
  held = code;
}

/** Returns the code and forgets it. A second call is empty. */
export function consumePairingCode(): string | undefined {
  const code = held;
  held = undefined;
  return code;
}

export function resetHostPairing(): void {
  held = undefined;
}
