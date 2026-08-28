/**
 * Schemas for the v1 product surface observed on 2026-08-28.
 *
 * Conversation turns, guest sessions, and project lists were read from
 * api.cortex.foundation. Realtime, Bot, Planning, Library, Plugins, and Code
 * hosts were not reachable yet — those shapes are typed here so a mock and the
 * live client share one interface, and unknown keys pass through.
 */

import { z } from 'zod';

export const guestSessionSchema = z
  .object({
    kind: z.string(),
    user_id: z.string(),
  })
  .passthrough();

export type GuestSession = z.infer<typeof guestSessionSchema>;

export const quotaSchema = z
  .object({
    key: z.string(),
    used: z.number(),
    limit: z.number(),
    resets_at: z.string().optional(),
  })
  .passthrough();

export type Quota = z.infer<typeof quotaSchema>;

export const listEnvelopeSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item),
      has_more: z.boolean().optional(),
    })
    .passthrough();

export const conversationSummarySchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    last_message_at: z.string().optional(),
    model_slug: z.string().optional(),
    message_count: z.number().optional(),
  })
  .passthrough();

export type ApiConversation = z.infer<typeof conversationSummarySchema>;

export const conversationListSchema = listEnvelopeSchema(conversationSummarySchema);

export const conversationMessageSchema = z
  .object({
    id: z.string(),
    role: z.string(),
    text: z.string().optional(),
    created_at: z.string().optional(),
    model_name: z.string().optional(),
  })
  .passthrough();

export type ApiConversationMessage = z.infer<typeof conversationMessageSchema>;

export const conversationMessageListSchema = listEnvelopeSchema(conversationMessageSchema);

export const projectSummarySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough();

export type ApiProject = z.infer<typeof projectSummarySchema>;

export const projectListSchema = listEnvelopeSchema(projectSummarySchema);

/** Observed SSE `data:` payloads from POST /v1/conversations[/id]/turns. */
export const turnEventSchema = z
  .object({
    type: z.string(),
    message_id: z.string().optional(),
    conversation_id: z.string().optional(),
    delta: z.string().optional(),
    text: z.string().optional(),
    reason: z.string().optional(),
    blocking: z.boolean().optional(),
    finish_reason: z.string().optional(),
    duration_ms: z.number().optional(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    cached_tokens: z.number().optional(),
    reasoning_tokens: z.number().nullish(),
  })
  .passthrough();

export type TurnEvent = z.infer<typeof turnEventSchema>;

export const turnStartedSchema = z.object({
  type: z.literal('turn_started'),
  conversation_id: z.string().optional(),
  message_id: z.string().optional(),
});

export type TurnStarted = z.infer<typeof turnStartedSchema>;
