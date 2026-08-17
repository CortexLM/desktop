-- Cortex IDE SQLite Schema
-- Version: 1.0.0
-- This schema defines the core data structures for the Cortex IDE application

-- Enable foreign keys and WAL mode
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Workspaces table
-- Stores workspace information (project directories)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  settings TEXT -- JSON string for workspace settings
);

CREATE INDEX idx_workspaces_path ON workspaces(path);
CREATE INDEX idx_workspaces_updated_at ON workspaces(updated_at);

-- Sessions table
-- Stores agent conversation sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT,
  model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT -- JSON string for additional session data
);

CREATE INDEX idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);

-- Messages table
-- Stores individual messages within sessions
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  metadata TEXT -- JSON string for tool calls, attachments, etc.
);

CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Missions table
-- Stores AI agent tasks/missions inspired by opencode-missions
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('planning', 'running', 'paused', 'completed', 'failed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  state TEXT NOT NULL -- JSON string containing mission state
);

CREATE INDEX idx_missions_workspace_id ON missions(workspace_id);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_updated_at ON missions(updated_at);

-- Usage logs table
-- Tracks API usage for billing and analytics
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

CREATE INDEX idx_usage_logs_session_id ON usage_logs(session_id);
CREATE INDEX idx_usage_logs_provider ON usage_logs(provider);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);

-- Automations table
-- Stores automation configurations
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1 CHECK(enabled IN (0, 1)),
  trigger TEXT NOT NULL, -- JSON string for trigger configuration
  actions TEXT NOT NULL, -- JSON string for actions array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_automations_workspace_id ON automations(workspace_id);
CREATE INDEX idx_automations_enabled ON automations(enabled);

-- Tasks table
-- Stores todo/planning tasks for workspace
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_order ON tasks("order");

-- Schema version table
-- Tracks database migrations
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT
);
