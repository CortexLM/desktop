import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import {
  availableTemplates,
  loadPlanning,
  planningState,
  PLANNING_TEMPLATES,
  resetPlanningForTests,
  scheduledTasks,
  setTaskStatus,
} from '../planning.ts';
import { setBotClientForTests } from '../bot-client.ts';
import { createMascot, mascotById, mascots, reconcileMascots, resetBotsForTests } from '../bots.ts';
import { sendBotMessage } from '../bot-actions.ts';
import { loadMemory, loadRoutines, loadSkills, panelState, resetBotRuntimeForTests } from '../bot-runtime-store.ts';
import { chatProjects, createProject, loadProjects, resetProjectsForTests } from '../projects.ts';
import { harnessStatus } from '../harness.ts';
import { inboxFromSessions, mergeInbox, postInbox } from '../inbox.ts';
import { PLUGIN_CARDS } from '../plugins.ts';
import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';

afterEach(() => {
  globalThis.localStorage?.clear();
  setBotClientForTests(undefined);
  resetBotsForTests();
  resetBotRuntimeForTests();
  resetPlanningForTests();
  resetProjectsForTests();
});

describe('Planning', () => {
  it('keeps four generalist templates then Subnet 100 last', () => {
    expect(PLANNING_TEMPLATES.map((template) => template.id)).toEqual([
      'todays-notes',
      'unread-mentions',
      'week-ahead',
      'evening-recap',
      'subnet-100',
    ]);
    expect(PLANNING_TEMPLATES[4]?.requiresAccount).toBe(true);
  });

  it('reads the schedule from the account rather than seeding one locally', async () => {
    const { fetch, calls } = stubFetch([
      {
        body: {
          items: [
            { id: 'todays-notes', title: "Today's notes", cadence: 'daily', status: 'paused' },
          ],
        },
      },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));

    await loadPlanning();

    expect(calls[0]!.url).toContain('/v1/planning/tasks');
    expect(scheduledTasks().map((task) => task.id)).toEqual(['todays-notes']);
    expect(scheduledTasks()[0]?.status).toBe('paused');
    // The four jobs the account has not added are still offered.
    expect(availableTemplates().map((template) => template.id)).toEqual([
      'unread-mentions',
      'week-ahead',
      'evening-recap',
      'subnet-100',
    ]);
    expect(globalThis.localStorage?.getItem('cortex.planning.v1')).toBeNull();
  });

  it('reports a missing planning route as unsupported, not as an empty schedule', async () => {
    const { fetch } = stubFetch([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));

    await loadPlanning();

    expect(planningState()).toBe('unsupported');
    expect(scheduledTasks()).toEqual([]);
  });

  it('says it is disconnected when no client can be reached', async () => {
    await loadPlanning();
    expect(planningState()).toBe('disconnected');
  });

  it('pauses a job through the API and re-reads the schedule', async () => {
    const { fetch, calls } = stubFetch([
      { body: { id: 'todays-notes', status: 'paused' } },
      { body: { items: [{ id: 'todays-notes', status: 'paused' }] } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));

    await setTaskStatus('todays-notes', 'paused');

    expect(calls[0]!.method).toBe('PATCH');
    expect(calls[0]!.body).toEqual({ status: 'paused' });
    expect(scheduledTasks()[0]?.status).toBe('paused');
  });
});

describe('Bot computers', () => {
  it('creates exactly one dedicated computer per mascot via the API', async () => {
    const { fetch } = stubFetch([
      { body: { id: 'mst_1', name: 'Scout', shape: 'round', color: 'green', computer_id: 'pc_1' } },
      { body: { id: 'mst_2', name: 'Archivist', shape: 'square', color: 'ink', computer_id: 'pc_2' } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    const first = await createMascot('Scout', 'round', 'green');
    const second = await createMascot('Archivist', 'square', 'ink');
    expect(first.computer.mascotId).toBe(first.id);
    expect(second.computer.mascotId).toBe(second.id);
    expect(first.computer.id).not.toBe(second.computer.id);
    expect(mascotById(first.id)?.computer.spec.vcpu).toBeGreaterThanOrEqual(4);
    expect(mascots().length).toBeGreaterThanOrEqual(2);
    expect(globalThis.localStorage?.getItem('cortex.bots.cache.v2')).toBeNull();
  });

  it('does not invent a running farm when the list is unavailable', async () => {
    const { fetch } = stubFetch([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    await reconcileMascots();
    expect(mascots()).toEqual([]);
  });
});

describe('Projects', () => {
  it('creates on the account and re-reads the list', async () => {
    const { fetch, calls } = stubFetch([
      { body: { id: 'proj_1', name: 'Brief for Ana Moreno' } },
      { body: { items: [{ id: 'proj_1', name: 'Brief for Ana Moreno' }] } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));

    const id = await createProject('Brief for Ana Moreno');

    expect(id).toBe('proj_1');
    expect(calls[0]!.body).toEqual({ name: 'Brief for Ana Moreno' });
    expect(chatProjects()[0]?.title).toBe('Brief for Ana Moreno');
    expect(globalThis.localStorage?.getItem('cortex.projects.v1')).toBeNull();
  });

  it('refuses to create without a connection instead of writing locally', async () => {
    await expect(createProject('Nowhere')).rejects.toThrow(/connection to Cortex/i);
    await loadProjects();
    expect(chatProjects()).toEqual([]);
  });
});

describe('Plugins', () => {
  it('lists the four official brands and installs via Composio', () => {
    expect(PLUGIN_CARDS.map((card) => card.id)).toEqual(['drive', 'slack', 'github', 'paper']);
    expect(PLUGIN_CARDS.every((card) => card.installVia === 'composio')).toBe(true);
  });
});

describe('Harness status', () => {
  it('is cloud-only in the browser when nothing remote is set', () => {
    const status = harnessStatus({ authenticated: false });
    expect(status.kind).toBe('cloud-only');
  });

  it('prefers a blocked permission over the socket', () => {
    expect(harnessStatus({ authenticated: true, permissionBlocked: true }).kind).toBe(
      'permission-blocked',
    );
  });
});

describe('Inbox', () => {
  it('maps a blocked Code run and a posted Bot event', () => {
    const fromRuns = inboxFromSessions([
      { id: 's1', title: 'Fix auth', status: 'blocked', updatedAt: 1 },
    ]);
    expect(fromRuns[0]?.kind).toBe('code-run-blocked');
    postInbox({ kind: 'bot-ask-user', message: 'Scout needs you', href: '/bot/x' });
    expect(mergeInbox([]).some((item) => item.kind === 'bot-ask-user')).toBe(true);
  });
});

describe('Bot message writes', () => {
  it('posts to the API and does not use localStorage as source of truth', async () => {
    const { fetch, calls } = stubFetch([
      { body: { id: 'msg_1', role: 'user', kind: 'user', text: 'hello' } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    const writes: string[] = [];
    const original = globalThis.localStorage?.setItem.bind(globalThis.localStorage);
    globalThis.localStorage?.setItem('probe', '1');
    const spy = (key: string, value: string) => {
      writes.push(key);
      original?.(key, value);
    };
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem = spy;
    }
    await sendBotMessage('mst_1', 'hello');
    expect(calls[0]!.url).toContain('/v1/mascots/mst_1/messages');
    expect(calls[0]!.body).toEqual({ text: 'hello' });
    expect(writes.some((key) => key.startsWith('cortex.bots'))).toBe(false);
  });
});

describe('Bot runtime panels', () => {
  it('loads memory, skills, and routines from the API', async () => {
    const { fetch, calls } = stubFetch([
      { body: { items: [{ id: 'f1', tier: 'profile', text: 'Likes tea' }], has_more: false } },
      { body: { items: [], has_more: false } },
      { body: { items: [{ slug: 'research', name: 'Research' }], has_more: false } },
      { body: { items: [], has_more: false } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    await loadMemory('mst_1');
    await loadSkills();
    await loadRoutines('mst_1');
    expect(calls[0]!.url).toContain('/v1/mascots/mst_1/memory?tier=profile');
    expect(calls[2]!.url).toBe('https://api.cortex.foundation/v1/skills');
    expect(calls[3]!.url).toContain('/v1/mascots/mst_1/routines');
    expect(panelState()).toBe('ready');
  });

  it('does not invent rows when the Bot runtime routes are missing', async () => {
    const missing = { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } };
    const { fetch } = stubFetch([missing, missing]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    await loadMemory('mst_1');
    expect(panelState()).toBe('too-old');
  });
});
