/**
 * Grok-core Bot shapes. These routes are on the parallel backend PR.
 * A 404 is `not_found` / "backend too old" — never a silent local cache.
 */

import { z } from 'zod';

import { listEnvelopeSchema } from './product-schemas.ts';

export const memoryTierSchema = z.enum(['profile', 'log', 'note']);
export type MemoryTier = z.infer<typeof memoryTierSchema>;

export const memoryFactSchema = z
  .object({
    id: z.string(),
    tier: z.string().optional(),
    text: z.string().optional(),
    content: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type ApiMemoryFact = z.infer<typeof memoryFactSchema>;
export const memoryListSchema = listEnvelopeSchema(memoryFactSchema);

export const skillRowSchema = z
  .object({
    id: z.string().optional(),
    slug: z.string(),
    name: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    markdown: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

export type ApiSkill = z.infer<typeof skillRowSchema>;
export const skillListSchema = listEnvelopeSchema(skillRowSchema);

export const skillRunSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type ApiSkillRun = z.infer<typeof skillRunSchema>;

export const routineRowSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    title: z.string().optional(),
    cron: z.string().optional(),
    trigger: z.unknown().optional(),
    paused: z.boolean().optional(),
    status: z.string().optional(),
    last_run_at: z.string().optional(),
  })
  .passthrough();

export type ApiRoutine = z.infer<typeof routineRowSchema>;
export const routineListSchema = listEnvelopeSchema(routineRowSchema);

export const taskRowSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    title: z.string().optional(),
    kind: z.string().optional(),
  })
  .passthrough();

export type ApiBotTask = z.infer<typeof taskRowSchema>;

export const groupRowSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    title: z.string().optional(),
    kind: z.string().optional(),
  })
  .passthrough();

export type ApiBotGroup = z.infer<typeof groupRowSchema>;
export const groupListSchema = listEnvelopeSchema(groupRowSchema);

export const inboxItemSchema = z
  .object({
    id: z.string().optional(),
    message: z.string().optional(),
    kind: z.string().optional(),
    from_mascot_id: z.string().optional(),
  })
  .passthrough();

export type ApiBotInboxItem = z.infer<typeof inboxItemSchema>;
export const inboxListSchema = listEnvelopeSchema(inboxItemSchema);

export const pluginConnectionSchema = z
  .object({
    id: z.string(),
    plugin_id: z.string().optional(),
    brand: z.string().optional(),
    name: z.string().optional(),
    connected: z.boolean().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type ApiPluginConnection = z.infer<typeof pluginConnectionSchema>;
export const pluginConnectionListSchema = listEnvelopeSchema(pluginConnectionSchema);

export const pluginRowSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    brand: z.string().optional(),
    installed: z.boolean().optional(),
    connected: z.boolean().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type ApiPlugin = z.infer<typeof pluginRowSchema>;
export const pluginListSchema = listEnvelopeSchema(pluginRowSchema);

/** Weekday daytime unless the user chose another cadence. */
export const DEFAULT_ROUTINE_CRON = '0 9 * * 1-5';
