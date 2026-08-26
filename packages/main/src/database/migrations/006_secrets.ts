/**
 * Migration 006: secrets
 *
 * The environment variables an agent run receives — a Stripe test key, a database
 * URL. Stored here rather than in a JSON file next to the provider settings because
 * they are per-workspace data with a lifecycle (created, used, deleted) and the
 * list is read on every screen visit.
 *
 * ## Two value columns, one of which is always null
 *
 * `value_enc` holds the `safeStorage` ciphertext; `value` holds plaintext for the
 * case where no OS keyring is available (a Linux box without one returns
 * `isEncryptionAvailable() === false` legitimately). The same pair as
 * `provider-settings-service` uses, for the same reason: the fallback is a step
 * down from encryption and it must be visible in the schema rather than hidden
 * behind one ambiguous column.
 *
 * ## `name` is unique
 *
 * Two secrets with one name cannot both apply — the environment variable would have
 * a single value — so the constraint is in the schema rather than being enforced by
 * whichever code path happens to check.
 */

import type { DatabaseAdapter } from '../adapter.js';

export const version = 6;
export const description = 'Secrets exposed to agent runs as environment variables';

export function up(db: DatabaseAdapter): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      value TEXT,
      value_enc TEXT,
      scope TEXT NOT NULL DEFAULT 'local',
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );
  `);

  // The list is ordered by name, which is also how a user looks one up.
  db.exec('CREATE INDEX IF NOT EXISTS idx_secrets_name ON secrets(name);');
}

export function down(db: DatabaseAdapter): void {
  db.exec('DROP TABLE IF EXISTS secrets;');
}
