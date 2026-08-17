/**
 * Database adapter + error-handling tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Bun's `spyOn` maps to Vitest's `vi.spyOn`.
const spyOn = vi.spyOn;
import { createDatabaseAdapter, type DatabaseAdapter } from '../adapter';
import {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseConstraintError,
  DatabaseMigrationError,
  DatabaseNotFoundError,
  checkDatabaseIntegrity,
  closeDatabaseSafely,
  createTransaction,
  handleDatabaseError,
  validateDatabaseConnection,
  wrapAsyncDatabaseOperation,
  wrapDatabaseOperation,
} from '../errors';

describe('createDatabaseAdapter (bun:sqlite)', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createDatabaseAdapter(':memory:');
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT NOT NULL UNIQUE)');
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // already closed by the test
    }
  });

  describe('prepare/run', () => {
    it('inserts a row and reports the change count', () => {
      const result = db.prepare('INSERT INTO items (label) VALUES (?)').run('first');

      expect(result.changes).toBe(1);
      expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);
    });

    it('reuses a prepared statement across calls', () => {
      const stmt = db.prepare('INSERT INTO items (label) VALUES (?)');

      stmt.run('a');
      stmt.run('b');

      expect(db.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 2 });
    });

    it('throws on a constraint violation', () => {
      db.prepare('INSERT INTO items (label) VALUES (?)').run('dup');

      expect(() => db.prepare('INSERT INTO items (label) VALUES (?)').run('dup')).toThrow();
    });
  });

  describe('prepare/get', () => {
    it('returns a single row', () => {
      db.prepare('INSERT INTO items (label) VALUES (?)').run('only');

      const row = db.prepare('SELECT label FROM items WHERE label = ?').get('only');

      expect(row).toEqual({ label: 'only' });
    });

    it('returns undefined when nothing matches', () => {
      expect(db.prepare('SELECT * FROM items WHERE label = ?').get('nope')).toBeUndefined();
    });
  });

  describe('prepare/all', () => {
    it('returns every matching row', () => {
      db.prepare('INSERT INTO items (label) VALUES (?)').run('a');
      db.prepare('INSERT INTO items (label) VALUES (?)').run('b');

      const rows = db.prepare('SELECT label FROM items ORDER BY label').all();

      expect(rows).toEqual([{ label: 'a' }, { label: 'b' }]);
    });

    it('returns an empty array when nothing matches', () => {
      expect(db.prepare('SELECT * FROM items WHERE id > 999').all()).toEqual([]);
    });
  });

  describe('exec', () => {
    it('runs DDL', () => {
      db.exec('CREATE TABLE extra (id INTEGER PRIMARY KEY)');

      const names = (
        db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
          name: string;
        }>
      ).map((r) => r.name);
      expect(names).toContain('extra');
    });

    it('throws on invalid SQL', () => {
      expect(() => db.exec('NOT VALID SQL')).toThrow();
    });
  });

  describe('pragma', () => {
    it('returns rows by default', () => {
      const result = db.pragma('journal_mode');

      expect(Array.isArray(result)).toBe(true);
    });

    it('unwraps the first value with simple: true', () => {
      const value = db.pragma('journal_mode', { simple: true });

      expect(typeof value).toBe('string');
    });

    it('applies a pragma assignment', () => {
      db.pragma('foreign_keys = ON');

      const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
      expect(result[0].foreign_keys).toBe(1);
    });
  });

  describe('open / close', () => {
    it('reports the connection as open', () => {
      expect(db.open).toBe(true);
    });

    it('rejects queries after close', () => {
      db.close();

      expect(() => db.prepare('SELECT 1').get()).toThrow();
    });
  });

  describe('transaction', () => {
    it('commits when the body succeeds', () => {
      const run = db.transaction(() => {
        db.prepare('INSERT INTO items (label) VALUES (?)').run('tx-a');
        db.prepare('INSERT INTO items (label) VALUES (?)').run('tx-b');
        return 'done';
      });

      expect(run()).toBe('done');
      expect(db.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 2 });
    });

    it('rolls back when the body throws', () => {
      const run = db.transaction(() => {
        db.prepare('INSERT INTO items (label) VALUES (?)').run('rollback-me');
        throw new Error('abort');
      });

      expect(() => run()).toThrow('abort');
      expect(db.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 0 });
    });

    it('rolls back on a constraint failure mid-transaction', () => {
      db.prepare('INSERT INTO items (label) VALUES (?)').run('existing');
      const run = db.transaction(() => {
        db.prepare('INSERT INTO items (label) VALUES (?)').run('new-one');
        db.prepare('INSERT INTO items (label) VALUES (?)').run('existing');
      });

      expect(() => run()).toThrow();
      expect(db.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 1 });
    });

    it('returns the body value through', () => {
      const run = db.transaction(() => 42);

      expect(run()).toBe(42);
    });
  });
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

describe('database error types', () => {
  it('DatabaseError carries a code and the original error', () => {
    const cause = new Error('root cause');
    const error = new DatabaseError('failed', 'DB_ERROR', cause);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DatabaseError');
    expect(error.code).toBe('DB_ERROR');
    expect(error.originalError).toBe(cause);
  });

  it.each([
    [DatabaseConnectionError, 'DatabaseConnectionError', 'DB_CONNECTION_ERROR'],
    [DatabaseConstraintError, 'DatabaseConstraintError', 'DB_CONSTRAINT_ERROR'],
    [DatabaseNotFoundError, 'DatabaseNotFoundError', 'DB_NOT_FOUND'],
    [DatabaseMigrationError, 'DatabaseMigrationError', 'DB_MIGRATION_ERROR'],
  ])('%p sets its name and code', (Ctor, name, code) => {
    const error = new (Ctor as new (m: string) => DatabaseError)('boom');

    expect(error.name).toBe(name);
    expect(error.code).toBe(code);
    expect(error).toBeInstanceOf(DatabaseError);
  });
});

describe('handleDatabaseError', () => {
  it('passes a DatabaseError through unchanged', () => {
    const original = new DatabaseConstraintError('already classified');

    expect(handleDatabaseError(original, 'ctx')).toBe(original);
  });

  it.each([
    'UNIQUE constraint failed: items.label',
    'FOREIGN KEY constraint failed',
    'CHECK constraint failed: role',
    'NOT NULL constraint failed: items.label',
  ])('classifies "%s" as a constraint error', (message) => {
    const error = handleDatabaseError(new Error(message), 'insert');

    expect(error).toBeInstanceOf(DatabaseConstraintError);
    expect(error.message).toContain('insert');
    expect(error.message).toContain('Constraint violation');
  });

  it.each([
    'database is locked',
    'unable to open database file',
    'database disk image is malformed',
  ])('classifies "%s" as a connection error', (message) => {
    const error = handleDatabaseError(new Error(message), 'connect');

    expect(error).toBeInstanceOf(DatabaseConnectionError);
    expect(error.message).toContain('Connection error');
  });

  it.each(['no such table: ghosts', 'no such column: nope'])(
    'classifies "%s" as a not-found error',
    (message) => {
      const error = handleDatabaseError(new Error(message), 'query');

      expect(error).toBeInstanceOf(DatabaseNotFoundError);
      expect(error.message).toContain('Schema error');
    }
  );

  it('falls back to a generic DatabaseError', () => {
    const error = handleDatabaseError(new Error('something odd'), 'op');

    expect(error.code).toBe('DB_ERROR');
    expect(error.message).toBe('op: something odd');
  });

  it('handles a thrown string', () => {
    const error = handleDatabaseError('just a string', 'op');

    expect(error.code).toBe('DB_UNKNOWN_ERROR');
    expect(error.message).toBe('op: Unknown error occurred');
  });

  it('handles a thrown null', () => {
    const error = handleDatabaseError(null, 'op');

    expect(error.code).toBe('DB_UNKNOWN_ERROR');
  });

  it('is case-insensitive when classifying', () => {
    const error = handleDatabaseError(new Error('Database Is Locked'), 'op');

    expect(error).toBeInstanceOf(DatabaseConnectionError);
  });

  it('preserves the original error as the cause', () => {
    const cause = new Error('UNIQUE constraint failed');

    expect(handleDatabaseError(cause, 'op').originalError).toBe(cause);
  });
});

describe('wrapDatabaseOperation', () => {
  it('returns the operation result', () => {
    expect(wrapDatabaseOperation(() => 'value', 'ctx')).toBe('value');
  });

  it('converts a thrown error into a DatabaseError', () => {
    expect(() =>
      wrapDatabaseOperation(() => {
        throw new Error('UNIQUE constraint failed');
      }, 'insert')
    ).toThrow(DatabaseConstraintError);
  });

  it('includes the context in the message', () => {
    try {
      wrapDatabaseOperation(() => {
        throw new Error('boom');
      }, 'my-context');
      expect.unreachable();
    } catch (error) {
      expect((error as DatabaseError).message).toContain('my-context');
    }
  });
});

describe('wrapAsyncDatabaseOperation', () => {
  it('resolves with the operation result', async () => {
    await expect(wrapAsyncDatabaseOperation(async () => 7, 'ctx')).resolves.toBe(7);
  });

  it('converts a rejection into a DatabaseError', async () => {
    await expect(
      wrapAsyncDatabaseOperation(async () => {
        throw new Error('no such table: x');
      }, 'query')
    ).rejects.toBeInstanceOf(DatabaseNotFoundError);
  });

  it('passes an existing DatabaseError through', async () => {
    const original = new DatabaseMigrationError('bad migration');

    await expect(
      wrapAsyncDatabaseOperation(async () => {
        throw original;
      }, 'migrate')
    ).rejects.toBe(original);
  });
});

describe('validateDatabaseConnection', () => {
  it('passes for a healthy connection', async () => {
    const db = await createDatabaseAdapter(':memory:');

    expect(() => validateDatabaseConnection(db)).not.toThrow();
    db.close();
  });

  it('throws a DatabaseConnectionError for a closed connection', async () => {
    const db = await createDatabaseAdapter(':memory:');
    db.close();

    expect(() => validateDatabaseConnection(db)).toThrow(DatabaseConnectionError);
  });
});

describe('checkDatabaseIntegrity', () => {
  it('reports ok for a healthy database', async () => {
    const db = await createDatabaseAdapter(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');

    const result = checkDatabaseIntegrity(db);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    db.close();
  });

  it('reports not-ok when the check cannot run', async () => {
    const db = await createDatabaseAdapter(':memory:');
    db.close();

    const result = checkDatabaseIntegrity(db);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Failed to check integrity');
  });

  it('surfaces integrity problems reported by SQLite', async () => {
    const db = await createDatabaseAdapter(':memory:');
    const pragmaSpy = spyOn(db, 'pragma').mockReturnValue([
      { integrity_check: 'row 3 missing from index idx' },
    ]);

    const result = checkDatabaseIntegrity(db);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['row 3 missing from index idx']);
    pragmaSpy.mockRestore();
    db.close();
  });
});

describe('closeDatabaseSafely', () => {
  it('checkpoints and closes an open database', async () => {
    const db = await createDatabaseAdapter(':memory:');

    closeDatabaseSafely(db);

    expect(() => db.prepare('SELECT 1').get()).toThrow();
  });

  it('swallows errors from a already-broken connection', async () => {
    const db = await createDatabaseAdapter(':memory:');
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    db.close();

    expect(() => closeDatabaseSafely(db)).not.toThrow();

    consoleErrorSpy.mockRestore();
  });

  it('does nothing when the adapter reports itself closed', () => {
    const fake = {
      open: false,
      pragma: () => {
        throw new Error('should not be called');
      },
      close: () => {
        throw new Error('should not be called');
      },
    } as unknown as DatabaseAdapter;

    expect(() => closeDatabaseSafely(fake)).not.toThrow();
  });
});

describe('createTransaction', () => {
  it('commits and returns the value', async () => {
    const db = await createDatabaseAdapter(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');

    const run = createTransaction(db, () => {
      db.prepare('INSERT INTO t (v) VALUES (?)').run('a');
      return 'ok';
    });

    expect(run()).toBe('ok');
    expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 1 });
    db.close();
  });

  it('wraps a failure as a DatabaseError and rolls back', async () => {
    const db = await createDatabaseAdapter(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT UNIQUE)');
    db.prepare('INSERT INTO t (v) VALUES (?)').run('dup');

    const run = createTransaction(db, () => {
      db.prepare('INSERT INTO t (v) VALUES (?)').run('fresh');
      db.prepare('INSERT INTO t (v) VALUES (?)').run('dup');
    });

    expect(() => run()).toThrow(DatabaseError);
    expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 1 });
    db.close();
  });

  it('labels the failure as a transaction failure', async () => {
    const db = await createDatabaseAdapter(':memory:');

    const run = createTransaction(db, () => {
      throw new Error('inner boom');
    });

    try {
      run();
      expect.unreachable();
    } catch (error) {
      expect((error as DatabaseError).message).toContain('Transaction failed');
    }
    db.close();
  });
});
