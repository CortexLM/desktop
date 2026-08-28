/**
 * Typed envelopes for authenticated `/v1/realtime` and the HTTP turn fallback.
 *
 * The WebSocket route was not deployed when this was written (GET/WS → 404).
 * Event names below match the product lock (Chat tokens, Code tools/permissions,
 * Bot ask-user, notifications) and the SSE types already observed on
 * POST /v1/conversations/turns. Extra keys pass through.
 */

import { z } from 'zod';

export const REALTIME_PATH = '/v1/realtime';

export const realtimeEventTypes = [
  'hello',
  'heartbeat',
  'subscribed',
  'error',
  'chat.started',
  'chat.token',
  'chat.reasoning',
  'chat.disclosure',
  'chat.done',
  'chat.usage',
  'code.tool',
  'code.permission',
  'code.run',
  'bot.ask_user',
  'bot.token',
  'bot.done',
  'token',
  'tool_call',
  'tool_result',
  'send_to_user',
  'ask_user',
  'computer_offline',
  'bot.tool_call',
  'bot.tool_result',
  'bot.send_to_user',
  'bot.computer_offline',
  'bot.routine',
  'notification',
  'farm.wake_fail',
] as const;

export type RealtimeEventType = (typeof realtimeEventTypes)[number];

export const realtimeEventSchema = z
  .object({
    type: z.string(),
    request_id: z.string().optional(),
    conversation_id: z.string().optional(),
    session_id: z.string().optional(),
    mascot_id: z.string().optional(),
    message_id: z.string().optional(),
    delta: z.string().optional(),
    text: z.string().optional(),
    message: z.string().optional(),
    href: z.string().optional(),
    kind: z.string().optional(),
    tool: z.string().optional(),
    tool_input: z.unknown().optional(),
    tool_output: z.unknown().optional(),
    attachments: z.unknown().optional(),
    ask_id: z.string().optional(),
    secret_name: z.string().optional(),
    request_permission_id: z.string().optional(),
    decision: z.string().optional(),
    status: z.string().optional(),
    finish_reason: z.string().optional(),
    room: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough();

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export const realtimeClientMessageSchema = z
  .object({
    type: z.string(),
    request_id: z.string().optional(),
    conversation_id: z.string().optional(),
    session_id: z.string().optional(),
    mascot_id: z.string().optional(),
    message: z.string().optional(),
    model: z.string().optional(),
    request_permission_id: z.string().optional(),
    decision: z.enum(['allow', 'always', 'deny']).optional(),
    room: z.string().optional(),
  })
  .passthrough();

export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'unavailable';

export interface RealtimeClient {
  readonly status: RealtimeStatus;
  /** False for the SSE listen-only fallback. Chat turns then use HTTP. */
  readonly writable: boolean;
  connect: () => Promise<RealtimeStatus>;
  disconnect: () => void;
  subscribe: (handler: (event: RealtimeEvent) => void) => () => void;
  send: (message: RealtimeClientMessage) => void;
  /** Optional room. A miss comes back as connection-local `error` / `not_found`. */
  join: (room: string) => void;
  leave: (room: string) => void;
}

const TURN_TO_REALTIME: Record<string, RealtimeEventType> = {
  text_delta: 'chat.token',
  reasoning_delta: 'chat.reasoning',
  disclosure: 'chat.disclosure',
  done: 'chat.done',
  usage: 'chat.usage',
  turn_started: 'chat.started',
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Maps an observed HTTP SSE turn frame onto the realtime envelope. */
export function eventFromTurnFrame(
  frame: unknown,
  ids: { conversationId?: string; messageId?: string },
): RealtimeEvent | undefined {
  if (typeof frame !== 'object' || frame === null) return undefined;
  const row = frame as Record<string, unknown>;
  const mapped = asString(row.type) ? TURN_TO_REALTIME[asString(row.type)!] : undefined;
  if (!mapped) return undefined;
  return {
    type: mapped,
    conversation_id: asString(row.conversation_id) ?? ids.conversationId,
    message_id: asString(row.message_id) ?? ids.messageId,
    delta: asString(row.delta),
    text: asString(row.text),
    finish_reason: asString(row.finish_reason),
  };
}
