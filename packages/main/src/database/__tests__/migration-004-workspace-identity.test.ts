/**
 * Migration 004 — workspace identity, and the FOREIGN KEY failure it removes.
 *
 * ## What is under test
 *
 * Before this migration, every `INSERT INTO tasks` from the Plans view failed
 * with `FOREIGN KEY constraint failed`: `tasks.workspace_id` references
 * `workspaces(id)`, the renderer supplies the open folder path as that value,
 * and nothing ever inserted a matching row (workspaces lived in
 * `workspaces.json`, not SQLite).
 *
 * The first test reproduces that failure against the pre-004 schema, so the
 * rest of the file is measuring a real fix and not a tautology.
 *
 * Runs against a real in-memory SQLite database — the constraint being tested is
 * enforced by SQLite itself, so a mock would prove nothing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createDatabaseAdapter, type DatabaseAdapter } from '../adapter';
import { MigrationManager } from '../migration-manager';
import { MIGRATIONS } from '../migrations/index';
import { DatabaseManager } from '../index';

let db: DatabaseAdapter;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

/** Runs migrations up to and including `version`, in order. */
function migrateTo(adapter: DatabaseAdapter, version: number): void {
  for (const migration of MIGRATIONS.filter((m) => m.version <= version)) {
    migration.up(adapter);
  }
}

function taskRow(workspaceId: string, id = `task_${Math.random().toString(36).slice(2)}`) {
  const now = Date.now();
  return [id, workspaceId, 'write the report', 'pending', 1, now, now] as const;
}

const INSERT_TASK =
  'INSERT INTO tasks (id, workspace_id, content, status, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)';

function insertTask(adapter: DatabaseAdapter, workspaceId: string, id?: string) {
  adapter.prepare(INSERT_TASK).run(...taskRow(workspaceId, id));
}

function workspaceRows(adapter: DatabaseAdapter) {
  return adapter
    .prepare('SELECT id, name, path FROM workspaces ORDER BY id')
    .all<{ id: string; name: string; path: string }>();
}

describe('migration 004: workspace identity', () => {
  beforeEach(async () => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    db = await createDatabaseAdapter(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
    consoleLogSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // The bug, reproduced
  // -------------------------------------------------------------------------

  describe('the bug being fixed', () => {
    it('rejects a task keyed by a folder path before migration 004', () => {
      migrateTo(db, 3);

      // Exactly what PlansView sends: workspace_id is the open folder path.
      expect(() => insertTask(db, '/tmp/some-project')).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("rejects the literal 'default' before migration 004 too", () => {
      migrateTo(db, 3);

      // What Workbench sends when no folder is open.
      expect(() => insertTask(db, 'default')).toThrow(/FOREIGN KEY constraint failed/);
    });
  });

  // -------------------------------------------------------------------------
  // The fix
  // -------------------------------------------------------------------------

  describe('after migration 004', () => {
    beforeEach(() => {
      migrateTo(db, 4);
    });

    it('accepts a task keyed by a folder path', () => {
      expect(() => insertTask(db, '/tmp/some-project')).not.toThrow();

      const rows = db.prepare('SELECT workspace_id FROM tasks').all<{ workspace_id: string }>();
      expect(rows).toHaveLength(1);
      expect(rows[0].workspace_id).toBe('/tmp/some-project');
    });

    it('registers the workspace with the folder basename as its name', () => {
      insertTask(db, '/home/dev/projects/my-app');

      expect(workspaceRows(db)).toEqual([
        { id: '/home/dev/projects/my-app', name: 'my-app', path: '/home/dev/projects/my-app' },
      ]);
    });

    it("accepts the literal 'default' and names it 'default'", () => {
      expect(() => insertTask(db, 'default')).not.toThrow();

      expect(workspaceRows(db)).toEqual([{ id: 'default', name: 'default', path: 'default' }]);
    });

    it('registers a workspace once across many tasks', () => {
      insertTask(db, '/tmp/project');
      insertTask(db, '/tmp/project');
      insertTask(db, '/tmp/project');

      expect(workspaceRows(db)).toHaveLength(1);
      expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get<{ n: number }>()?.n).toBe(3);
    });

    it('does not touch an existing workspace row', () => {
      const now = Date.now();
      db.prepare(
        'INSERT INTO workspaces (id, name, path, created_at, updated_at, settings) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('/tmp/named', 'Hand-picked name', '/tmp/named', now, now, null);

      insertTask(db, '/tmp/named');

      expect(workspaceRows(db)).toEqual([
        { id: '/tmp/named', name: 'Hand-picked name', path: '/tmp/named' },
      ]);
    });

    it('auto-registers for automations as well', () => {
      const now = Date.now();

      expect(() =>
        db
          .prepare(
            'INSERT INTO automations (id, workspace_id, name, enabled, trigger, actions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .run('a1', '/tmp/auto-project', 'Nightly', 1, '{}', '[]', now, now)
      ).not.toThrow();

      expect(workspaceRows(db)).toEqual([
        { id: '/tmp/auto-project', name: 'auto-project', path: '/tmp/auto-project' },
      ]);
    });

    it('leaves a null automation workspace alone', () => {
      const now = Date.now();
      db.prepare(
        'INSERT INTO automations (id, workspace_id, name, enabled, trigger, actions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('a1', null, 'Global', 1, '{}', '[]', now, now);

      expect(workspaceRows(db)).toHaveLength(0);
    });

    // The reason for keeping the FK rather than dropping it.
    it('still cascades a workspace delete to its tasks', () => {
      insertTask(db, '/tmp/doomed', 'task-1');
      expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get<{ n: number }>()?.n).toBe(1);

      db.prepare('DELETE FROM workspaces WHERE id = ?').run('/tmp/doomed');

      expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get<{ n: number }>()?.n).toBe(0);
    });

    it('creates the app_state table', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all<{ name: string }>()
        .map((r) => r.name);

      expect(tables).toContain('app_state');
    });
  });

  // -------------------------------------------------------------------------
  // Legacy rows: the case that would otherwise deadlock on UNIQUE(path)
  // -------------------------------------------------------------------------

  describe('re-keying pre-existing UUID-keyed workspaces', () => {
    const UUID = '3953fa99-4588-404c-9b50-04c10f28c752';
    const PATH = '/root/projects/example';

    beforeEach(() => {
      migrateTo(db, 3);

      const now = Date.now();
      db.prepare(
        'INSERT INTO workspaces (id, name, path, created_at, updated_at, settings) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(UUID, 'Example Project', PATH, now, now, null);
      db.prepare(
        'INSERT INTO sessions (id, workspace_id, title, model, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('s1', UUID, 'A chat', 'gpt-4', now, now, null);
      db.prepare(
        'INSERT INTO missions (id, workspace_id, status, created_at, updated_at, state) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('m1', UUID, 'planning', now, now, '{}');
      db.prepare(
        'INSERT INTO automations (id, workspace_id, name, enabled, trigger, actions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('a1', UUID, 'Nightly', 1, '{}', '[]', now, now);
    });

    it('re-keys the workspace to its path', () => {
      MIGRATIONS.find((m) => m.version === 4)!.up(db);

      expect(workspaceRows(db)).toEqual([
        { id: PATH, name: 'Example Project', path: PATH },
      ]);
    });

    it('repoints every child row, losing none', () => {
      MIGRATIONS.find((m) => m.version === 4)!.up(db);

      expect(
        db.prepare('SELECT workspace_id FROM sessions').get<{ workspace_id: string }>()?.workspace_id
      ).toBe(PATH);
      expect(
        db.prepare('SELECT workspace_id FROM missions').get<{ workspace_id: string }>()?.workspace_id
      ).toBe(PATH);
      expect(
        db.prepare('SELECT workspace_id FROM automations').get<{ workspace_id: string }>()
          ?.workspace_id
      ).toBe(PATH);

      // Nothing was dropped on the way.
      expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get<{ n: number }>()?.n).toBe(1);
      expect(db.prepare('SELECT COUNT(*) AS n FROM missions').get<{ n: number }>()?.n).toBe(1);
      expect(db.prepare('SELECT COUNT(*) AS n FROM automations').get<{ n: number }>()?.n).toBe(1);
    });

    it('lets a task be written for that folder afterwards', () => {
      MIGRATIONS.find((m) => m.version === 4)!.up(db);

      // Without the re-key this is the deadlock: UNIQUE(path) blocks inserting a
      // second row keyed by path, so the FK could never be satisfied for a
      // folder the user had already added.
      expect(() => insertTask(db, PATH)).not.toThrow();
      expect(workspaceRows(db)).toHaveLength(1);
    });

    it('keeps referential integrity verifiable by SQLite itself', () => {
      MIGRATIONS.find((m) => m.version === 4)!.up(db);

      const violations = db.prepare('PRAGMA foreign_key_check').all();
      expect(violations).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Through the real MigrationManager, i.e. inside a transaction
  // -------------------------------------------------------------------------

  describe('applied by MigrationManager', () => {
    it('runs inside the migration transaction without an FK violation', async () => {
      const now = Date.now();

      // Pre-seed a legacy workspace at version 3, then let MigrationManager
      // apply 004 the way the app does. `PRAGMA foreign_keys` is a no-op inside
      // a transaction, so this is what proves `defer_foreign_keys` is doing the
      // work.
      migrateTo(db, 3);

      // Constructed before seeding: the constructor is what creates
      // `schema_version`.
      const migrationManager = new MigrationManager(db);
      db.prepare('INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)').run(
        3,
        now,
        'seeded'
      );
      db.prepare(
        'INSERT INTO workspaces (id, name, path, created_at, updated_at, settings) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('uuid-legacy', 'Legacy', '/tmp/legacy', now, now, null);
      db.prepare(
        'INSERT INTO sessions (id, workspace_id, title, model, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('s1', 'uuid-legacy', 'A chat', 'gpt-4', now, now, null);

      await migrationManager.migrate();

      expect(workspaceRows(db)).toEqual([
        { id: '/tmp/legacy', name: 'Legacy', path: '/tmp/legacy' },
      ]);
      expect(
        db.prepare('SELECT workspace_id FROM sessions').get<{ workspace_id: string }>()?.workspace_id
      ).toBe('/tmp/legacy');
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    });

    it('reaches version 4 on a fresh database', async () => {
      const manager = new MigrationManager(db);
      await manager.migrate();

      expect(manager.getCurrentVersion()).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // Partially-migrated databases
  // -------------------------------------------------------------------------

  describe('partially-migrated database', () => {
    it('is a no-op when the workspaces table was never created', () => {
      // `schema_version` can name a version whose tables do not exist: an
      // interrupted upgrade, or a hand-edited row. Refusing to run would leave
      // the app unable to open its database at all, which is worse than the
      // state it was handed.
      const migration = MIGRATIONS.find((m) => m.version === 4)!;

      expect(() => migration.up(db)).not.toThrow();

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all<{ name: string }>()
        .map((r) => r.name);
      expect(tables).toContain('app_state');
      expect(tables).not.toContain('workspaces');
    });

    it('creates the tasks trigger only once tasks exists', () => {
      migrateTo(db, 4);

      const triggers = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
        .all<{ name: string }>()
        .map((r) => r.name);

      expect(triggers).toContain('tasks_ensure_workspace');
      expect(triggers).toContain('automations_ensure_workspace');
    });
  });

  // -------------------------------------------------------------------------
  // Idempotence — migrations must tolerate being re-applied
  // -------------------------------------------------------------------------

  describe('re-application', () => {
    it('is idempotent', () => {
      migrateTo(db, 4);
      insertTask(db, '/tmp/project');

      const migration = MIGRATIONS.find((m) => m.version === 4)!;
      expect(() => migration.up(db)).not.toThrow();

      expect(workspaceRows(db)).toHaveLength(1);
      expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get<{ n: number }>()?.n).toBe(1);
    });

    it('down() removes the triggers and leaves the data', () => {
      migrateTo(db, 4);
      insertTask(db, '/tmp/project');

      MIGRATIONS.find((m) => m.version === 4)!.down(db);

      const triggers = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
        .all<{ name: string }>()
        .map((r) => r.name);
      expect(triggers).not.toContain('tasks_ensure_workspace');

      // The workspace and its task survive: only the auto-registration path is
      // withdrawn.
      expect(workspaceRows(db)).toHaveLength(1);
      expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get<{ n: number }>()?.n).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // End to end through DatabaseManager, the way the app opens the DB
  // -------------------------------------------------------------------------

  describe('through DatabaseManager', () => {
    it('lets a task be created for a path-keyed workspace', async () => {
      const manager = await DatabaseManager.create(':memory:');
      await manager.initialize();

      try {
        const adapter = manager.getDb();

        // No workspace registered: this is a first run with a folder open.
        expect(() => insertTask(adapter, '/tmp/fresh-project')).not.toThrow();

        expect(manager.getWorkspace('/tmp/fresh-project')).not.toBeNull();
        expect(manager.getWorkspace('/tmp/fresh-project')?.name).toBe('fresh-project');
      } finally {
        manager.close();
      }
    });
  });
});
