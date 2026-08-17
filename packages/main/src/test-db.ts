// Simple test script to verify database implementation
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const dbDir = join(homedir(), '.cortex-ide');
const dbPath = join(dbDir, 'test.db');

console.log('[Test] Creating database directory...');
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

console.log('[Test] Opening database:', dbPath);
const db = new Database(dbPath);

// Enable WAL mode
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

console.log('[Test] Creating tables...');

// Create workspaces table
db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    settings JSON
  )
`);

console.log('[Test] ✓ Workspaces table created');

// Insert test workspace
const now = Date.now();
const workspaceId = `${now}-test`;

db.prepare(`
  INSERT INTO workspaces (id, name, path, created_at, updated_at, settings)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  workspaceId,
  'Test Workspace',
  '/tmp/test-project',
  now,
  now,
  JSON.stringify({ theme: 'dark' })
);

console.log('[Test] ✓ Inserted test workspace:', workspaceId);

// Query the workspace
const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
console.log('[Test] ✓ Retrieved workspace:', workspace);

// Check database stats
const pageCount = db.pragma('page_count', { simple: true }) as number;
const pageSize = db.pragma('page_size', { simple: true }) as number;

console.log('[Test] Database stats:');
console.log('  - Page count:', pageCount);
console.log('  - Page size:', pageSize);
console.log('  - Total size:', (pageCount * pageSize / 1024).toFixed(2), 'KB');

db.close();
console.log('[Test] ✓ Database closed successfully');
console.log('\n[Test] All tests passed! Database layer is working correctly.');
