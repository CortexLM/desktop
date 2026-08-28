import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbHolder } = vi.hoisted(() => ({
  dbHolder: { current: null as import('../database-service').DatabaseService | null },
}));

vi.mock('../database-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../database-service')>();
  return {
    ...actual,
    getDatabaseService: () => {
      if (!dbHolder.current) throw new Error('database not ready');
      return dbHolder.current;
    },
  };
});

const { DatabaseService } = await import('../database-service');
const {
  WorkspaceRunSettingsService,
  getWorkspaceRunSettingsService,
  resetWorkspaceRunSettingsService,
} = await import('../workspace-settings-service');

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cortex-ws-settings-'));
  const db = new DatabaseService(join(dir, 'test.db'));
  await db.initialize();
  dbHolder.current = db;
});

afterEach(async () => {
  dbHolder.current?.close();
  dbHolder.current = null;
  resetWorkspaceRunSettingsService();
  await rm(dir, { recursive: true, force: true });
});

describe('WorkspaceRunSettingsService', () => {
  it('returns defaults when nothing is stored', async () => {
    const service = new WorkspaceRunSettingsService();
    await expect(service.get()).resolves.toEqual({
      defaults: {
        model: '',
        repository: '',
        baseBranch: '',
        branchPrefix: 'cortex/',
        createPullRequests: 'draft',
      },
      permissions: {
        runShellCommands: true,
        applyDatabaseMigrations: false,
        slackNotifications: false,
        networkAccess: 'allowlist',
      },
    });
  });

  it('coerces malformed stored values back to defaults', async () => {
    await dbHolder.current!.execute([
      {
        query: `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)`,
        params: [
          'workspace_settings',
          JSON.stringify({
            defaults: { createPullRequests: 'ship-it', model: 12 },
            permissions: { runShellCommands: 'yes', networkAccess: 'maybe' },
          }),
          Date.now(),
        ],
      },
    ]);
    const service = new WorkspaceRunSettingsService();
    const settings = await service.get();
    expect(settings.defaults.createPullRequests).toBe('draft');
    expect(settings.defaults.model).toBe('');
    expect(settings.permissions.runShellCommands).toBe(true);
    expect(settings.permissions.networkAccess).toBe('allowlist');
  });

  it('merges a partial write onto the current value', async () => {
    const service = new WorkspaceRunSettingsService();
    const next = await service.set({ permissions: { runShellCommands: false } });
    expect(next.permissions.runShellCommands).toBe(false);
    expect(next.permissions.networkAccess).toBe('allowlist');
    expect(next.defaults.branchPrefix).toBe('cortex/');
  });

  it('serves the cache until invalidate', async () => {
    const service = new WorkspaceRunSettingsService();
    await service.set({ defaults: { model: 'gpt-4.1' } });
    await dbHolder.current!.execute([
      {
        query: `UPDATE app_state SET value = ? WHERE key = ?`,
        params: [JSON.stringify({ defaults: { model: 'changed' } }), 'workspace_settings'],
      },
    ]);
    expect((await service.get()).defaults.model).toBe('gpt-4.1');
    service.invalidate();
    expect((await service.get()).defaults.model).toBe('changed');
  });

  it('falls back to defaults when the database is not ready', async () => {
    const previous = dbHolder.current;
    dbHolder.current = null;
    const service = new WorkspaceRunSettingsService();
    const settings = await service.get();
    expect(settings.permissions.runShellCommands).toBe(true);
    previous?.close();
  });

  it('reuses a singleton until reset', () => {
    const first = getWorkspaceRunSettingsService();
    expect(getWorkspaceRunSettingsService()).toBe(first);
    resetWorkspaceRunSettingsService();
    expect(getWorkspaceRunSettingsService()).not.toBe(first);
  });
});
