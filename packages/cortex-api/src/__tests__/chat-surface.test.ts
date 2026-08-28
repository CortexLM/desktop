import { describe, expect, it } from 'vitest';

import {
  createLibraryItem,
  createPlanningTask,
  createProjectSource,
  createResearchTask,
  deleteLibraryItem,
  deletePlanningTask,
  deleteProject,
  deleteProjectSource,
  getChatPreferences,
  getProject,
  listLibraryItems,
  listPlanningRuns,
  listPlanningTasks,
  listProjectSources,
  listResearchTasks,
  patchPlanningTask,
  patchProject,
  putChatPreferences,
  runPlanningTask,
} from '../chat-surface.ts';
import { CortexApiClient } from '../client.ts';
import { isCortexApiError } from '../errors.ts';
import { stubFetch } from './fixtures.ts';

const BASE = 'https://api.cortex.foundation';

function client(responses: Parameters<typeof stubFetch>[0]) {
  const { fetch, calls } = stubFetch(responses);
  return { client: new CortexApiClient({ fetch }), calls };
}

function routes(calls: ReturnType<typeof stubFetch>['calls']): string[] {
  return calls.map((call) => `${call.method} ${call.url.slice(BASE.length)}`);
}

describe('Planning', () => {
  it('reads the account schedule', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'todays-notes', title: "Today's notes", status: 'active' }] } },
    ]);

    const tasks = await listPlanningTasks(api);

    expect(calls[0]!.url).toBe(`${BASE}/v1/planning/tasks`);
    expect(tasks[0]?.id).toBe('todays-notes');
  });

  it('creates, patches, runs, lists runs and deletes', async () => {
    const { client: api, calls } = client([
      { body: { id: 'tsk_1', title: 'Week ahead' } },
      { body: { id: 'tsk_1', status: 'paused' } },
      { body: { id: 'run_1', task_id: 'tsk_1', conversation_id: 'cnv_5' } },
      { body: { items: [{ id: 'run_1', task_id: 'tsk_1' }] } },
      { status: 204 },
    ]);

    await createPlanningTask(api, {
      title: 'Week ahead',
      cadence: 'weekly',
      template_id: 'week-ahead',
    });
    await patchPlanningTask(api, 'tsk_1', { status: 'paused' });
    const run = await runPlanningTask(api, 'tsk_1');
    await listPlanningRuns(api, 'tsk_1');
    await deletePlanningTask(api, 'tsk_1');

    expect(routes(calls)).toEqual([
      'POST /v1/planning/tasks',
      'PATCH /v1/planning/tasks/tsk_1',
      'POST /v1/planning/tasks/tsk_1/run',
      'GET /v1/planning/tasks/tsk_1/runs',
      'DELETE /v1/planning/tasks/tsk_1',
    ]);
    expect(calls[0]!.body).toEqual({
      title: 'Week ahead',
      cadence: 'weekly',
      template_id: 'week-ahead',
    });
    // The run names the conversation it landed in, so the UI links to a real thread.
    expect(run.conversation_id).toBe('cnv_5');
  });

  it('keeps a missing planning route as not_found', async () => {
    const { client: api } = client([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);

    await expect(listPlanningTasks(api)).rejects.toSatisfy(
      (error: unknown) => isCortexApiError(error) && error.code === 'not_found',
    );
  });
});

describe('Library', () => {
  it('lists, saves an answer linked to its thread, and deletes', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'lib_1', title: 'Tokyo plan', kind: 'answer' }] } },
      { body: { id: 'lib_2', title: 'Saved', kind: 'answer' } },
      { status: 204 },
    ]);

    const items = await listLibraryItems(api);
    await createLibraryItem(api, {
      title: 'Saved',
      kind: 'answer',
      excerpt: 'the answer',
      conversation_id: 'cnv_1',
    });
    await deleteLibraryItem(api, 'lib_2');

    expect(items[0]?.title).toBe('Tokyo plan');
    expect(calls[1]!.body).toEqual({
      title: 'Saved',
      kind: 'answer',
      excerpt: 'the answer',
      conversation_id: 'cnv_1',
    });
    expect(routes(calls)[2]).toBe('DELETE /v1/library/lib_2');
  });
});

describe('Projects and sources', () => {
  it('reads, edits and deletes a project', async () => {
    const { client: api, calls } = client([
      { body: { id: 'proj_1', name: 'Brief', brief: 'why' } },
      { body: { id: 'proj_1', brief: 'updated' } },
      { status: 204 },
    ]);

    const project = await getProject(api, 'proj_1');
    await patchProject(api, 'proj_1', { brief: 'updated' });
    await deleteProject(api, 'proj_1');

    expect(project.brief).toBe('why');
    expect(routes(calls)).toEqual([
      'GET /v1/projects/proj_1',
      'PATCH /v1/projects/proj_1',
      'DELETE /v1/projects/proj_1',
    ]);
  });

  it('attaches and detaches a source', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'src_1', label: 'notes.md', kind: 'file' }] } },
      { body: { id: 'src_2', label: 'https://example', kind: 'url' } },
      { status: 204 },
    ]);

    const sources = await listProjectSources(api, 'proj_1');
    await createProjectSource(api, 'proj_1', {
      label: 'https://example',
      kind: 'url',
      url: 'https://example',
    });
    await deleteProjectSource(api, 'proj_1', 'src_2');

    expect(sources[0]?.label).toBe('notes.md');
    expect(routes(calls)).toEqual([
      'GET /v1/projects/proj_1/sources',
      'POST /v1/projects/proj_1/sources',
      'DELETE /v1/projects/proj_1/sources/src_2',
    ]);
  });
});

describe('Research', () => {
  it('lists runs and queues one', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'res_1', question: 'Who ships fastest?', status: 'running' }] } },
      { body: { id: 'res_2', question: 'Why?', status: 'queued' } },
    ]);

    const runs = await listResearchTasks(api);
    await createResearchTask(api, { question: 'Why?' });

    expect(runs[0]?.status).toBe('running');
    expect(routes(calls)).toEqual(['GET /v1/research/tasks', 'POST /v1/research/tasks']);
    expect(calls[1]!.body).toEqual({ question: 'Why?' });
  });
});

describe('Chat preferences', () => {
  it('reads them and sends only what changed', async () => {
    const { client: api, calls } = client([
      { body: { stream_replies: false, notify_on_mentions: true } },
      { body: { stream_replies: true, notify_on_mentions: true } },
    ]);

    const read = await getChatPreferences(api);
    await putChatPreferences(api, { stream_replies: true });

    expect(read.stream_replies).toBe(false);
    expect(routes(calls)).toEqual(['GET /v1/me/preferences', 'PUT /v1/me/preferences']);
    // One field, so a second tab's setting is not overwritten.
    expect(calls[1]!.body).toEqual({ stream_replies: true });
  });
});
