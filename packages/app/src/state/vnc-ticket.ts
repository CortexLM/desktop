/**
 * VNC signaling ticket for a mascot computer. Hash only — never a password.
 * A live 404 stays `not_found` and the wake remains failed.
 */

import { createSignal } from 'solid-js';

import { createVncTicket, isCortexApiError } from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import type { DesktopTransport } from '../screens/bot/computer-desktop.tsx';

export async function requestVncTicket(mascotId: string): Promise<string | undefined> {
  const client = botClient();
  if (!client) return undefined;
  try {
    const ticket = await createVncTicket(client, mascotId);
    return ticket.ticket_hash;
  } catch (error) {
    if (isCortexApiError(error) && error.code === 'not_found') return undefined;
    return undefined;
  }
}

/**
 * Which delivery the Computer screen should describe.
 *
 * Starts at `screenshot`, which is the path that always works: poll a frame, send
 * input back. `probeDesktopTransport` then asks whether the service will issue a
 * signalling ticket for this box, and the label changes accordingly.
 *
 * The ticket hash is deliberately not kept. Nothing in this client can consume it
 * yet — the relay's protocol is not in CONTRACT.md — so holding it would be storing
 * a credential for a connection we do not make. What the screen needs is the
 * *capability*, and that is a boolean.
 */
const [desktopTransport, setDesktopTransport] = createSignal<DesktopTransport>('screenshot');

export { desktopTransport };

export async function probeDesktopTransport(mascotId: string): Promise<void> {
  const ticket = await requestVncTicket(mascotId);
  setDesktopTransport(ticket ? 'vnc' : 'unavailable');
}

export function resetDesktopTransportForTests(): void {
  setDesktopTransport('screenshot');
}
