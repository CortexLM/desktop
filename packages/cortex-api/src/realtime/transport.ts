/**
 * Prefer the realtime socket; fall back to HTTP conversation turns.
 *
 * Chat tokens, Code permissions, Bot ask-user, and notifications arrive on the
 * socket when it is connected. HTTP POST /v1/conversations[/id]/turns is the
 * observed fallback for Chat. Code/Bot streams have no HTTP route yet — those
 * stay on the socket or the local mock, never a fake harness in the browser.
 */

import type { CortexApiClient } from '../client.ts';
import { streamConversationTurn } from '../product.ts';
import {
  eventFromTurnFrame,
  type RealtimeClient,
  type RealtimeClientMessage,
  type RealtimeEvent,
} from './events.ts';

export interface StreamTransport {
  readonly channel: () => 'realtime' | 'http' | 'none';
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
    channel: () => {
      if (realtime.status === 'connected') return 'realtime';
      if (http) return 'http';
      return 'none';
    },
    subscribe: (handler) => realtime.subscribe(handler),
    streamChat: (message, conversationId) => streamChatTurn(realtime, http, message, conversationId),
    send: (message) => realtime.send(message),
  };
}

async function* streamChatTurn(
  realtime: RealtimeClient,
  http: CortexApiClient | undefined,
  message: string,
  conversationId?: string,
): AsyncGenerator<RealtimeEvent, void, undefined> {
  if (realtime.status === 'connected') {
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
    if (event.request_id && event.request_id !== requestId) return;
    if (conversationId && event.conversation_id && event.conversation_id !== conversationId) return;
    pending.push(event);
    if (event.type === 'chat.done' || event.type === 'error') done = true;
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
