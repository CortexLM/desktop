/**
 * HTTP helpers for the backend staging control plane.
 *
 * Each call hits the live path. A 404 is `not_found`, not an empty farm.
 * Test doubles live in `test-doubles.ts` behind `CORTEX_ALLOW_TEST_DOUBLES=1`.
 */

import type { z } from 'zod';

import type { CortexApiClient } from './client.ts';
import {
  createMascot,
  createVncTicket,
  deleteMascot,
  heartbeatCodeHost,
  listMascotVideos,
  markNotificationRead,
  pairCodeHost,
  postScheduledResult,
} from './control-plane.ts';
import {
  codeHostListSchema,
  codeSessionListSchema,
  libraryItemListSchema,
  mascotListSchema,
  notificationListSchema,
  planningTaskListSchema,
  pluginListSchema,
  type ApiCodeHost,
  type ApiCodeSession,
  type ApiLibraryItem,
  type ApiMascot,
  type ApiMascotVideo,
  type ApiNotification,
  type ApiPlanningTask,
  type ApiPlugin,
  type HostPairing,
  type VncTicket,
} from './pending-schemas.ts';

export interface ProductSurface {
  listMascots: (signal?: AbortSignal) => Promise<ApiMascot[]>;
  listCodeHosts: (signal?: AbortSignal) => Promise<ApiCodeHost[]>;
  listCodeSessions: (signal?: AbortSignal) => Promise<ApiCodeSession[]>;
  listPlanningTasks: (signal?: AbortSignal) => Promise<ApiPlanningTask[]>;
  listLibraryItems: (signal?: AbortSignal) => Promise<ApiLibraryItem[]>;
  listPlugins: (signal?: AbortSignal) => Promise<ApiPlugin[]>;
  listNotifications: (signal?: AbortSignal) => Promise<ApiNotification[]>;
  postScheduledResult: (
    conversationId: string,
    body: { task_id: string; message?: string },
    signal?: AbortSignal,
  ) => Promise<void>;
  pairCodeHost: (signal?: AbortSignal) => Promise<HostPairing>;
  heartbeatCodeHost: (
    body: { device_token: string; host_id?: string },
    signal?: AbortSignal,
  ) => Promise<void>;
  createMascot: (
    body: { name: string; shape?: string; color?: string },
    signal?: AbortSignal,
  ) => Promise<ApiMascot>;
  deleteMascot: (id: string, signal?: AbortSignal) => Promise<void>;
  createVncTicket: (id: string, signal?: AbortSignal) => Promise<VncTicket>;
  listMascotVideos: (id: string, signal?: AbortSignal) => Promise<ApiMascotVideo[]>;
  markNotificationRead: (id: string, signal?: AbortSignal) => Promise<void>;
}

export function createHttpProductSurface(client: CortexApiClient): ProductSurface {
  return {
    listMascots: (signal) => items(client, '/v1/mascots', mascotListSchema, signal),
    listCodeHosts: (signal) => items(client, '/v1/code/hosts', codeHostListSchema, signal),
    listCodeSessions: (signal) => items(client, '/v1/code/sessions', codeSessionListSchema, signal),
    listPlanningTasks: (signal) => items(client, '/v1/planning/tasks', planningTaskListSchema, signal),
    listLibraryItems: (signal) => items(client, '/v1/library', libraryItemListSchema, signal),
    listPlugins: (signal) => items(client, '/v1/plugins', pluginListSchema, signal),
    listNotifications: (signal) => items(client, '/v1/notifications', notificationListSchema, signal),
    postScheduledResult: (conversationId, body, signal) =>
      postScheduledResult(client, conversationId, body, signal),
    pairCodeHost: (signal) => pairCodeHost(client, signal),
    heartbeatCodeHost: (body, signal) => heartbeatCodeHost(client, body, signal),
    createMascot: (body, signal) => createMascot(client, body, signal),
    deleteMascot: (id, signal) => deleteMascot(client, id, signal),
    createVncTicket: (id, signal) => createVncTicket(client, id, signal),
    listMascotVideos: (id, signal) => listMascotVideos(client, id, signal),
    markNotificationRead: (id, signal) => markNotificationRead(client, id, signal),
  };
}

async function items<T>(
  client: CortexApiClient,
  path: string,
  schema: z.ZodType<{ items: T[] }>,
  signal?: AbortSignal,
): Promise<T[]> {
  const list = await client.request(path, schema, { signal });
  return list.items;
}
