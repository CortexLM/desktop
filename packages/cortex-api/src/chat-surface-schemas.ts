/**
 * Shapes for the Chat surfaces beyond conversations: Planning, Library,
 * project sources, Research, and account preferences.
 *
 * `/v1/projects` is live (see `product-schemas.ts`). The rest answered 404 on
 * the public deployment when this was written, so fields stay optional and a
 * 404 surfaces as "not on this backend" rather than as an empty account.
 */

import { z } from 'zod';

import { listEnvelopeSchema } from './product-schemas.ts';
import { planningTaskRowSchema, type ApiPlanningTask } from './pending-schemas.ts';

export { planningTaskRowSchema };
export type { ApiPlanningTask };

/**
 * One run of a scheduled task.
 *
 * `conversation_id` is what turns a finished run into something openable: the
 * result is a real conversation, not a toast the client made up.
 */
export const planningRunSchema = z
  .object({
    id: z.string(),
    task_id: z.string().optional(),
    status: z.string().optional(),
    conversation_id: z.string().optional(),
    message: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type ApiPlanningRun = z.infer<typeof planningRunSchema>;
export const planningRunListSchema = listEnvelopeSchema(planningRunSchema);

export const libraryItemDetailSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    kind: z.string().optional(),
    excerpt: z.string().optional(),
    conversation_id: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type ApiLibraryItemDetail = z.infer<typeof libraryItemDetailSchema>;

export const projectDetailSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    title: z.string().optional(),
    brief: z.string().optional(),
    updated_at: z.string().optional(),
    source_count: z.number().optional(),
  })
  .passthrough();

export type ApiProjectDetail = z.infer<typeof projectDetailSchema>;

export const projectSourceSchema = z
  .object({
    id: z.string(),
    label: z.string().optional(),
    kind: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();

export type ApiProjectSource = z.infer<typeof projectSourceSchema>;
export const projectSourceListSchema = listEnvelopeSchema(projectSourceSchema);

/** A deep-research run: a question, then sources and a report. */
export const researchTaskSchema = z
  .object({
    id: z.string(),
    question: z.string().optional(),
    status: z.string().optional(),
    conversation_id: z.string().optional(),
    source_count: z.number().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type ApiResearchTask = z.infer<typeof researchTaskSchema>;
export const researchTaskListSchema = listEnvelopeSchema(researchTaskSchema);

/**
 * Account-level Chat preferences.
 *
 * Server-held rather than per-browser so the same account behaves the same way
 * in the desktop app and in a second tab.
 */
export const chatPreferencesSchema = z
  .object({
    stream_replies: z.boolean().optional(),
    notify_on_mentions: z.boolean().optional(),
    default_model: z.string().optional(),
  })
  .passthrough();

export type ApiChatPreferences = z.infer<typeof chatPreferencesSchema>;
