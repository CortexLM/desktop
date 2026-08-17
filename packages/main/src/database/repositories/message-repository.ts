/**
 * Repository - Messages
 */

import { randomUUID } from 'node:crypto';
import type { Message, MessageRow } from '../types.js';
import { BaseRepository, toJSONColumn, fromJSONColumn } from './base-repository.js';

const TABLE = 'messages';

export class MessageRepository extends BaseRepository {
  create(data: Omit<Message, 'id' | 'created_at'>): Message {
    const message: Message = {
      id: randomUUID(),
      ...data,
      created_at: Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO ${TABLE} (id, session_id, role, content, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        message.id,
        message.session_id,
        message.role,
        message.content,
        message.created_at,
        toJSONColumn(message.metadata)
      );

    return message;
  }

  get(id: string): Message | null {
    const row = this.db.prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(id) as
      | MessageRow
      | undefined;

    return row ? this.deserialize(row) : null;
  }

  /**
   * Messages d'une session, du plus ancien au plus récent
   */
  list(sessionId: string): Message[] {
    const rows = this.db
      .prepare(`SELECT * FROM ${TABLE} WHERE session_id = ? ORDER BY created_at ASC`)
      .all(sessionId) as MessageRow[];

    return rows.map((row) => this.deserialize(row));
  }

  delete(id: string): void {
    this.deleteById(TABLE, id);
  }

  private deserialize(row: MessageRow): Message {
    return {
      ...row,
      role: row.role as Message['role'],
      metadata: fromJSONColumn(row.metadata),
    };
  }
}
