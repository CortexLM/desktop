import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { CortexApiError } from '../errors.ts';
import {
  backendTooOldCopy,
  classifyBotError,
  farmOfflineCopy,
  isNotFound,
  isServiceUnavailable,
} from '../bot-errors.ts';
import {
  addMemory,
  createBotTask,
  createSkill,
  deleteRoutine,
  deleteSkill,
  getBotTask,
  getSkill,
  listBotGroups,
  listBotInbox,
  pauseRoutine,
  postBotInbox,
  postHandoff,
  postTeach,
  resumeRoutine,
} from '../bot-grok.ts';
import { mascotPath, skillPath as skillPathFn, withQuery } from '../bot-paths.ts';
import { disconnectPlugin } from '../bot-plugins.ts';
import {
  inboxItemSchema,
  memoryFactSchema,
  routineRowSchema,
  skillRowSchema,
} from '../bot-grok-schemas.ts';
import { stubFetch } from './fixtures.ts';

function clientFor(responses: Parameters<typeof stubFetch>[0]) {
  const stub = stubFetch(responses);
  return { client: new CortexApiClient({ fetch: stub.fetch }), calls: stub.calls };
}

describe('bot paths', () => {
  it('encodes ids and drops empty query values', () => {
    expect(mascotPath('mst/1', '/memory')).toBe('/v1/mascots/mst%2F1/memory');
    expect(skillPathFn('research', '/run')).toBe('/v1/skills/research/run');
    expect(withQuery('/v1/x', { tier: 'profile', extra: undefined })).toBe('/v1/x?tier=profile');
    expect(withQuery('/v1/x', { tier: '' })).toBe('/v1/x');
  });
});

describe('grok writes', () => {
  it('covers memory, skill, routine, task, inbox, groups, handoff, teach', async () => {
    const { client, calls } = clientFor([
      { body: { id: 'f2', tier: 'note', text: 'prefers dark' } },
      { body: { slug: 'research', markdown: '# SKILL' } },
      { body: { slug: 'draft', name: 'Draft' } },
      { body: {} },
      { body: {} },
      { body: { id: 'rtn_1', status: 'paused' } },
      { body: { id: 'rtn_1', status: 'active' } },
      { body: { id: 'tsk_1', title: 'Scout', status: 'running' } },
      { body: { id: 'tsk_1', status: 'done' } },
      { body: { items: [{ id: 'in_1', message: 'hi' }], has_more: false } },
      { body: { id: 'in_2', message: 'pong' } },
      { body: { items: [{ id: 'grp_1', name: 'Ops' }], has_more: false } },
      { body: {} },
      { body: { slug: 'from-demo', name: 'From demo' } },
    ]);
    expect((await addMemory(client, 'mst_1', { tier: 'note', text: 'prefers dark' })).id).toBe('f2');
    expect((await getSkill(client, 'research')).markdown).toBe('# SKILL');
    expect((await createSkill(client, { slug: 'draft' })).slug).toBe('draft');
    await deleteSkill(client, 'draft');
    await deleteRoutine(client, 'mst_1', 'rtn_1');
    expect((await pauseRoutine(client, 'mst_1', 'rtn_1')).status).toBe('paused');
    expect((await resumeRoutine(client, 'mst_1', 'rtn_1')).status).toBe('active');
    expect((await createBotTask(client, 'mst_1', { title: 'Scout' })).id).toBe('tsk_1');
    expect((await getBotTask(client, 'mst_1', 'tsk_1')).status).toBe('done');
    expect((await listBotInbox(client, 'mst_1'))[0]?.id).toBe('in_1');
    expect((await postBotInbox(client, 'mst_1', { message: 'pong' })).message).toBe('pong');
    expect((await listBotGroups(client, 'mst_1'))[0]?.name).toBe('Ops');
    await postHandoff(client, 'mst_1', { to_mascot_id: 'mst_2', message: 'take it' });
    expect((await postTeach(client, 'mst_1', { video_id: 'vid_1' })).slug).toBe('from-demo');
    expect(calls[1]!.url).toContain(skillPathFn('research'));
    expect(calls[12]!.url).toContain('/handoff');
    expect(calls[13]!.url).toContain('/teach');
  });
});

describe('plugin disconnect and honest errors', () => {
  it('disconnects through DELETE and classifies unknown failures', async () => {
    const { client, calls } = clientFor([{ body: {} }]);
    await disconnectPlugin(client, 'slack');
    expect(calls[0]!.method).toBe('DELETE');
    expect(calls[0]!.url).toContain('/plugins/slack/connect');

    const api = new CortexApiError('RATE_LIMITED', 'slow down', { status: 429 });
    expect(classifyBotError(api).code).toBe('RATE_LIMITED');
    expect(classifyBotError(new Error('boom')).code).toBe('UNKNOWN_ERROR');
    expect(isNotFound(api)).toBe(false);
    expect(isServiceUnavailable(api)).toBe(false);

    const empty503 = new CortexApiError('unavailable', '', { status: 503 });
    expect(classifyBotError(empty503).message).toBe(
      'Plugins are not configured on this backend.',
    );
    expect(isServiceUnavailable(empty503)).toBe(true);
    expect(isNotFound(new CortexApiError('not_found', 'gone', { status: 404 }))).toBe(true);
    expect(backendTooOldCopy('Skills')).toEqual({
      title: 'Backend too old',
      body: 'Skills needs a newer Cortex API. This client will not invent a local copy.',
    });
    expect(farmOfflineCopy().title).toBe('Computer offline');
  });
});

describe('grok schemas', () => {
  it('keeps extra keys and optional fields', () => {
    expect(memoryFactSchema.parse({ id: 'f1', extra: true }).extra).toBe(true);
    expect(skillRowSchema.parse({ slug: 's' }).name).toBeUndefined();
    expect(routineRowSchema.parse({ id: 'r', cron: '0 9 * * 1-5' }).cron).toBe('0 9 * * 1-5');
    expect(inboxItemSchema.parse({ message: 'hello' }).message).toBe('hello');
  });
});
