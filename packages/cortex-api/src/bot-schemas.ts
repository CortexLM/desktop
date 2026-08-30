/**
 * Shapes for Bot / mascot routes on CortexLM/backend staging + Bot runtime.
 *
 * Existing mascot/computer routes are on staging. Memory, skills, routines,
 * tasks, inbox, groups, handoff, and teach are designed against the parallel
 * Bot runtime PR. Fields stay optional so a live 404 is `not_found`, not a parse
 * failure that looks like an empty farm.
 */

import { z } from 'zod';

import { listEnvelopeSchema } from './product-schemas.ts';

export const computerStatusSchema = z.enum([
  'empty',
  'hibernated',
  'waking',
  'running',
  'stopped',
  'offline',
  'wake-failed',
]);

export type ApiComputerStatus = z.infer<typeof computerStatusSchema>;

export const computerRowSchema = z
  .object({
    id: z.string().optional(),
    mascot_id: z.string().optional(),
    status: z.string().optional(),
    provider: z.string().optional(),
    offline: z.boolean().optional(),
    last_error: z.string().optional(),
    arch: z.string().optional(),
    vcpu: z.number().optional(),
    memory_gib: z.number().optional(),
    screenshot_url: z.string().optional(),
    stream_url: z.string().optional(),
    embed_url: z.string().optional(),
    control_holder: z.string().optional(),
    runtime: z.string().optional(),
    mode: z.string().optional(),
  })
  .passthrough();

export type ApiComputer = z.infer<typeof computerRowSchema>;

export const mascotRowSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    look: z.string().optional(),
    face: z.string().optional(),
    resting_face: z.string().optional(),
    shape: z.string().optional(),
    color: z.string().optional(),
    unread: z.boolean().optional(),
    has_unread: z.boolean().optional(),
    unread_count: z.number().optional(),
    computer_id: z.string().optional(),
    computer: computerRowSchema.optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export type ApiMascot = z.infer<typeof mascotRowSchema>;
export const mascotListSchema = listEnvelopeSchema(mascotRowSchema);

export const attachmentSchema = z
  .object({
    id: z.string().optional(),
    kind: z.string().optional(),
    url: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export const askUserSchema = z
  .object({
    id: z.string().optional(),
    prompt: z.string().optional(),
    options: z.array(z.string()).optional(),
    pending: z.boolean().optional(),
  })
  .passthrough();

export const secretRequestSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    reason: z.string().optional(),
    pending: z.boolean().optional(),
  })
  .passthrough();

export const botMessageSchema = z
  .object({
    id: z.string().optional(),
    seq: z.number().optional(),
    role: z.string().optional(),
    kind: z.string().optional(),
    text: z.string().optional(),
    content: z.string().optional(),
    created_at: z.string().optional(),
    attachments: z.array(attachmentSchema).optional(),
    ask_user: askUserSchema.optional(),
    secret: secretRequestSchema.optional(),
    tool: z.string().optional(),
    tool_input: z.unknown().optional(),
    tool_output: z.unknown().optional(),
  })
  .passthrough();

export type ApiBotMessage = z.infer<typeof botMessageSchema>;
export const botMessageListSchema = listEnvelopeSchema(botMessageSchema);

export const mascotVideoSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    created_at: z.string().optional(),
    kind: z.string().optional(),
    recording: z.boolean().optional(),
  })
  .passthrough();

export type ApiMascotVideo = z.infer<typeof mascotVideoSchema>;
export const mascotVideoListSchema = listEnvelopeSchema(mascotVideoSchema);

export const screenshotSchema = z
  .object({
    image_base64: z.string().optional(),
    url: z.string().optional(),
    content_type: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type ApiScreenshot = z.infer<typeof screenshotSchema>;

export const cursorSchema = z
  .object({
    x: z.number().optional(),
    y: z.number().optional(),
  })
  .passthrough();

export type ApiCursor = z.infer<typeof cursorSchema>;

export const shellResultSchema = z
  .object({
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    exit_code: z.number().optional(),
  })
  .passthrough();

export type ApiShellResult = z.infer<typeof shellResultSchema>;

export const fsEntrySchema = z
  .object({
    name: z.string(),
    path: z.string().optional(),
    kind: z.string().optional(),
  })
  .passthrough();

export type ApiFsEntry = z.infer<typeof fsEntrySchema>;
export const fsListSchema = listEnvelopeSchema(fsEntrySchema);

export const filePreviewSchema = z
  .object({
    path: z.string().optional(),
    text: z.string().optional(),
    content: z.string().optional(),
    encoding: z.string().optional(),
  })
  .passthrough();

export type ApiFilePreview = z.infer<typeof filePreviewSchema>;
