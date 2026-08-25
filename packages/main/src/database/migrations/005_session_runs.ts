/**
 * Migration 005: sessions become runs, with a timeline
 *
 * ## What was missing
 *
 * `sessions` (migration 001) holds an id, a title, a model and a JSON blob. That
 * is enough for a chat transcript and not enough for a *run*: the inbox has to
 * sort and filter by state, the row has to show which repo and branch the work
 * happened on, and the card shows a diff stat. All of that lived only in
 * `AIService`'s in-memory map, so it was gone on restart — and the app showed an
 * empty list every launch while the DB still held the rows.
 *
 * The columns added here are the ones the UI *queries or sorts by*. Anything
 * purely descriptive stays in `metadata`, because a column that is only ever
 * read back whole earns nothing over a JSON field.
 *
 * ## Why the timeline is its own table
 *
 * `messages.role` is `CHECK(role IN ('user','assistant','system'))`, so a tool
 * call cannot be stored there at all — `AIService.persistMessage` silently skips
 * `role === 'tool'` for exactly this reason. Widening that CHECK was the obvious
 * move and the wrong one: a tool event is not a message. It carries a name, an
 * ok/failed outcome, a duration and a diff stat, and squeezing those into
 * `content` as prose would mean parsing them back out to render a row.
 *
 * So `session_events` is an append-only log of what happened during a run, with
 * the payload shaped per kind. `seq` rather than a timestamp for ordering: two
 * events in the same millisecond are common (a tool ending and the next starting)
 * and `created_at` alone would render them in an arbitrary order.
 */

import type { DatabaseAdapter } from '../adapter.js';

export const version = 5;
export const description = 'Session run state and an append-only session timeline';

function tableExists(db: DatabaseAdapter, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get<{ name: string }>(table);
  return row !== undefined;
}

/**
 * Adds a column only when it is absent.
 *
 * SQLite has no `ADD COLUMN IF NOT EXISTS`, and this migration has to be safe to
 * re-run against a database a partially-applied earlier attempt touched.
 *
 * `PRAGMA table_info` on a table that does not exist returns an empty list rather
 * than failing, so it cannot stand in for an existence check — the guard has to be
 * separate, or the `ALTER TABLE` below throws `no such table`.
 */
function addColumn(db: DatabaseAdapter, table: string, column: string, definition: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (existing.some((row) => row.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

export function up(db: DatabaseAdapter): void {
  // `schema_version` can name a version whose tables do not exist — a row written
  // by a run that failed after recording itself, or a hand-edited database. This
  // migration then has nothing to alter, and must be a no-op rather than an error
  // that blocks every later migration behind it. Migration 004 guards the same way
  // for the same reason.
  if (!tableExists(db, 'sessions')) return;

  // `status` has no CHECK constraint. The set of run states is a product decision
  // that changes more often than the schema should, and a CHECK here would turn
  // adding one into a migration. The service owns the vocabulary.
  addColumn(db, 'sessions', 'status', "TEXT NOT NULL DEFAULT 'queued'");
  addColumn(db, 'sessions', 'repo', 'TEXT');
  addColumn(db, 'sessions', 'branch', 'TEXT');
  addColumn(db, 'sessions', 'runtime', 'TEXT');
  addColumn(db, 'sessions', 'provider', 'TEXT');
  // The prompt is denormalised onto the row on purpose: the inbox shows it as the
  // session's title line, and joining `messages` to find the first user turn for
  // every row in the list is a query per row for something that never changes.
  addColumn(db, 'sessions', 'prompt', 'TEXT');
  addColumn(db, 'sessions', 'additions', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'sessions', 'deletions', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'sessions', 'files_changed', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'sessions', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  // Set when the run stops, so "ran for 4m 32s" is a fact rather than a guess
  // from `updated_at`, which every later edit would move.
  addColumn(db, 'sessions', 'started_at', 'INTEGER');
  addColumn(db, 'sessions', 'finished_at', 'INTEGER');
  addColumn(db, 'sessions', 'error', 'TEXT');
  addColumn(db, 'sessions', 'pull_request_url', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(session_id, seq)
    );
  `);

  // The only access pattern: every event for one session, in order. A separate
  // index on `created_at` would serve no query the app makes.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_events_session
      ON session_events(session_id, seq);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  `);

  // The inbox is ordered by recency and almost always excludes archived rows, so
  // the index carries `archived` first to keep that the covered case.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_archived_updated
      ON sessions(archived, updated_at DESC);
  `);
}

export function down(db: DatabaseAdapter): void {
  db.exec('DROP TABLE IF EXISTS session_events;');
  // The added columns are deliberately left in place. SQLite gained
  // `DROP COLUMN` only in 3.35 and it fails outright on a column that any index
  // references — so a faithful down migration here means rebuilding the table,
  // which risks the rows it is meant to preserve. Leaving nullable columns behind
  // costs nothing and cannot lose data.
}
