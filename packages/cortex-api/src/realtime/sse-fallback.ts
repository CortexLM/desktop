/**
 * GET /v1/realtime/events — SSE fallback when the WebSocket is down.
 *
 * Same JSON frames as the socket, owner-room only (Chat tokens fan out there).
 * Client-to-server subscribe/send is not available on this path; Chat turns
 * stay on POST /v1/conversations/{id}/turns. A live 404 is `not_found`.
 */

import type { CortexApiClient } from '../client.ts';
import { CortexApiError } from '../errors.ts';
import { readEventStream } from '../sse.ts';
import {
  realtimeEventSchema,
  type RealtimeClient,
  type RealtimeClientMessage,
  type RealtimeEvent,
  type RealtimeStatus,
} from './events.ts';
import { REALTIME_EVENTS_PATH } from './rooms.ts';

export function createRealtimeSse(client: CortexApiClient): RealtimeClient {
  const handlers = new Set<(event: RealtimeEvent) => void>();
  let status: RealtimeStatus = 'idle';
  let abort: AbortController | undefined;

  return {
    get status() {
      return status;
    },
    connect: () => openSse(client, handlers, (next) => {
      status = next;
    }, (controller) => {
      abort = controller;
    }),
    disconnect: () => {
      abort?.abort();
      abort = undefined;
      if (status !== 'unavailable') status = 'disconnected';
    },
    subscribe: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    send: (_message: RealtimeClientMessage) => {
      throw new CortexApiError(
        'REALTIME_SSE_READONLY',
        'The SSE fallback is listen-only; send over the WebSocket or HTTP turns',
        { status: 0, route: `GET ${REALTIME_EVENTS_PATH}` },
      );
    },
    join: () => {
      // Owner room only on SSE. Optional rooms need the socket.
    },
    leave: () => {},
  };
}

async function openSse(
  client: CortexApiClient,
  handlers: Set<(event: RealtimeEvent) => void>,
  setStatus: (status: RealtimeStatus) => void,
  setAbort: (controller: AbortController) => void,
): Promise<RealtimeStatus> {
  const controller = new AbortController();
  setAbort(controller);
  setStatus('connecting');
  try {
    const response = await client.open(REALTIME_EVENTS_PATH, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!response.body) {
      setStatus('unavailable');
      return 'unavailable';
    }
    setStatus('connected');
    void pumpSse(response.body, handlers, setStatus, controller.signal);
    return 'connected';
  } catch (error) {
    setStatus(error instanceof CortexApiError && error.code === 'not_found' ? 'unavailable' : 'disconnected');
    return 'unavailable';
  }
}

async function pumpSse(
  body: ReadableStream<Uint8Array>,
  handlers: Set<(event: RealtimeEvent) => void>,
  setStatus: (status: RealtimeStatus) => void,
  signal: AbortSignal,
): Promise<void> {
  try {
    for await (const frame of readEventStream(body)) {
      if (signal.aborted) break;
      const parsed = realtimeEventSchema.safeParse(frame);
      if (!parsed.success) continue;
      for (const handler of handlers) handler(parsed.data);
    }
  } finally {
    setStatus('disconnected');
  }
}

