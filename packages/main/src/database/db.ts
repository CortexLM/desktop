/**
 * Database package exports
 */

export { DatabaseManager } from './index.js';
export { MigrationManager } from './migration-manager.js';
export { createDatabaseAdapter } from './adapter.js';
export type { DatabaseAdapter, StatementAdapter } from './adapter.js';
export * from './types.js';
export * from './errors.js';
