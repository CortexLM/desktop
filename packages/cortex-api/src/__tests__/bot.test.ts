import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { CortexApiError } from '../errors.ts';
import { BACKEND_TOO_OLD, classifyBotError, PLUGIN_UNAVAILABLE } from '../bot-errors.ts';
import {
  createMascot,
  deleteMascot,
  getMascot,
  listMascotMessages,
  listMascots,
  patchMascot,
  postAskUser,
  postMascotMessage,
  postRespond,
  postSecret,
} from '../bot-mascots.ts';
import {
  createVncTicket,
  getComputer,
  getCursor,
  getScreenshot,
  listComputerFs,
  listMascotVideos,
  postComputerInput,
  postLifecycle,
  postRecord,
  postShell,
  readComputerFile,
} from '../bot-computer.ts';
import { computerRowSchema, mascotRowSchema } from '../bot-schemas.ts';
import {
  DEFAULT_ROUTINE_CRON,
  createRoutine,
  forgetMemory,
  listMemory,
  listRoutines,
  listSkills,
  runSkill,
} from '../bot-grok.ts';
import { connectPlugin, listPluginConnections, listPlugins } from '../bot-plugins.ts';
import { stubFetch } from './fixtures.ts';

function clientFor(responses: Parameters<typeof stubFetch>[0]) {
  const stub = stubFetch(responses);
  return { client: new CortexApiClient({ fetch: stub.fetch }), calls: stub.calls };
}

describe('mascot writes', () => {
  it('creates a mascot on POST /v1/mascots', async () => {
    const { client, calls } = clientFor([{ body: { id: 'mst_1', name: 'Scout', computer_id: 'pc_1' } }]);
    const created = await createMascot(client, { name: 'Scout', shape: 'round', color: 'green' });
    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/mascots');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.body).toEqual({ name: 'Scout', shape: 'round', color: 'green' });
    expect(created.id).toBe('mst_1');
  });

  it('posts a message to the mascot, not a local store', async () => {
    const { client, calls } = clientFor([
      { body: { id: 'msg_1', role: 'user', kind: 'user', text: 'hello' } },
    ]);
    await postMascotMessage(client, 'mst_1', { text: 'hello' });
    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/mascots/mst_1/messages');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.body).toEqual({ text: 'hello' });
  });

  it('lists messages and answers an ask-user', async () => {
    const { client, calls } = clientFor([
      { body: { items: [{ id: 'm1', kind: 'ask_user', text: 'Wake?' }], has_more: false } },
      { body: { id: 'm2', role: 'user', text: 'yes' } },
      { body: {} },
    ]);
    const messages = await listMascotMessages(client, 'mst_1');
    await postRespond(client, 'mst_1', { ask_id: 'ask_1', text: 'yes' });
    await postSecret(client, 'mst_1', { name: 'token', value: 'secret' });
    expect(messages[0]?.kind).toBe('ask_user');
    expect(calls[1]!.url).toContain('/respond');
    expect(calls[2]!.url).toContain('/secrets');
  });

  it('lists, reads, patches, asks, and deletes a mascot on the API', async () => {
    const { client, calls } = clientFor([
      { body: { items: [{ id: 'mst_1', name: 'Scout' }], has_more: false } },
      { body: { id: 'mst_1', name: 'Scout' } },
      { body: { id: 'mst_1', name: 'Scout II' } },
      { body: { id: 'ask_1', kind: 'ask_user', text: 'Wake?' } },
      { body: {} },
    ]);
    expect((await listMascots(client))[0]?.id).toBe('mst_1');
    expect((await getMascot(client, 'mst_1')).name).toBe('Scout');
    expect((await patchMascot(client, 'mst_1', { name: 'Scout II' })).name).toBe('Scout II');
    expect((await postAskUser(client, 'mst_1', { prompt: 'Wake?', options: ['yes'] })).kind).toBe(
      'ask_user',
    );
    await deleteMascot(client, 'mst_1');
    expect(calls[2]!.method).toBe('PATCH');
    expect(calls[3]!.url).toContain('/ask-user');
    expect(calls[4]!.method).toBe('DELETE');
  });
});

describe('computer', () => {
  it('hibernates through lifecycle and lists videos from the API', async () => {
    const { client, calls } = clientFor([
      { body: { id: 'pc_1', status: 'hibernated' } },
      { body: { items: [{ id: 'vid_1', title: 'Clip' }], has_more: false } },
      { body: {} },
    ]);
    const computer = await postLifecycle(client, 'mst_1', 'hibernate');
    const videos = await listMascotVideos(client, 'mst_1');
    await postRecord(client, 'mst_1', { action: 'start' });
    expect(computer.status).toBe('hibernated');
    expect(videos[0]?.id).toBe('vid_1');
    expect(calls[0]!.url).toContain('/computer/lifecycle');
    expect(calls[0]!.body).toEqual({ action: 'hibernate' });
    expect(calls[1]!.url).toContain('/videos');
    expect(calls[2]!.url).toContain('/record');
  });

  it('sends pointer input and reads a screenshot', async () => {
    const { client, calls } = clientFor([
      { body: { image_base64: 'aaaa', content_type: 'image/png' } },
      { body: {} },
      { body: {} },
      { body: { stdout: 'ok', exit_code: 0 } },
      { body: { status: 'running', provider: 'farm' } },
    ]);
    const shot = await getScreenshot(client, 'mst_1');
    await postComputerInput(client, 'mst_1', { action: 'click', x: 10, y: 20 });
    await postComputerInput(client, 'mst_1', { action: 'drag', x: 10, y: 20, x2: 80, y2: 90 });
    const shell = await postShell(client, 'mst_1', 'ls');
    const box = await getComputer(client, 'mst_1');
    expect(shot.image_base64).toBe('aaaa');
    expect(shell.exit_code).toBe(0);
    expect(box.status).toBe('running');
    expect(calls[1]!.body).toEqual({ action: 'click', x: 10, y: 20 });
    expect(calls[2]!.body).toEqual({ action: 'drag', x: 10, y: 20, x2: 80, y2: 90 });
    expect(calls[3]!.url).toContain('/computer/shell');
  });

  it('sends scroll, type, and lists the default fs root', async () => {
    const { client, calls } = clientFor([
      { body: {} },
      { body: {} },
      { body: { items: [{ name: '.' }], has_more: false } },
    ]);
    await postComputerInput(client, 'mst_1', { action: 'scroll', dx: 0, dy: 40 });
    await postComputerInput(client, 'mst_1', { action: 'type', text: 'ls' });
    expect((await listComputerFs(client, 'mst_1'))[0]?.name).toBe('.');
    expect(calls[0]!.body).toEqual({ action: 'scroll', dx: 0, dy: 40 });
    expect(calls[2]!.url).toContain('/computer/fs?path=%2F');
  });

  it('reads cursor, files, and a VNC hash-only ticket', async () => {
    const { client, calls } = clientFor([
      { body: { x: 12, y: 8 } },
      { body: { items: [{ name: 'README.md', path: '/README.md' }], has_more: false } },
      { body: { path: '/README.md', text: 'hi' } },
      { body: { ticket_hash: 'abc', password: 'drop-me' } },
    ]);
    expect((await getCursor(client, 'mst_1')).x).toBe(12);
    expect((await listComputerFs(client, 'mst_1', '/home'))[0]?.name).toBe('README.md');
    expect((await readComputerFile(client, 'mst_1', '/README.md')).text).toBe('hi');
    const ticket = await createVncTicket(client, 'mst_1');
    expect(ticket).toEqual({ ticket_hash: 'abc' });
    expect(calls[1]!.url).toContain('/computer/fs?path=%2Fhome');
    expect(calls[3]!.url).toContain('/vnc-ticket');
  });
});

describe('bot schemas', () => {
  it('accepts extra farm fields without inventing a running box', () => {
    expect(mascotRowSchema.parse({ id: 'mst_1', extra: 1 }).id).toBe('mst_1');
    expect(computerRowSchema.parse({ status: 'offline', provider: 'mock' }).provider).toBe('mock');
  });
});

describe('grok core', () => {
  it('lists memory, skills, and routines on the real paths', async () => {
    const { client, calls } = clientFor([
      { body: { items: [{ id: 'f1', tier: 'profile', text: 'Likes tea' }], has_more: false } },
      { body: {} },
      { body: { items: [{ slug: 'research', name: 'Research' }], has_more: false } },
      { body: { status: 'started' } },
      { body: { items: [], has_more: false } },
      { body: { id: 'rtn_1', name: 'Morning', cron: DEFAULT_ROUTINE_CRON } },
    ]);
    const facts = await listMemory(client, 'mst_1', 'profile');
    await forgetMemory(client, 'mst_1', { factId: 'f1', tier: 'profile' });
    const skills = await listSkills(client);
    await runSkill(client, 'mst_1', 'research');
    await listRoutines(client, 'mst_1');
    const routine = await createRoutine(client, 'mst_1', { name: 'Morning' });
    expect(facts[0]?.text).toBe('Likes tea');
    expect(skills[0]?.slug).toBe('research');
    expect(routine.cron).toBe(DEFAULT_ROUTINE_CRON);
    expect(calls[0]!.url).toContain('/memory?tier=profile');
    expect(calls[1]!.method).toBe('DELETE');
    expect(calls[2]!.url).toBe('https://api.cortex.foundation/v1/skills');
    expect(calls[3]!.url).toContain('/skills/research/run');
    expect(calls[5]!.body).toMatchObject({ name: 'Morning', cron: DEFAULT_ROUTINE_CRON });
  });

  it('surfaces 404 as backend too old and 503 as plugin unavailable', async () => {
    const missing = clientFor([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    const error = await listMemory(missing.client, 'mst_1', 'log').catch((caught: unknown) => caught);
    expect(classifyBotError(error).code).toBe(BACKEND_TOO_OLD);

    const down = clientFor([
      { status: 503, body: { code: 'unavailable', message: 'Composio key missing' } },
    ]);
    const plugins = await listPlugins(down.client).catch((caught: unknown) => caught);
    expect(classifyBotError(plugins).code).toBe(PLUGIN_UNAVAILABLE);
  });
});

describe('plugins', () => {
  it('lists catalog and connections without inventing Drive or Slack', async () => {
    const { client, calls } = clientFor([
      { body: { items: [], has_more: false } },
      { body: { items: [], has_more: false } },
      { body: { id: 'drive', connected: true } },
    ]);
    expect(await listPlugins(client)).toEqual([]);
    expect(await listPluginConnections(client)).toEqual([]);
    await connectPlugin(client, 'drive');
    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/plugins');
    expect(calls[1]!.url).toBe('https://api.cortex.foundation/v1/plugins/connections');
    expect(calls[2]!.url).toContain('/plugins/drive/connect');
  });

  it('keeps a live 404 as CortexApiError, not an empty catalog', async () => {
    const { client } = clientFor([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    const error = await listPlugins(client).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CortexApiError);
    expect((error as CortexApiError).code).toBe('not_found');
  });
});
