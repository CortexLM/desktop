/**
 * Repository - Missions
 */

import { randomUUID } from 'node:crypto';
import type { Mission, MissionRow } from '../types.js';
import type { SqlValue } from '../adapter.js';
import { BaseRepository } from './base-repository.js';

const TABLE = 'missions';

export class MissionRepository extends BaseRepository {
  create(data: Omit<Mission, 'id' | 'created_at' | 'updated_at'>): Mission {
    const now = Date.now();
    const mission: Mission = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO ${TABLE} (id, workspace_id, status, created_at, updated_at, state)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        mission.id,
        mission.workspace_id,
        mission.status,
        mission.created_at,
        mission.updated_at,
        JSON.stringify(mission.state)
      );

    return mission;
  }

  get(id: string): Mission | null {
    const row = this.db.prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(id) as
      | MissionRow
      | undefined;

    return row ? this.deserialize(row) : null;
  }

  /**
   * Liste les missions, filtrables par workspace et/ou statut
   */
  list(workspaceId?: string, status?: Mission['status']): Mission[] {
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    if (workspaceId) {
      conditions.push('workspace_id = ?');
      params.push(workspaceId);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM ${TABLE}${where} ORDER BY updated_at DESC`)
      .all(...params) as MissionRow[];

    return rows.map((row) => this.deserialize(row));
  }

  update(id: string, data: Partial<Omit<Mission, 'id' | 'created_at'>>): void {
    this.applyUpdate(
      TABLE,
      id,
      this.collectUpdates(data, {
        status: { column: 'status' },
        state: { column: 'state', serialize: (value) => JSON.stringify(value) },
      })
    );
  }

  delete(id: string): void {
    this.deleteById(TABLE, id);
  }

  private deserialize(row: MissionRow): Mission {
    return {
      ...row,
      status: row.status as Mission['status'],
      state: JSON.parse(row.state),
    };
  }
}
