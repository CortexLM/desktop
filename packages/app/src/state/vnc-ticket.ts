/**
 * VNC signalling for a mascot computer. Hash plus an optional stream URL —
 * never a password. A live 404 stays `not_found`.
 */

import { createSignal } from 'solid-js';

import { createVncTicket, isCortexApiError, type VncTicket } from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import type { BotComputer } from './bot-map.ts';
import type { DesktopTransport } from '../screens/bot/computer-desktop.tsx';

const [desktopTransport, setDesktopTransport] = createSignal<DesktopTransport>('screenshot');
const [streamUrl, setStreamUrl] = createSignal<string | undefined>();

export { desktopTransport, streamUrl };

export async function requestVncTicket(mascotId: string): Promise<VncTicket | undefined> {
  const client = botClient();
  if (!client) return undefined;
  try {
    return await createVncTicket(client, mascotId);
  } catch (error) {
    if (isCortexApiError(error) && error.code === 'not_found') return undefined;
    return undefined;
  }
}

/**
 * Screenshot is the path that always works. A ticket with a stream URL is a
 * live noVNC page. A ticket without a URL is still a live box — we say so,
 * and keep polling frames until the farm mints a page.
 */
export async function probeDesktopTransport(mascotId: string): Promise<void> {
  const ticket = await requestVncTicket(mascotId);
  if (!ticket) {
    setStreamUrl(undefined);
    setDesktopTransport('unavailable');
    return;
  }
  applyStream(ticket.stream_url, ticket.ticket_hash ? 'vnc' : 'unavailable');
}

/** Prefer a stream URL the computer row already carries. */
export function syncDesktopStream(computer: BotComputer): void {
  if (computer.streamUrl) {
    applyStream(computer.streamUrl, 'novnc');
    return;
  }
  if (computer.status !== 'running') {
    setStreamUrl(undefined);
    setDesktopTransport('screenshot');
  }
}

function applyStream(url: string | undefined, withoutUrl: DesktopTransport): void {
  if (url) {
    setStreamUrl(url);
    setDesktopTransport('novnc');
    return;
  }
  setStreamUrl(undefined);
  setDesktopTransport(withoutUrl);
}

export function resetDesktopTransportForTests(): void {
  setDesktopTransport('screenshot');
  setStreamUrl(undefined);
}
