# Database Layer - Cortex IDE

This directory contains the complete SQLite database layer for Cortex IDE, including schema, migrations, and a type-safe database manager.

## Structure

```
database/
├── schema.sql              # Complete SQL schema
├── migrations/             # Migration files
│   └── 001_initial_schema.ts
├── index.ts                # DatabaseManager class
├── migration-manager.ts    # Migration system
├── types.ts                # TypeScript types
├── errors.ts               # Error handling
├── db.ts                   # Package exports
├── test-db.ts              # Integration tests
└── README.md               # This file
```

## Features

### ✅ Complete Schema
- **Workspaces**: Project directories with settings
- **Sessions**: Agent conversation sessions
- **Messages**: Chat history with role-based messages
- **Missions**: AI agent tasks inspired by opencode-missions
- **Usage Logs**: API usage tracking for billing
- **Automations**: Automation configurations

### ✅ Migration System
- Version-based migrations
- Automatic migration discovery
- Rollback support
- Transaction-safe execution

### ✅ Type Safety
- Full TypeScript types for all entities
- Separate row types for database serialization
- JSON field type definitions

### ✅ CRUD Operations
- Complete CRUD for all entities
- Query methods with filtering
- Aggregation queries (usage stats)
- Cascade deletes for related data

### ✅ Performance
- **WAL mode** enabled for better concurrency
- Proper indexing on frequently queried columns
- Foreign key constraints enforced

### ✅ Error Handling
- Custom error classes
- SQLite error classification
- Connection validation
- Integrity checking

## Usage

### Initialize Database

```typescript
import { DatabaseManager } from './database/index.js';

const db = new DatabaseManager('./cortex-ide.db');

// Run migrations
await db.initialize();
```

### Create a Workspace

```typescript
const workspace = db.createWorkspace({
  name: 'My Project',
  path: '/home/user/projects/my-project',
  settings: {
    theme: 'dark',
    editor: {
      fontSize: 14,
      tabSize: 2,
    },
  },
});
```

### Create a Session

```typescript
const session = db.createSession({
  workspace_id: workspace.id,
  title: 'Implement authentication',
  model: 'gpt-4',
  metadata: {
    provider: 'openai',
    temperature: 0.7,
  },
});
```

### Add Messages

```typescript
const message = db.createMessage({
  session_id: session.id,
  role: 'user',
  content: 'How do I implement JWT authentication?',
});

const response = db.createMessage({
  session_id: session.id,
  role: 'assistant',
  content: 'Here is how to implement JWT...',
  metadata: {
    tokens: {
      input: 15,
      output: 150,
    },
  },
});
```

### Track Usage

```typescript
const log = db.createUsageLog({
  session_id: session.id,
  provider: 'openai',
  model: 'gpt-4',
  tokens_input: 15,
  tokens_output: 150,
  cost: 0.0045,
});

// Get aggregated stats
const stats = db.getUsageStats();
console.log('Total cost:', stats.totalCost);
console.log('By provider:', stats.byProvider);
```

### Create Mission

```typescript
const mission = db.createMission({
  workspace_id: workspace.id,
  status: 'running',
  state: {
    name: 'Refactor auth module',
    description: 'Refactor authentication to use JWT',
    steps: [
      {
        id: 'step-1',
        name: 'Install dependencies',
        status: 'completed',
      },
      {
        id: 'step-2',
        name: 'Implement JWT utils',
        status: 'running',
      },
    ],
    currentStep: 1,
  },
});

// Update mission status
db.updateMission(mission.id, {
  status: 'completed',
});
```

### Create Automation

```typescript
const automation = db.createAutomation({
  workspace_id: workspace.id,
  name: 'Auto-format on save',
  enabled: true,
  trigger: {
    type: 'file_watch',
    config: {
      pattern: '**/*.ts',
      event: 'save',
    },
  },
  actions: [
    {
      type: 'run_script',
      config: {
        command: 'prettier --write',
      },
    },
  ],
});
```

### Query Data

```typescript
// List all workspaces
const workspaces = db.listWorkspaces();

// List sessions for a workspace
const sessions = db.listSessions(workspace.id);

// List messages in a session
const messages = db.listMessages(session.id);

// List missions by status
const runningMissions = db.listMissions(workspace.id, 'running');

// List enabled automations
const automations = db.listAutomations(workspace.id, true);

// List usage logs
const logs = db.listUsageLogs(session.id);
```

### Update Data

```typescript
// Update workspace
db.updateWorkspace(workspace.id, {
  name: 'Updated Project Name',
  settings: {
    theme: 'light',
  },
});

// Update session
db.updateSession(session.id, {
  title: 'New session title',
});

// Update mission
db.updateMission(mission.id, {
  status: 'paused',
  state: {
    ...mission.state,
    currentStep: 2,
  },
});

// Update automation
db.updateAutomation(automation.id, {
  enabled: false,
});
```

### Delete Data

```typescript
// Delete message
db.deleteMessage(message.id);

// Delete session (cascades to messages)
db.deleteSession(session.id);

// Delete workspace (cascades to sessions, missions, automations)
db.deleteWorkspace(workspace.id);
```

## Migrations

### Check Migration Status

```typescript
const manager = db.getMigrationManager();
const status = await manager.getStatus();

console.log('Current version:', status.current);
console.log('Available migrations:', status.available);
console.log('Pending migrations:', status.pending);
```

### Rollback Migration

```typescript
// Rollback to version 0 (empty database)
await manager.rollback(0);
```

### Create New Migration

Create a new file in `migrations/` directory:

```typescript
// migrations/002_add_teams.ts
import type Database from 'better-sqlite3';

export const version = 2;
export const description = 'Add teams table';

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

export function down(db: Database.Database): void {
  db.exec('DROP TABLE teams;');
}
```

## Error Handling

```typescript
import { 
  DatabaseError,
  DatabaseConstraintError,
  DatabaseConnectionError,
  wrapDatabaseOperation,
} from './database/errors.js';

try {
  const workspace = db.createWorkspace({
    name: 'Test',
    path: '/existing/path', // Duplicate path
  });
} catch (error) {
  if (error instanceof DatabaseConstraintError) {
    console.error('Constraint violation:', error.message);
  } else if (error instanceof DatabaseConnectionError) {
    console.error('Connection error:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Testing

Run the integration test:

```bash
bun run src/database/test-db.ts
```

The test covers:
- Database initialization
- All CRUD operations
- Migration system
- Usage statistics
- Data relationships
- Cascade deletes
- Error handling

## Performance Considerations

### WAL Mode
The database uses Write-Ahead Logging (WAL) mode for better concurrency:
- Multiple readers don't block each other
- Readers don't block writers
- Writers don't block readers

### Indexes
Indexes are created on:
- Foreign keys (workspace_id, session_id)
- Updated/created timestamps
- Status fields
- Frequently queried columns

### Transactions
Use transactions for multiple related operations:

```typescript
const db = dbManager.getDb();
const transaction = db.transaction(() => {
  const workspace = dbManager.createWorkspace({ ... });
  const session = dbManager.createSession({ workspace_id: workspace.id, ... });
  const message = dbManager.createMessage({ session_id: session.id, ... });
});

transaction();
```

## Schema Version

Current schema version: **1**

The schema version is tracked in the `schema_version` table and managed automatically by the migration system.
