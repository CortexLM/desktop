/**
 * Migration 002: Add tasks table
 * Creates tasks table for PlansView todo/planning feature
 */

import type { DatabaseAdapter } from '../adapter.js';

export const version = 2;
export const description = 'Add tasks table for workspace planning';

export function up(db: DatabaseAdapter): void {
  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks("order");
  `);
}

export function down(db: DatabaseAdapter): void {
  db.exec('DROP TABLE IF EXISTS tasks;');
}
