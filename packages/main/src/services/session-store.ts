/**
 * Reading and writing a run's rows.
 *
 * Extracted from `SessionService` so that class is about behaviour — starting a
 * turn, recording it, stopping it — and this is about SQL. It is also the part
 * worth reading on its own: the sequence allocation in `append` is the only thing
 * here that is not obvious, and burying it among the agent plumbing hid it.
 */

import type { SessionEvent, SessionSummary } from '@cortex-ide/shared';

import { getDatabaseService } from './database-service';
import { toSummary, type SessionRow } from './session-rows';

export class SessionStore {
  /** Next timeline sequence per session, so ordering survives a restart. */
  private readonly nextSeq = new Map<string, number>();

  async upsert(id: string, columns: Record<string, unknown>): Promise<void> {
    const db = getDatabaseService();
    const names = Object.keys(columns);
    const placeholders = names.map(() => '?').join(', ');
    const updates = names.map((name) => `${name} = excluded.${name}`).join(', ');

    await db.execute([
      {
        query: `INSERT INTO sessions (id, ${names.join(', ')}) VALUES (?, ${placeholders})
                ON CONFLICT(id) DO UPDATE SET ${updates}`,
        params: [id, ...names.map((name) => columns[name] as never)],
      },
    ]);
  }

  async patch(id: string, columns: Record<string, unknown>): Promise<void> {
    const names = Object.keys(columns);
    if (names.length === 0) return;

    const db = getDatabaseService();
    await db.execute([
      {
        query: `UPDATE sessions SET ${names.map((name) => `${name} = ?`).join(', ')} WHERE id = ?`,
        params: [...names.map((name) => columns[name] as never), id],
      },
    ]);
  }

  /**
   * Appends a timeline row.
   *
   * `seq` is allocated from the persisted maximum on first use per session rather
   * than from a counter that starts at zero: after a restart a fresh counter would
   * collide with the rows already stored, and the UNIQUE constraint would reject
   * every event of a resumed session.
   */
  async append(id: string, event: SessionEvent): Promise<void> {
    const db = getDatabaseService();

    let seq = this.nextSeq.get(id);
    if (seq === undefined) {
      const max = await db.query<{ seq: number | null }>(
        'SELECT MAX(seq) AS seq FROM session_events WHERE session_id = ?',
        [id],
      );
      seq = (max.rows[0]?.seq ?? -1) + 1;
    }
    this.nextSeq.set(id, seq + 1);

    const { kind, at, ...payload } = event as SessionEvent & Record<string, unknown>;
    await db.execute([
      {
        query: `INSERT INTO session_events (id, session_id, seq, kind, payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
        params: [`${id}:${seq}`, id, seq, kind, JSON.stringify(payload), at],
      },
      { query: 'UPDATE sessions SET updated_at = ? WHERE id = ?', params: [at, id] },
    ]);
  }

  /**
   * Appends assistant text, merging into the previous reply when there is one.
   *
   * Streaming delivers prose a token at a time. Stored as one row per chunk, a
   * single answer becomes hundreds of timeline entries — so the tail row is extended
   * instead, and the timeline keeps one entry per turn of speech.
   */
  async appendReply(id: string, text: string): Promise<void> {
    const db = getDatabaseService();
    const tail = await db.query<{ seq: number; kind: string; payload: string }>(
      'SELECT seq, kind, payload FROM session_events WHERE session_id = ? ORDER BY seq DESC LIMIT 1',
      [id],
    );
    const last = tail.rows[0];

    if (last?.kind !== 'reply') {
      await this.append(id, { kind: 'reply', at: Date.now(), text });
      return;
    }

    let previous = '';
    try {
      previous = String((JSON.parse(last.payload) as { text?: unknown }).text ?? '');
    } catch {
      previous = '';
    }

    await db.execute([
      {
        query: 'UPDATE session_events SET payload = ? WHERE session_id = ? AND seq = ?',
        params: [JSON.stringify({ text: previous + text }), id, last.seq],
      },
    ]);
  }

  async row(id: string): Promise<SessionRow | undefined> {
    const db = getDatabaseService();
    const rows = await db.query<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
    return rows.rows[0];
  }

  async summary(id: string): Promise<SessionSummary | null> {
    const row = await this.row(id);
    return row ? toSummary(row) : null;
  }

  forget(id: string): void {
    this.nextSeq.delete(id);
  }
}
