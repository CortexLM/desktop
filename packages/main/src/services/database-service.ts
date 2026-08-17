/**
 * Database Service - Main Process
 * Fournit un accès partagé (singleton) à la base SQLite et expose des
 * opérations query/execute sûres pour les handlers IPC.
 *
 * Sécurité : les handlers IPC sont accessibles depuis le renderer, on ne peut
 * donc pas y exécuter du SQL arbitraire. `query()` n'accepte que des lectures,
 * `execute()` refuse le SQL destructif de schéma et exige des paramètres liés.
 */

import { join } from 'node:path';
import { homedir } from 'node:os';
import { DatabaseManager } from '../database/index.js';
import { DatabaseError, handleDatabaseError } from '../database/errors.js';
import type { DatabaseAdapter, SqlValue } from '../database/adapter.js';

/**
 * Vérifie que les paramètres venus de l'IPC sont liables par SQLite.
 *
 * Le renderer peut envoyer n'importe quoi : la signature publique reste
 * `unknown[]`, et cette validation la réduit à `SqlValue[]` avant d'atteindre le
 * driver — au lieu de masquer le problème avec un cast.
 */
function toSqlParams(params: readonly unknown[]): SqlValue[] {
  return params.map((param, index) => {
    if (
      param === null ||
      typeof param === 'string' ||
      typeof param === 'number' ||
      typeof param === 'bigint' ||
      typeof param === 'boolean' ||
      param instanceof Uint8Array
    ) {
      return param as SqlValue;
    }

    throw new DatabaseError(
      `Unsupported SQL parameter at index ${index}: ${typeof param}`,
      'DB_INVALID_PARAM'
    );
  });
}

export interface QueryResult<T = unknown> {
  rows: T[];
}

export interface ExecuteStatement {
  query: string;
  params?: unknown[];
}

export interface ExecuteResult {
  success: boolean;
  changes: number;
}

/**
 * Statements autorisés en écriture depuis le renderer.
 * DROP / ALTER / ATTACH / PRAGMA restent réservés aux migrations internes.
 */
const ALLOWED_WRITE_STATEMENTS = ['insert', 'update', 'delete', 'replace'] as const;

/**
 * Un seul statement par requête : empêche le stacking
 * (`SELECT 1; DROP TABLE sessions`).
 */
function assertSingleStatement(sql: string): void {
  // On retire les littéraux string pour ne pas compter les ';' qu'ils contiennent
  const withoutStrings = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
  const withoutTrailing = withoutStrings.replace(/;\s*$/, '');

  if (withoutTrailing.includes(';')) {
    throw new DatabaseError(
      'Multiple SQL statements are not allowed in a single request',
      'DB_MULTIPLE_STATEMENTS'
    );
  }
}

/**
 * Retire commentaires et espaces de tête pour identifier le premier mot-clé.
 */
function firstKeyword(sql: string): string {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .trim();

  return stripped.split(/\s+/)[0]?.toLowerCase() ?? '';
}

function assertReadOnly(sql: string): void {
  const keyword = firstKeyword(sql);

  // `WITH` est autorisé uniquement pour les CTE de lecture
  if (keyword === 'with') {
    if (/\b(insert|update|delete|replace|drop|alter|create)\b/i.test(sql)) {
      throw new DatabaseError(
        'Only read-only statements are allowed in query()',
        'DB_READONLY_VIOLATION'
      );
    }
    return;
  }

  if (keyword !== 'select') {
    throw new DatabaseError(
      `Only SELECT statements are allowed in query() (got "${keyword || 'empty'}")`,
      'DB_READONLY_VIOLATION'
    );
  }
}

function assertAllowedWrite(sql: string): void {
  const keyword = firstKeyword(sql);

  if (!ALLOWED_WRITE_STATEMENTS.includes(keyword as (typeof ALLOWED_WRITE_STATEMENTS)[number])) {
    throw new DatabaseError(
      `Statement "${keyword || 'empty'}" is not allowed. ` +
        `Allowed: ${ALLOWED_WRITE_STATEMENTS.join(', ')}`,
      'DB_STATEMENT_NOT_ALLOWED'
    );
  }
}

/**
 * Chemin par défaut de la base. Utilise le userData d'Electron quand
 * disponible, sinon `~/.cortex-ide` (tests, scripts CLI).
 */
export async function getDefaultDatabasePath(): Promise<string> {
  try {
    // Import paresseux : `electron` n'est pas résoluble hors du process main
    const electron = await import('electron');
    const app = (electron as { app?: { getPath?: (name: string) => string } }).app;
    if (app?.getPath) {
      return join(app.getPath('userData'), 'cortex-ide.db');
    }
  } catch {
    // Pas dans Electron : fallback
  }

  return join(homedir(), '.cortex-ide', 'cortex-ide.db');
}

export class DatabaseService {
  private manager: DatabaseManager | null = null;
  private initPromise: Promise<DatabaseManager> | null = null;

  /**
   * @param dbPath chemin explicite de la base. Si omis, résolu au premier
   *   `initialize()` (userData Electron, sinon `~/.cortex-ide`).
   */
  constructor(private readonly dbPath?: string) {}

  /**
   * Initialise la connexion et lance les migrations (idempotent).
   * Les appels concurrents partagent la même promesse pour éviter
   * d'ouvrir plusieurs connexions.
   */
  async initialize(): Promise<DatabaseManager> {
    if (this.manager) return this.manager;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const resolvedPath = this.dbPath ?? (await getDefaultDatabasePath());

          const { mkdir } = await import('node:fs/promises');
          const { dirname } = await import('node:path');
          await mkdir(dirname(resolvedPath), { recursive: true });

          const manager = await DatabaseManager.create(resolvedPath);
          await manager.initialize();
          this.manager = manager;
          return manager;
        } catch (error) {
          // Permet une nouvelle tentative après un échec
          this.initPromise = null;
          throw handleDatabaseError(error, 'Database initialization failed');
        }
      })();
    }

    return this.initPromise;
  }

  /** Accès au DatabaseManager (API typée par entité). */
  async getManager(): Promise<DatabaseManager> {
    return this.manager ?? (await this.initialize());
  }

  private async getAdapter(): Promise<DatabaseAdapter> {
    const manager = await this.getManager();
    return manager.getDb();
  }

  /**
   * Exécute une requête en lecture seule.
   * @throws {DatabaseError} si le statement n'est pas un SELECT/CTE de lecture
   */
  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    assertSingleStatement(sql);
    assertReadOnly(sql);

    const db = await this.getAdapter();

    try {
      const rows = db.prepare(sql).all<T>(...toSqlParams(params));
      return { rows };
    } catch (error) {
      throw handleDatabaseError(error, 'Query failed');
    }
  }

  /**
   * Exécute un ou plusieurs statements d'écriture dans une transaction.
   * Tout échoue ou tout réussit (rollback automatique).
   *
   * @returns le nombre total de lignes modifiées
   * @throws {DatabaseError} si un statement n'est pas autorisé
   */
  async execute(statements: ExecuteStatement[]): Promise<ExecuteResult> {
    if (statements.length === 0) {
      throw new DatabaseError('At least one statement is required', 'DB_EMPTY_BATCH');
    }

    // Valide tout AVANT d'ouvrir la transaction
    for (const statement of statements) {
      assertSingleStatement(statement.query);
      assertAllowedWrite(statement.query);
    }

    const db = await this.getAdapter();

    try {
      const runAll = db.transaction(() => {
        let changes = 0;
        for (const statement of statements) {
          const result = db
            .prepare(statement.query)
            .run(...toSqlParams(statement.params ?? []));
          changes += result.changes;
        }
        return changes;
      });

      return { success: true, changes: runAll() };
    } catch (error) {
      throw handleDatabaseError(error, 'Execute failed');
    }
  }

  /** Ferme la connexion. Idempotent. */
  close(): void {
    if (!this.manager) return;

    try {
      this.manager.close();
    } catch (error) {
      console.error('[DatabaseService] Failed to close database:', error);
    } finally {
      this.manager = null;
      this.initPromise = null;
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let databaseServiceInstance: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService();
  }
  return databaseServiceInstance;
}

/** Réinitialise le singleton (ferme la connexion). Utilisé par les tests. */
export function resetDatabaseService(): void {
  if (databaseServiceInstance) {
    databaseServiceInstance.close();
    databaseServiceInstance = null;
  }
}
