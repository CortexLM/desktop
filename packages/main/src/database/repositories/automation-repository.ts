/**
 * Repository - Automations
 */

import { randomUUID } from 'node:crypto';
import type { Automation, AutomationRow } from '../types.js';
import type { SqlValue } from '../adapter.js';
import { BaseRepository } from './base-repository.js';

const TABLE = 'automations';

/** SQLite n'a pas de booléen : `enabled` est stocké en 0/1. */
const toSQLiteBoolean = (value: boolean): number => (value ? 1 : 0);

export class AutomationRepository extends BaseRepository {
  create(data: Omit<Automation, 'id' | 'created_at' | 'updated_at'>): Automation {
    const now = Date.now();
    const automation: Automation = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO ${TABLE} (id, workspace_id, name, enabled, trigger, actions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        automation.id,
        automation.workspace_id,
        automation.name,
        toSQLiteBoolean(automation.enabled),
        JSON.stringify(automation.trigger),
        JSON.stringify(automation.actions),
        automation.created_at,
        automation.updated_at
      );

    return automation;
  }

  get(id: string): Automation | null {
    const row = this.db.prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(id) as
      | AutomationRow
      | undefined;

    return row ? this.deserialize(row) : null;
  }

  /**
   * Liste les automations, filtrables par workspace et par état d'activation
   */
  list(workspaceId?: string, enabledOnly?: boolean): Automation[] {
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    if (workspaceId) {
      conditions.push('workspace_id = ?');
      params.push(workspaceId);
    }

    if (enabledOnly) {
      conditions.push('enabled = 1');
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM ${TABLE}${where} ORDER BY updated_at DESC`)
      .all(...params) as AutomationRow[];

    return rows.map((row) => this.deserialize(row));
  }

  update(id: string, data: Partial<Omit<Automation, 'id' | 'created_at'>>): void {
    this.applyUpdate(
      TABLE,
      id,
      this.collectUpdates(data, {
        name: { column: 'name' },
        enabled: { column: 'enabled', serialize: (value) => toSQLiteBoolean(value) },
        trigger: { column: 'trigger', serialize: (value) => JSON.stringify(value) },
        actions: { column: 'actions', serialize: (value) => JSON.stringify(value) },
      })
    );
  }

  delete(id: string): void {
    this.deleteById(TABLE, id);
  }

  private deserialize(row: AutomationRow): Automation {
    return {
      ...row,
      enabled: row.enabled === 1,
      trigger: JSON.parse(row.trigger),
      actions: JSON.parse(row.actions),
    };
  }
}
