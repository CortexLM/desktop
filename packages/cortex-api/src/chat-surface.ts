/**
 * Chat surfaces that are account state rather than a conversation: Planning,
 * Library, project sources, Research, and preferences.
 *
 * These exist because the web app previously kept all of it in `localStorage`,
 * which is not a product: a scheduled task that only runs while a tab is open
 * has not been scheduled, and a library that lives in one browser profile is
 * not saved. The routes below are the account-held versions.
 *
 * The public deployment answered 404 for everything except `/v1/projects`. The
 * callers surface that as "Planning needs the Cortex backend", not as an empty
 * list, which is why nothing here falls back to a local write.
 */

import type { CortexApiClient } from './client.ts';
import { listItems } from './lists.ts';
import { unknownSchema } from './schemas.ts';
import {
  libraryItemListSchema,
  planningTaskListSchema,
  type ApiLibraryItem,
  type ApiPlanningTask,
} from './pending-schemas.ts';
import {
  chatPreferencesSchema,
  libraryItemDetailSchema,
  planningRunListSchema,
  planningRunSchema,
  planningTaskRowSchema,
  projectDetailSchema,
  projectSourceListSchema,
  projectSourceSchema,
  researchTaskListSchema,
  researchTaskSchema,
  type ApiChatPreferences,
  type ApiLibraryItemDetail,
  type ApiPlanningRun,
  type ApiProjectDetail,
  type ApiProjectSource,
  type ApiResearchTask,
} from './chat-surface-schemas.ts';

const PLANNING = '/v1/planning/tasks';
const LIBRARY = '/v1/library';
const PROJECTS = '/v1/projects';
const RESEARCH = '/v1/research/tasks';

function planningPath(id: string, suffix = ''): string {
  return `${PLANNING}/${encodeURIComponent(id)}${suffix}`;
}

function projectPath(id: string, suffix = ''): string {
  return `${PROJECTS}/${encodeURIComponent(id)}${suffix}`;
}

/* ------------------------------------------------------------------------- */
/* Planning — scheduled generalist tasks                                     */
/* ------------------------------------------------------------------------- */

export function listPlanningTasks(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiPlanningTask[]> {
  return listItems(client, PLANNING, planningTaskListSchema, { signal });
}

export function createPlanningTask(
  client: CortexApiClient,
  body: { title: string; summary?: string; cadence?: string; template_id?: string },
  signal?: AbortSignal,
): Promise<ApiPlanningTask> {
  return client.request(PLANNING, planningTaskRowSchema, { method: 'POST', body, signal });
}

export function patchPlanningTask(
  client: CortexApiClient,
  id: string,
  body: { status?: string; cadence?: string; title?: string },
  signal?: AbortSignal,
): Promise<ApiPlanningTask> {
  return client.request(planningPath(id), planningTaskRowSchema, {
    method: 'PATCH',
    body,
    signal,
  });
}

export async function deletePlanningTask(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(planningPath(id), unknownSchema, { method: 'DELETE', signal });
}

/**
 * Runs a scheduled task now.
 *
 * The service owns the schedule, so "run now" is a request rather than a local
 * timestamp bump — and the run it returns carries the conversation the result
 * landed in.
 */
export function runPlanningTask(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiPlanningRun> {
  return client.request(planningPath(id, '/run'), planningRunSchema, {
    method: 'POST',
    body: {},
    signal,
  });
}

export function listPlanningRuns(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiPlanningRun[]> {
  return listItems(client, planningPath(id, '/runs'), planningRunListSchema, { signal });
}

/* ------------------------------------------------------------------------- */
/* Library — saved answers and uploads                                       */
/* ------------------------------------------------------------------------- */

export function listLibraryItems(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiLibraryItem[]> {
  return listItems(client, LIBRARY, libraryItemListSchema, { signal });
}

export function createLibraryItem(
  client: CortexApiClient,
  body: { title: string; kind?: string; excerpt?: string; conversation_id?: string },
  signal?: AbortSignal,
): Promise<ApiLibraryItemDetail> {
  return client.request(LIBRARY, libraryItemDetailSchema, { method: 'POST', body, signal });
}

export async function deleteLibraryItem(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`${LIBRARY}/${encodeURIComponent(id)}`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}

/* ------------------------------------------------------------------------- */
/* Projects and their sources                                                */
/* ------------------------------------------------------------------------- */

export function getProject(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiProjectDetail> {
  return client.request(projectPath(id), projectDetailSchema, { signal });
}

export function patchProject(
  client: CortexApiClient,
  id: string,
  body: { name?: string; brief?: string },
  signal?: AbortSignal,
): Promise<ApiProjectDetail> {
  return client.request(projectPath(id), projectDetailSchema, { method: 'PATCH', body, signal });
}

export async function deleteProject(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(projectPath(id), unknownSchema, { method: 'DELETE', signal });
}

export function listProjectSources(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiProjectSource[]> {
  return listItems(client, projectPath(id, '/sources'), projectSourceListSchema, { signal });
}

export function createProjectSource(
  client: CortexApiClient,
  id: string,
  body: { label: string; kind?: string; url?: string },
  signal?: AbortSignal,
): Promise<ApiProjectSource> {
  return client.request(projectPath(id, '/sources'), projectSourceSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export async function deleteProjectSource(
  client: CortexApiClient,
  id: string,
  sourceId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(
    projectPath(id, `/sources/${encodeURIComponent(sourceId)}`),
    unknownSchema,
    { method: 'DELETE', signal },
  );
}

/* ------------------------------------------------------------------------- */
/* Research                                                                  */
/* ------------------------------------------------------------------------- */

export function listResearchTasks(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiResearchTask[]> {
  return listItems(client, RESEARCH, researchTaskListSchema, { signal });
}

export function createResearchTask(
  client: CortexApiClient,
  body: { question: string },
  signal?: AbortSignal,
): Promise<ApiResearchTask> {
  return client.request(RESEARCH, researchTaskSchema, { method: 'POST', body, signal });
}

/* ------------------------------------------------------------------------- */
/* Preferences                                                               */
/* ------------------------------------------------------------------------- */

export function getChatPreferences(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiChatPreferences> {
  return client.request('/v1/me/preferences', chatPreferencesSchema, { signal });
}

export function putChatPreferences(
  client: CortexApiClient,
  body: ApiChatPreferences,
  signal?: AbortSignal,
): Promise<ApiChatPreferences> {
  return client.request('/v1/me/preferences', chatPreferencesSchema, {
    method: 'PUT',
    body,
    signal,
  });
}
