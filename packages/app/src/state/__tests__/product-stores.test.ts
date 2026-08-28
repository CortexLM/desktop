import { afterEach, describe, expect, it } from 'vitest';

import { PLANNING_SEED, scheduledTasks, setTaskStatus } from '../planning.ts';
import { createMascot, mascotById, mascots, setComputerStatus } from '../bots.ts';
import { createProject, projectById } from '../projects.ts';
import { harnessStatus } from '../harness.ts';
import { inboxFromSessions, mergeInbox, postInbox } from '../inbox.ts';
import { installPlugin, isPluginInstalled, PLUGIN_CARDS } from '../plugins.ts';

afterEach(() => {
  globalThis.localStorage?.clear();
});

describe('Planning seed', () => {
  it('keeps four generalist jobs then Subnet 100 last', () => {
    expect(PLANNING_SEED.map((task) => task.id)).toEqual([
      'todays-notes',
      'unread-mentions',
      'week-ahead',
      'evening-recap',
      'subnet-100',
    ]);
    expect(PLANNING_SEED[4]?.requiresAccount).toBe(true);
    expect(scheduledTasks().at(-1)?.id).toBe('subnet-100');
  });

  it('pauses a job without dropping it', () => {
    setTaskStatus('todays-notes', 'paused');
    expect(scheduledTasks().find((task) => task.id === 'todays-notes')?.status).toBe('paused');
  });
});

describe('Bot computers', () => {
  it('creates exactly one dedicated computer per mascot', () => {
    const first = createMascot('Scout', 'round', 'green');
    const second = createMascot('Archivist', 'square', 'ink');
    expect(first.computer.mascotId).toBe(first.id);
    expect(second.computer.mascotId).toBe(second.id);
    expect(first.computer.id).not.toBe(second.computer.id);
    expect(mascotById(first.id)?.computer.spec.vcpu).toBeGreaterThanOrEqual(4);
    expect(mascots().length).toBeGreaterThanOrEqual(2);
  });

  it('records a failed wake instead of inventing a running VNC', () => {
    const mascot = createMascot('Probe', 'tall', 'terracotta');
    setComputerStatus(mascot.id, 'wake-failed', 'farm unreachable');
    expect(mascotById(mascot.id)?.computer.status).toBe('wake-failed');
  });
});

describe('Projects', () => {
  it('starts empty and does not invent a demo project', () => {
    const created = createProject('Brief for Ana Moreno');
    expect(projectById(created.id)?.title).toBe('Brief for Ana Moreno');
  });
});

describe('Plugins', () => {
  it('lists the four official brands and installs via Composio', () => {
    expect(PLUGIN_CARDS.map((card) => card.id)).toEqual(['drive', 'slack', 'github', 'paper']);
    expect(PLUGIN_CARDS.every((card) => card.installVia === 'composio')).toBe(true);
    installPlugin('github');
    expect(isPluginInstalled('github')).toBe(true);
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
