/**
 * Database Performance Optimizer - Optimise les requêtes SQLite
 */

import { Database, Statement } from 'better-sqlite3';

/**
 * Statement mis en cache.
 *
 * `finalize` n'existe pas dans les types de better-sqlite3 mais est présent sur
 * certains builds, d'où le membre optionnel : le cache l'appelle quand il évince
 * une entrée.
 */
export type CachedStatement = Statement & { finalize?: () => void };

export interface PreparedStatementCache {
  get(sql: string): CachedStatement | undefined;
  set(sql: string, stmt: CachedStatement): void;
  clear(): void;
  size(): number;
}

class DatabaseOptimizer {
  private preparedStatements = new Map<string, CachedStatement>();
  private maxCacheSize = 200;
  private batchOperations: Array<() => void> = [];
  private isBatching = false;

  /**
   * Get or create a prepared statement
   */
  getPreparedStatement(db: Database, sql: string): CachedStatement {
    let stmt = this.preparedStatements.get(sql);
    
    if (!stmt) {
      stmt = db.prepare(sql);
      this.preparedStatements.set(sql, stmt);

      // Limit cache size
      if (this.preparedStatements.size > this.maxCacheSize) {
        const firstKey = this.preparedStatements.keys().next().value;
        if (firstKey) {
          const firstStmt = this.preparedStatements.get(firstKey);
          if (firstStmt && typeof firstStmt.finalize === 'function') {
            firstStmt.finalize();
          }
          this.preparedStatements.delete(firstKey);
        }
      }
    }

    return stmt;
  }

  /**
   * Start a batch operation
   */
  startBatch() {
    this.isBatching = true;
    this.batchOperations = [];
  }

  /**
   * Add operation to batch
   */
  addToBatch(operation: () => void) {
    if (this.isBatching) {
      this.batchOperations.push(operation);
    } else {
      operation();
    }
  }

  /**
   * Execute all batched operations in a transaction
   */
  executeBatch(db: Database) {
    if (!this.isBatching || this.batchOperations.length === 0) return;

    const transaction = db.transaction(() => {
      for (const operation of this.batchOperations) {
        operation();
      }
    });

    transaction();
    
    this.batchOperations = [];
    this.isBatching = false;
  }

  /**
   * Cancel current batch
   */
  cancelBatch() {
    this.batchOperations = [];
    this.isBatching = false;
  }

  /**
   * Clear prepared statement cache
   */
  clearCache() {
    for (const stmt of this.preparedStatements.values()) {
      if (stmt && typeof stmt.finalize === 'function') {
        stmt.finalize();
      }
    }
    this.preparedStatements.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.preparedStatements.size,
      maxSize: this.maxCacheSize,
      batchSize: this.batchOperations.length,
      isBatching: this.isBatching
    };
  }

  /**
   * Optimize database with pragmas
   */
  optimizeDatabase(db: Database) {
    // Already set in migration-manager, but ensure they're active
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 30000000000'); // 30GB memory-mapped I/O
    db.pragma('page_size = 4096');
    db.pragma('auto_vacuum = INCREMENTAL');
  }

  /**
   * Create indexes for common queries
   */
  createOptimalIndexes(db: Database) {
    const indexes = [
      // AI Sessions indexes
      'CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON ai_sessions(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_model ON ai_sessions(model)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_status ON ai_sessions(status)',
      
      // Messages indexes
      'CREATE INDEX IF NOT EXISTS idx_messages_session_id ON ai_messages(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON ai_messages(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_messages_role ON ai_messages(role)',
      
      // Automations indexes
      'CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled)',
      'CREATE INDEX IF NOT EXISTS idx_automations_created_at ON automations(created_at)',
      
      // Executions indexes
      'CREATE INDEX IF NOT EXISTS idx_executions_automation_id ON automation_executions(automation_id)',
      'CREATE INDEX IF NOT EXISTS idx_executions_status ON automation_executions(status)',
      'CREATE INDEX IF NOT EXISTS idx_executions_started_at ON automation_executions(started_at DESC)',
      
      // MCP indexes
      'CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled)',
      'CREATE INDEX IF NOT EXISTS idx_mcp_tools_server_id ON mcp_tools(server_id)',
      'CREATE INDEX IF NOT EXISTS idx_mcp_tools_name ON mcp_tools(name)'
    ];

    for (const indexSql of indexes) {
      try {
        db.exec(indexSql);
      } catch (error) {
        // Index might already exist, that's fine
        console.warn('[DatabaseOptimizer] Index creation warning:', error);
      }
    }
  }

  /**
   * Analyze database for query planner
   */
  analyzeDatabase(db: Database) {
    db.exec('ANALYZE');
  }

  /**
   * Vacuum database (should be done periodically, not frequently)
   */
  vacuumDatabase(db: Database) {
    db.exec('VACUUM');
  }

  /**
   * Get database statistics
   */
  getDatabaseStats(db: Database) {
    const pageCount = db.pragma('page_count', { simple: true }) as number;
    const pageSize = db.pragma('page_size', { simple: true }) as number;
    const freelistCount = db.pragma('freelist_count', { simple: true }) as number;
    
    return {
      totalPages: pageCount,
      pageSize,
      totalSize: pageCount * pageSize,
      freePages: freelistCount,
      usedSize: (pageCount - freelistCount) * pageSize,
      cacheSize: db.pragma('cache_size', { simple: true }),
      journalMode: db.pragma('journal_mode', { simple: true }),
      synchronous: db.pragma('synchronous', { simple: true })
    };
  }
}

export const dbOptimizer = new DatabaseOptimizer();
