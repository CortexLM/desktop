/**
 * better-sqlite3 adapter tests.
 *
 * `createDatabaseAdapter` picks its backend from `typeof Bun`, and `Bun` is a
 * non-configurable global — so the Node/Electron branch cannot be reached by
 * faking the runtime. `createBetterSqlite3Adapter` is therefore tested directly
 * against a fake driver that mimics better-sqlite3's API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;

import { createBetterSqlite3Adapter, type DatabaseAdapter } from '../adapter';

// ---------------------------------------------------------------------------
// Fake better-sqlite3 driver
// ---------------------------------------------------------------------------

interface FakeStatement {
  run: ReturnType<typeof mock>;
  get: ReturnType<typeof mock>;
  all: ReturnType<typeof mock>;
}

class FakeDriver {
  open = true;
  statements: Array<{ sql: string; stmt: FakeStatement }> = [];

  prepare = mock((sql: string) => {
    const stmt: FakeStatement = {
      // better-sqlite3 returns this shape from run() directly.
      run: mock(() => ({ changes: 1, lastInsertRowid: 42 })),
      get: mock(() => ({ sql })),
      all: mock(() => [{ sql }]),
    };
    this.statements.push({ sql, stmt });
    return stmt;
  });

  exec = mock(() => undefined);

  pragma = mock((pragma: string, options?: { simple?: boolean }) =>
    options?.simple ? 'wal' : [{ pragma }]
  );

  close = mock(() => {
    this.open = false;
  });

  transaction = mock(<T>(fn: () => T) => () => fn());

  /** Statement created by the most recent prepare(). */
  get lastStatement(): FakeStatement {
    return this.statements[this.statements.length - 1].stmt;
  }
}

let driver: FakeDriver;
let db: DatabaseAdapter;

beforeEach(() => {
  driver = new FakeDriver();
  // The adapter's driver interface is structural and narrower than what Bun's
  // `mock()` types infer, so the fake is asserted onto it here rather than
  // widening the production type to accommodate a test double.
  db = createBetterSqlite3Adapter(driver as unknown as Parameters<typeof createBetterSqlite3Adapter>[0]);
});

describe('createBetterSqlite3Adapter', () => {
  describe('prepare', () => {
    it('passes the SQL to the driver', () => {
      db.prepare('SELECT 1');

      expect(driver.prepare).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns the driver run() result unchanged', () => {
      const result = db.prepare('INSERT INTO t VALUES (?)').run('x');

      expect(result).toEqual({ changes: 1, lastInsertRowid: 42 });
    });

    it('delegates get()', () => {
      const row = db.prepare('SELECT 1').get();

      expect(row).toEqual({ sql: 'SELECT 1' });
    });

    it('delegates all()', () => {
      const rows = db.prepare('SELECT * FROM t').all();

      expect(rows).toEqual([{ sql: 'SELECT * FROM t' }]);
    });

    it('forwards bound parameters to run()', () => {
      db.prepare('INSERT INTO t VALUES (?, ?)').run('a', 2);

      expect(driver.lastStatement.run).toHaveBeenCalledWith('a', 2);
    });

    it('forwards bound parameters to get()', () => {
      db.prepare('SELECT * FROM t WHERE id = ?').get(7);

      expect(driver.lastStatement.get).toHaveBeenCalledWith(7);
    });

    it('forwards bound parameters to all()', () => {
      db.prepare('SELECT * FROM t WHERE a = ? AND b = ?').all(1, 2);

      expect(driver.lastStatement.all).toHaveBeenCalledWith(1, 2);
    });

    it('prepares a fresh statement per call', () => {
      db.prepare('SELECT 1');
      db.prepare('SELECT 2');

      expect(driver.prepare).toHaveBeenCalledTimes(2);
    });

    it('propagates a driver prepare() failure', () => {
      driver.prepare.mockImplementationOnce(() => {
        throw new Error('near "SELCT": syntax error');
      });

      expect(() => db.prepare('SELCT 1')).toThrow('syntax error');
    });
  });

  describe('exec', () => {
    it('delegates to the driver', () => {
      db.exec('CREATE TABLE t (id INTEGER)');

      expect(driver.exec).toHaveBeenCalledWith('CREATE TABLE t (id INTEGER)');
    });

    it('propagates a driver failure', () => {
      driver.exec.mockImplementationOnce(() => {
        throw new Error('table t already exists');
      });

      expect(() => db.exec('CREATE TABLE t (id INTEGER)')).toThrow('already exists');
    });
  });

  describe('pragma', () => {
    it('forwards the options object', () => {
      const result = db.pragma('journal_mode', { simple: true });

      expect(driver.pragma).toHaveBeenCalledWith('journal_mode', { simple: true });
      expect(result).toBe('wal');
    });

    it('forwards an absent options object', () => {
      const result = db.pragma('foreign_keys');

      expect(driver.pragma).toHaveBeenCalledWith('foreign_keys', undefined);
      expect(result).toEqual([{ pragma: 'foreign_keys' }]);
    });
  });

  describe('open / close', () => {
    it('reflects the driver open flag', () => {
      expect(db.open).toBe(true);
    });

    it('delegates close() and reflects the new flag', () => {
      db.close();

      expect(driver.close).toHaveBeenCalled();
      expect(db.open).toBe(false);
    });
  });

  describe('transaction', () => {
    it('delegates to the driver transaction()', () => {
      const run = db.transaction(() => 'committed');

      expect(run()).toBe('committed');
      expect(driver.transaction).toHaveBeenCalled();
    });

    it('returns the body value through', () => {
      expect(db.transaction(() => 42)()).toBe(42);
    });

    it('propagates errors thrown by the body', () => {
      const run = db.transaction(() => {
        throw new Error('rollback me');
      });

      expect(() => run()).toThrow('rollback me');
    });

    it('does not invoke the body until the returned function is called', () => {
      const body = mock(() => 'x');

      db.transaction(body);

      expect(body).not.toHaveBeenCalled();
    });
  });
});
