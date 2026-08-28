import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

const { dbHolder } = vi.hoisted(() => ({
  dbHolder: { current: null as import('../../../services/database-service').DatabaseService | null },
}));

vi.mock('../../../services/database-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/database-service')>();
  return {
    ...actual,
    getDatabaseService: () => {
      if (!dbHolder.current) throw new Error('database not ready');
      return dbHolder.current;
    },
  };
});

const { DatabaseService } = await import('../../../services/database-service');
const { registerMissionHandlers, unregisterMissionHandlers } = await import('../mission-handlers');

const CHANNELS = [
  'mission:list',
  'mission:create',
  'mission:start',
  'mission:pause',
  'mission:resume',
] as const;

let dir: string;
let workspaceId: string;

async function invoke(channel: string, payload?: unknown) {
  const handler = registeredHandlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler({}, payload);
}

beforeEach(async () => {
  resetElectronMock();
  dir = await mkdtemp(join(tmpdir(), 'cortex-missions-'));
  const db = new DatabaseService(join(dir, 'test.db'));
  await db.initialize();
  dbHolder.current = db;
  const workspace = (await db.getManager()).createWorkspace({
    name: 'Missions',
    path: join(dir, 'repo'),
  });
  workspaceId = workspace.id;
  registerMissionHandlers();
});

afterEach(async () => {
  unregisterMissionHandlers();
  dbHolder.current?.close();
  dbHolder.current = null;
  await rm(dir, { recursive: true, force: true });
});

describe('mission handlers', () => {
  it('registers and unregisters every channel', () => {
    for (const channel of CHANNELS) {
      expect(registeredHandlers.has(channel), channel).toBe(true);
    }
    unregisterMissionHandlers();
    for (const channel of CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(false);
    }
    registerMissionHandlers();
  });

  it('creates, lists, starts, pauses, and resumes a mission', async () => {
    const created = (await invoke('mission:create', {
      workspaceId,
      name: 'Ship',
      description: 'do it',
      steps: ['Plan', 'Build'],
    })) as { success: boolean; data: { mission: { id: string; name: string; status: string } } };
    expect(created.success).toBe(true);
    expect(created.data.mission.name).toBe('Ship');
    expect(created.data.mission.status).toBe('planning');

    const listed = (await invoke('mission:list', { workspaceId })) as {
      data: { missions: Array<{ id: string }> };
    };
    expect(listed.data.missions).toHaveLength(1);

    const started = (await invoke('mission:start', { id: created.data.mission.id })) as {
      data: { mission: { status: string } };
    };
    expect(started.data.mission.status).toBe('running');

    const paused = (await invoke('mission:pause', { id: created.data.mission.id })) as {
      data: { mission: { status: string } };
    };
    expect(paused.data.mission.status).toBe('paused');

    const resumed = (await invoke('mission:resume', { id: created.data.mission.id })) as {
      data: { mission: { status: string } };
    };
    expect(resumed.data.mission.status).toBe('running');
  });

  it('rejects start, pause, and resume without an id', async () => {
    for (const channel of ['mission:start', 'mission:pause', 'mission:resume'] as const) {
      await expect(invoke(channel, {})).resolves.toEqual({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'id required' },
      });
    }
  });

  it('creates with default name and steps when the payload is empty', async () => {
    const created = (await invoke('mission:create', { workspaceId })) as {
      data: { mission: { name: string; steps: Array<{ name: string }> } };
    };
    expect(created.data.mission.name).toBe('Untitled mission');
    expect(created.data.mission.steps.map((step) => step.name)).toEqual(['Plan', 'Implement', 'Verify']);
  });
});
