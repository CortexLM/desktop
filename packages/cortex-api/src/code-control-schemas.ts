/**
 * Shapes for the Code control plane — the routes the web app needs so a
 * browser can drive Code without an Electron main process.
 *
 * None of these answered on the public deployment when this client was written
 * (`/v1/code/hosts` and `/v1/code/sessions` were already typed in
 * `pending-schemas.ts` and 404 there too). Every field except the identifier is
 * optional so a partially-shipped backend parses instead of throwing
 * `SCHEMA_MISMATCH`, and a 404 stays `not_found` for the caller to surface. A
 * successful parse is not proof the feature exists.
 */

import { z } from 'zod';

import { listEnvelopeSchema } from './product-schemas.ts';

/** One entry in a session's timeline: a message, a tool call, or a diff. */
export const codeTimelineEntrySchema = z
  .object({
    id: z.string(),
    kind: z.string().optional(),
    role: z.string().optional(),
    text: z.string().optional(),
    tool: z.string().optional(),
    status: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type ApiCodeTimelineEntry = z.infer<typeof codeTimelineEntrySchema>;

export const codeFileChangeSchema = z
  .object({
    path: z.string(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    patch: z.string().optional(),
  })
  .passthrough();

export type ApiCodeFileChange = z.infer<typeof codeFileChangeSchema>;

export const codePermissionRequestSchema = z
  .object({
    id: z.string(),
    tool: z.string().optional(),
    summary: z.string().optional(),
    command: z.string().optional(),
  })
  .passthrough();

export type ApiCodePermissionRequest = z.infer<typeof codePermissionRequestSchema>;

export const codePullRequestSchema = z
  .object({
    url: z.string().optional(),
    number: z.number().optional(),
    title: z.string().optional(),
    state: z.string().optional(),
    draft: z.boolean().optional(),
  })
  .passthrough();

export type ApiCodePullRequest = z.infer<typeof codePullRequestSchema>;

/**
 * A session with its timeline. Separate from `codeSessionRowSchema` (the inbox
 * row) because the detail route carries the parts the workbench renders and the
 * list route does not.
 */
export const codeSessionDetailSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    status: z.string().optional(),
    runtime: z.string().optional(),
    repository: z.string().optional(),
    branch: z.string().optional(),
    model: z.string().optional(),
    host_id: z.string().optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    files_changed: z.number().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    timeline: z.array(codeTimelineEntrySchema).optional(),
    changes: z.array(codeFileChangeSchema).optional(),
    pull_request: codePullRequestSchema.optional(),
    permission_request: codePermissionRequestSchema.optional(),
  })
  .passthrough();

export type ApiCodeSessionDetail = z.infer<typeof codeSessionDetailSchema>;

export const codeRepositorySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    full_name: z.string().optional(),
    default_branch: z.string().optional(),
    branches: z.array(z.string()).optional(),
  })
  .passthrough();

export type ApiCodeRepository = z.infer<typeof codeRepositorySchema>;
export const codeRepositoryListSchema = listEnvelopeSchema(codeRepositorySchema);

/**
 * Workspace defaults and run permissions as the service stores them.
 *
 * Snake case because it is the wire shape; the renderer maps it to the camelCase
 * `WorkspaceRunSettings` the screens already use.
 */
export const codeSettingsSchema = z
  .object({
    defaults: z
      .object({
        model: z.string().optional(),
        repository: z.string().optional(),
        base_branch: z.string().optional(),
        branch_prefix: z.string().optional(),
        create_pull_requests: z.string().optional(),
      })
      .passthrough()
      .optional(),
    permissions: z
      .object({
        run_shell_commands: z.boolean().optional(),
        apply_database_migrations: z.boolean().optional(),
        slack_notifications: z.boolean().optional(),
        network_access: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ApiCodeSettings = z.infer<typeof codeSettingsSchema>;

/** A provider credential as the service reports it: masked, never the key. */
export const codeProviderSchema = z
  .object({
    id: z.string(),
    configured: z.boolean().optional(),
    masked_key: z.string().optional(),
    source: z.string().optional(),
    base_url: z.string().optional(),
  })
  .passthrough();

export type ApiCodeProvider = z.infer<typeof codeProviderSchema>;
export const codeProviderListSchema = listEnvelopeSchema(codeProviderSchema);

/** Secrets are write-only: the value is never in a response. */
export const codeSecretSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    created_at: z.string().optional(),
    last_used_at: z.string().optional(),
  })
  .passthrough();

export type ApiCodeSecret = z.infer<typeof codeSecretSchema>;
export const codeSecretListSchema = listEnvelopeSchema(codeSecretSchema);

export const codeAutomationSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    trigger: z.record(z.unknown()).optional(),
    actions: z.array(z.record(z.unknown())).optional(),
    last_run_at: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type ApiCodeAutomation = z.infer<typeof codeAutomationSchema>;
export const codeAutomationListSchema = listEnvelopeSchema(codeAutomationSchema);

export const codeAutomationLogSchema = z
  .object({
    id: z.string(),
    automation_id: z.string().optional(),
    status: z.string().optional(),
    message: z.string().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type ApiCodeAutomationLog = z.infer<typeof codeAutomationLogSchema>;
export const codeAutomationLogListSchema = listEnvelopeSchema(codeAutomationLogSchema);

/**
 * A ticket: the unit of queued work a Code session is started from.
 *
 * `session_id` is set once a run has been started for the ticket, which is what
 * lets the ticket list link into the workbench instead of duplicating it.
 */
export const codeTicketSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    body: z.string().optional(),
    status: z.string().optional(),
    repository: z.string().optional(),
    assignee: z.string().optional(),
    session_id: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type ApiCodeTicket = z.infer<typeof codeTicketSchema>;
export const codeTicketListSchema = listEnvelopeSchema(codeTicketSchema);

/**
 * Usage and credits. The Usage screen renders `—` for anything absent rather
 * than a zero, because "no data" and "nothing used" are different claims.
 */
export const codeUsageSchema = z
  .object({
    period_start: z.string().optional(),
    period_end: z.string().optional(),
    credits_used: z.number().optional(),
    credits_included: z.number().optional(),
    sessions_run: z.number().optional(),
    plan: z.string().optional(),
  })
  .passthrough();

export type ApiCodeUsage = z.infer<typeof codeUsageSchema>;

/** An SSH runtime the account has registered. Never carries a key or password. */
export const codeSshRuntimeSchema = z
  .object({
    id: z.string(),
    host: z.string().optional(),
    user: z.string().optional(),
    port: z.number().optional(),
    status: z.string().optional(),
    fingerprint: z.string().optional(),
  })
  .passthrough();

export type ApiCodeSshRuntime = z.infer<typeof codeSshRuntimeSchema>;
export const codeSshRuntimeListSchema = listEnvelopeSchema(codeSshRuntimeSchema);
