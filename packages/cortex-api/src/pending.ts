/**
 * HTTP helpers for routes that are not on the public API yet.
 *
 * Each call hits the path the parallel backend PRs named. A live 404 is an
 * honest `CortexApiError` (`not_found`), not an empty list invented here.
 * Tests use `createMockProductSurface` instead of pretending the farm is up.
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
  type ApiNotification,
  type ApiPlanningTask,
  type ApiPlugin,
} from './pending-schemas.ts';

export interface ProductSurface {
  listMascots: (signal?: AbortSignal) => Promise<ApiMascot[]>;
  listCodeHosts: (signal?: AbortSignal) => Promise<ApiCodeHost[]>;
  listCodeSessions: (signal?: AbortSignal) => Promise<ApiCodeSession[]>;
  listPlanningTasks: (signal?: AbortSignal) => Promise<ApiPlanningTask[]>;
  listLibraryItems: (signal?: AbortSignal) => Promise<ApiLibraryItem[]>;
  listPlugins: (signal?: AbortSignal) => Promise<ApiPlugin[]>;
  listNotifications: (signal?: AbortSignal) => Promise<ApiNotification[]>;
  postScheduledResult: typeof postScheduledResult;
  pairCodeHost: typeof pairCodeHost;
  heartbeatCodeHost: typeof heartbeatCodeHost;
  createMascot: typeof createMascot;
  deleteMascot: typeof deleteMascot;
  createVncTicket: typeof createVncTicket;
  listMascotVideos: typeof listMascotVideos;
  markNotificationRead: typeof markNotificationRead;
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

export function createMockProductSurface(seed: Partial<{
  mascots: ApiMascot[];
  hosts: ApiCodeHost[];
  sessions: ApiCodeSession[];
  tasks: ApiPlanningTask[];
  library: ApiLibraryItem[];
  plugins: ApiPlugin[];
  notifications: ApiNotification[];
}> = {}): ProductSurface {
  const empty = async <T>(rows: T[] | undefined) => rows ?? [];
  return {
    listMascots: () => empty(seed.mascots),
    listCodeHosts: () => empty(seed.hosts),
    listCodeSessions: () => empty(seed.sessions),
    listPlanningTasks: () => empty(seed.tasks),
    listLibraryItems: () => empty(seed.library),
    listPlugins: () => empty(seed.plugins),
    listNotifications: () => empty(seed.notifications),
    postScheduledResult: async () => {},
    pairCodeHost: async () => ({ pairing_code: 'PAIR-TEST' }),
    heartbeatCodeHost: async () => {},
    createMascot: async (body) => ({ id: 'mst_mock', name: body.name }),
    deleteMascot: async () => {},
    createVncTicket: async () => ({ ticket_hash: 'ticket-hash-only' }),
    listMascotVideos: async () => [],
    markNotificationRead: async () => {},
  };
}
