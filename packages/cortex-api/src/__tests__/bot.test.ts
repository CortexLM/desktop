import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { CortexApiError } from '../errors.ts';
import {
  BACKEND_TOO_OLD,
  classifyBotError,
  isAccountRequired,
  PLUGIN_UNAVAILABLE,
} from '../bot-errors.ts';
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
  postComputerControl,
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
} from '../bot-runtime.ts';
import {
  connectPlugin,
  getPluginCatalog,
  listPluginConnections,
  listPlugins,
  setPluginSurfaces,
} from '../bot-plugins.ts';
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

  it('takes computer control and keeps an https stream URL on the ticket', async () => {
    const { client, calls } = clientFor([
      { body: { id: 'pc_1', status: 'running', control_holder: 'user' } },
      { body: { ticket_hash: 'abc', stream_url: 'https://farm.example/vnc' } },
      { body: { id: 'pc_1', status: 'running', runtime: 'cloud' } },
    ]);
    const taken = await postComputerControl(client, 'mst_1', 'take');
    const ticket = await createVncTicket(client, 'mst_1');
    const woken = await postLifecycle(client, 'mst_1', 'resume', { runtime: 'cloud' });
    expect(taken.control_holder).toBe('user');
    expect(ticket).toEqual({ ticket_hash: 'abc', stream_url: 'https://farm.example/vnc' });
    expect(woken.runtime).toBe('cloud');
    expect(calls[0]!.url).toContain('/computer/control');
    expect(calls[0]!.body).toEqual({ action: 'take' });
    expect(calls[2]!.body).toEqual({ action: 'resume', runtime: 'cloud' });
  });
});

describe('bot schemas', () => {
  it('accepts extra farm fields without inventing a running box', () => {
    expect(mascotRowSchema.parse({ id: 'mst_1', extra: 1 }).id).toBe('mst_1');
    expect(computerRowSchema.parse({ status: 'offline', provider: 'mock' }).provider).toBe('mock');
  });
});

describe('bot runtime', () => {
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
  it('reads the marketplace catalogue whole, is_live and provider included', async () => {
    // Shape observed live 2026-08-29; see CONTRACT.md.
    const { client, calls } = clientFor([
      {
        body: {
          items: [
            {
              slug: 'gmail',
              name: 'Gmail',
              description: 'Email.',
              category: 'email',
              auth: 'oauth2',
              managed_auth: true,
              logo_url: 'https://logos.composio.dev/api/gmail',
              tool_count: 61,
            },
          ],
          is_live: true,
          provider: 'composio',
          source: 'marketplace',
        },
      },
      { body: { items: [], has_more: false } },
      { body: {} },
    ]);

    const catalogue = await getPluginCatalog(client);
    expect(await listPluginConnections(client)).toEqual([]);
    await connectPlugin(client, 'gmail', ['chat', 'bot']);

    expect(catalogue.is_live).toBe(true);
    expect(catalogue.provider).toBe('composio');
    expect(catalogue.items[0]?.slug).toBe('gmail');
    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/plugins/catalog');
    expect(calls[1]!.url).toBe('https://api.cortex.foundation/v1/plugins/connections');
    expect(calls[2]!.url).toContain('/plugins/gmail/connect');
  });

  it('carries is_live: false through rather than reading it as an empty catalogue', async () => {
    const { client } = clientFor([
      { body: { items: [], is_live: false, provider: 'composio' } },
    ]);
    expect((await getPluginCatalog(client)).is_live).toBe(false);
  });

  it('keeps an unknown item shape rather than dropping the row', async () => {
    // Only `slug` is required: a card with no description beats a parse failure
    // that empties the page because one app grew a field.
    const { client } = clientFor([
      { body: { items: [{ slug: 'novel', unheard_of: true }], is_live: true } },
    ]);
    expect((await getPluginCatalog(client)).items[0]?.slug).toBe('novel');
  });

  it('keeps a live 404 as CortexApiError, not an empty catalog', async () => {
    const { client } = clientFor([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    const error = await getPluginCatalog(client).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CortexApiError);
    expect((error as CortexApiError).code).toBe('not_found');
  });
});

describe('plugin surfaces', () => {
  it('connects on the surfaces the caller chose', async () => {
    const { client, calls } = clientFor([{ body: {} }]);

    await connectPlugin(client, 'gmail', ['chat']);

    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.body).toEqual({ surfaces: ['chat'] });
  });

  it('re-assigns a connection with PATCH on the same route', async () => {
    const { client, calls } = clientFor([{ body: {} }]);

    await setPluginSurfaces(client, 'gmail', ['bot']);

    expect(calls[0]!.method).toBe('PATCH');
    expect(calls[0]!.url).toContain('/v1/plugins/gmail/connect');
    expect(calls[0]!.body).toEqual({ surfaces: ['bot'] });
  });

  it('refuses to send a connection assigned to nothing', async () => {
    // A connection on neither surface is reachable from neither product, so it
    // is a Disconnect. The request is not made rather than being made and lost.
    const { client, calls } = clientFor([{ body: {} }]);

    await expect(setPluginSurfaces(client, 'gmail', [])).rejects.toThrow(/at least one surface/i);
    await expect(connectPlugin(client, 'gmail', [])).rejects.toThrow(/at least one surface/i);
    expect(calls).toEqual([]);
  });

  it('reads an assignment off a connection row', async () => {
    const { client } = clientFor([
      {
        body: {
          items: [{ id: 'con_1', toolkit_slug: 'gmail', surfaces: ['chat'] }],
          has_more: false,
        },
      },
    ]);

    expect((await listPluginConnections(client))[0]?.surfaces).toEqual(['chat']);
  });

  it('keeps a row whose surfaces this client has no switch for', async () => {
    // A third surface must cost the user a switch, not the whole page.
    const { client } = clientFor([
      {
        body: {
          items: [{ id: 'con_1', toolkit_slug: 'gmail', surfaces: ['chat', 'inbox'] }],
          has_more: false,
        },
      },
    ]);

    expect((await listPluginConnections(client))[0]?.surfaces).toEqual(['chat', 'inbox']);
  });
});

describe('isAccountRequired', () => {
  /** Both bodies are verbatim from the live service, 2026-08-29. */
  const guestRefusal = {
    status: 403,
    body: {
      type: 'https://docs.cortex.sh/problems/entitlement_required',
      title: 'Your plan does not include this',
      status: 403,
      code: 'entitlement_required',
      detail:
        'Connecting an app needs an account: a guest session cannot be signed back into to revoke it later. Sign in first.',
    },
  };

  const noSession = {
    status: 401,
    body: {
      type: 'https://docs.cortex.sh/problems/unauthenticated',
      title: 'Authentication required',
      status: 401,
      code: 'unauthenticated',
      detail: 'No session. Sign in, or begin a guest session at POST /v1/auth/guest.',
    },
  };

  async function connectError(reply: { status: number; body: unknown }) {
    const { client } = clientFor([reply]);
    return connectPlugin(client, 'gmail', ['chat', 'bot']).catch((caught: unknown) => caught);
  }

  it('recognises the guest refusal on connect', async () => {
    expect(isAccountRequired(await connectError(guestRefusal))).toBe(true);
  });

  it('recognises no session at all', async () => {
    expect(isAccountRequired(await connectError(noSession))).toBe(true);
  });

  it('does not mistake a plan gate for a missing account', async () => {
    // Same code, different reason. Sending a signed-in user to a sign-in screen
    // because their plan is too small is a worse dead end than the message.
    const planGate = {
      status: 403,
      body: {
        title: 'Your plan does not include this',
        code: 'entitlement_required',
        detail: 'This workspace is on the free plan. Upgrade to connect more than one app.',
      },
    };
    expect(isAccountRequired(await connectError(planGate))).toBe(false);
  });

  it('leaves a server failure alone, since signing in would not fix it', async () => {
    const down = { status: 503, body: { code: 'unavailable', message: 'Marketplace down' } };
    expect(isAccountRequired(await connectError(down))).toBe(false);
    expect(isAccountRequired(new Error('offline'))).toBe(false);
  });
});
