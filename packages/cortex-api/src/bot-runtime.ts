/**
 * Cortex Bot runtime routes: memory, skills, routines, tasks, inbox, groups,
 * handoff, teach. A live 404 stays `not_found`.
 */

import type { CortexApiClient } from './client.ts';
import { unknownSchema } from './schemas.ts';
import { mascotPath, skillPath, withQuery } from './bot-paths.ts';
import {
  DEFAULT_ROUTINE_CRON,
  groupListSchema,
  inboxItemSchema,
  inboxListSchema,
  memoryFactSchema,
  memoryListSchema,
  routineListSchema,
  routineRowSchema,
  skillListSchema,
  skillRowSchema,
  skillRunSchema,
  taskRowSchema,
  type ApiBotGroup,
  type ApiBotInboxItem,
  type ApiBotTask,
  type ApiMemoryFact,
  type ApiRoutine,
  type ApiSkill,
  type ApiSkillRun,
  type MemoryTier,
} from './bot-runtime-schemas.ts';

export { DEFAULT_ROUTINE_CRON };

export async function listMemory(
  client: CortexApiClient,
  id: string,
  tier: MemoryTier,
  signal?: AbortSignal,
): Promise<ApiMemoryFact[]> {
  const path = withQuery(mascotPath(id, '/memory'), { tier });
  const list = await client.request(path, memoryListSchema, { signal });
  return list.items;
}

export function addMemory(
  client: CortexApiClient,
  id: string,
  body: { tier: MemoryTier; text: string },
  signal?: AbortSignal,
): Promise<ApiMemoryFact> {
  return client.request(mascotPath(id, '/memory'), memoryFactSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export async function forgetMemory(
  client: CortexApiClient,
  id: string,
  body: { factId: string; tier: MemoryTier },
  signal?: AbortSignal,
): Promise<void> {
  const path = withQuery(mascotPath(id, `/memory/${encodeURIComponent(body.factId)}`), {
    tier: body.tier,
  });
  await client.request(path, unknownSchema, { method: 'DELETE', signal });
}

export async function listSkills(client: CortexApiClient, signal?: AbortSignal): Promise<ApiSkill[]> {
  const list = await client.request('/v1/skills', skillListSchema, { signal });
  return list.items;
}

export function getSkill(
  client: CortexApiClient,
  slug: string,
  signal?: AbortSignal,
): Promise<ApiSkill> {
  return client.request(skillPath(slug), skillRowSchema, { signal });
}

export function createSkill(
  client: CortexApiClient,
  body: { slug: string; name?: string; markdown?: string },
  signal?: AbortSignal,
): Promise<ApiSkill> {
  return client.request('/v1/skills', skillRowSchema, { method: 'POST', body, signal });
}

export async function deleteSkill(
  client: CortexApiClient,
  slug: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(skillPath(slug), unknownSchema, { method: 'DELETE', signal });
}

export function runSkill(
  client: CortexApiClient,
  mascotId: string,
  slug: string,
  signal?: AbortSignal,
): Promise<ApiSkillRun> {
  return client.request(mascotPath(mascotId, `/skills/${encodeURIComponent(slug)}/run`), skillRunSchema, {
    method: 'POST',
    body: {},
    signal,
  });
}

export async function listRoutines(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiRoutine[]> {
  const list = await client.request(mascotPath(id, '/routines'), routineListSchema, { signal });
  return list.items;
}

export function createRoutine(
  client: CortexApiClient,
  id: string,
  body: { name: string; cron?: string; trigger?: unknown },
  signal?: AbortSignal,
): Promise<ApiRoutine> {
  return client.request(mascotPath(id, '/routines'), routineRowSchema, {
    method: 'POST',
    body: { cron: DEFAULT_ROUTINE_CRON, ...body },
    signal,
  });
}

export async function deleteRoutine(
  client: CortexApiClient,
  id: string,
  routineId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(mascotPath(id, `/routines/${encodeURIComponent(routineId)}`), unknownSchema, {
    method: 'DELETE',
    signal,
  });
}

export function pauseRoutine(
  client: CortexApiClient,
  id: string,
  routineId: string,
  signal?: AbortSignal,
): Promise<ApiRoutine> {
  return client.request(
    mascotPath(id, `/routines/${encodeURIComponent(routineId)}/pause`),
    routineRowSchema,
    { method: 'POST', body: {}, signal },
  );
}

export function resumeRoutine(
  client: CortexApiClient,
  id: string,
  routineId: string,
  signal?: AbortSignal,
): Promise<ApiRoutine> {
  return client.request(
    mascotPath(id, `/routines/${encodeURIComponent(routineId)}/resume`),
    routineRowSchema,
    { method: 'POST', body: {}, signal },
  );
}

export function createBotTask(
  client: CortexApiClient,
  id: string,
  body: { title: string; prompt?: string },
  signal?: AbortSignal,
): Promise<ApiBotTask> {
  return client.request(mascotPath(id, '/tasks'), taskRowSchema, { method: 'POST', body, signal });
}

export function getBotTask(
  client: CortexApiClient,
  id: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<ApiBotTask> {
  return client.request(mascotPath(id, `/tasks/${encodeURIComponent(taskId)}`), taskRowSchema, {
    signal,
  });
}

export async function listBotInbox(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiBotInboxItem[]> {
  const list = await client.request(mascotPath(id, '/inbox'), inboxListSchema, { signal });
  return list.items;
}

export function postBotInbox(
  client: CortexApiClient,
  id: string,
  body: { message: string; from_mascot_id?: string },
  signal?: AbortSignal,
): Promise<ApiBotInboxItem> {
  return client.request(mascotPath(id, '/inbox'), inboxItemSchema, { method: 'POST', body, signal });
}

export async function listBotGroups(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiBotGroup[]> {
  const list = await client.request(mascotPath(id, '/groups'), groupListSchema, { signal });
  return list.items;
}

export async function postHandoff(
  client: CortexApiClient,
  id: string,
  body: { to_mascot_id: string; message?: string },
  signal?: AbortSignal,
): Promise<void> {
  await client.request(mascotPath(id, '/handoff'), unknownSchema, { method: 'POST', body, signal });
}

export async function postTeach(
  client: CortexApiClient,
  id: string,
  body: { video_id: string },
  signal?: AbortSignal,
): Promise<ApiSkill> {
  return client.request(mascotPath(id, '/teach'), skillRowSchema, { method: 'POST', body, signal });
}
