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

export { desktopTransport, streamUrl };

export async function requestDesktopStream(mascotId: string): Promise<DesktopStream> {
  const client = botClient();
  if (!client) return { transport: 'unavailable' };
  try {
    const ticket = await createVncTicket(client, mascotId);
    const url = httpsUrl(ticket.stream_url ?? ticket.embed_url);
    const transport: DesktopTransport = url ? 'vnc' : 'unavailable';
    setDesktopTransport(transport);
    setStreamUrl(url);
    return { transport, streamUrl: url };
  } catch (error) {
    if (isCortexApiError(error) && error.code === 'not_found') {
      setDesktopTransport('unavailable');
      setStreamUrl(undefined);
      return { transport: 'unavailable' };
    }
    setDesktopTransport('screenshot');
    setStreamUrl(undefined);
    return { transport: 'screenshot' };
  }
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
  setDesktopTransport('screenshot');
  setStreamUrl(undefined);
}

function httpsUrl(value?: string): string | undefined {
  if (!value) return undefined;
  return value.startsWith('https:') ? value : undefined;
}
