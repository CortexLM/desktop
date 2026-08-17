/**
 * Static migration registry.
 *
 * Migrations used to be discovered by scanning this directory at runtime and
 * `import()`-ing each file. That cannot work in the packaged app: Vite bundles
 * the main process into a single file, so `dist/migrations/` does not exist and
 * the scan failed silently — the schema was never created and every
 * DB-backed feature (AI sessions, automations, notes, plans) broke while the log
 * claimed "Database is up to date (version: 0)".
 *
 * Listing them statically makes the bundler include them and turns a missing
 * migration into a compile error instead of a silent no-op.
 */

import type { DatabaseAdapter } from '../adapter.js';

import * as initialSchema from './001_initial_schema';
import * as addTasksTable from './002_add_tasks_table';
import * as addMcpTables from './003_add_mcp_tables';
import * as workspaceIdentity from './004_workspace_identity';

export interface Migration {
  version: number;
  description: string;
  up: (db: DatabaseAdapter) => void;
  down: (db: DatabaseAdapter) => void;
}

/**
 * Migrations are written in two shapes: as functions taking the adapter, or as
 * raw SQL strings. Normalise both into the function form.
 */
type MigrationModule = {
  version?: number;
  description?: string;
  up: ((db: DatabaseAdapter) => void) | string;
  down: ((db: DatabaseAdapter) => void) | string;
};

function toRunner(
  step: ((db: DatabaseAdapter) => void) | string
): (db: DatabaseAdapter) => void {
  return typeof step === 'string' ? (db) => db.exec(step) : step;
}

function normalise(
  module: MigrationModule,
  fallbackVersion: number,
  fallbackDescription: string
): Migration {
  return {
    version: module.version ?? fallbackVersion,
    description: module.description ?? fallbackDescription,
    up: toRunner(module.up),
    down: toRunner(module.down),
  };
}

/**
 * Every known migration, ascending by version.
 *
 * Add new migrations here; the fallback version/description apply only to
 * modules that predate the `version` export convention.
 */
export const MIGRATIONS: Migration[] = [
  normalise(initialSchema as MigrationModule, 1, 'Initial schema'),
  normalise(addTasksTable as MigrationModule, 2, 'Add tasks table'),
  normalise(addMcpTables as MigrationModule, 3, 'Add MCP tables'),
  normalise(workspaceIdentity as MigrationModule, 4, 'Key workspaces by path'),
].sort((a, b) => a.version - b.version);
