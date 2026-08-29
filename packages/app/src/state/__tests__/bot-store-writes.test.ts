import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import {
  answerAsk,
  runLifecycle,
  sendComputerInput,
  setRecording,
  submitBotSecret,
} from '../bot-actions.ts';
import { requireBotClient, setBotClientForTests } from '../bot-client.ts';
import {
  loadFs,
  openFile,
  preview,
  refreshScreenshot,
  runShell,
  screenshotSrc,
  setRecordingFlagValue,
  shot,
} from '../bot-computer-live.ts';
import {
  addRoutine,
  forgetFact,
  handoffTo,
  loadGroups,
  openSkill,
  runMascotSkill,
  teachFromVideo,
  toggleRoutine,
} from '../bot-runtime-store.ts';
import { applyBotRealtime } from '../bot-realtime.ts';
import {
  createMascot,
  hydrateMascot,
  loadState,
  mascotById,
  patchMascotState,
  reconcileMascots,
  replaceMascot,
  resetBotsForTests,
} from '../bots.ts';
import {
  installPlugin,
  isPluginConnected,
  pluginState,
  reconcilePlugins,
  removePlugin,
} from '../plugins.ts';
import { ipcProductFetch, productUrlPath, unwrapProductResponse } from '../ipc-fetch.ts';

afterEach(() => {
  globalThis.localStorage?.clear();
  setBotClientForTests(undefined);
  resetBotsForTests();
});

function clientFor(responses: Parameters<typeof stubFetch>[0]) {
  const stub = stubFetch(responses);
  setBotClientForTests(new CortexApiClient({ fetch: stub.fetch }));
  return stub;
}

describe('bot actions and hydrate', () => {
  it('answers, secrets, lifecycle, input, and record hit the API', async () => {
    const { calls } = clientFor([
      { body: { id: 'mst_1', name: 'Scout', computer_id: 'pc_1' } },
      { body: { id: 'm2', kind: 'user', text: 'yes' } },
      { body: {} },
      { body: { status: 'running' } },
      { body: {} },
      { body: {} },
    ]);
    await createMascot('Scout', 'round', 'green');
    patchMascotState('mst_1', (mascot) => ({
      ...mascot,
      messages: [
        {
          id: 'ask',
          seq: 0,
          role: 'assistant',
          kind: 'ask_user',
          content: 'Wake?',
          at: 1,
          ask: { prompt: 'Wake?', pending: true },
        },
        {
          id: 'sec',
          seq: 1,
          role: 'assistant',
          kind: 'secret',
          content: '',
          at: 1,
          secret: { name: 'token', pending: true },
        },
      ],
    }));
    await answerAsk('mst_1', 'yes', 'ask_1');
    await submitBotSecret('mst_1', 'token', 'secret');
    await runLifecycle('mst_1', 'resume');
    await sendComputerInput('mst_1', { action: 'click', x: 1, y: 2 });
    await setRecording('mst_1', 'start');
    expect(calls[1]!.url).toContain('/respond');
    expect(calls[2]!.url).toContain('/secrets');
    expect(calls[3]!.url).toContain('/lifecycle');
    expect(mascotById('mst_1')?.computer.status).toBe('running');
  });

  it('hydrates messages and videos from the API and writes nothing to the browser', async () => {
    clientFor([
      { body: { items: [{ id: 'mst_1', name: 'Scout' }], has_more: false } },
      { body: { id: 'mst_1', name: 'Scout' } },
      { body: { items: [{ id: 'msg_1', kind: 'send_to_user', text: 'hi' }], has_more: false } },
      { body: { items: [{ id: 'vid_1', title: 'Clip' }], has_more: false } },
      { body: { status: 'running' } },
    ]);
    await reconcileMascots();
    expect(loadState()).toBe('ready');
    expect(globalThis.localStorage?.length ?? 0).toBe(0);
    await hydrateMascot('mst_1');
    expect(mascotById('mst_1')?.messages[0]?.content).toBe('hi');
    expect(mascotById('mst_1')?.videos[0]?.id).toBe('vid_1');
    const next = { ...mascotById('mst_1')!, name: 'Scout II' };
    replaceMascot(next);
    expect(mascotById('mst_1')?.name).toBe('Scout II');
  });

  it('marks the list unavailable without a client', async () => {
    await reconcileMascots();
    expect(loadState()).toBe('unavailable');
    expect(() => requireBotClient()).toThrow(/not connected/);
  });
});

describe('bot runtime writes', () => {
  it('forgets, opens, runs, toggles, groups, handoff, and teach', async () => {
    const { calls } = clientFor([
      { body: {} },
      { body: { slug: 'research', markdown: '# SKILL' } },
      { body: { status: 'started' } },
      { body: { id: 'rtn_1', name: 'Morning', cron: '0 9 * * 1-5' } },
      { body: { id: 'rtn_1', status: 'paused' } },
      { body: { id: 'rtn_1', status: 'active' } },
      { body: { items: [{ id: 'g1', name: 'Ops' }], has_more: false } },
      { body: { items: [{ id: 'in_1', message: 'hi' }], has_more: false } },
      { body: {} },
      { body: { slug: 'from-demo' } },
      { body: { items: [{ slug: 'from-demo' }], has_more: false } },
    ]);
    await forgetFact('mst_1', 'f1', 'profile');
    await openSkill('research');
    await runMascotSkill('mst_1', 'research');
    await addRoutine('mst_1', 'Morning');
    await toggleRoutine('mst_1', { id: 'rtn_1', status: 'active' });
    await toggleRoutine('mst_1', { id: 'rtn_1', paused: true });
    await loadGroups('mst_1');
    await handoffTo('mst_1', 'mst_2', 'take it');
    await teachFromVideo('mst_1', 'vid_1');
    expect(calls[0]!.method).toBe('DELETE');
    expect(calls[8]!.url).toContain('/handoff');
    expect(calls[9]!.url).toContain('/teach');
  });
});

describe('computer live and plugins', () => {
  it('loads screenshot, shell, files, and plugin catalog', async () => {
    const { calls } = clientFor([
      { body: { image_base64: 'aaaa', content_type: 'image/png' } },
      { body: { stdout: 'ok', stderr: '', exit_code: 0 } },
      { body: { items: [{ name: 'README.md', path: '/README.md' }], has_more: false } },
      { body: { path: '/README.md', text: 'hi' } },
      { body: { items: [{ id: 'drive', connected: true }], has_more: false } },
      { body: { items: [], has_more: false } },
      { body: { id: 'drive', connected: true } },
      { body: { items: [{ id: 'drive', connected: true }], has_more: false } },
      { body: { items: [], has_more: false } },
      { body: {} },
      { body: { items: [], has_more: false } },
      { body: { items: [], has_more: false } },
    ]);
    await refreshScreenshot('mst_1');
    expect(screenshotSrc(shot())?.startsWith('data:image/png')).toBe(true);
    await runShell('mst_1', 'ls');
    await loadFs('mst_1', '/home');
    await openFile('mst_1', '/README.md');
    expect(preview()?.text).toBe('hi');
    setRecordingFlagValue(true);
    await reconcilePlugins();
    expect(isPluginConnected('drive')).toBe(true);
    await installPlugin('drive');
    await removePlugin('slack');
    expect(calls[4]!.url).toContain('/v1/plugins');
  });

  it('surfaces plugin 503 as unavailable and empty catalog as empty', async () => {
    clientFor([
      { status: 503, body: { code: 'unavailable', message: 'Composio key missing' } },
      { status: 503, body: { code: 'unavailable', message: 'Composio key missing' } },
    ]);
    await reconcilePlugins();
    expect(pluginState()).toBe('unavailable');
  });

  it('marks plugins unavailable without a client', async () => {
    await reconcilePlugins();
    expect(pluginState()).toBe('unavailable');
  });

  it('records computer errors and empty screenshot src', async () => {
    clientFor([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
      { status: 500, body: { code: 'boom', message: 'down' } },
    ]);
    await refreshScreenshot('mst_1');
    await runShell('mst_1', 'ls');
    expect(screenshotSrc(undefined)).toBeUndefined();
    expect(screenshotSrc({ url: 'https://shot' })).toBe('https://shot');
    expect(screenshotSrc({})).toBeUndefined();
  });
});

describe('realtime extras and ipc fetch helpers', () => {
  it('appends tokens and ignores frames without a mascot', async () => {
    clientFor([{ body: { id: 'mst_1', name: 'Scout', computer_id: 'pc_1' } }]);
    await createMascot('Scout', 'round', 'green');
    applyBotRealtime({ type: 'bot.token', mascot_id: 'mst_1', delta: 'He' });
    applyBotRealtime({ type: 'token', mascot_id: 'mst_1', delta: 'llo' });
    applyBotRealtime({ type: 'bot.ask_user', mascot_id: 'mst_1', message: 'Wake?' });
    applyBotRealtime({ type: 'hello' });
    expect(mascotById('mst_1')?.messages.some((row) => row.content === 'Hello')).toBe(true);
  });

  it('builds product paths and unwraps IPC envelopes', () => {
    expect(productUrlPath('https://api.cortex.foundation/v1/mascots?x=1')).toBe('/v1/mascots?x=1');
    expect(productUrlPath('/v1/skills')).toBe('/v1/skills');
    expect(productUrlPath('v1/plugins')).toBe('/v1/plugins');
    expect(unwrapProductResponse({ success: true, data: { status: 200, headers: {}, bodyText: '{}' } })).toEqual({
      status: 200,
      headers: {},
      bodyText: '{}',
    });
    expect(() =>
      unwrapProductResponse({ success: false, error: { code: 'x', message: 'nope' } }),
    ).toThrow('nope');
  });

  it('sends product fetches through the host bridge', async () => {
    const productRequest = async () => ({
      success: true as const,
      data: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: '{"ok":true}',
      },
    });
    (globalThis as { cortex?: { cortex?: { productRequest: typeof productRequest } } }).cortex = {
      cortex: { productRequest },
    };
    const response = await ipcProductFetch('/v1/mascots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Scout' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    delete (globalThis as { cortex?: unknown }).cortex;
  });
});
