/**
 * Mascot CRUD, messages, ask-user, secrets. Staging routes.
 */

import type { z } from 'zod';

import type { CortexApiClient } from './client.ts';
import { unknownSchema } from './schemas.ts';
import { mascotPath } from './bot-paths.ts';
import type { ComputerKind } from './bot-computer-kind.ts';
import {
  botMessageListSchema,
  botMessageSchema,
  mascotListSchema,
  mascotRowSchema,
  type ApiBotMessage,
  type ApiMascot,
} from './bot-schemas.ts';

export function listMascots(client: CortexApiClient, signal?: AbortSignal): Promise<ApiMascot[]> {
  return items(client, '/v1/mascots', mascotListSchema, signal);
}

export function getMascot(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiMascot> {
  return client.request(mascotPath(id), mascotRowSchema, { signal });
}

/** Identity the user picks. `color`/`shape` stay as aliases for older backends. */
export interface MascotWriteBody {
  name?: string;
  look?: string;
  face?: string;
  color?: string;
  shape?: string;
  /**
   * Where the dedicated computer should run. The client never sends a loop cap
   * (`max_rounds`, `max_tool_rounds`) on this or any other Bot write.
   */
  computer_kind?: ComputerKind;
}

export function createMascot(
  client: CortexApiClient,
  body: MascotWriteBody & { name: string },
  signal?: AbortSignal,
): Promise<ApiMascot> {
  return client.request('/v1/mascots', mascotRowSchema, { method: 'POST', body, signal });
}

export function patchMascot(
  client: CortexApiClient,
  id: string,
  body: MascotWriteBody,
  signal?: AbortSignal,
): Promise<ApiMascot> {
  return client.request(mascotPath(id), mascotRowSchema, { method: 'PATCH', body, signal });
}

export async function deleteMascot(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(mascotPath(id), unknownSchema, { method: 'DELETE', signal });
}

export function listMascotMessages(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiBotMessage[]> {
  return items(client, mascotPath(id, '/messages'), botMessageListSchema, signal);
}

export function postMascotMessage(
  client: CortexApiClient,
  id: string,
  body: { text: string },
  signal?: AbortSignal,
): Promise<ApiBotMessage> {
  return client.request(mascotPath(id, '/messages'), botMessageSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export function postAskUser(
  client: CortexApiClient,
  id: string,
  body: { prompt: string; options?: string[] },
  signal?: AbortSignal,
): Promise<ApiBotMessage> {
  return client.request(mascotPath(id, '/ask-user'), botMessageSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export function postRespond(
  client: CortexApiClient,
  id: string,
  body: { ask_id?: string; text: string },
  signal?: AbortSignal,
): Promise<ApiBotMessage> {
  return client.request(mascotPath(id, '/respond'), botMessageSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export async function postSecret(
  client: CortexApiClient,
  id: string,
  body: { name: string; value: string },
  signal?: AbortSignal,
): Promise<void> {
  await client.request(mascotPath(id, '/secrets'), unknownSchema, {
    method: 'POST',
    body,
    signal,
  });
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
