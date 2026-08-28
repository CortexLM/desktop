/**
 * Product HTTP routes: guest session, conversations, projects.
 *
 * Conversation turns stream as SSE from POST /v1/conversations/turns (create)
 * and POST /v1/conversations/:id/turns (follow-up). Observed 2026-08-28.
 * Bot / Planning / Code-host routes are not on the live service yet — those
 * methods 404 honestly and the mock transport covers them.
 */

import type { CortexApiClient } from './client.ts';
import { guestTokenFromSetCookie } from './cookies.ts';
import { unknownSchema } from './schemas.ts';
import {
  conversationListSchema,
  conversationMessageListSchema,
  guestSessionSchema,
  projectListSchema,
  projectSummarySchema,
  turnEventSchema,
  type ApiConversation,
  type ApiConversationMessage,
  type ApiProject,
  type GuestSession,
  type TurnEvent,
} from './product-schemas.ts';
import { readEventStream } from './sse.ts';

export async function startGuestSession(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<GuestSession> {
  const response = await client.open('/v1/auth/guest', {
    method: 'POST',
    body: {},
    anonymous: true,
    signal,
  });
  const session = await client.readJson(response, guestSessionSchema, 'POST /v1/auth/guest');
  const token = guestTokenFromSetCookie(response.headers.get('set-cookie'));
  if (token) client.applyGuestToken(token);
  return session;
}

export async function listConversations(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiConversation[]> {
  const list = await client.request('/v1/conversations', conversationListSchema, { signal });
  return list.items;
}

export async function listConversationMessages(
  client: CortexApiClient,
  conversationId: string,
  signal?: AbortSignal,
): Promise<ApiConversationMessage[]> {
  const path = `/v1/conversations/${encodeURIComponent(conversationId)}/messages`;
  const list = await client.request(path, conversationMessageListSchema, { signal });
  return list.items;
}

export async function deleteConversation(
  client: CortexApiClient,
  conversationId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(
    `/v1/conversations/${encodeURIComponent(conversationId)}`,
    unknownSchema,
    { method: 'DELETE', signal },
  );
}

export async function listProjects(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiProject[]> {
  const list = await client.request('/v1/projects', projectListSchema, { signal });
  return list.items;
}

export async function createProject(
  client: CortexApiClient,
  name: string,
  signal?: AbortSignal,
): Promise<ApiProject> {
  return client.request('/v1/projects', projectSummarySchema, {
    method: 'POST',
    body: { name },
    signal,
  });
}

export interface StreamTurnRequest {
  message: string;
  conversationId?: string;
}

/**
 * Streams one HTTP turn. The first yielded value is `turn_started` with ids
 * from `x-conversation-id` / `x-message-id` when the service sent them.
 */
export async function* streamConversationTurn(
  client: CortexApiClient,
  body: StreamTurnRequest,
  signal?: AbortSignal,
): AsyncGenerator<TurnEvent, void, undefined> {
  const path = body.conversationId
    ? `/v1/conversations/${encodeURIComponent(body.conversationId)}/turns`
    : '/v1/conversations/turns';
  const response = await client.open(path, {
    method: 'POST',
    body: { message: body.message },
    headers: { Accept: 'text/event-stream' },
    signal,
  });

  yield {
    type: 'turn_started',
    conversation_id: response.headers.get('x-conversation-id') ?? undefined,
    message_id: response.headers.get('x-message-id') ?? undefined,
  };

  if (!response.body) return;
  for await (const frame of readEventStream(response.body)) {
    const parsed = turnEventSchema.safeParse(frame);
    if (parsed.success) yield parsed.data;
  }
}
