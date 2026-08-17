/**
 * WorkspaceManager — SQLite-backed persistence and the one-time
 * `workspaces.json` import.
 *
 * ## Why this file exists
 *
 * WorkspaceManager used to persist to `workspaces.json` while the SQLite
 * `workspaces` table — the one every foreign key points at — stayed empty. That
 * is what made every `INSERT INTO tasks` fail with `FOREIGN KEY constraint
 * failed`.
 *
 * The migration to SQLite has to carry the existing file across. Losing a user's
 * workspace list silently would be worse than the bug it replaces, so the import
 * is tested against a real file on disk and a real database, not mocks:
 *   - a valid file is imported and then *renamed*, never deleted;
 *   - a corrupt file is left exactly where it is;
 *   - the active-workspace pointer survives the re-keying.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { WorkspaceManager } from '../workspace-manager';
import { DatabaseService } from '../database-service';

let dataDir: string;
let projectA: string;
let projectB: string;
let service: DatabaseService;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

/** A DatabaseService backed by a real file DB inside the temp dir. */
function freshService(): DatabaseService {
  return new DatabaseService(join(dataDir, 'test.db'));
}

function legacyFile(contents: unknown): string {
  const path = join(dataDir, 'workspaces.json');
  writeFileSync(path, JSON.stringify(contents, null, 2));
  return path;
}

async function initialisedManager(): Promise<WorkspaceManager> {
  const manager = new WorkspaceManager(dataDir, service);
  await manager.initialize();
  return manager;
}

describe('WorkspaceManager', () => {
  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    dataDir = mkdtempSync(join(tmpdir(), 'cortex-ws-manager-'));

    // Real directories: initialize() drops workspaces whose folder is gone, so
    // fixtures need to actually exist on disk.
    projectA = join(dataDir, 'project-a');
    projectB = join(dataDir, 'project-b');
    mkdirSync(projectA);
    mkdirSync(projectB);

    service = freshService();
  });

  afterEach(() => {
    service.close();
    rmSync(dataDir, { recursive: true, force: true });
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Persistence target
  // -------------------------------------------------------------------------

  describe('persists to SQLite', () => {
    it('writes an added workspace into the workspaces table', async () => {
      const manager = await initialisedManager();

      await manager.addWorkspace(projectA, 'Project A');

      const db = (await service.getManager()).getDb();
      const rows = db
        .prepare('SELECT id, name, path FROM workspaces')
        .all<{ id: string; name: string; path: string }>();

      expect(rows).toEqual([{ id: projectA, name: 'Project A', path: projectA }]);
    });

    it('keys the workspace by its path, which is what the renderer sends', async () => {
      const manager = await initialisedManager();

      const workspace = await manager.addWorkspace(projectA);

      // The renderer identifies a workspace by the open folder path
      // (`workspacePath ?? 'default'`). The id has to be that same value for
      // `tasks.workspace_id` to resolve.
      expect(workspace.id).toBe(projectA);
    });

    it('does not write a workspaces.json', async () => {
      const manager = await initialisedManager();
      await manager.addWorkspace(projectA);
      await manager.save();

      expect(existsSync(join(dataDir, 'workspaces.json'))).toBe(false);
    });

    it('reloads workspaces from SQLite in a new manager instance', async () => {
      const first = await initialisedManager();
      await first.addWorkspace(projectA, 'Project A');
      await first.addWorkspace(projectB, 'Project B');

      const second = await initialisedManager();

      expect(second.listWorkspaces().map((w) => w.path).sort()).toEqual(
        [projectA, projectB].sort()
      );
    });

    it('remembers the active workspace across instances', async () => {
      const first = await initialisedManager();
      await first.addWorkspace(projectA);
      await first.addWorkspace(projectB);
      await first.switchWorkspace(projectB);

      const second = await initialisedManager();

      expect(second.getActiveWorkspace()?.path).toBe(projectB);
    });

    it('does not add the same folder twice', async () => {
      const manager = await initialisedManager();

      const first = await manager.addWorkspace(projectA);
      const second = await manager.addWorkspace(projectA);

      expect(second.id).toBe(first.id);
      expect(manager.listWorkspaces()).toHaveLength(1);
    });

    it('rejects a file as a workspace path', async () => {
      const manager = await initialisedManager();
      const filePath = join(dataDir, 'a-file.txt');
      writeFileSync(filePath, 'not a directory');

      await expect(manager.addWorkspace(filePath)).rejects.toThrow(/must be a directory/);
    });

    it('removes a workspace from SQLite', async () => {
      const manager = await initialisedManager();
      await manager.addWorkspace(projectA);

      await manager.removeWorkspace(projectA);

      const db = (await service.getManager()).getDb();
      expect(db.prepare('SELECT COUNT(*) AS n FROM workspaces').get<{ n: number }>()?.n).toBe(0);
      expect(manager.listWorkspaces()).toHaveLength(0);
    });

    it('cascades a removal to that workspace tasks', async () => {
      const manager = await initialisedManager();
      await manager.addWorkspace(projectA);

      const db = (await service.getManager()).getDb();
      const now = Date.now();
      db.prepare(
        'INSERT INTO tasks (id, workspace_id, content, status, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('t1', projectA, 'a task', 'pending', 1, now, now);

      await manager.removeWorkspace(projectA);

      expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get<{ n: number }>()?.n).toBe(0);
    });

    it('persists updated settings', async () => {
      const manager = await initialisedManager();
      await manager.addWorkspace(projectA);

      await manager.updateSettings(projectA, { theme: 'dark' });

      const reloaded = await initialisedManager();
      expect(reloaded.getWorkspace(projectA)?.settings).toMatchObject({ theme: 'dark' });
    });

    it('throws when used before initialize()', async () => {
      const manager = new WorkspaceManager(dataDir, service);

      await expect(manager.addWorkspace(projectA)).rejects.toThrow(/initialize\(\) must be awaited/);
    });
  });

  // -------------------------------------------------------------------------
  // The legacy file: the data-loss risk
  // -------------------------------------------------------------------------

  describe('workspaces.json import', () => {
    it('imports every entry into SQLite', async () => {
      legacyFile({
        workspaces: [
          { id: 'ws_1', name: 'Project A', path: projectA, createdAt: 1, updatedAt: 2 },
          { id: 'ws_2', name: 'Project B', path: projectB, createdAt: 3, updatedAt: 4 },
        ],
        activeWorkspaceId: 'ws_2',
      });

      const manager = await initialisedManager();

      expect(manager.listWorkspaces().map((w) => w.name).sort()).toEqual([
        'Project A',
        'Project B',
      ]);
    });

    it('re-keys imported workspaces by path', async () => {
      legacyFile({
        workspaces: [{ id: 'ws_1', name: 'Project A', path: projectA }],
      });

      const manager = await initialisedManager();

      expect(manager.getWorkspace(projectA)?.id).toBe(projectA);
      // The generated id from the JSON file is gone: it was never a value the
      // renderer could produce.
      expect(manager.getWorkspace('ws_1')).toBeNull();
    });

    it('carries the active workspace across the re-keying', async () => {
      legacyFile({
        workspaces: [
          { id: 'ws_1', name: 'Project A', path: projectA },
          { id: 'ws_2', name: 'Project B', path: projectB },
        ],
        activeWorkspaceId: 'ws_2',
      });

      const manager = await initialisedManager();

      expect(manager.getActiveWorkspace()?.path).toBe(projectB);
    });

    it('renames the file rather than deleting it', async () => {
      const path = legacyFile({
        workspaces: [{ id: 'ws_1', name: 'Project A', path: projectA }],
      });
      const originalContents = readFileSync(path, 'utf-8');

      await initialisedManager();

      expect(existsSync(path)).toBe(false);
      expect(existsSync(`${path}.migrated`)).toBe(true);
      // Byte-identical: the backup is the original, not a re-serialisation.
      expect(readFileSync(`${path}.migrated`, 'utf-8')).toBe(originalContents);
    });

    it('does not re-import on the next start', async () => {
      legacyFile({ workspaces: [{ id: 'ws_1', name: 'Project A', path: projectA }] });

      await initialisedManager();
      const second = await initialisedManager();

      expect(second.listWorkspaces()).toHaveLength(1);
    });

    it('leaves a corrupt file untouched', async () => {
      const path = join(dataDir, 'workspaces.json');
      writeFileSync(path, '{ this is not json');

      const manager = await initialisedManager();

      // Still there, unrenamed: an unreadable file may be repairable by hand,
      // and renaming it would hide that it existed.
      expect(existsSync(path)).toBe(true);
      expect(existsSync(`${path}.migrated`)).toBe(false);
      expect(readFileSync(path, 'utf-8')).toBe('{ this is not json');
      // And the app still starts.
      expect(manager.listWorkspaces()).toHaveLength(0);
    });

    it('skips entries with no usable path', async () => {
      legacyFile({
        workspaces: [
          { id: 'ws_1', name: 'No path' },
          { id: 'ws_2', name: 'Empty path', path: '' },
          { id: 'ws_3', name: 'Project A', path: projectA },
        ],
      });

      const manager = await initialisedManager();

      expect(manager.listWorkspaces()).toHaveLength(1);
      expect(manager.listWorkspaces()[0].path).toBe(projectA);
    });

    it('names an entry after its folder when the file has no name', async () => {
      legacyFile({ workspaces: [{ id: 'ws_1', path: projectA }] });

      const manager = await initialisedManager();

      expect(manager.getWorkspace(projectA)?.name).toBe('project-a');
    });

    it('handles a missing file as the normal first run', async () => {
      const manager = await initialisedManager();

      expect(manager.listWorkspaces()).toEqual([]);
      expect(manager.getActiveWorkspace()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Rows whose folder is gone
  // -------------------------------------------------------------------------

  describe('unreachable folders', () => {
    it('hides a workspace whose folder no longer exists', async () => {
      const first = await initialisedManager();
      await first.addWorkspace(projectA);
      rmSync(projectA, { recursive: true, force: true });

      const second = await initialisedManager();

      expect(second.listWorkspaces()).toHaveLength(0);
    });

    it('keeps its row and data rather than cascading them away', async () => {
      const first = await initialisedManager();
      await first.addWorkspace(projectA);

      const db = (await service.getManager()).getDb();
      const now = Date.now();
      db.prepare(
        'INSERT INTO tasks (id, workspace_id, content, status, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('t1', projectA, 'a task', 'pending', 1, now, now);

      rmSync(projectA, { recursive: true, force: true });
      await initialisedManager();

      // An unmounted drive must not destroy the user's tasks.
      expect(db.prepare('SELECT COUNT(*) AS n FROM workspaces').get<{ n: number }>()?.n).toBe(1);
      expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get<{ n: number }>()?.n).toBe(1);
    });

    it('drops the active pointer when its workspace is unreachable', async () => {
      const first = await initialisedManager();
      await first.addWorkspace(projectA);
      await first.switchWorkspace(projectA);
      rmSync(projectA, { recursive: true, force: true });

      const second = await initialisedManager();

      expect(second.getActiveWorkspace()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Events the handlers rely on
  // -------------------------------------------------------------------------

  describe('events', () => {
    it('emits workspace-added', async () => {
      const manager = await initialisedManager();
      const added = vi.fn();
      manager.on('workspace-added', added);

      await manager.addWorkspace(projectA);

      expect(added).toHaveBeenCalledTimes(1);
    });

    it('emits workspace-switched, which the IPC layer relays to the renderer', async () => {
      const manager = await initialisedManager();
      await manager.addWorkspace(projectA);
      await manager.addWorkspace(projectB);

      const switched = vi.fn();
      manager.on('workspace-switched', switched);
      await manager.switchWorkspace(projectB);

      expect(switched).toHaveBeenCalledWith(projectB, projectA);
    });

    it('emits workspace-cleanup and workspace-removed on removal', async () => {
      const manager = await initialisedManager();
      await manager.addWorkspace(projectA);

      const cleanup = vi.fn();
      const removed = vi.fn();
      manager.on('workspace-cleanup', cleanup);
      manager.on('workspace-removed', removed);

      await manager.removeWorkspace(projectA);

      expect(cleanup).toHaveBeenCalled();
      expect(removed).toHaveBeenCalledWith(projectA);
    });

    it('throws when switching to an unknown workspace', async () => {
      const manager = await initialisedManager();

      await expect(manager.switchWorkspace('/nope')).rejects.toThrow(/not found/);
    });
  });

  // -------------------------------------------------------------------------
  // In-memory runtime state (never persisted, before or after this change)
  // -------------------------------------------------------------------------

  describe('runtime context', () => {
    it('tracks sessions, open files and terminals per workspace', async () => {
      const manager = await initialisedManager();
      await manager.addWorkspace(projectA);

      manager.addSession(projectA, 's1');
      manager.addOpenFile(projectA, '/a.ts');
      manager.addTerminal(projectA, 't1');

      const context = manager.getContext(projectA);
      expect(context?.activeSessions.has('s1')).toBe(true);
      expect(context?.openFiles.has('/a.ts')).toBe(true);
      expect(context?.terminalIds.has('t1')).toBe(true);

      manager.removeSession(projectA, 's1');
      manager.removeOpenFile(projectA, '/a.ts');
      manager.removeTerminal(projectA, 't1');

      expect(manager.getContext(projectA)?.activeSessions.size).toBe(0);
      expect(manager.getContext(projectA)?.openFiles.size).toBe(0);
      expect(manager.getContext(projectA)?.terminalIds.size).toBe(0);
    });

    it('starts a reloaded workspace with empty runtime state', async () => {
      const first = await initialisedManager();
      await first.addWorkspace(projectA);
      first.addTerminal(projectA, 't1');

      const second = await initialisedManager();

      expect(second.getContext(projectA)?.terminalIds.size).toBe(0);
    });
  });
});
