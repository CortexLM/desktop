/**
 * Shapes for routes the parallel backend PRs are adding.
 *
 * None of these answered on the public API on 2026-08-28 (all 404 except
 * `/v1/projects`, which is already in product-schemas). Fields are optional
 * so the live client can grow. A successful parse is not proof the farm exists.
 */

import { z } from 'zod';

import { listEnvelopeSchema } from './product-schemas.ts';
import {
  mascotListSchema,
  mascotRowSchema,
  mascotVideoListSchema,
  mascotVideoSchema,
  type ApiMascot,
  type ApiMascotVideo,
} from './bot-schemas.ts';
import { pluginListSchema, pluginRowSchema, type ApiPlugin } from './bot-runtime-schemas.ts';

export {
  mascotListSchema,
  mascotRowSchema,
  mascotVideoListSchema,
  mascotVideoSchema,
  pluginListSchema,
  pluginRowSchema,
};
export type { ApiMascot, ApiMascotVideo, ApiPlugin };

export const codeHostRowSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type ApiCodeHost = z.infer<typeof codeHostRowSchema>;
export const codeHostListSchema = listEnvelopeSchema(codeHostRowSchema);

export const codeSessionRowSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    status: z.string().optional(),
    runtime: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type ApiCodeSession = z.infer<typeof codeSessionRowSchema>;
export const codeSessionListSchema = listEnvelopeSchema(codeSessionRowSchema);

export const planningTaskRowSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    cadence: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type ApiPlanningTask = z.infer<typeof planningTaskRowSchema>;
export const planningTaskListSchema = listEnvelopeSchema(planningTaskRowSchema);

export const libraryItemRowSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    kind: z.string().optional(),
  })
  .passthrough();

export type ApiLibraryItem = z.infer<typeof libraryItemRowSchema>;
export const libraryItemListSchema = listEnvelopeSchema(libraryItemRowSchema);

export const notificationRowSchema = z
  .object({
    id: z.string(),
    kind: z.string().optional(),
    message: z.string().optional(),
    href: z.string().optional(),
  })
  .passthrough();

export type ApiNotification = z.infer<typeof notificationRowSchema>;
export const notificationListSchema = listEnvelopeSchema(notificationRowSchema);

/** Shown once. Extra keys such as `pairing_hash` are dropped, not stored. */
export const hostPairingSchema = z.object({
  pairing_code: z.string(),
  expires_in: z.number().optional(),
  host_id: z.string().optional(),
});

export type HostPairing = z.infer<typeof hostPairingSchema>;

export const hostHeartbeatSchema = z
  .object({
    device_token: z.string(),
    host_id: z.string().optional(),
  })
  .passthrough();

export type HostHeartbeat = z.infer<typeof hostHeartbeatSchema>;

/** Signaling ticket. Hash only for capability; optional stream URL for the embed. */
export const vncTicketSchema = z
  .object({
    ticket_hash: z.string(),
    stream_url: z.string().optional(),
    embed_url: z.string().optional(),
  })
  .passthrough();

export type VncTicket = z.infer<typeof vncTicketSchema>;

export const scheduledResultSchema = z
  .object({
    task_id: z.string(),
    message: z.string().optional(),
  })
  .passthrough();

export type ScheduledResult = z.infer<typeof scheduledResultSchema>;
