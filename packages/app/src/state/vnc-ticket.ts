/**
 * VNC signaling ticket for a mascot computer. Hash only — never a password.
 * A live 404 stays `not_found` and the wake remains failed.
 */

import { createVncTicket, isCortexApiError } from '@cortex-ide/cortex-api';

import { liveSession } from './realtime-session.ts';

export async function requestVncTicket(mascotId: string): Promise<string | undefined> {
  const live = liveSession();
  if (!live) return undefined;
  try {
    const ticket = await createVncTicket(live.client, mascotId);
    return ticket.ticket_hash;
  } catch (error) {
    if (isCortexApiError(error) && error.code === 'not_found') return undefined;
    return undefined;
  }
}
