/**
 * Migration manager for Cortex IDE database
 * Handles schema versioning and migration execution
 */

import type { DatabaseAdapter } from './adapter.js';
import { MIGRATIONS, type Migration } from './migrations/index';

export class MigrationManager {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
    this.ensureSchemaVersionTable();
  }

  /**
   * Ensure schema_version table exists
   */
  private ensureSchemaVersionTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL,
        description TEXT
      );
    `);
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    const row = this.db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number | null };
    return row?.version ?? 0;
  }

  /**
   * All known migrations, ascending by version.
   *
   * Reads from the static registry rather than scanning the filesystem, so it
   * works identically in dev and in the bundled app.
   */
  private async loadMigrations(): Promise<Migration[]> {
    return MIGRATIONS;
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    const migrations = await this.loadMigrations();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log('✓ Database is up to date (version:', currentVersion + ')');
      return;
    }

    console.log(`Running ${pendingMigrations.length} migration(s)...`);

    for (const migration of pendingMigrations) {
      try {
        console.log(`Applying migration ${migration.version}: ${migration.description}`);
        
        // Run migration in transaction
        const applyMigration = this.db.transaction(() => {
          migration.up(this.db);
          
          // Record migration
          this.db
            .prepare(
              'INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)'
            )
            .run(migration.version, Date.now(), migration.description);
        });

        applyMigration();
        console.log(`✓ Migration ${migration.version} completed`);
      } catch (error) {
        console.error(`✗ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    console.log('✓ All migrations completed successfully');
  }

  /**
   * Rollback to specific version
   */
  async rollback(targetVersion: number): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    
    if (targetVersion >= currentVersion) {
      console.log('Nothing to rollback');
      return;
    }

    const migrations = await this.loadMigrations();
    const migrationsToRollback = migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version);

    console.log(`Rolling back ${migrationsToRollback.length} migration(s)...`);

    for (const migration of migrationsToRollback) {
      try {
        console.log(`Rolling back migration ${migration.version}: ${migration.description}`);
        
        // Run rollback in transaction
        const rollbackMigration = this.db.transaction(() => {
          migration.down(this.db);
          
          // Remove migration record
          this.db
            .prepare('DELETE FROM schema_version WHERE version = ?')
            .run(migration.version);
        });

        rollbackMigration();
        console.log(`✓ Migration ${migration.version} rolled back`);
      } catch (error) {
        console.error(`✗ Rollback of migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    console.log(`✓ Rolled back to version ${targetVersion}`);
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    current: number;
    available: Migration[];
    pending: Migration[];
  }> {
    const currentVersion = this.getCurrentVersion();
    const migrations = await this.loadMigrations();
    const pending = migrations.filter(m => m.version > currentVersion);

    return {
      current: currentVersion,
      available: migrations,
      pending,
    };
  }
}
