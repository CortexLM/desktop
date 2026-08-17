/**
 * DatabaseManager CRUD tests
 *
 * Runs against a real in-memory SQLite database via `bun:sqlite`, so schema,
 * constraints, cascades and JSON (de)serialisation are all exercised for real.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Bun's `spyOn` maps to Vitest's `vi.spyOn`.
const spyOn = vi.spyOn;
import { DatabaseManager } from '../index';
import type { Mission, Workspace } from '../types';

/**
 * Portable replacement for Bun's `Bun.sleep(ms)`: resolves after `ms` real
 * milliseconds. No test in this suite uses fake timers, so real-time waits
 * keep the original semantics.
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

let db: DatabaseManager;
let consoleLogSpy: ReturnType<typeof spyOn>;

async function freshDatabase(): Promise<DatabaseManager> {
  const manager = await DatabaseManager.create(':memory:');
  await manager.initialize();
  return manager;
}

function workspaceInput(overrides: Partial<Workspace> = {}) {
  return {
    name: 'My project',
    path: `/repos/project-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  } as Omit<Workspace, 'id' | 'created_at' | 'updated_at'>;
}

describe('DatabaseManager', () => {
  beforeEach(async () => {
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    db = await freshDatabase();
  });

  afterEach(() => {
    db.close();
    consoleLogSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe('lifecycle', () => {
    it('creates the schema on initialize', () => {
      const tables = db
        .getDb()
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const names = tables.map((t) => t.name);

      expect(names).toContain('workspaces');
      expect(names).toContain('sessions');
      expect(names).toContain('messages');
      expect(names).toContain('missions');
      expect(names).toContain('usage_logs');
      expect(names).toContain('automations');
    });

    it('is idempotent when initialize is called twice', async () => {
      await db.initialize();

      expect(db.getMigrationManager().getCurrentVersion()).toBeGreaterThan(0);
    });

    it('exposes the underlying adapter', () => {
      const row = db.getDb().prepare('SELECT 1 AS one').get() as { one: number };

      expect(row.one).toBe(1);
    });

    it('enables foreign key enforcement', () => {
      const result = db.getDb().pragma('foreign_keys') as Array<{ foreign_keys: number }>;

      expect(result[0].foreign_keys).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Workspaces
  // -------------------------------------------------------------------------

  describe('workspaces', () => {
    it('creates a workspace with a uuid and timestamps', () => {
      const before = Date.now();
      const ws = db.createWorkspace(workspaceInput());

      expect(ws.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(ws.created_at).toBeGreaterThanOrEqual(before);
      expect(ws.updated_at).toBe(ws.created_at);
    });

    it('reads a workspace back by id', () => {
      const created = db.createWorkspace(workspaceInput({ name: 'Alpha' }));

      const found = db.getWorkspace(created.id);

      expect(found?.name).toBe('Alpha');
      expect(found?.path).toBe(created.path);
    });

    it('returns null for an unknown id', () => {
      expect(db.getWorkspace('does-not-exist')).toBeNull();
    });

    it('finds a workspace by path', () => {
      const created = db.createWorkspace(workspaceInput({ path: '/repos/findme' }));

      expect(db.getWorkspaceByPath('/repos/findme')?.id).toBe(created.id);
    });

    it('returns null for an unknown path', () => {
      expect(db.getWorkspaceByPath('/nope')).toBeNull();
    });

    it('round-trips nested settings as JSON', () => {
      const created = db.createWorkspace(
        workspaceInput({
          settings: {
            theme: 'dark',
            editor: { fontSize: 14, tabSize: 2, wordWrap: true },
            git: { autoFetch: true, defaultBranch: 'main' },
          },
        })
      );

      const found = db.getWorkspace(created.id);

      expect(found?.settings?.theme).toBe('dark');
      expect(found?.settings?.editor?.fontSize).toBe(14);
      expect(found?.settings?.git?.defaultBranch).toBe('main');
    });

    it('stores undefined settings as null', () => {
      const created = db.createWorkspace(workspaceInput());

      expect(db.getWorkspace(created.id)?.settings).toBeUndefined();
    });

    it('lists workspaces newest-updated first', async () => {
      const a = db.createWorkspace(workspaceInput({ name: 'A' }));
      const b = db.createWorkspace(workspaceInput({ name: 'B' }));
      await sleep(2);
      db.updateWorkspace(a.id, { name: 'A2' });

      const list = db.listWorkspaces();

      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(a.id);
      expect(list[1].id).toBe(b.id);
    });

    it('returns an empty list when there are none', () => {
      expect(db.listWorkspaces()).toEqual([]);
    });

    it('updates only the provided fields', () => {
      const created = db.createWorkspace(workspaceInput({ name: 'Old' }));

      db.updateWorkspace(created.id, { name: 'New' });

      const found = db.getWorkspace(created.id);
      expect(found?.name).toBe('New');
      expect(found?.path).toBe(created.path);
    });

    it('updates the path', () => {
      const created = db.createWorkspace(workspaceInput());

      db.updateWorkspace(created.id, { path: '/repos/moved' });

      expect(db.getWorkspace(created.id)?.path).toBe('/repos/moved');
    });

    it('replaces settings wholesale', () => {
      const created = db.createWorkspace(workspaceInput({ settings: { theme: 'light' } }));

      db.updateWorkspace(created.id, { settings: { theme: 'dark' } });

      expect(db.getWorkspace(created.id)?.settings?.theme).toBe('dark');
    });

    it('always bumps updated_at', async () => {
      const created = db.createWorkspace(workspaceInput());
      await sleep(2);

      db.updateWorkspace(created.id, { name: 'Touched' });

      expect(db.getWorkspace(created.id)!.updated_at).toBeGreaterThan(created.updated_at);
    });

    it('bumps updated_at even with no field updates', async () => {
      const created = db.createWorkspace(workspaceInput());
      await sleep(2);

      db.updateWorkspace(created.id, {});

      expect(db.getWorkspace(created.id)!.updated_at).toBeGreaterThan(created.updated_at);
    });

    it('updating a missing workspace affects nothing', () => {
      db.updateWorkspace('ghost', { name: 'x' });

      expect(db.listWorkspaces()).toEqual([]);
    });

    it('deletes a workspace', () => {
      const created = db.createWorkspace(workspaceInput());

      db.deleteWorkspace(created.id);

      expect(db.getWorkspace(created.id)).toBeNull();
    });

    it('deleting a missing workspace is a no-op', () => {
      expect(() => db.deleteWorkspace('ghost')).not.toThrow();
    });

    it('rejects a duplicate path (UNIQUE constraint)', () => {
      db.createWorkspace(workspaceInput({ path: '/repos/dup' }));

      expect(() => db.createWorkspace(workspaceInput({ path: '/repos/dup' }))).toThrow();
    });

    it('cascades deletion to sessions', () => {
      const ws = db.createWorkspace(workspaceInput());
      const session = db.createSession({ workspace_id: ws.id, title: 'S', model: 'gpt-4' });

      db.deleteWorkspace(ws.id);

      expect(db.getSession(session.id)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  describe('sessions', () => {
    let workspace: Workspace;

    beforeEach(() => {
      workspace = db.createWorkspace(workspaceInput());
    });

    it('creates a session tied to a workspace', () => {
      const session = db.createSession({
        workspace_id: workspace.id,
        title: 'Refactor',
        model: 'gpt-4',
      });

      expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(db.getSession(session.id)?.title).toBe('Refactor');
    });

    it('accepts a null workspace, title and model', () => {
      const session = db.createSession({ workspace_id: null, title: null, model: null });

      const found = db.getSession(session.id);
      expect(found?.workspace_id).toBeNull();
      expect(found?.title).toBeNull();
      expect(found?.model).toBeNull();
    });

    it('round-trips metadata', () => {
      const session = db.createSession({
        workspace_id: workspace.id,
        title: 'T',
        model: 'gpt-4',
        metadata: { provider: 'openai', temperature: 0.7, maxTokens: 4096 },
      });

      const found = db.getSession(session.id);
      expect(found?.metadata?.provider).toBe('openai');
      expect(found?.metadata?.temperature).toBe(0.7);
    });

    it('returns null for an unknown session', () => {
      expect(db.getSession('ghost')).toBeNull();
    });

    it('lists every session when unfiltered', () => {
      db.createSession({ workspace_id: workspace.id, title: 'A', model: 'm' });
      db.createSession({ workspace_id: null, title: 'B', model: 'm' });

      expect(db.listSessions()).toHaveLength(2);
    });

    it('filters sessions by workspace', () => {
      const other = db.createWorkspace(workspaceInput());
      db.createSession({ workspace_id: workspace.id, title: 'A', model: 'm' });
      db.createSession({ workspace_id: other.id, title: 'B', model: 'm' });

      const list = db.listSessions(workspace.id);

      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('A');
    });

    it('orders sessions by updated_at descending', async () => {
      const a = db.createSession({ workspace_id: workspace.id, title: 'A', model: 'm' });
      db.createSession({ workspace_id: workspace.id, title: 'B', model: 'm' });
      await sleep(2);
      db.updateSession(a.id, { title: 'A2' });

      expect(db.listSessions()[0].id).toBe(a.id);
    });

    it('updates the title, model and metadata', () => {
      const session = db.createSession({ workspace_id: workspace.id, title: 'A', model: 'm' });

      db.updateSession(session.id, {
        title: 'B',
        model: 'claude-3',
        metadata: { provider: 'anthropic' },
      });

      const found = db.getSession(session.id);
      expect(found?.title).toBe('B');
      expect(found?.model).toBe('claude-3');
      expect(found?.metadata?.provider).toBe('anthropic');
    });

    it('deletes a session', () => {
      const session = db.createSession({ workspace_id: workspace.id, title: 'A', model: 'm' });

      db.deleteSession(session.id);

      expect(db.getSession(session.id)).toBeNull();
    });

    it('cascades deletion to messages', () => {
      const session = db.createSession({ workspace_id: workspace.id, title: 'A', model: 'm' });
      const message = db.createMessage({ session_id: session.id, role: 'user', content: 'hi' });

      db.deleteSession(session.id);

      expect(db.getMessage(message.id)).toBeNull();
    });

    it('rejects a session pointing at a missing workspace', () => {
      expect(() =>
        db.createSession({ workspace_id: 'no-such-workspace', title: 'A', model: 'm' })
      ).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  describe('messages', () => {
    let sessionId: string;

    beforeEach(() => {
      const ws = db.createWorkspace(workspaceInput());
      sessionId = db.createSession({ workspace_id: ws.id, title: 'S', model: 'gpt-4' }).id;
    });

    it('creates a message with created_at only', () => {
      const before = Date.now();
      const message = db.createMessage({ session_id: sessionId, role: 'user', content: 'Hello' });

      expect(message.created_at).toBeGreaterThanOrEqual(before);
      expect(db.getMessage(message.id)?.content).toBe('Hello');
    });

    it.each(['user', 'assistant', 'system'] as const)('stores the %s role', (role) => {
      const message = db.createMessage({ session_id: sessionId, role, content: 'x' });

      expect(db.getMessage(message.id)?.role).toBe(role);
    });

    it('rejects an invalid role (CHECK constraint)', () => {
      expect(() =>
        db.createMessage({
          session_id: sessionId,
          role: 'moderator' as 'user',
          content: 'x',
        })
      ).toThrow();
    });

    it('round-trips metadata', () => {
      const message = db.createMessage({
        session_id: sessionId,
        role: 'assistant',
        content: 'x',
        metadata: { tokens: { input: 10, output: 20 }, attachments: ['a.png'] },
      });

      const found = db.getMessage(message.id);
      expect(found?.metadata?.tokens?.input).toBe(10);
      expect(found?.metadata?.attachments).toEqual(['a.png']);
    });

    it('returns null for an unknown message', () => {
      expect(db.getMessage('ghost')).toBeNull();
    });

    it('lists messages in chronological order', async () => {
      db.createMessage({ session_id: sessionId, role: 'user', content: 'first' });
      await sleep(2);
      db.createMessage({ session_id: sessionId, role: 'assistant', content: 'second' });
      await sleep(2);
      db.createMessage({ session_id: sessionId, role: 'user', content: 'third' });

      const list = db.listMessages(sessionId);

      expect(list.map((m) => m.content)).toEqual(['first', 'second', 'third']);
    });

    it('scopes messages to their session', () => {
      const ws = db.createWorkspace(workspaceInput());
      const other = db.createSession({ workspace_id: ws.id, title: 'O', model: 'm' }).id;
      db.createMessage({ session_id: sessionId, role: 'user', content: 'mine' });
      db.createMessage({ session_id: other, role: 'user', content: 'theirs' });

      expect(db.listMessages(sessionId)).toHaveLength(1);
    });

    it('returns an empty list for a session with no messages', () => {
      expect(db.listMessages(sessionId)).toEqual([]);
    });

    it('deletes a message', () => {
      const message = db.createMessage({ session_id: sessionId, role: 'user', content: 'x' });

      db.deleteMessage(message.id);

      expect(db.getMessage(message.id)).toBeNull();
    });

    it('preserves large content payloads', () => {
      const big = 'x'.repeat(100_000);
      const message = db.createMessage({ session_id: sessionId, role: 'user', content: big });

      expect(db.getMessage(message.id)?.content).toHaveLength(100_000);
    });

    it('preserves unicode and emoji', () => {
      const message = db.createMessage({
        session_id: sessionId,
        role: 'user',
        content: 'héllo → 世界 🎉',
      });

      expect(db.getMessage(message.id)?.content).toBe('héllo → 世界 🎉');
    });

    it('stores content that looks like SQL verbatim', () => {
      const nasty = "'; DROP TABLE messages; --";
      const message = db.createMessage({ session_id: sessionId, role: 'user', content: nasty });

      expect(db.getMessage(message.id)?.content).toBe(nasty);
      expect(db.listMessages(sessionId)).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Missions
  // -------------------------------------------------------------------------

  describe('missions', () => {
    let workspaceId: string;

    beforeEach(() => {
      workspaceId = db.createWorkspace(workspaceInput()).id;
    });

    it('creates a mission with serialised state', () => {
      const mission = db.createMission({
        workspace_id: workspaceId,
        status: 'planning',
        state: { name: 'Ship v1', steps: [], currentStep: 0 },
      });

      const found = db.getMission(mission.id);
      expect(found?.status).toBe('planning');
      expect(found?.state.name).toBe('Ship v1');
    });

    it('round-trips nested mission steps', () => {
      const mission = db.createMission({
        workspace_id: workspaceId,
        status: 'running',
        state: {
          steps: [
            { id: 's1', name: 'Analyse', status: 'completed' },
            { id: 's2', name: 'Implement', status: 'running' },
          ],
          currentStep: 1,
        },
      });

      const found = db.getMission(mission.id);
      expect(found?.state.steps).toHaveLength(2);
      expect(found?.state.steps?.[1].name).toBe('Implement');
    });

    it('returns null for an unknown mission', () => {
      expect(db.getMission('ghost')).toBeNull();
    });

    it.each(['planning', 'running', 'paused', 'completed', 'failed'] as const)(
      'accepts the %s status',
      (status) => {
        const mission = db.createMission({ workspace_id: workspaceId, status, state: {} });

        expect(db.getMission(mission.id)?.status).toBe(status);
      }
    );

    it('rejects an invalid status', () => {
      expect(() =>
        db.createMission({
          workspace_id: workspaceId,
          status: 'exploded' as Mission['status'],
          state: {},
        })
      ).toThrow();
    });

    it('lists all missions when unfiltered', () => {
      db.createMission({ workspace_id: workspaceId, status: 'planning', state: {} });
      db.createMission({ workspace_id: null, status: 'running', state: {} });

      expect(db.listMissions()).toHaveLength(2);
    });

    it('filters by workspace', () => {
      const other = db.createWorkspace(workspaceInput()).id;
      db.createMission({ workspace_id: workspaceId, status: 'planning', state: {} });
      db.createMission({ workspace_id: other, status: 'planning', state: {} });

      expect(db.listMissions(workspaceId)).toHaveLength(1);
    });

    it('filters by status', () => {
      db.createMission({ workspace_id: workspaceId, status: 'planning', state: {} });
      db.createMission({ workspace_id: workspaceId, status: 'failed', state: {} });

      const failed = db.listMissions(undefined, 'failed');

      expect(failed).toHaveLength(1);
      expect(failed[0].status).toBe('failed');
    });

    it('filters by workspace and status together', () => {
      const other = db.createWorkspace(workspaceInput()).id;
      db.createMission({ workspace_id: workspaceId, status: 'running', state: {} });
      db.createMission({ workspace_id: workspaceId, status: 'failed', state: {} });
      db.createMission({ workspace_id: other, status: 'running', state: {} });

      expect(db.listMissions(workspaceId, 'running')).toHaveLength(1);
    });

    it('updates the status', () => {
      const mission = db.createMission({
        workspace_id: workspaceId,
        status: 'planning',
        state: {},
      });

      db.updateMission(mission.id, { status: 'completed' });

      expect(db.getMission(mission.id)?.status).toBe('completed');
    });

    it('updates the state', () => {
      const mission = db.createMission({
        workspace_id: workspaceId,
        status: 'running',
        state: { currentStep: 0 },
      });

      db.updateMission(mission.id, { state: { currentStep: 3, error: 'timeout' } });

      const found = db.getMission(mission.id);
      expect(found?.state.currentStep).toBe(3);
      expect(found?.state.error).toBe('timeout');
    });

    it('deletes a mission', () => {
      const mission = db.createMission({
        workspace_id: workspaceId,
        status: 'planning',
        state: {},
      });

      db.deleteMission(mission.id);

      expect(db.getMission(mission.id)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Usage logs
  // -------------------------------------------------------------------------

  describe('usage logs', () => {
    let sessionId: string;

    beforeEach(() => {
      const ws = db.createWorkspace(workspaceInput());
      sessionId = db.createSession({ workspace_id: ws.id, title: 'S', model: 'gpt-4' }).id;
    });

    it('creates a usage log', () => {
      const log = db.createUsageLog({
        session_id: sessionId,
        provider: 'openai',
        model: 'gpt-4',
        tokens_input: 100,
        tokens_output: 250,
        cost: 0.0125,
      });

      expect(log.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(db.listUsageLogs()[0].cost).toBeCloseTo(0.0125);
    });

    it('accepts null token counts and cost', () => {
      db.createUsageLog({
        session_id: null,
        provider: 'ollama',
        model: 'llama3',
        tokens_input: null,
        tokens_output: null,
        cost: null,
      });

      const logs = db.listUsageLogs();
      expect(logs[0].tokens_input).toBeNull();
      expect(logs[0].cost).toBeNull();
    });

    it('filters by session', () => {
      const ws = db.createWorkspace(workspaceInput());
      const other = db.createSession({ workspace_id: ws.id, title: 'O', model: 'm' }).id;
      db.createUsageLog({
        session_id: sessionId,
        provider: 'openai',
        model: 'gpt-4',
        tokens_input: 1,
        tokens_output: 1,
        cost: 0,
      });
      db.createUsageLog({
        session_id: other,
        provider: 'openai',
        model: 'gpt-4',
        tokens_input: 1,
        tokens_output: 1,
        cost: 0,
      });

      expect(db.listUsageLogs(sessionId)).toHaveLength(1);
    });

    it('filters by provider', () => {
      db.createUsageLog({
        session_id: sessionId,
        provider: 'openai',
        model: 'gpt-4',
        tokens_input: 1,
        tokens_output: 1,
        cost: 0,
      });
      db.createUsageLog({
        session_id: sessionId,
        provider: 'anthropic',
        model: 'claude-3',
        tokens_input: 1,
        tokens_output: 1,
        cost: 0,
      });

      expect(db.listUsageLogs(undefined, 'anthropic')).toHaveLength(1);
    });

    it('filters by session and provider together', () => {
      db.createUsageLog({
        session_id: sessionId,
        provider: 'openai',
        model: 'gpt-4',
        tokens_input: 1,
        tokens_output: 1,
        cost: 0,
      });
      db.createUsageLog({
        session_id: sessionId,
        provider: 'anthropic',
        model: 'claude-3',
        tokens_input: 1,
        tokens_output: 1,
        cost: 0,
      });

      expect(db.listUsageLogs(sessionId, 'openai')).toHaveLength(1);
    });

    it('returns an empty list when nothing matches', () => {
      expect(db.listUsageLogs('nobody')).toEqual([]);
    });

    describe('getUsageStats', () => {
      beforeEach(() => {
        db.createUsageLog({
          session_id: sessionId,
          provider: 'openai',
          model: 'gpt-4',
          tokens_input: 100,
          tokens_output: 200,
          cost: 0.01,
        });
        db.createUsageLog({
          session_id: sessionId,
          provider: 'openai',
          model: 'gpt-4',
          tokens_input: 50,
          tokens_output: 75,
          cost: 0.005,
        });
        db.createUsageLog({
          session_id: sessionId,
          provider: 'anthropic',
          model: 'claude-3',
          tokens_input: 300,
          tokens_output: 400,
          cost: 0.02,
        });
      });

      it('aggregates totals across providers', () => {
        const stats = db.getUsageStats();

        expect(stats.totalTokensInput).toBe(450);
        expect(stats.totalTokensOutput).toBe(675);
        expect(stats.totalCost).toBeCloseTo(0.035);
      });

      it('groups per provider', () => {
        const stats = db.getUsageStats();

        expect(stats.byProvider.openai.tokens_input).toBe(150);
        expect(stats.byProvider.openai.tokens_output).toBe(275);
        expect(stats.byProvider.anthropic.tokens_input).toBe(300);
      });

      it('returns zeros when there is no usage', async () => {
        const empty = await freshDatabase();

        const stats = empty.getUsageStats();

        expect(stats.totalTokensInput).toBe(0);
        expect(stats.totalCost).toBe(0);
        expect(stats.byProvider).toEqual({});
        empty.close();
      });

      it('honours a start date', () => {
        const future = Date.now() + 60_000;

        const stats = db.getUsageStats(future);

        expect(stats.totalTokensInput).toBe(0);
      });

      it('honours an end date', () => {
        const past = Date.now() - 60_000;

        const stats = db.getUsageStats(undefined, past);

        expect(stats.totalTokensInput).toBe(0);
      });

      it('honours a surrounding date range', () => {
        const stats = db.getUsageStats(Date.now() - 60_000, Date.now() + 60_000);

        expect(stats.totalTokensInput).toBe(450);
      });

      it('treats null token counts as zero', async () => {
        const fresh = await freshDatabase();
        fresh.createUsageLog({
          session_id: null,
          provider: 'ollama',
          model: 'llama3',
          tokens_input: null,
          tokens_output: null,
          cost: null,
        });

        const stats = fresh.getUsageStats();

        expect(stats.totalTokensInput).toBe(0);
        expect(stats.byProvider.ollama.tokens_input).toBe(0);
        fresh.close();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Automations
  // -------------------------------------------------------------------------

  describe('automations', () => {
    let workspaceId: string;

    beforeEach(() => {
      workspaceId = db.createWorkspace(workspaceInput()).id;
    });

    function automationInput(overrides: Record<string, unknown> = {}) {
      return {
        workspace_id: workspaceId,
        name: 'Lint on save',
        enabled: true,
        trigger: { type: 'file_watch' as const, config: { pattern: '**/*.ts' } },
        actions: [{ type: 'run_script' as const, config: { script: 'bun lint' } }],
        ...overrides,
      };
    }

    it('creates an automation', () => {
      const automation = db.createAutomation(automationInput());

      expect(automation.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(db.getAutomation(automation.id)?.name).toBe('Lint on save');
    });

    it('stores enabled as a numeric column but returns a boolean', () => {
      const enabled = db.createAutomation(automationInput({ enabled: true }));
      const disabled = db.createAutomation(automationInput({ enabled: false }));

      expect(db.getAutomation(enabled.id)?.enabled).toBe(true);
      expect(db.getAutomation(disabled.id)?.enabled).toBe(false);

      const raw = db
        .getDb()
        .prepare('SELECT enabled FROM automations WHERE id = ?')
        .get(enabled.id) as { enabled: number };
      expect(raw.enabled).toBe(1);
    });

    it('round-trips the trigger and actions as JSON', () => {
      const automation = db.createAutomation(
        automationInput({
          trigger: { type: 'schedule', config: { cron: '0 9 * * 1' } },
          actions: [
            { type: 'ai_task', config: { prompt: 'Summarise' } },
            { type: 'notification', config: { message: 'done' } },
          ],
        })
      );

      const found = db.getAutomation(automation.id);
      expect(found?.trigger.type).toBe('schedule');
      expect(found?.trigger.config.cron).toBe('0 9 * * 1');
      expect(found?.actions).toHaveLength(2);
      expect(found?.actions[1].type).toBe('notification');
    });

    it('returns null for an unknown automation', () => {
      expect(db.getAutomation('ghost')).toBeNull();
    });

    it('lists all automations', () => {
      db.createAutomation(automationInput({ name: 'A' }));
      db.createAutomation(automationInput({ name: 'B' }));

      expect(db.listAutomations()).toHaveLength(2);
    });

    it('filters by workspace', () => {
      const other = db.createWorkspace(workspaceInput()).id;
      db.createAutomation(automationInput());
      db.createAutomation(automationInput({ workspace_id: other }));

      expect(db.listAutomations(workspaceId)).toHaveLength(1);
    });

    it('filters to enabled only', () => {
      db.createAutomation(automationInput({ enabled: true }));
      db.createAutomation(automationInput({ enabled: false }));

      expect(db.listAutomations(undefined, true)).toHaveLength(1);
    });

    it('returns both when enabledOnly is false', () => {
      db.createAutomation(automationInput({ enabled: true }));
      db.createAutomation(automationInput({ enabled: false }));

      expect(db.listAutomations(undefined, false)).toHaveLength(2);
    });

    it('updates the name', () => {
      const automation = db.createAutomation(automationInput());

      db.updateAutomation(automation.id, { name: 'Renamed' });

      expect(db.getAutomation(automation.id)?.name).toBe('Renamed');
    });

    it('toggles enabled', () => {
      const automation = db.createAutomation(automationInput({ enabled: true }));

      db.updateAutomation(automation.id, { enabled: false });

      expect(db.getAutomation(automation.id)?.enabled).toBe(false);
    });

    it('updates the trigger and actions', () => {
      const automation = db.createAutomation(automationInput());

      db.updateAutomation(automation.id, {
        trigger: { type: 'manual', config: {} },
        actions: [{ type: 'notification', config: { message: 'hi' } }],
      });

      const found = db.getAutomation(automation.id);
      expect(found?.trigger.type).toBe('manual');
      expect(found?.actions).toHaveLength(1);
    });

    it('deletes an automation', () => {
      const automation = db.createAutomation(automationInput());

      db.deleteAutomation(automation.id);

      expect(db.getAutomation(automation.id)).toBeNull();
    });

    it('cascades when its workspace is deleted', () => {
      const automation = db.createAutomation(automationInput());

      db.deleteWorkspace(workspaceId);

      expect(db.getAutomation(automation.id)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Concurrency / transactions
  // -------------------------------------------------------------------------

  describe('concurrent and bulk operations', () => {
    it('keeps every row when many are inserted in a burst', () => {
      const ws = db.createWorkspace(workspaceInput());
      const sessionId = db.createSession({ workspace_id: ws.id, title: 'S', model: 'm' }).id;

      for (let i = 0; i < 200; i += 1) {
        db.createMessage({ session_id: sessionId, role: 'user', content: `msg-${i}` });
      }

      expect(db.listMessages(sessionId)).toHaveLength(200);
    });

    it('generates unique ids across many inserts', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i += 1) {
        ids.add(db.createWorkspace(workspaceInput()).id);
      }

      expect(ids.size).toBe(100);
    });

    it('commits a successful transaction', () => {
      const adapter = db.getDb();
      const run = adapter.transaction(() => {
        db.createWorkspace(workspaceInput({ name: 'tx-1' }));
        db.createWorkspace(workspaceInput({ name: 'tx-2' }));
      });

      run();

      expect(db.listWorkspaces()).toHaveLength(2);
    });

    it('rolls back a failed transaction', () => {
      const adapter = db.getDb();
      const run = adapter.transaction(() => {
        db.createWorkspace(workspaceInput({ path: '/repos/tx' }));
        // Duplicate path violates UNIQUE and aborts the transaction.
        db.createWorkspace(workspaceInput({ path: '/repos/tx' }));
      });

      expect(() => run()).toThrow();
      expect(db.listWorkspaces()).toEqual([]);
    });

    it('isolates data between separate in-memory databases', async () => {
      db.createWorkspace(workspaceInput());
      const other = await freshDatabase();

      expect(other.listWorkspaces()).toEqual([]);
      other.close();
    });
  });
});
