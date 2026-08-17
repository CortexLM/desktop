/**
 * Repository - Workspaces
 */

import { randomUUID } from 'node:crypto';
import type { Workspace, WorkspaceRow } from '../types.js';
import { BaseRepository, toJSONColumn, fromJSONColumn } from './base-repository.js';

const TABLE = 'workspaces';

/**
 * Last segment of a path, used as a workspace's display name.
 *
 * Implemented here rather than with `node:path`: the value can be the literal
 * `'default'` (what the renderer sends when no folder is open) or a Windows
 * path, and `posix.basename` would mishandle the latter on a POSIX host.
 */
function basename(path: string): string {
  const segments = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return segments[segments.length - 1] || path;
}

export class WorkspaceRepository extends BaseRepository {
  /**
   * Registers a workspace keyed by its own path, and returns it.
   *
   * This is the entry point the application uses (via `WorkspaceManager`), as
   * opposed to `create()` below which mints a surrogate UUID.
   *
   * Why `id === path`: the renderer identifies a workspace by the open folder
   * path and has no way to learn any other identifier — `tasks.workspace_id`
   * and `automations.workspace_id` are written straight from
   * `workspacePath ?? 'default'`. Keying by path is what makes those foreign
   * keys satisfiable; see `migrations/004_workspace_identity.ts` for the full
   * rationale and its known limit (a moved folder is a new workspace).
   *
   * Idempotent, because it is called on every workspace open and on import from
   * `workspaces.json`. An existing row is returned unchanged apart from `name`,
   * which is refreshed when a better one is supplied: the row may have been
   * auto-registered by the SQL trigger with the basename as a placeholder, and
   * the real name is only known once someone passes it.
   */
  ensure(path: string, name?: string): Workspace {
    const existing = this.get(path);
    const now = Date.now();

    if (existing) {
      if (name && name !== existing.name) {
        this.update(path, { name });
        return { ...existing, name, updated_at: now };
      }
      return existing;
    }

    const workspace: Workspace = {
      id: path,
      name: name || basename(path),
      path,
      created_at: now,
      updated_at: now,
      settings: {},
    };

    // `INSERT OR IGNORE` guards the race where a concurrent write (or the
    // trigger, firing for a task inserted between the SELECT above and here)
    // already created the row. Re-read afterwards so the caller always gets
    // what is actually stored rather than what this call attempted.
    this.db
      .prepare(
        `INSERT OR IGNORE INTO ${TABLE} (id, name, path, created_at, updated_at, settings)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        workspace.id,
        workspace.name,
        workspace.path,
        workspace.created_at,
        workspace.updated_at,
        toJSONColumn(workspace.settings)
      );

    return this.get(path) ?? workspace;
  }

  create(data: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>): Workspace {
    const now = Date.now();
    const workspace: Workspace = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO ${TABLE} (id, name, path, created_at, updated_at, settings)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        workspace.id,
        workspace.name,
        workspace.path,
        workspace.created_at,
        workspace.updated_at,
        toJSONColumn(workspace.settings)
      );

    return workspace;
  }

  get(id: string): Workspace | null {
    const row = this.db.prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(id) as
      | WorkspaceRow
      | undefined;

    return row ? this.deserialize(row) : null;
  }

  getByPath(path: string): Workspace | null {
    const row = this.db.prepare(`SELECT * FROM ${TABLE} WHERE path = ?`).get(path) as
      | WorkspaceRow
      | undefined;

    return row ? this.deserialize(row) : null;
  }

  list(): Workspace[] {
    const rows = this.db
      .prepare(`SELECT * FROM ${TABLE} ORDER BY updated_at DESC`)
      .all() as WorkspaceRow[];

    return rows.map((row) => this.deserialize(row));
  }

  update(id: string, data: Partial<Omit<Workspace, 'id' | 'created_at'>>): void {
    this.applyUpdate(
      TABLE,
      id,
      this.collectUpdates(data, {
        name: { column: 'name' },
        path: { column: 'path' },
        settings: { column: 'settings', serialize: (value) => JSON.stringify(value) },
      })
    );
  }

  delete(id: string): void {
    this.deleteById(TABLE, id);
  }

  private deserialize(row: WorkspaceRow): Workspace {
    return {
      ...row,
      settings: fromJSONColumn(row.settings),
    };
  }
}
