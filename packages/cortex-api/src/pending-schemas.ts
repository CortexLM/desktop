/**
 * Shapes for routes the parallel backend PRs are adding.
 *
 * None of these answered on the public API on 2026-08-28 (all 404 except
 * `/v1/projects`, which is already in product-schemas). Fields are optional
 * and passthrough so a mock and the live client share one type when the
 * service lands. Do not treat a successful parse of a mock row as proof the
 * farm exists.
 */

import { z } from 'zod';

import { listEnvelopeSchema } from './product-schemas.ts';

export const mascotRowSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    shape: z.string().optional(),
    color: z.string().optional(),
    computer_id: z.string().optional(),
  })
  .passthrough();

export type ApiMascot = z.infer<typeof mascotRowSchema>;
export const mascotListSchema = listEnvelopeSchema(mascotRowSchema);

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

export const pluginRowSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    installed: z.boolean().optional(),
  })
  .passthrough();

export type ApiPlugin = z.infer<typeof pluginRowSchema>;
export const pluginListSchema = listEnvelopeSchema(pluginRowSchema);

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
