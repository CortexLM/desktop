/**
 * MigrationManager tests — schema versioning, migrate, rollback and status.
 *
 * Uses a real in-memory SQLite database through the Bun adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Bun's `spyOn` maps to Vitest's `vi.spyOn`.
const spyOn = vi.spyOn;
import { createDatabaseAdapter, type DatabaseAdapter } from '../adapter';
import { MigrationManager } from '../migration-manager';

let db: DatabaseAdapter;
let manager: MigrationManager;
let consoleLogSpy: ReturnType<typeof spyOn>;
let consoleErrorSpy: ReturnType<typeof spyOn>;

function tableNames(adapter: DatabaseAdapter): string[] {
  return (
    adapter
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
}

describe('MigrationManager', () => {
  beforeEach(async () => {
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    db = await createDatabaseAdapter(':memory:');
    manager = new MigrationManager(db);
  });

  afterEach(() => {
    db.close();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('schema_version bookkeeping', () => {
    it('creates the schema_version table in the constructor', () => {
      expect(tableNames(db)).toContain('schema_version');
    });

    it('reports version 0 on a blank database', () => {
      expect(manager.getCurrentVersion()).toBe(0);
    });

    it('reports the highest applied version', () => {
      db.prepare('INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)').run(
        7,
        Date.now(),
        'seven'
      );
      db.prepare('INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)').run(
        3,
        Date.now(),
        'three'
      );

      expect(manager.getCurrentVersion()).toBe(7);
    });

    it('is safe to construct twice against the same database', () => {
      const second = new MigrationManager(db);

      expect(second.getCurrentVersion()).toBe(0);
    });
  });

  describe('migrate', () => {
    it('applies pending migrations and records them', async () => {
      await manager.migrate();

      expect(manager.getCurrentVersion()).toBeGreaterThanOrEqual(1);
      const applied = db
        .prepare('SELECT version, description FROM schema_version ORDER BY version')
        .all() as Array<{ version: number; description: string }>;
      expect(applied.length).toBeGreaterThanOrEqual(1);
      expect(applied[0].version).toBe(1);
    });

    it('creates the core tables', async () => {
      await manager.migrate();

      const names = tableNames(db);
      expect(names).toContain('workspaces');
      expect(names).toContain('sessions');
      expect(names).toContain('messages');
      expect(names).toContain('missions');
      expect(names).toContain('usage_logs');
      expect(names).toContain('automations');
    });

    it('creates the tasks table from migration 002', async () => {
      await manager.migrate();

      expect(tableNames(db)).toContain('tasks');
    });

    it('is a no-op on a second run', async () => {
      await manager.migrate();
      const version = manager.getCurrentVersion();
      const rowsBefore = db.prepare('SELECT COUNT(*) AS n FROM schema_version').get() as {
        n: number;
      };

      await manager.migrate();

      expect(manager.getCurrentVersion()).toBe(version);
      const rowsAfter = db.prepare('SELECT COUNT(*) AS n FROM schema_version').get() as {
        n: number;
      };
      expect(rowsAfter.n).toBe(rowsBefore.n);
    });

    it('skips migrations at or below the current version', async () => {
      db.prepare('INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)').run(
        1,
        Date.now(),
        'pretend 001 ran'
      );

      await manager.migrate();

      const versions = (
        db.prepare('SELECT version FROM schema_version ORDER BY version').all() as Array<{
          version: number;
        }>
      ).map((r) => r.version);
      expect(versions.filter((v) => v === 1)).toHaveLength(1);
    });

    it('records a timestamp for every applied migration', async () => {
      const before = Date.now();

      await manager.migrate();

      const rows = db.prepare('SELECT applied_at FROM schema_version').all() as Array<{
        applied_at: number;
      }>;
      for (const row of rows) {
        expect(row.applied_at).toBeGreaterThanOrEqual(before);
      }
    });

    it('applies every registered migration in ascending order', async () => {
      // The registry is static (no directory scan), so the set of migrations is
      // fixed at build time and always ordered.
      await manager.migrate();

      const applied = (
        db.prepare('SELECT version FROM schema_version ORDER BY applied_at').all() as Array<{
          version: number;
        }>
      ).map((r) => r.version);

      expect(applied).toEqual([...applied].sort((a, b) => a - b));
      expect(applied.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('rollback', () => {
    it('reverts down to the requested version', async () => {
      await manager.migrate();
      const top = manager.getCurrentVersion();
      expect(top).toBeGreaterThanOrEqual(2);

      await manager.rollback(1);

      expect(manager.getCurrentVersion()).toBe(1);
      expect(tableNames(db)).not.toContain('tasks');
      expect(tableNames(db)).toContain('workspaces');
    });

    it('drops every table when rolling back to 0', async () => {
      await manager.migrate();

      await manager.rollback(0);

      expect(manager.getCurrentVersion()).toBe(0);
      const names = tableNames(db);
      expect(names).not.toContain('workspaces');
      expect(names).not.toContain('sessions');
      expect(names).toContain('schema_version');
    });

    it('removes the schema_version rows it rolled back', async () => {
      await manager.migrate();

      await manager.rollback(1);

      const versions = (
        db.prepare('SELECT version FROM schema_version').all() as Array<{ version: number }>
      ).map((r) => r.version);
      expect(versions).toEqual([1]);
    });

    it('does nothing when the target equals the current version', async () => {
      await manager.migrate();
      const current = manager.getCurrentVersion();

      await manager.rollback(current);

      expect(manager.getCurrentVersion()).toBe(current);
    });

    it('does nothing when the target is above the current version', async () => {
      await manager.migrate();
      const current = manager.getCurrentVersion();

      await manager.rollback(current + 5);

      expect(manager.getCurrentVersion()).toBe(current);
    });

    it('does nothing on a blank database', async () => {
      await manager.rollback(0);

      expect(manager.getCurrentVersion()).toBe(0);
    });

    it('supports migrate → rollback → migrate', async () => {
      await manager.migrate();
      const top = manager.getCurrentVersion();

      await manager.rollback(0);
      await manager.migrate();

      expect(manager.getCurrentVersion()).toBe(top);
      expect(tableNames(db)).toContain('workspaces');
    });
  });

  describe('getStatus', () => {
    it('reports version 0 and all migrations pending initially', async () => {
      const status = await manager.getStatus();

      expect(status.current).toBe(0);
      expect(status.available.length).toBeGreaterThanOrEqual(1);
      expect(status.pending).toHaveLength(status.available.length);
    });

    it('reports nothing pending once migrated', async () => {
      await manager.migrate();

      const status = await manager.getStatus();

      expect(status.pending).toEqual([]);
      expect(status.current).toBe(manager.getCurrentVersion());
    });

    it('lists migrations sorted by version', async () => {
      const status = await manager.getStatus();

      const versions = status.available.map((m) => m.version);
      expect(versions).toEqual([...versions].sort((a, b) => a - b));
    });

    it('exposes descriptions', async () => {
      const status = await manager.getStatus();

      expect(status.available[0].description).toContain('Initial schema');
    });

    it('reports only the remaining migrations as pending', async () => {
      db.prepare('INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)').run(
        1,
        Date.now(),
        'manual'
      );

      const status = await manager.getStatus();

      expect(status.current).toBe(1);
      expect(status.pending.every((m) => m.version > 1)).toBe(true);
    });
  });

  describe('SQL-string migrations', () => {
    it('applies migration 003 even though it exports raw SQL rather than functions', async () => {
      // 003_add_mcp_tables.ts exports `up`/`down` as template-literal SQL and no
      // `version`. The static registry normalises both shapes (and supplies the
      // version), so it is applied like any other migration — previously the
      // directory scan skipped it and the MCP tables were never created.
      await manager.migrate();

      const status = await manager.getStatus();
      expect(status.available.map((m) => m.version)).toContain(3);
      expect(tableNames(db)).toContain('mcp_servers');
      expect(tableNames(db)).toContain('mcp_permissions');
    });

    it('rolls migration 003 back', async () => {
      await manager.migrate();

      await manager.rollback(2);

      expect(tableNames(db)).not.toContain('mcp_servers');
      expect(tableNames(db)).toContain('tasks');
    });
  });
});
