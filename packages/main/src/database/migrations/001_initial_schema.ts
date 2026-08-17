/**
 * Migration 001: Initial schema
 * Creates all core tables for Cortex IDE
 */

import type { DatabaseAdapter } from '../adapter.js';

export const version = 1;
export const description = 'Initial schema with workspaces, sessions, messages, missions, usage_logs, and automations';

export function up(db: DatabaseAdapter): void {
  // Enable foreign keys and WAL mode
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Workspaces table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      settings TEXT
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspaces_path ON workspaces(path);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON workspaces(updated_at);
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT,
      model TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);

  // Missions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('planning', 'running', 'paused', 'completed', 'failed')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      state TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_missions_workspace_id ON missions(workspace_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_missions_updated_at ON missions(updated_at);
  `);

  // Usage logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_input INTEGER,
      tokens_output INTEGER,
      cost REAL,
      created_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_usage_logs_session_id ON usage_logs(session_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_usage_logs_provider ON usage_logs(provider);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
  `);

  // Automations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1 CHECK(enabled IN (0, 1)),
      trigger TEXT NOT NULL,
      actions TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_automations_workspace_id ON automations(workspace_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);
  `);
}

export function down(db: DatabaseAdapter): void {
  // Drop tables in reverse order
  db.exec('DROP TABLE IF EXISTS automations;');
  db.exec('DROP TABLE IF EXISTS usage_logs;');
  db.exec('DROP TABLE IF EXISTS missions;');
  db.exec('DROP TABLE IF EXISTS messages;');
  db.exec('DROP TABLE IF EXISTS sessions;');
  db.exec('DROP TABLE IF EXISTS workspaces;');
}
