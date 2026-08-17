/**
 * Migration 003: Add MCP servers table
 */

export const up = `
-- MCP Servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT,
  author TEXT,
  homepage TEXT,
  status TEXT NOT NULL CHECK(status IN ('installed', 'available', 'running', 'error', 'stopped')),
  command TEXT,
  args TEXT, -- JSON array of strings
  env TEXT, -- JSON object
  transport TEXT NOT NULL CHECK(transport IN ('stdio', 'http')),
  tools TEXT, -- JSON array of tools
  installed_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX idx_mcp_servers_updated_at ON mcp_servers(updated_at);

-- MCP Permissions table
CREATE TABLE IF NOT EXISTS mcp_permissions (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 0 CHECK(granted IN (0, 1)),
  granted_at INTEGER,
  granted_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(server_id, tool_name)
);

CREATE INDEX idx_mcp_permissions_server_id ON mcp_permissions(server_id);
CREATE INDEX idx_mcp_permissions_granted ON mcp_permissions(granted);
`;

export const down = `
DROP TABLE IF EXISTS mcp_permissions;
DROP TABLE IF EXISTS mcp_servers;
`;
