/**
 * Applies the real migration chain to a copy of a database, and reports what
 * changed.
 *
 * Used to check migration 004 against the legacy UUID-keyed database found on
 * this machine (`~/.cortex-ide/cortex-ide.db`) without touching the original.
 *
 *   bunx tsx scripts/migrate-db-copy.ts /path/to/copy.db
 */

import { DatabaseManager } from '../packages/main/src/database/index';

const target = process.argv[2];
if (!target) {
  console.error('usage: migrate-db-copy.ts <path-to-db-copy>');
  process.exit(1);
}

const manager = await DatabaseManager.create(target);
const db = manager.getDb();

const before = {
  version: db.prepare('SELECT MAX(version) AS v FROM schema_version').get<{ v: number }>()?.v,
  workspaces: db.prepare('SELECT id, name, path FROM workspaces').all(),
  sessions: db.prepare('SELECT id, workspace_id FROM sessions').all(),
  automations: db.prepare('SELECT id, workspace_id FROM automations').all(),
};

console.log('--- before ---');
console.log(JSON.stringify(before, null, 2));

await manager.initialize();

const after = {
  version: db.prepare('SELECT MAX(version) AS v FROM schema_version').get<{ v: number }>()?.v,
  workspaces: db.prepare('SELECT id, name, path FROM workspaces').all(),
  sessions: db.prepare('SELECT id, workspace_id FROM sessions').all(),
  automations: db.prepare('SELECT id, workspace_id FROM automations').all(),
  tasks: db.prepare('SELECT COUNT(*) AS n FROM tasks').get<{ n: number }>()?.n,
  fkViolations: db.prepare('PRAGMA foreign_key_check').all(),
  triggers: db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
    .all<{ name: string }>()
    .map((r) => r.name),
};

console.log('--- after ---');
console.log(JSON.stringify(after, null, 2));

// Does a task insert keyed by the folder path now succeed? That is the bug.
const now = Date.now();
try {
  db.prepare(
    'INSERT INTO tasks (id, workspace_id, content, status, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run('probe-task', '/root/projects/example', 'probe', 'pending', 1, now, now);
  console.log('\n✅ task insert keyed by folder path succeeded');
} catch (error) {
  console.log(`\n❌ task insert failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}

const sessionsPreserved = after.sessions.length === before.sessions.length;
const automationsPreserved = after.automations.length === before.automations.length;
console.log(`sessions preserved   : ${sessionsPreserved} (${before.sessions.length} -> ${after.sessions.length})`);
console.log(`automations preserved: ${automationsPreserved} (${before.automations.length} -> ${after.automations.length})`);
console.log(`FK violations        : ${after.fkViolations.length}`);

if (!sessionsPreserved || !automationsPreserved || after.fkViolations.length > 0) {
  process.exitCode = 1;
}

manager.close();
