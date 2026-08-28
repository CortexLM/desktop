/**
 * Migration 007: conversations
 *
 * The Chat product's threads. Separate tables from the Code product's `sessions`
 * on purpose: a conversation is a linear exchange of messages with none of a
 * run's machinery (repo, branch, diff stats, timeline events, permissions), and
 * stretching the sessions schema over both would leave most columns null for one
 * product and invite queries that mix the two.
 *
 * `seq` orders messages within a thread explicitly rather than leaning on the
 * autoincrement id — ids order by insertion across ALL threads, which happens to
 * work until a backfill or an import breaks the coincidence.
 */

import type { DatabaseAdapter } from '../adapter.js';

export const version = 7;
export const description = 'Chat conversations and their messages';

export function up(db: DatabaseAdapter): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'search',
      provider TEXT,
      model TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread
      ON conversation_messages(conversation_id, seq);
  `);
}

export function down(db: DatabaseAdapter): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_conversation_messages_thread;
    DROP TABLE IF EXISTS conversation_messages;
    DROP TABLE IF EXISTS conversations;
  `);
}
