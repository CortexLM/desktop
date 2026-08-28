/**
 * Zod schemas for the Cortex API surface.
 *
 * Response schemas are deliberately lenient about unknown keys: the service is versioned
 * independently of this client, and rejecting a payload because it grew a field would break
 * the app on a backwards-compatible server change. What is validated is the shape the app
 * actually depends on.
 *
 * See CONTRACT.md for how each shape was established.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

export const healthSchema = z
  .object({
    status: z.string(),
    version: z.string(),
    uptime_secs: z.number(),
  })
  .passthrough();

export type Health = z.infer<typeof healthSchema>;

/* -------------------------------------------------------------------------- */
/* Models                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `fast` and `reasoning` were the two categories observed. The union stays open because a
 * new tier appearing server-side should show up in the picker, not crash the catalogue.
 */
export const modelCategorySchema = z.union([
  z.literal('fast'),
  z.literal('reasoning'),
  z.string(),
]);

export const modelCapabilitiesSchema = z
  .object({
    function_calling: z.boolean(),
    json_mode: z.boolean(),
    streaming: z.boolean(),
    vision: z.boolean(),
  })
  .partial()
  .passthrough();

export const cortexModelSchema = z
  .object({
    /**
     * The v1 catalogue keys models by `slug`; earlier deployments used `id`.
     * Normalised in a preprocess below so consumers only ever see `id`.
     */
    id: z.string(),
    object: z.literal('model').or(z.string()).optional(),
    created: z.number().optional(),
    display_name: z.string().optional(),
    description: z.string().optional(),
    category: modelCategorySchema.optional(),
    is_premium: z.boolean().optional(),
    /** v1 flags preview models explicitly. */
    is_preview: z.boolean().optional(),
    /** Server-side expression of plan gating: the caller may not use this model. */
    locked: z.boolean().optional(),
    cost_multiplier: z.number().optional(),
    context_length: z.number().optional(),
    /** v1 name for the context window. */
    context_tokens: z.number().optional(),
    max_output_tokens: z.number().optional(),
    capabilities: modelCapabilitiesSchema.optional(),
    supports_reasoning: z.boolean().optional(),
    supports_tools: z.boolean().optional(),
    supports_vision: z.boolean().optional(),
    /**
     * Credit multipliers arrive as decimal *strings* ("0.600"). They are kept as strings:
     * parsing them to float would quietly lose precision on a billing value.
     */
    credit_multiplier_input: z.string().optional(),
    credit_multiplier_output: z.string().optional(),
    credit_multiplier_cached_input: z.string().optional(),
    price_version: z.number().optional(),
    stale: z.boolean().optional(),
  })
  .passthrough();

export type CortexModel = z.infer<typeof cortexModelSchema>;

/** v1 rows key models by `slug`; earlier deployments used `id`. Normalise to `id`. */
function normaliseModelRow(row: unknown): unknown {
  if (typeof row !== 'object' || row === null) return row;
  const record = row as Record<string, unknown>;
  if (typeof record.id === 'string') return record;
  if (typeof record.slug === 'string') return { ...record, id: record.slug };
  return record;
}

const modelListEnvelopeSchema = z
  .object({
    data: z.array(cortexModelSchema),
    has_more: z.boolean().optional(),
  })
  .passthrough();

/**
 * The v1 catalogue answers `{ items: [...], has_more }`; earlier deployments
 * answered `{ object: 'list', data: [...] }`. Both are accepted and collapsed
 * onto one `data` array so callers never see the envelope difference. A body
 * with NEITHER array is left untouched, so it still fails the schema instead of
 * being silently normalised into an empty catalogue.
 */
export const modelListSchema = z
  .unknown()
  .transform((raw) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const record = raw as Record<string, unknown>;
    const rows = Array.isArray(record.items)
      ? record.items
      : Array.isArray(record.data)
        ? record.data
        : undefined;
    if (!rows) return raw;
    return { ...record, data: rows.map(normaliseModelRow) };
  })
  .pipe(modelListEnvelopeSchema);

export type ModelList = z.infer<typeof modelListSchema>;

/* -------------------------------------------------------------------------- */
/* Providers                                                                  */
/* -------------------------------------------------------------------------- */

export const upstreamProviderSchema = z
  .object({
    name: z.string(),
    configured: z.boolean(),
    default: z.boolean(),
    healthy: z.boolean(),
    active_model_count: z.number(),
  })
  .passthrough();

export type UpstreamProvider = z.infer<typeof upstreamProviderSchema>;

export const upstreamProviderListSchema = z.array(upstreamProviderSchema);

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export const deviceCodeSchema = z
  .object({
    /** Shown to the user; they type this at `verification_uri`. */
    user_code: z.string(),
    /** Secret the client polls with. Never display it. */
    device_code: z.string(),
    verification_uri: z.string(),
    /** Some RFC 8628 servers also return a pre-filled URI. Cortex did not, but may. */
    verification_uri_complete: z.string().optional(),
    expires_in: z.number(),
    /** Seconds between polls. RFC 8628 defaults to 5 when absent. */
    interval: z.number().optional(),
  })
  .passthrough();

export type DeviceCode = z.infer<typeof deviceCodeSchema>;

export const deviceTokenSchema = z
  .object({
    access_token: z.string(),
    token_type: z.string().optional(),
    expires_in: z.number().optional(),
    refresh_token: z.string().optional(),
    scope: z.string().optional(),
  })
  .passthrough();

export type DeviceToken = z.infer<typeof deviceTokenSchema>;

/**
 * `/auth/me` could not be reached without credentials, so only the fields the UI needs are
 * declared and all of them are optional. The user row and account screens degrade to the
 * email when a display name or avatar is absent.
 */
export const cortexUserSchema = z
  .object({
    id: z.string().optional(),
    email: z.string().optional(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    name: z.string().nullish(),
    display_name: z.string().nullish(),
    profile_picture_url: z.string().nullish(),
    organization_id: z.string().nullish(),
    plan_slug: z.string().nullish(),
    is_guest: z.boolean().optional(),
    quotas: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type CortexUser = z.infer<typeof cortexUserSchema>;

export const organizationSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
  })
  .passthrough();

export type Organization = z.infer<typeof organizationSchema>;

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export const applicationErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .passthrough();

export const oauthErrorSchema = z
  .object({
    error: z.string(),
    error_description: z.string().optional(),
  })
  .passthrough();

/* -------------------------------------------------------------------------- */
/* Chat completions                                                           */
/* -------------------------------------------------------------------------- */

export const chatRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

export const chatMessageSchema = z
  .object({
    role: chatRoleSchema,
    content: z.string().nullable(),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
    tool_calls: z
      .array(
        z
          .object({
            id: z.string(),
            type: z.literal('function').or(z.string()),
            function: z.object({ name: z.string(), arguments: z.string() }).passthrough(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatCompletionRequestSchema = z
  .object({
    model: z.string(),
    messages: z.array(chatMessageSchema),
    stream: z.boolean().optional(),
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
    tools: z.array(z.unknown()).optional(),
    tool_choice: z.unknown().optional(),
  })
  .passthrough();

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

export const chatCompletionChoiceSchema = z
  .object({
    index: z.number(),
    message: chatMessageSchema.optional(),
    delta: chatMessageSchema.partial().optional(),
    finish_reason: z.string().nullish(),
  })
  .passthrough();

export const chatCompletionSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number().optional(),
    model: z.string().optional(),
    choices: z.array(chatCompletionChoiceSchema),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ChatCompletion = z.infer<typeof chatCompletionSchema>;

/* -------------------------------------------------------------------------- */
/* API keys                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * An API key, as `/auth/api-keys` returns it.
 *
 * Every field but `id` is optional and the object is `passthrough`, because the
 * shape could not be observed: the route needs a real session, and obtaining one
 * requires a human to approve a device flow. What is declared here is what the
 * Integrations screen needs; anything else the service sends is carried through
 * rather than dropped.
 *
 * `key` is present only in the create response. Services that hash their keys show
 * the value once and never again, which is why the screen stores nothing and shows
 * the last four characters.
 */
export const apiKeySchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    created_at: z.union([z.number(), z.string()]).optional(),
    last_used_at: z.union([z.number(), z.string()]).nullish(),
    /** Only on creation. */
    key: z.string().optional(),
    /** Some services return a display suffix instead of the key. */
    last_four: z.string().optional(),
  })
  .passthrough();

export type CortexApiKey = z.infer<typeof apiKeySchema>;

export const apiKeyListSchema = z.array(apiKeySchema);

/** For responses whose body is not read. */
export const unknownSchema = z.unknown();
