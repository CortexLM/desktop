/**
 * Repository - Usage logs
 */

import { randomUUID } from 'node:crypto';
import type { UsageLog, UsageLogRow } from '../types.js';
import type { SqlValue } from '../adapter.js';
import { BaseRepository } from './base-repository.js';

const TABLE = 'usage_logs';

/**
 * Consommation agrégée par provider
 */
export interface ProviderUsage {
  tokens_input: number;
  tokens_output: number;
  cost: number;
}

export interface UsageStats {
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;
  byProvider: Record<string, ProviderUsage>;
}

/** Ligne renvoyée par l'agrégation SQL (SUM peut valoir NULL). */
interface UsageAggregateRow {
  provider: string;
  tokens_input: number | null;
  tokens_output: number | null;
  cost: number | null;
}

export class UsageLogRepository extends BaseRepository {
  create(data: Omit<UsageLog, 'id' | 'created_at'>): UsageLog {
    const log: UsageLog = {
      id: randomUUID(),
      ...data,
      created_at: Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO ${TABLE} (id, session_id, provider, model, tokens_input, tokens_output, cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        log.id,
        log.session_id,
        log.provider,
        log.model,
        log.tokens_input,
        log.tokens_output,
        log.cost,
        log.created_at
      );

    return log;
  }

  /**
   * Liste les logs, filtrables par session et/ou provider
   */
  list(sessionId?: string, provider?: string): UsageLog[] {
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    if (sessionId) {
      conditions.push('session_id = ?');
      params.push(sessionId);
    }

    if (provider) {
      conditions.push('provider = ?');
      params.push(provider);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    return this.db
      .prepare(`SELECT * FROM ${TABLE}${where} ORDER BY created_at DESC`)
      .all(...params) as UsageLogRow[];
  }

  /**
   * Agrège tokens et coûts sur une fenêtre temporelle.
   *
   * L'agrégation est faite en SQL (`GROUP BY provider`) pour éviter de charger
   * tous les logs en mémoire.
   *
   * @param startDate borne inférieure incluse (timestamp ms)
   * @param endDate borne supérieure incluse (timestamp ms)
   */
  getStats(startDate?: number, endDate?: number): UsageStats {
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    if (startDate) {
      conditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('created_at <= ?');
      params.push(endDate);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const rows = this.db
      .prepare(
        `SELECT provider,
                SUM(tokens_input) as tokens_input,
                SUM(tokens_output) as tokens_output,
                SUM(cost) as cost
         FROM ${TABLE}${where}
         GROUP BY provider`
      )
      .all(...params) as UsageAggregateRow[];

    const stats: UsageStats = {
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalCost: 0,
      byProvider: {},
    };

    for (const row of rows) {
      const usage: ProviderUsage = {
        tokens_input: row.tokens_input || 0,
        tokens_output: row.tokens_output || 0,
        cost: row.cost || 0,
      };

      stats.byProvider[row.provider] = usage;
      stats.totalTokensInput += usage.tokens_input;
      stats.totalTokensOutput += usage.tokens_output;
      stats.totalCost += usage.cost;
    }

    return stats;
  }
}
