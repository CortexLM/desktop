/**
 * Cortex Bot runtime shapes. These routes are on the parallel backend PR.
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
    /** The catalogue slug. Which of these the service fills is not yet observed. */
    slug: z.string().optional(),
    toolkit_slug: z.string().optional(),
    brand: z.string().optional(),
    name: z.string().optional(),
    connected: z.boolean().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type ApiPluginConnection = z.infer<typeof pluginConnectionSchema>;
export const pluginConnectionListSchema = listEnvelopeSchema(pluginConnectionSchema);

/**
 * One app in the marketplace catalogue, as `GET /v1/plugins/catalog` returns it
 * (observed 2026-08-29).
 *
 * Only `slug` is required. Everything else is presentation the provider may or
 * may not carry for a given app, and a card with no description is a better
 * answer than a parse failure that empties the whole page.
 */
export const pluginCatalogEntrySchema = z
  .object({
    slug: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    /** `oauth2`, `oauth1`, `api_key`, `none`. */
    auth: z.string().optional(),
    managed_auth: z.boolean().optional(),
    logo_url: z.string().optional(),
    app_url: z.string().optional(),
    tool_count: z.number().optional(),
    connected: z.boolean().optional(),
  })
  .passthrough();

export type ApiPluginCatalogEntry = z.infer<typeof pluginCatalogEntrySchema>;

/**
 * The catalogue envelope.
 *
 * `is_live` is the field that matters: the list is cached server-side, so a
 * response arrives whether or not the marketplace answered. `false` means the
 * client is looking at something stale or empty and must say so — it is not an
 * invitation to fall back to a list of apps chosen here.
 */
export const pluginCatalogSchema = z
  .object({
    items: z.array(pluginCatalogEntrySchema),
    is_live: z.boolean().optional(),
    /** Who the marketplace is, e.g. `composio`. Named by the service, not by us. */
    provider: z.string().optional(),
    source: z.string().optional(),
  })
  .passthrough();

export type ApiPluginCatalog = z.infer<typeof pluginCatalogSchema>;

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
