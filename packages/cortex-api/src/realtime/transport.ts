/**
 * Prefer GET /v1/realtime (writable WS). SSE is listen-only; Chat turns then
 * use POST /v1/conversations[/id]/turns. Code/Bot still need the socket.
 */

import type { CortexApiClient } from '../client.ts';
import { streamConversationTurn } from '../product.ts';
import {
  eventFromTurnFrame,
  type RealtimeClient,
  type RealtimeClientMessage,
  type RealtimeEvent,
} from './events.ts';
import { isConnectionLocalType } from './rooms.ts';

export type StreamChannel = 'realtime' | 'sse' | 'http' | 'none';

export interface StreamTransport {
  readonly channel: () => StreamChannel;
  subscribe: (handler: (event: RealtimeEvent) => void) => () => void;
  streamChat: (
    message: string,
    conversationId?: string,
  ) => AsyncGenerator<RealtimeEvent, void, undefined>;
  send: (message: RealtimeClientMessage) => void;
}

export function createStreamTransport(
  realtime: RealtimeClient,
  http?: CortexApiClient,
): StreamTransport {
  return {
    channel: () => channelOf(realtime, http),
    subscribe: (handler) => realtime.subscribe(handler),
    streamChat: (message, conversationId) => streamChatTurn(realtime, http, message, conversationId),
    send: (message) => realtime.send(message),
  };
}

function channelOf(realtime: RealtimeClient, http?: CortexApiClient): StreamChannel {
  if (realtime.status === 'connected' && realtime.writable) return 'realtime';
  if (realtime.status === 'connected') return 'sse';
  return http ? 'http' : 'none';
}

function canSendOn(realtime: RealtimeClient): boolean {
  return realtime.status === 'connected' && realtime.writable;
}

async function* streamChatTurn(
  realtime: RealtimeClient,
  http: CortexApiClient | undefined,
  message: string,
  conversationId?: string,
): AsyncGenerator<RealtimeEvent, void, undefined> {
  if (canSendOn(realtime)) {
    yield* streamOverSocket(realtime, message, conversationId);
    return;
  }
  if (!http) return;
  yield* streamOverHttp(http, message, conversationId);
}

async function* streamOverSocket(
  realtime: RealtimeClient,
  message: string,
  conversationId?: string,
): AsyncGenerator<RealtimeEvent, void, undefined> {
  const requestId = `turn_${Date.now().toString(36)}`;
  const pending: RealtimeEvent[] = [];
  let done = false;
  const release = realtime.subscribe((event) => {
    if (isConnectionLocalType(event.type)) return;
    if (event.request_id && event.request_id !== requestId) return;
    if (conversationId && event.conversation_id && event.conversation_id !== conversationId) return;
    pending.push(event);
    if (event.type === 'chat.done') done = true;
  });

  realtime.send({ type: 'chat.turn', request_id: requestId, conversation_id: conversationId, message });

  try {
    while (!done || pending.length > 0) {
      const next = pending.shift();
      if (next) {
        yield next;
        continue;
      }
      await wait(16);
    }
  } finally {
    release();
  }
}

async function* streamOverHttp(
  http: CortexApiClient,
  message: string,
  conversationId?: string,
): AsyncGenerator<RealtimeEvent, void, undefined> {
  let ids: { conversationId?: string; messageId?: string } = { conversationId };
  for await (const frame of streamConversationTurn(http, { message, conversationId })) {
    if (frame.type === 'turn_started') {
      ids = {
        conversationId: frame.conversation_id ?? conversationId,
        messageId: frame.message_id,
      };
    }
    const event = eventFromTurnFrame(frame, ids);
    if (event) yield event;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
