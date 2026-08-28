import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbHolder } = vi.hoisted(() => ({
  dbHolder: { current: null as import('../database-service').DatabaseService | null },
}));

vi.mock('../database-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../database-service')>();
  return {
    ...actual,
    getDatabaseService: () => {
      if (!dbHolder.current) throw new Error('database not ready');
      return dbHolder.current;
    },
  };
});

const { DatabaseService } = await import('../database-service');
const { SessionStore } = await import('../session-store');

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cortex-session-store-'));
  const db = new DatabaseService(join(dir, 'test.db'));
  await db.initialize();
  dbHolder.current = db;
});

afterEach(async () => {
  dbHolder.current?.close();
  dbHolder.current = null;
  await rm(dir, { recursive: true, force: true });
});

describe('SessionStore', () => {
  it('upserts a row and reads it back', async () => {
    const store = new SessionStore();
    const now = Date.now();
    await store.upsert('ses_1', { title: 'First', created_at: now, updated_at: now });
    expect((await store.row('ses_1'))?.title).toBe('First');
    await store.upsert('ses_1', { title: 'Second', created_at: now, updated_at: now });
    expect((await store.row('ses_1'))?.title).toBe('Second');
    expect(await store.summary('missing')).toBeNull();
    expect((await store.summary('ses_1'))?.id).toBe('ses_1');
  });

  it('ignores an empty patch', async () => {
    const store = new SessionStore();
    await store.patch('ses_1', {});
    await store.upsert('ses_1', { title: 'Keep', created_at: 1, updated_at: 1 });
    await store.patch('ses_1', { title: 'Patched' });
    expect((await store.row('ses_1'))?.title).toBe('Patched');
  });

  it('allocates seq from the persisted maximum after forget', async () => {
    const store = new SessionStore();
    await store.upsert('ses_1', { title: 'Run', created_at: 1, updated_at: 1 });
    await store.append('ses_1', { kind: 'prompt', at: 1, text: 'hi' });
    await store.append('ses_1', { kind: 'reply', at: 2, text: 'ok' });
    store.forget('ses_1');
    await store.append('ses_1', { kind: 'prompt', at: 3, text: 'again' });
    const events = await dbHolder.current!.query<{ seq: number }>(
      'SELECT seq FROM session_events WHERE session_id = ? ORDER BY seq',
      ['ses_1'],
    );
    expect(events.rows.map((row) => row.seq)).toEqual([0, 1, 2]);
  });

  it('merges reply text and recovers from a corrupt payload', async () => {
    const store = new SessionStore();
    await store.upsert('ses_1', { title: 'Run', created_at: 1, updated_at: 1 });
    await store.appendReply('ses_1', 'He');
    await store.appendReply('ses_1', 'llo');
    const first = await dbHolder.current!.query<{ payload: string }>(
      "SELECT payload FROM session_events WHERE session_id = ? AND kind = 'reply'",
      ['ses_1'],
    );
    expect(JSON.parse(first.rows[0]!.payload).text).toBe('Hello');

    await dbHolder.current!.execute([
      {
        query: "UPDATE session_events SET payload = 'not-json' WHERE session_id = ?",
        params: ['ses_1'],
      },
    ]);
    await store.appendReply('ses_1', '!');
    const again = await dbHolder.current!.query<{ payload: string }>(
      "SELECT payload FROM session_events WHERE session_id = ? AND kind = 'reply'",
      ['ses_1'],
    );
    expect(JSON.parse(again.rows[0]!.payload).text).toBe('!');
  });
});
