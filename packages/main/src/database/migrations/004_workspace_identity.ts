/**
 * Migration 004: one identity for a workspace
 *
 * ## The bug this fixes
 *
 * Every task creation failed with `FOREIGN KEY constraint failed`, so Plans
 * could not save anything, for any user.
 *
 * `tasks.workspace_id` is `NOT NULL REFERENCES workspaces(id)` (migration 002),
 * and the renderer supplies the *open folder path* as that value — Workbench
 * mounts `<PlansView workspaceId={workspacePath ?? 'default'} />`. But nothing
 * ever inserted a matching `workspaces` row: `WorkspaceManager` persisted to
 * `workspaces.json`, never to SQLite. The referenced row could not exist, so
 * every INSERT was rejected.
 *
 * The same latent break applied to `automations.workspace_id`, which the
 * renderer also keys by path (`AutomationsPanel workspaceId={workspacePath ??
 * 'default'}`). It only escaped notice because that column is nullable, so the
 * FK is checked but never satisfied rather than being NOT NULL.
 *
 * ## The decision: workspaces are keyed by their path
 *
 * The whole renderer already treats "the open folder path" as workspace
 * identity: GitPanel takes `repoPath`, FileExplorer takes `workspacePath`,
 * NotesView / PlansView / AutomationsPanel take `workspacePath ?? 'default'`.
 * The `path` column is already `NOT NULL UNIQUE`, i.e. already a candidate key.
 *
 * So this migration makes `id` and `path` the same value rather than inventing
 * a second identifier the renderer has no way to learn. The FK is kept — with
 * it the `ON DELETE CASCADE` behaviour that `database.test.ts` covers for
 * sessions and automations continues to hold, and now covers tasks too.
 *
 * The alternative (dropping the FK, letting `workspace_id` be a free string)
 * was rejected: it would silently keep orphan rows for every renamed folder and
 * remove the cascade, which is real behaviour under test.
 *
 * **Known limit, stated rather than hidden:** with the path as the key, moving
 * or renaming a folder produces a *new* workspace, and the old row's tasks stay
 * attached to the old path. A surrogate key would survive a move, but only if
 * the renderer asked main for the id before writing — it does not, and cannot
 * be changed from here. Path-keying is what makes the constraint honest today.
 *
 * ## Three things happen here
 *
 * 1. **Legacy rows are re-keyed.** Any row whose `id` is not its `path` (the
 *    UUIDs `WorkspaceRepository.create()` used to mint) is rewritten to
 *    `id = path`, and every child row referencing it is repointed at the new
 *    value. Without this, a pre-existing workspace would block its own
 *    registration: `path` is UNIQUE, so a second row keyed by path could not be
 *    inserted, and the FK would keep failing for exactly the folders a user had
 *    already added.
 *
 *    The child tables are discovered from the schema (`PRAGMA
 *    foreign_key_list`), not hardcoded, because the re-key deletes the old
 *    parent row: any child table left out would have its rows cascaded away
 *    instead of moved.
 *
 * 2. **`workspaces.json` is imported** by `WorkspaceManager` (see
 *    `services/workspace-manager.ts`), not here — a migration runs inside a
 *    transaction and has no business doing async file I/O. The file is kept and
 *    renamed, never deleted.
 *
 * 3. **`app_state` holds which workspace is active.** Moving the workspace list
 *    into SQLite leaves nowhere for the "active workspace" pointer that
 *    `workspace:list` returns as `activeId`. A one-row-per-key table keeps that
 *    pointer next to the data it points at, instead of leaving a second file
 *    behind for one string — which is the shape of the bug being fixed here.
 *
 * 4. **A workspace registers itself on first write.** Two `BEFORE INSERT`
 *    triggers insert the missing parent row when a task or automation arrives
 *    for an unknown workspace. This is what makes the fix complete: the
 *    renderer can open a folder through `WorkspaceSelector` (which only writes
 *    `localStorage`) without main ever being told, so no eager registration in
 *    main can cover every path. The trigger runs on the write itself, so it
 *    cannot be out of date.
 *
 * `INSERT` inside a `BEFORE INSERT` trigger is deliberate and is checked by
 * `__tests__/migration-004-workspace-identity.test.ts`: the parent row exists
 * by the time SQLite validates the FK.
 */

import type { DatabaseAdapter } from '../adapter.js';

export const version = 4;
export const description = 'Key workspaces by path and auto-register on first write';

/** Quotes an identifier read back from SQLite's own catalogue. */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Whether `table` exists.
 *
 * Every step below is guarded by this rather than assuming the tables from
 * migrations 001/002 are present. A migration can legitimately run against a
 * partially-migrated database — `schema_version` can record a version whose
 * tables were never created (an interrupted upgrade, a hand-edited row) — and
 * earlier migrations here are defensive in the same way (`CREATE TABLE IF NOT
 * EXISTS`). Blowing up on a missing table would turn a recoverable state into
 * an app that cannot open its database at all.
 */
function tableExists(db: DatabaseAdapter, table: string): boolean {
  return (
    db
      .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get<{ present: number }>(table) !== undefined
  );
}

/**
 * Every (table, column) that references `workspaces(id)`, discovered from the
 * schema rather than hardcoded.
 *
 * Hardcoding `['sessions', 'missions', 'automations', 'tasks']` would be correct
 * today and silently wrong later: the re-key below deletes the old parent rows,
 * and `ON DELETE CASCADE` means any child table this migration forgot to
 * repoint would have its rows *deleted* instead of moved. Asking the schema
 * removes that failure mode.
 */
function workspaceChildColumns(db: DatabaseAdapter): Array<{ table: string; column: string }> {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'workspaces'"
    )
    .all<{ name: string }>();

  const children: Array<{ table: string; column: string }> = [];

  for (const { name } of tables) {
    const foreignKeys = db
      .prepare(`PRAGMA foreign_key_list(${quoteIdent(name)})`)
      .all<{ table: string; from: string }>();

    for (const fk of foreignKeys) {
      if (fk.table === 'workspaces') {
        children.push({ table: name, column: fk.from });
      }
    }
  }

  return children;
}

/**
 * Placeholder prefix parked in `workspaces.path` while a row is being re-keyed.
 *
 * `path` is UNIQUE, so the new row (keyed by path) cannot be inserted while the
 * legacy row still holds that same path. The legacy row's path is parked under
 * this prefix for the few statements in between, then that row is deleted.
 */
const PARKED_PATH_PREFIX = '__cortex_rekey__:';

/**
 * SQL expression for the last path segment of `<expr>`, used as the display
 * name for an auto-registered workspace.
 *
 * `rtrim(p, replace(p, '/', ''))` strips every trailing character that is not a
 * slash, leaving the leading directories plus the final slash; removing that
 * prefix leaves the basename. Values with no slash (notably the literal
 * `'default'` the renderer sends when no folder is open) are used as-is.
 */
function basenameExpr(expr: string): string {
  return `CASE
      WHEN instr(${expr}, '/') > 0
        THEN replace(${expr}, rtrim(${expr}, replace(${expr}, '/', '')), '')
      ELSE ${expr}
    END`;
}

/**
 * Trigger that inserts the referenced workspace when it is missing.
 *
 * Guarded by `NOT EXISTS` rather than `INSERT OR IGNORE`: a row could exist
 * with this `path` under a different `id`, and `OR IGNORE` would swallow that
 * UNIQUE conflict and leave the FK unsatisfied — the failure this migration
 * exists to remove. Re-keying above guarantees the conflict cannot arise; the
 * explicit guard means a future stray row surfaces as an error instead of a
 * silent no-op.
 */
function ensureWorkspaceTrigger(table: string, timestampColumn: string): string {
  return `
    CREATE TRIGGER IF NOT EXISTS ${table}_ensure_workspace
    BEFORE INSERT ON ${table}
    FOR EACH ROW
    WHEN NEW.workspace_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM workspaces WHERE id = NEW.workspace_id)
    BEGIN
      INSERT INTO workspaces (id, name, path, created_at, updated_at, settings)
      VALUES (
        NEW.workspace_id,
        ${basenameExpr('NEW.workspace_id')},
        NEW.workspace_id,
        NEW.${timestampColumn},
        NEW.${timestampColumn},
        NULL
      );
    END;
  `;
}

/**
 * Rewrites every workspace whose `id` is not its `path` so that it is.
 *
 * Done with plain inserts/updates/deletes that satisfy the foreign keys at
 * every step, rather than relying on `PRAGMA defer_foreign_keys`: that pragma
 * only has an effect inside a transaction, so a migration depending on it would
 * work when applied by `MigrationManager` and fail when applied directly. The
 * sequence per legacy row is:
 *
 *   1. park the legacy row's `path` under a placeholder, freeing the real path
 *      (it is UNIQUE, so the new row cannot exist while the old one holds it);
 *   2. insert the new row keyed by the real path, carrying the name, timestamps
 *      and settings across;
 *   3. repoint every child column that references `workspaces(id)` — discovered
 *      from the schema — at the new id;
 *   4. delete the parked legacy row. By now nothing references it, so
 *      `ON DELETE CASCADE` has nothing to take with it.
 *
 * Steps 3 and 4 in that order matter: deleting first would cascade the children
 * away instead of moving them.
 */
function rekeyWorkspacesByPath(db: DatabaseAdapter): void {
  if (!tableExists(db, 'workspaces')) return;

  const legacy = db
    .prepare('SELECT id, path FROM workspaces WHERE id <> path')
    .all<{ id: string; path: string }>();

  if (legacy.length === 0) return;

  const children = workspaceChildColumns(db);

  for (const row of legacy) {
    // A legacy row whose path is already taken by a correctly-keyed row would
    // collide on insert. Nothing else to move: the correct row already exists,
    // so the children are repointed at it and the legacy row is dropped.
    const targetExists =
      db.prepare('SELECT 1 AS present FROM workspaces WHERE id = ?').get<{ present: number }>(
        row.path
      ) !== undefined;

    db.prepare('UPDATE workspaces SET path = ? WHERE id = ?').run(
      `${PARKED_PATH_PREFIX}${row.id}`,
      row.id
    );

    if (!targetExists) {
      db.prepare(
        `INSERT INTO workspaces (id, name, path, created_at, updated_at, settings)
         SELECT ?, name, ?, created_at, updated_at, settings FROM workspaces WHERE id = ?`
      ).run(row.path, row.path, row.id);
    }

    for (const child of children) {
      db.prepare(
        `UPDATE ${quoteIdent(child.table)} SET ${quoteIdent(child.column)} = ?
          WHERE ${quoteIdent(child.column)} = ?`
      ).run(row.path, row.id);
    }

    db.prepare('DELETE FROM workspaces WHERE id = ?').run(row.id);
  }
}

export function up(db: DatabaseAdapter): void {
  rekeyWorkspacesByPath(db);

  // Small key/value store for app-level pointers. Deliberately not a FK to
  // `workspaces`: the active workspace may have been removed from disk, and the
  // pointer should survive that rather than being cascaded away mid-session.
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL
    );
  `);

  // `created_at` on both tables is NOT NULL, so it is always bindable as the
  // auto-registered workspace's timestamps.
  //
  // Guarded on the table existing: `CREATE TRIGGER` on a missing table is an
  // error even with `IF NOT EXISTS`, and both tables come from earlier
  // migrations that may not have run on a partially-migrated database.
  if (tableExists(db, 'tasks')) {
    db.exec(ensureWorkspaceTrigger('tasks', 'created_at'));
  }
  if (tableExists(db, 'automations')) {
    db.exec(ensureWorkspaceTrigger('automations', 'created_at'));
  }
}

export function down(db: DatabaseAdapter): void {
  // Only the triggers and `app_state` are dropped. The re-keying is not
  // reversed: the original UUIDs are not recorded anywhere, so inventing new
  // ones would not restore the previous state, it would fabricate a different
  // one.
  db.exec('DROP TRIGGER IF EXISTS tasks_ensure_workspace;');
  db.exec('DROP TRIGGER IF EXISTS automations_ensure_workspace;');
  db.exec('DROP TABLE IF EXISTS app_state;');
}
