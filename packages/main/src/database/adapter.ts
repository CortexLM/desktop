/**
 * Database adapter abstraction
 * Supports both better-sqlite3 (Electron/Node) and bun:sqlite (Bun runtime)
 */

/**
 * A value SQLite can bind to a statement parameter.
 *
 * Both drivers accept these, plus a single object for named parameters.
 */
export type SqlValue = string | number | bigint | boolean | null | Uint8Array;
export type SqlParams = SqlValue[] | [Record<string, SqlValue>];

/** One row as returned by SQLite: column name -> value. */
export type SqlRow = Record<string, SqlValue>;

/** Result of a PRAGMA: a row list, or a scalar with `{ simple: true }`. */
export type PragmaResult = SqlRow[] | SqlValue;

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

// Type definitions for both database implementations
export interface DatabaseAdapter {
  prepare(sql: string): StatementAdapter;
  exec(sql: string): void;
  pragma(pragma: string, options?: { simple?: boolean }): PragmaResult;
  close(): void;
  readonly open: boolean;
  transaction<T>(fn: () => T): () => T;
}

export interface StatementAdapter {
  run(...params: SqlParams): RunResult;
  /** The matching row, or `undefined` when the query matched nothing. */
  get<TRow = SqlRow>(...params: SqlParams): TRow | undefined;
  all<TRow = SqlRow>(...params: SqlParams): TRow[];
}

/**
 * Structural view of the driver objects this module wraps.
 *
 * Declared locally rather than imported: the two drivers (`bun:sqlite` and
 * `better-sqlite3`) have incompatible nominal types, and only these members are
 * ever used. Keeps the adapters free of `any` while staying driver-agnostic.
 */
interface DriverStatement {
  run(...params: SqlParams): RunResult | undefined;
  get(...params: SqlParams): unknown;
  all(...params: SqlParams): unknown[];
}

interface SqliteDriver {
  prepare(sql: string): DriverStatement;
  exec(sql: string): void;
  close(): void;
}

/** `bun:sqlite`'s Database. `pragma()` is not part of its API. */
interface BunDriver extends SqliteDriver {}

/**
 * better-sqlite3's Database, which owns `pragma`, `open` and `transaction`.
 *
 * `pragma` and `transaction` are typed loosely (`unknown` / `() => unknown`)
 * because that is what better-sqlite3's own declarations return; the adapter
 * narrows both at the boundary.
 */
interface BetterSqlite3Driver extends SqliteDriver {
  pragma(pragma: string, options?: { simple?: boolean }): unknown;
  readonly open: boolean;
  transaction(fn: (...args: never[]) => unknown): (...args: never[]) => unknown;
}

/**
 * Create database adapter based on runtime
 */
export async function createDatabaseAdapter(dbPath: string): Promise<DatabaseAdapter> {
  // Check if we're running in Bun
  const isBun = typeof Bun !== 'undefined';

  if (isBun) {
    // Use bun:sqlite
    const { Database } = await import('bun:sqlite');
    const db = new Database(dbPath);
    return createBunAdapter(db);
  } else {
    // Use better-sqlite3 for Electron/Node
    const BetterSqlite3 = await import('better-sqlite3');
    const db = new BetterSqlite3.default(dbPath);
    return createBetterSqlite3Adapter(db);
  }
}

/**
 * Create adapter for bun:sqlite
 *
 * Exported so each backend can be tested directly: `Bun` is a
 * non-configurable global, so a test cannot fake the runtime detection in
 * `createDatabaseAdapter`.
 */
export function createBunAdapter(db: BunDriver): DatabaseAdapter {
  return {
    prepare(sql: string): StatementAdapter {
      const stmt = db.prepare(sql);
      return {
        run(...params: SqlParams) {
          // bun:sqlite returns { changes, lastInsertRowid } from Statement.run().
          // (`db.changes` / `db.lastInsertRowid` do not exist on bun:sqlite's
          // Database, so reading them yielded undefined.)
          const result = stmt.run(...params);
          return {
            changes: result?.changes ?? 0,
            lastInsertRowid: result?.lastInsertRowid ?? 0,
          };
        },
        get<TRow>(...params: SqlParams) {
          // bun:sqlite yields null for "no row"; better-sqlite3 yields
          // undefined. Normalise so callers behave identically on both.
          //
          // The driver is untyped at the row level, so the caller's `TRow` is
          // asserted here: SQLite cannot validate a shape at compile time.
          return (stmt.get(...params) ?? undefined) as TRow | undefined;
        },
        all<TRow>(...params: SqlParams) {
          return stmt.all(...params) as TRow[];
        },
      };
    },
    exec(sql: string) {
      db.exec(sql);
    },
    pragma(pragma: string, options?: { simple?: boolean }) {
      // bun:sqlite has no `pragma()`, so it goes through a prepared statement.
      const result = db.prepare(`PRAGMA ${pragma}`).all() as SqlRow[];
      if (options?.simple && result.length > 0) {
        return Object.values(result[0])[0];
      }
      return result;
    },
    close() {
      db.close();
    },
    get open() {
      // Bun's SQLite doesn't have an 'open' property, assume open if not closed
      return true;
    },
    transaction<T>(fn: () => T): () => T {
      return () => {
        db.exec('BEGIN');
        try {
          const result = fn();
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      };
    },
  };
}

/**
 * Create adapter for better-sqlite3
 *
 * Exported for direct testing; see `createBunAdapter`.
 */
export function createBetterSqlite3Adapter(db: BetterSqlite3Driver): DatabaseAdapter {
  return {
    prepare(sql: string): StatementAdapter {
      const stmt = db.prepare(sql);
      return {
        run(...params: SqlParams) {
          // better-sqlite3 always returns a RunResult from run().
          return stmt.run(...params) as RunResult;
        },
        get<TRow>(...params: SqlParams) {
          // Row shape asserted; see the bun adapter's `get` for why.
          return stmt.get(...params) as TRow | undefined;
        },
        all<TRow>(...params: SqlParams) {
          return stmt.all(...params) as TRow[];
        },
      };
    },
    exec(sql: string) {
      db.exec(sql);
    },
    pragma(pragma: string, options?: { simple?: boolean }) {
      // better-sqlite3 types this as `unknown`; the adapter's contract is a row
      // list (or a scalar with `simple: true`), which is what it actually returns.
      return db.pragma(pragma, options) as PragmaResult;
    },
    close() {
      db.close();
    },
    get open() {
      return db.open;
    },
    transaction<T>(fn: () => T): () => T {
      // The driver's transaction() is untyped in its return; it hands back a
      // function returning exactly what `fn` returned.
      return db.transaction(fn) as () => T;
    },
  };
}
