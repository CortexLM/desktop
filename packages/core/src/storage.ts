import { DatabaseSync } from "node:sqlite"
import type { Event, Message, MessageWithParts, Part, Session } from "@cortex/schema"

const MIGRATIONS: string[] = [
  `CREATE TABLE event (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     aggregate_id TEXT NOT NULL,
     seq INTEGER NOT NULL,
     type TEXT NOT NULL,
     data TEXT NOT NULL,
     time INTEGER NOT NULL,
     UNIQUE (aggregate_id, seq)
   );
   CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT, kind TEXT NOT NULL, bot_id TEXT, updated INTEGER NOT NULL, data TEXT NOT NULL);
   CREATE INDEX session_updated ON session(updated);
   CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE, data TEXT NOT NULL);
   CREATE INDEX message_session ON message(session_id, id);
   CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES message(id) ON DELETE CASCADE, session_id TEXT NOT NULL, data TEXT NOT NULL);
   CREATE INDEX part_message ON part(message_id, id);
   CREATE TABLE doc (kind TEXT NOT NULL, id TEXT NOT NULL, parent TEXT, time INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (kind, id));
   CREATE INDEX doc_parent ON doc(kind, parent, time);`,
]

/** Durable event types; everything else on the bus is live-only (deltas, status, asks). */
export const DURABLE = new Set<Event["type"]>(["session.created", "session.updated", "session.deleted", "message.updated", "part.updated"])

const aggregateOf = (e: Event): string => {
  switch (e.type) {
    case "session.created":
    case "session.updated":
      return e.properties.session.id
    case "session.deleted":
      return e.properties.sessionID
    case "message.updated":
      return e.properties.message.sessionID
    case "part.updated":
      return e.properties.part.sessionID
    default:
      return "global"
  }
}

/**
 * SQLite storage: an append-only `event` journal with transactional projections
 * (session/message/part), plus a generic JSON `doc` table for configuration domains.
 */
export class Storage {
  readonly db: DatabaseSync
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;")
    this.migrate()
  }

  private migrate() {
    const row = this.db.prepare("PRAGMA user_version").get() as { user_version: number }
    for (let v = row.user_version; v < MIGRATIONS.length; v++) {
      this.tx(() => {
        this.db.exec(MIGRATIONS[v]!)
        this.db.exec(`PRAGMA user_version = ${v + 1}`)
      })
    }
  }

  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE")
    try {
      const out = fn()
      this.db.exec("COMMIT")
      return out
    } catch (err) {
      this.db.exec("ROLLBACK")
      throw err
    }
  }

  /** Append a durable event and run its projection in one transaction. */
  append(e: Event) {
    const agg = aggregateOf(e)
    this.tx(() => {
      const head = this.db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM event WHERE aggregate_id = ?").get(agg) as { s: number }
      this.db.prepare("INSERT INTO event (aggregate_id, seq, type, data, time) VALUES (?, ?, ?, ?, ?)").run(agg, head.s + 1, e.type, JSON.stringify(e.properties), Date.now())
      this.project(e)
    })
  }

  private project(e: Event) {
    const db = this.db
    switch (e.type) {
      case "session.created":
      case "session.updated": {
        const s = e.properties.session
        db.prepare(
          `INSERT INTO session (id, parent_id, kind, bot_id, updated, data) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET updated = excluded.updated, data = excluded.data`,
        ).run(s.id, s.parentID ?? null, s.kind, s.botID ?? null, s.time.updated, JSON.stringify(s))
        return
      }
      case "session.deleted":
        db.prepare("DELETE FROM part WHERE session_id = ?").run(e.properties.sessionID)
        db.prepare("DELETE FROM session WHERE id = ?").run(e.properties.sessionID)
        return
      case "message.updated": {
        const m = e.properties.message
        db.prepare("INSERT INTO message (id, session_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").run(m.id, m.sessionID, JSON.stringify(m))
        return
      }
      case "part.updated": {
        const p = e.properties.part
        db.prepare("INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").run(p.id, p.messageID, p.sessionID, JSON.stringify(p))
        return
      }
    }
  }

  events(aggregateID: string): { seq: number; type: string; data: unknown }[] {
    return (this.db.prepare("SELECT seq, type, data FROM event WHERE aggregate_id = ? ORDER BY seq").all(aggregateID) as { seq: number; type: string; data: string }[]).map((r) => ({
      ...r,
      data: JSON.parse(r.data),
    }))
  }

  session(id: string): Session | undefined {
    const r = this.db.prepare("SELECT data FROM session WHERE id = ?").get(id) as { data: string } | undefined
    return r && JSON.parse(r.data)
  }
  sessions(filter: { kind?: string; botID?: string; parentID?: string | null } = {}): Session[] {
    const where: string[] = []
    const args: string[] = []
    if (filter.kind) { where.push("kind = ?"); args.push(filter.kind) }
    if (filter.botID) { where.push("bot_id = ?"); args.push(filter.botID) }
    if (filter.parentID === null) where.push("parent_id IS NULL")
    else if (filter.parentID) { where.push("parent_id = ?"); args.push(filter.parentID) }
    const sql = `SELECT data FROM session ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY updated DESC`
    return (this.db.prepare(sql).all(...args) as { data: string }[]).map((r) => JSON.parse(r.data))
  }
  message(id: string): Message | undefined {
    const r = this.db.prepare("SELECT data FROM message WHERE id = ?").get(id) as { data: string } | undefined
    return r && JSON.parse(r.data)
  }
  messages(sessionID: string): MessageWithParts[] {
    const msgs = (this.db.prepare("SELECT id, data FROM message WHERE session_id = ? ORDER BY id").all(sessionID) as { id: string; data: string }[])
    const parts = this.db.prepare("SELECT data FROM part WHERE session_id = ? ORDER BY id").all(sessionID) as { data: string }[]
    const byMsg = new Map<string, Part[]>()
    for (const r of parts) {
      const p = JSON.parse(r.data) as Part
      byMsg.set(p.messageID, [...(byMsg.get(p.messageID) ?? []), p])
    }
    return msgs.map((m) => ({ info: JSON.parse(m.data), parts: byMsg.get(m.id) ?? [] }))
  }

  // ---- generic documents ----
  getDoc<T>(kind: string, id: string): T | undefined {
    const r = this.db.prepare("SELECT data FROM doc WHERE kind = ? AND id = ?").get(kind, id) as { data: string } | undefined
    return r && JSON.parse(r.data)
  }
  listDocs<T>(kind: string, parent?: string): T[] {
    const rows = parent === undefined
      ? this.db.prepare("SELECT data FROM doc WHERE kind = ? ORDER BY time DESC").all(kind)
      : this.db.prepare("SELECT data FROM doc WHERE kind = ? AND parent = ? ORDER BY time DESC").all(kind, parent)
    return (rows as { data: string }[]).map((r) => JSON.parse(r.data))
  }
  putDoc(kind: string, id: string, data: unknown, parent?: string, time = Date.now()) {
    this.db
      .prepare("INSERT INTO doc (kind, id, parent, time, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET parent = excluded.parent, time = excluded.time, data = excluded.data")
      .run(kind, id, parent ?? null, time, JSON.stringify(data))
  }
  deleteDoc(kind: string, id: string): boolean {
    return Number(this.db.prepare("DELETE FROM doc WHERE kind = ? AND id = ?").run(kind, id).changes) > 0
  }
  deleteDocs(kind: string, parent: string) {
    this.db.prepare("DELETE FROM doc WHERE kind = ? AND parent = ?").run(kind, parent)
  }

  close() {
    this.db.close()
  }
}
