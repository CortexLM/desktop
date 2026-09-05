/**
 * VNC signaling for a mascot computer.
 *
 * The ticket hash is never stored: it is a capability probe. When the service
 * also returns an https stream URL, that URL is what the computer rail embeds
 * (chrome-less noVNC). The renderer never sees a password.
 */

import { createSignal } from 'solid-js';

import { createVncTicket, isCortexApiError } from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import type { DesktopTransport } from '../screens/bot/computer-desktop.tsx';

export interface DesktopStream {
  transport: DesktopTransport;
  streamUrl?: string;
}

const [desktopTransport, setDesktopTransport] = createSignal<DesktopTransport>('screenshot');
const [streamUrl, setStreamUrl] = createSignal<string | undefined>();
const [streamOwner, setStreamOwner] = createSignal<string | undefined>();

export { desktopTransport, streamUrl };

export function attachDesktopStream(mascotId: string | undefined): void {
  if (streamOwner() === mascotId) return;
  setStreamOwner(mascotId);
  setDesktopTransport('screenshot');
  setStreamUrl(undefined);
}

export function streamUrlFor(mascotId: string | undefined): string | undefined {
  if (!mascotId || streamOwner() !== mascotId) return undefined;
  return streamUrl();
}

export async function requestDesktopStream(mascotId: string): Promise<DesktopStream> {
  const client = botClient();
  if (!client) return { transport: 'unavailable' };
  try {
    const ticket = await createVncTicket(client, mascotId);
    const url = httpsUrl(ticket.stream_url ?? ticket.embed_url);
    return applyStream(mascotId, { transport: url ? 'vnc' : 'unavailable', streamUrl: url });
  } catch (error) {
    return applyStreamError(mascotId, error);
  }
}

function stillOnStream(mascotId: string): boolean {
  return streamOwner() === mascotId;
}

function applyStream(mascotId: string, result: DesktopStream): DesktopStream {
  if (!stillOnStream(mascotId)) return result;
  setDesktopTransport(result.transport);
  setStreamUrl(result.streamUrl);
  return result;
}

function applyStreamError(mascotId: string, error: unknown): DesktopStream {
  if (!stillOnStream(mascotId)) return { transport: 'screenshot' };
  const missing = isCortexApiError(error) && error.code === 'not_found';
  const transport: DesktopTransport = missing ? 'unavailable' : 'screenshot';
  setDesktopTransport(transport);
  setStreamUrl(undefined);
  return { transport };
}

/** @deprecated Use requestDesktopStream. Kept for existing callers. */
export async function requestVncTicket(mascotId: string): Promise<string | undefined> {
  const result = await requestDesktopStream(mascotId);
  return result.streamUrl;
}

export async function probeDesktopTransport(mascotId: string): Promise<void> {
  await requestDesktopStream(mascotId);
}

export function resetDesktopTransportForTests(): void {
  setStreamOwner(undefined);
  setDesktopTransport('screenshot');
  setStreamUrl(undefined);
}

function httpsUrl(value?: string): string | undefined {
  if (!value) return undefined;
  return value.startsWith('https:') ? value : undefined;
}
