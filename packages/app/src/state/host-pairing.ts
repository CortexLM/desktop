/**
 * Host pairing code is shown once. The service stores a hash; this client
 * never persists the code or any hash. A live 404 stays `not_found`.
 */

import { isCortexApiError, pairCodeHost } from '@cortex-ide/cortex-api';

import { liveSession } from './realtime-session.ts';

let held: string | undefined;

export async function requestHostPairing(): Promise<string | undefined> {
  const live = liveSession();
  if (!live) return undefined;
  try {
    const pairing = await pairCodeHost(live.client);
    rememberPairingCode(pairing.pairing_code);
    return pairing.pairing_code;
  } catch (error) {
    if (isCortexApiError(error) && error.code === 'not_found') return undefined;
    return undefined;
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
