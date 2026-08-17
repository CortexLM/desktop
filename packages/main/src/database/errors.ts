/**
 * Database error handling utilities
 * Provides robust error handling for database operations
 */

import type { DatabaseAdapter } from './adapter.js';

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'DB_CONNECTION_ERROR', originalError);
    this.name = 'DatabaseConnectionError';
  }
}

export class DatabaseConstraintError extends DatabaseError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'DB_CONSTRAINT_ERROR', originalError);
    this.name = 'DatabaseConstraintError';
  }
}

export class DatabaseNotFoundError extends DatabaseError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'DB_NOT_FOUND', originalError);
    this.name = 'DatabaseNotFoundError';
  }
}

export class DatabaseMigrationError extends DatabaseError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'DB_MIGRATION_ERROR', originalError);
    this.name = 'DatabaseMigrationError';
  }
}

/**
 * Wrap database operations with error handling
 */
export function wrapDatabaseOperation<T>(
  operation: () => T,
  context: string
): T {
  try {
    return operation();
  } catch (error) {
    throw handleDatabaseError(error, context);
  }
}

/**
 * Wrap async database operations with error handling
 */
export async function wrapAsyncDatabaseOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw handleDatabaseError(error, context);
  }
}

/**
 * Handle and classify database errors
 */
export function handleDatabaseError(error: unknown, context: string): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // SQLite constraint errors
    if (
      message.includes('unique constraint') ||
      message.includes('foreign key constraint') ||
      message.includes('check constraint') ||
      message.includes('not null constraint')
    ) {
      return new DatabaseConstraintError(
        `${context}: Constraint violation - ${error.message}`,
        error
      );
    }

    // Connection errors
    if (
      message.includes('database is locked') ||
      message.includes('unable to open database') ||
      message.includes('database disk image is malformed')
    ) {
      return new DatabaseConnectionError(
        `${context}: Connection error - ${error.message}`,
        error
      );
    }

    // Not found errors
    if (message.includes('no such table') || message.includes('no such column')) {
      return new DatabaseNotFoundError(
        `${context}: Schema error - ${error.message}`,
        error
      );
    }

    // Generic error
    return new DatabaseError(
      `${context}: ${error.message}`,
      'DB_ERROR',
      error
    );
  }

  // Unknown error type
  return new DatabaseError(
    `${context}: Unknown error occurred`,
    'DB_UNKNOWN_ERROR',
    error
  );
}

/**
 * Validate database connection
 */
export function validateDatabaseConnection(db: DatabaseAdapter): void {
  try {
    db.prepare('SELECT 1').get();
  } catch (error) {
    throw new DatabaseConnectionError(
      'Failed to validate database connection',
      error
    );
  }
}

/**
 * Check if database file is corrupted
 */
export function checkDatabaseIntegrity(db: DatabaseAdapter): {
  ok: boolean;
  errors: string[];
} {
  try {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    const errors = result
      .filter(row => row.integrity_check !== 'ok')
      .map(row => row.integrity_check);

    return {
      ok: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      ok: false,
      errors: ['Failed to check integrity: ' + (error instanceof Error ? error.message : 'Unknown error')],
    };
  }
}

/**
 * Safely close database connection
 */
export function closeDatabaseSafely(db: DatabaseAdapter): void {
  try {
    if (db.open) {
      // Checkpoint WAL file
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    }
  } catch (error) {
    console.error('Error closing database:', error);
  }
}

/**
 * Create a transaction wrapper with error handling
 */
export function createTransaction<T>(
  db: DatabaseAdapter,
  fn: () => T
): () => T {
  return db.transaction(() => {
    try {
      return fn();
    } catch (error) {
      throw handleDatabaseError(error, 'Transaction failed');
    }
  });
}
