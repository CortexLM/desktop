# Cortex IDE - Database Layer

## Overview

This is the SQLite database layer for Cortex IDE, implemented with `better-sqlite3`.

## Features

- ✅ **Complete schema** with all tables (workspaces, sessions, messages, missions, usage_logs, automations)
- ✅ **Migration system** with version tracking and rollback support
- ✅ **WAL mode** enabled for better concurrency
- ✅ **Type-safe** with full TypeScript types
- ✅ **CRUD methods** for all entities
- ✅ **Error handling** with custom error types
- ✅ **Foreign key constraints** and cascade deletes
- ✅ **JSON support** for complex data (settings, metadata, state)
- ✅ **Indexes** on frequently queried fields

## Installation

```bash
cd /root/projects/cortex-ide
bun install
```

## Usage

```typescript
import { DatabaseManager } from '@cortex/main/database';

// Initialize database
const db = new DatabaseManager({
  path: '/path/to/database.db',
  verbose: true, // Enable SQL logging
});

await db.initialize();

// Create a workspace
const workspace = db.createWorkspace({
  name: 'My Project',
  path: '/home/user/projects/my-project',
  settings: { theme: 'dark' },
});

// Create a session
const session = db.createSession({
  workspace_id: workspace.id,
  title: 'Chat session',
  model: 'gpt-4',
});

// Add messages
db.createMessage({
  session_id: session.id,
  role: 'user',
  content: 'Hello!',
});

// List messages
const messages = db.listMessages(session.id);

// Track usage
db.createUsageLog({
  session_id: session.id,
  provider: 'openai',
  model: 'gpt-4',
  tokens_input: 100,
  tokens_output: 200,
  cost: 0.01,
});

// Get statistics
const stats = db.getUsageStats();
console.log(stats);
```

## Database Schema

### Tables

- **workspaces** - Project workspaces
- **sessions** - Agent conversation sessions
- **messages** - Chat messages in sessions
- **missions** - AI agent tasks (inspired by opencode-missions)
- **usage_logs** - Token usage and billing tracking
- **automations** - User-defined automations
- **schema_version** - Migration version tracking

### Performance Optimizations

- WAL (Write-Ahead Logging) mode for concurrent reads/writes
- Memory-mapped I/O for faster access
- Indexes on foreign keys and timestamp columns
- NORMAL synchronous mode for better performance

## API Reference

### DatabaseManager

#### Workspaces
- `createWorkspace(data: CreateWorkspace): Workspace`
- `getWorkspace(id: string): Workspace | null`
- `getWorkspaceByPath(path: string): Workspace | null`
- `listWorkspaces(limit?, offset?): Workspace[]`
- `updateWorkspace(id: string, data: UpdateWorkspace): Workspace`
- `deleteWorkspace(id: string): void`

#### Sessions
- `createSession(data: CreateSession): Session`
- `getSession(id: string): Session | null`
- `listSessions(workspaceId?, limit?, offset?): Session[]`
- `updateSession(id: string, data: UpdateSession): Session`
- `deleteSession(id: string): void`

#### Messages
- `createMessage(data: CreateMessage): Message`
- `getMessage(id: string): Message | null`
- `listMessages(sessionId: string, limit?, offset?): Message[]`
- `deleteMessage(id: string): void`

#### Missions
- `createMission(data: CreateMission): Mission`
- `getMission(id: string): Mission | null`
- `listMissions(workspaceId?, status?, limit?, offset?): Mission[]`
- `updateMission(id: string, data: UpdateMission): Mission`
- `deleteMission(id: string): void`

#### Usage Logs
- `createUsageLog(data: CreateUsageLog): UsageLog`
- `getUsageLog(id: string): UsageLog | null`
- `listUsageLogs(filters?, limit?, offset?): UsageLog[]`
- `getUsageStats(sessionId?): UsageStats`

#### Automations
- `createAutomation(data: CreateAutomation): Automation`
- `getAutomation(id: string): Automation | null`
- `listAutomations(workspaceId?, enabledOnly?, limit?, offset?): Automation[]`
- `updateAutomation(id: string, data: UpdateAutomation): Automation`
- `deleteAutomation(id: string): void`

#### Utilities
- `vacuum(): void` - Compact database
- `checkpoint(): void` - Checkpoint WAL
- `getStats(): DatabaseStats` - Get database statistics
- `close(): void` - Close database connection

## Error Handling

The database layer provides custom error types:

```typescript
import { DatabaseError } from '@cortex/main/database';

try {
  db.getWorkspace('invalid-id');
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error(error.code); // 'NOT_FOUND', 'UNIQUE_CONSTRAINT', etc.
    console.error(error.message);
  }
}
```

Error codes:
- `NOT_FOUND` - Entity not found
- `UNIQUE_CONSTRAINT` - Duplicate key violation
- `FOREIGN_KEY` - Invalid foreign key reference
- `INVALID_DATA` - Data validation failed
- `TRANSACTION_ERROR` - Transaction failed
- `UNKNOWN_ERROR` - Unexpected error

## Migrations

The migration system supports:

```typescript
// Register a new migration
db.migrationManager.registerMigration({
  version: 2,
  description: 'Add user preferences table',
  up: `
    CREATE TABLE user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value JSON,
      UNIQUE(user_id, key)
    );
  `,
  down: `DROP TABLE user_preferences;`,
});

// Apply migrations
await db.initialize();

// Rollback to version
await db.migrationManager.rollback(1);
```

## Testing

Run the example:

```bash
cd packages/main
bun run src/index.ts
```

This will:
1. Initialize the database
2. Run migrations
3. Create example data
4. Display usage statistics

## Next Steps

This database layer is now ready for integration with:

1. **IPC Layer** (Phase 1, Task 3) - Expose database operations to renderer process
2. **AI Engine** (Phase 4) - Store agent sessions and missions
3. **Workspace Management** - Track projects and files
4. **Usage Tracking** - Monitor AI provider usage and costs
5. **Automations System** (Phase 5) - Persist automation rules

## Architecture Notes

- **Filesystem-first**: Follows opencode-missions pattern with local SQLite storage
- **Type-safe**: Full TypeScript coverage with strict types
- **Performance**: WAL mode + indexes for production-grade performance
- **Migrations**: Version-controlled schema with rollback support
- **Error handling**: Comprehensive error types and handling
