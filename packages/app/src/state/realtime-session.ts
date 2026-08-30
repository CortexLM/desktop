/**
 * One live-API session for the renderer: HTTP client + realtime socket + transport.
 *
 * Created only when `liveApiBase()` says the origin may call the API. Tests and
 * localhost keep the detached hosts so they never open a production guest session.
 */

import {
  CortexApiClient,
  createRealtimeSocket,
  createRealtimeSse,
  createStreamTransport,
  type RealtimeClient,
  type RealtimeStatus,
  type StreamTransport,
} from '@cortex-ide/cortex-api';

import { applyRealtimeEvent, setRealtimeStatus } from './realtime-bridge.ts';
import { liveApiBase } from './live-api.ts';
import { hasElectronHost } from './electron-bridge.ts';
import { ipcProductFetch } from './ipc-fetch.ts';
import { CORTEX_API_BASE_URL } from '@cortex-ide/cortex-api';

export interface LiveSession {
  client: CortexApiClient;
  realtime: RealtimeClient;
  transport: StreamTransport;
}

let session: LiveSession | undefined;

export function liveSession(): LiveSession | undefined {
  const baseUrl = sessionBaseUrl();
  if (!baseUrl) return undefined;
  if (!session) {
    const fetchImpl = hasElectronHost() ? ipcProductFetch : undefined;
    const client = new CortexApiClient({ baseUrl, fetch: fetchImpl });
    const realtime = createRealtimeSocket({ baseUrl });
    session = { client, realtime, transport: createStreamTransport(realtime, client) };
  }
  return session;
}

/** Web uses the Vite/origin base. Electron uses main as the fetch, same URL. */
function sessionBaseUrl(): string | undefined {
  return liveApiBase() ?? (hasElectronHost() ? CORTEX_API_BASE_URL : undefined);
}

export async function bootLiveRealtime(): Promise<void> {
  const current = liveSession();
  if (!current) return;
  current.realtime.subscribe(applyRealtimeEvent);
  setRealtimeStatus('connecting');
  const socketStatus = await current.realtime.connect();
  setRealtimeStatus(socketStatus === 'connected' ? socketStatus : await attachSseFallback(current));
}

/** GET /v1/realtime/events when the WebSocket is down. Owner room only. */
async function attachSseFallback(current: LiveSession): Promise<RealtimeStatus> {
  const sse = createRealtimeSse(current.client);
  sse.subscribe(applyRealtimeEvent);
  const status = await sse.connect();
  if (status === 'connected' && session) {
    session.realtime = sse;
    session.transport = createStreamTransport(sse, current.client);
  }
  return status;
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
  current.transport.send(botTurnPayload(mascotId, message));
  return true;
}

/** The client never attaches a loop cap. The farm runs until the mascot is done. */
export function botTurnPayload(mascotId: string, message: string) {
  return { type: 'bot.turn' as const, mascot_id: mascotId, message };
}
