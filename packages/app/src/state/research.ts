/**
 * Research — deep-research runs.
 *
 * The screen was a placeholder: a signed-out gate or "Nothing is queued", with no
 * store, no client, and no way to start anything. It now reads the account's runs
 * and can queue one.
 *
 * There is no local fallback. A research run is minutes of server work against
 * live sources; a browser cannot do any part of it, so when the backend has no
 * route the screen says so rather than showing an empty queue that would imply
 * the feature works and the user simply has not used it.
 */

import {
  createResearchTask,
  listResearchTasks,
  type ApiResearchTask,
} from '@cortex-ide/cortex-api';

import { createRemoteCollection } from './remote-collection.ts';

export type ResearchStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ResearchRun {
  id: string;
  question: string;
  status: ResearchStatus;
  sourceCount: number;
  conversationId?: string;
}

const STATUSES: readonly ResearchStatus[] = ['queued', 'running', 'done', 'failed'];

export function toResearchRun(row: ApiResearchTask): ResearchRun {
  const run: ResearchRun = {
    id: row.id,
    question: row.question ?? 'Research',
    status: STATUSES.find((status) => status === row.status) ?? 'queued',
    sourceCount: row.source_count ?? 0,
  };
  if (row.conversation_id) run.conversationId = row.conversation_id;
  return run;
}

const collection = createRemoteCollection<ResearchRun>({
  label: 'Research',
  load: async (client) => (await listResearchTasks(client)).map(toResearchRun),
});

export const researchRuns = collection.items;
export const researchState = collection.state;
export const researchError = collection.error;
export const loadResearch = collection.reload;
export const resetResearchForTests = collection.reset;

export function startResearch(question: string): Promise<void> {
  const trimmed = question.trim();
  if (!trimmed) return Promise.resolve();
  return collection.mutate((client) => createResearchTask(client, { question: trimmed }));
}
