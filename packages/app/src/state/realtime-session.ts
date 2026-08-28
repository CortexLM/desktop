/**
 * One live-API session for the renderer: HTTP client + realtime socket + transport.
 *
 * Created only when `liveApiBase()` says the origin may call the API. Tests and
 * localhost keep the detached hosts so they never open a production guest session.
 */

import {
  CortexApiClient,
  createRealtimeSocket,
  createStreamTransport,
  type RealtimeClient,
  type StreamTransport,
} from '@cortex-ide/cortex-api';

import { applyRealtimeEvent, setRealtimeStatus } from './realtime-bridge.ts';
import { liveApiBase } from './live-api.ts';

export interface LiveSession {
  client: CortexApiClient;
  realtime: RealtimeClient;
  transport: StreamTransport;
}

let session: LiveSession | undefined;

export function liveSession(): LiveSession | undefined {
  const baseUrl = liveApiBase();
  if (!baseUrl) return undefined;
  if (!session) {
    const client = new CortexApiClient({ baseUrl });
    const realtime = createRealtimeSocket({ baseUrl });
    session = { client, realtime, transport: createStreamTransport(realtime, client) };
  }
  return session;
}

export async function bootLiveRealtime(): Promise<void> {
  const current = liveSession();
  if (!current) return;
  current.realtime.subscribe(applyRealtimeEvent);
  setRealtimeStatus('connecting');
  setRealtimeStatus(await current.realtime.connect());
}

/** Test-only: drop the singleton so the next call rebuilds. */
export function resetLiveSession(): void {
  session?.realtime.disconnect();
  session = undefined;
}

/** True when the Bot turn went out on the socket. False means stay on local UI. */
export function sendBotTurn(mascotId: string, message: string): boolean {
  const current = liveSession();
  if (!current || current.transport.channel() !== 'realtime') return false;
  current.transport.send({ type: 'bot.turn', mascot_id: mascotId, message });
  return true;
}
