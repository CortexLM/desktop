/**
 * Browser/Node WebSocket client for GET /v1/realtime.
 *
 * Authentication is the HTTP cookie the browser already holds on a
 * cortex.foundation origin. Custom headers cannot be set on the constructor, and
 * secrets are never placed on the query string. Node tests inject `WebSocket`.
 *
 * When the route is missing the socket fails fast and reports `unavailable`.
 */

import { CortexApiError } from '../errors.ts';
import {
  realtimeEventSchema,
  type RealtimeClient,
  type RealtimeClientMessage,
  type RealtimeEvent,
  type RealtimeStatus,
} from './events.ts';
import { realtimeUrl } from './url.ts';

export interface BrowserWebSocket {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: (type: string, listener: (event: { data?: unknown }) => void) => void;
}

export type WebSocketCtor = new (url: string) => BrowserWebSocket;

export interface RealtimeSocketOptions {
  baseUrl: string;
  WebSocket?: WebSocketCtor;
  connectTimeoutMs?: number;
}

interface SocketState {
  status: RealtimeStatus;
  socket?: BrowserWebSocket;
  handlers: Set<(event: RealtimeEvent) => void>;
}

export function createRealtimeSocket(options: RealtimeSocketOptions): RealtimeClient {
  const state: SocketState = { status: 'idle', handlers: new Set() };

  return {
    get status() {
      return state.status;
    },
    connect: () => openSocket(options, state),
    disconnect: () => {
      state.socket?.close();
      state.socket = undefined;
      if (state.status !== 'unavailable') state.status = 'disconnected';
    },
    subscribe: (handler) => {
      state.handlers.add(handler);
      return () => state.handlers.delete(handler);
    },
    send: (message: RealtimeClientMessage) => sendOn(state, message),
  };
}

function sendOn(state: SocketState, message: RealtimeClientMessage): void {
  if (!state.socket || state.status !== 'connected') {
    throw new CortexApiError('REALTIME_NOT_CONNECTED', 'The realtime socket is not connected', {
      status: 0,
      route: 'WS /v1/realtime',
    });
  }
  state.socket.send(JSON.stringify(message));
}

async function openSocket(
  options: RealtimeSocketOptions,
  state: SocketState,
): Promise<RealtimeStatus> {
  const Ctor = options.WebSocket ?? (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  if (!Ctor) {
    state.status = 'unavailable';
    return 'unavailable';
  }

  state.status = 'connecting';
  try {
    const socket = new Ctor(realtimeUrl(options.baseUrl));
    state.socket = socket;
    listen(socket, state);
    state.status = await waitForOpen(socket, options.connectTimeoutMs ?? 4_000);
    if (state.status !== 'connected') state.socket = undefined;
    return state.status;
  } catch {
    state.socket = undefined;
    state.status = 'unavailable';
    return 'unavailable';
  }
}

function listen(socket: BrowserWebSocket, state: SocketState): void {
  socket.addEventListener('message', (event) => {
    const parsed = parseSocketData(event.data);
    if (!parsed) return;
    for (const handler of state.handlers) handler(parsed);
  });
  socket.addEventListener('close', () => {
    state.socket = undefined;
    if (state.status === 'connected') state.status = 'disconnected';
  });
}

function parseSocketData(data: unknown): RealtimeEvent | undefined {
  if (typeof data !== 'string') return undefined;
  try {
    const parsed = realtimeEventSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function waitForOpen(socket: BrowserWebSocket, timeoutMs: number): Promise<RealtimeStatus> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (next: RealtimeStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(next);
    };
    const timer = setTimeout(() => {
      socket.close();
      finish('unavailable');
    }, timeoutMs);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'hello' }));
      finish('connected');
    });
    socket.addEventListener('error', () => finish('unavailable'));
    socket.addEventListener('close', () => finish('unavailable'));
  });
}
