/**
 * Repository - Sessions
 */

import { randomUUID } from 'node:crypto';
import type { Session, SessionRow } from '../types.js';
import { BaseRepository, toJSONColumn, fromJSONColumn } from './base-repository.js';

const TABLE = 'sessions';

export class SessionRepository extends BaseRepository {
  create(data: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO ${TABLE} (id, workspace_id, title, model, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.workspace_id,
        session.title,
        session.model,
        session.created_at,
        session.updated_at,
        toJSONColumn(session.metadata)
      );

    return session;
  }

  get(id: string): Session | null {
    const row = this.db.prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(id) as
      | SessionRow
      | undefined;

    return row ? this.deserialize(row) : null;
  }

  /**
   * Liste les sessions, éventuellement restreintes à un workspace
   */
  list(workspaceId?: string): Session[] {
    const rows = workspaceId
      ? (this.db
          .prepare(`SELECT * FROM ${TABLE} WHERE workspace_id = ? ORDER BY updated_at DESC`)
          .all(workspaceId) as SessionRow[])
      : (this.db
          .prepare(`SELECT * FROM ${TABLE} ORDER BY updated_at DESC`)
          .all() as SessionRow[]);

    return rows.map((row) => this.deserialize(row));
  }

  update(id: string, data: Partial<Omit<Session, 'id' | 'created_at'>>): void {
    this.applyUpdate(
      TABLE,
      id,
      this.collectUpdates(data, {
        title: { column: 'title' },
        model: { column: 'model' },
        metadata: { column: 'metadata', serialize: (value) => JSON.stringify(value) },
      })
    );
  }

  delete(id: string): void {
    this.deleteById(TABLE, id);
  }

  private deserialize(row: SessionRow): Session {
    return {
      ...row,
      metadata: fromJSONColumn(row.metadata),
    };
  }
}
