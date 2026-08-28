import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { GUEST_COOKIE_NAME } from '../cookies.ts';
import {
  listConversationMessages,
  listConversations,
  listProjects,
  startGuestSession,
  streamConversationTurn,
} from '../product.ts';
import { stubFetch } from './fixtures.ts';

const GUEST_BODY = { kind: 'guest', user_id: 'usr_01EXAMPLEEXAMPLEEXAMPLE01' };

describe('guest session', () => {
  it('posts /v1/auth/guest anonymously and stores cortex_gt from Set-Cookie', async () => {
    const { fetch, calls } = stubFetch([
      {
        body: GUEST_BODY,
        headers: {
          'set-cookie': `${GUEST_COOKIE_NAME}=guest-test-token; HttpOnly; Path=/`,
        },
      },
    ]);
    const client = new CortexApiClient({ fetch });

    const session = await startGuestSession(client);

    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/auth/guest');
    expect(calls[0]!.headers['x-api-key']).toBeUndefined();
    expect(session.user_id).toBe('usr_01EXAMPLEEXAMPLEEXAMPLE01');
    expect(client.isAuthenticated).toBe(true);

    const { fetch: fetchMe, calls: meCalls } = stubFetch([
      { body: { display_name: 'Guest', is_guest: true, email: '' } },
    ]);
    const next = new CortexApiClient({
      fetch: fetchMe,
      credentials: { guestToken: 'guest-test-token' },
    });
    await next.currentUser();
    expect(meCalls[0]!.url).toBe('https://api.cortex.foundation/v1/me');
    expect(meCalls[0]!.headers.cookie).toBe(`${GUEST_COOKIE_NAME}=guest-test-token`);
  });
});

describe('conversations and projects', () => {
  it('unwraps the items envelope for conversations', async () => {
    const { fetch, calls } = stubFetch([
      {
        body: {
          items: [
            {
              id: 'cnv_01EXAMPLEEXAMPLEEXAMPLE01',
              title: 'hello',
              model_slug: 'cortex-1-mini',
              message_count: 2,
            },
          ],
          has_more: false,
        },
      },
    ]);

    const rows = await listConversations(new CortexApiClient({ fetch }));
    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/conversations');
    expect(rows[0]).toMatchObject({ id: 'cnv_01EXAMPLEEXAMPLEEXAMPLE01', title: 'hello' });
  });

  it('reads messages with text, not content', async () => {
    const { fetch } = stubFetch([
      {
        body: {
          items: [
            { id: 'msg_u', role: 'user', text: 'Say only: ok' },
            { id: 'msg_a', role: 'assistant', text: 'ok', model_name: 'cortex-1-mini' },
          ],
          has_more: false,
        },
      },
    ]);

    const rows = await listConversationMessages(
      new CortexApiClient({ fetch }),
      'cnv_01EXAMPLEEXAMPLEEXAMPLE01',
    );
    expect(rows.map((row) => row.role)).toEqual(['user', 'assistant']);
    expect(rows[1]?.text).toBe('ok');
  });

  it('lists projects and treats an empty list as empty, not missing', async () => {
    const { fetch } = stubFetch([{ body: { items: [], has_more: false } }]);
    const rows = await listProjects(new CortexApiClient({ fetch }));
    expect(rows).toEqual([]);
  });

  it('streams a turn and surfaces conversation ids from response headers', async () => {
    const stream = [
      'data: {"type":"text_delta","message_id":"msg_a","delta":"ok"}\n\n',
      'data: {"type":"done","message_id":"msg_a","finish_reason":"stop"}\n\n',
    ].join('');

    const fetchImpl = (async () =>
      new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'x-conversation-id': 'cnv_01EXAMPLEEXAMPLEEXAMPLE01',
          'x-message-id': 'msg_a',
        },
      })) as typeof globalThis.fetch;

    const frames: Array<{ type: string }> = [];
    for await (const frame of streamConversationTurn(new CortexApiClient({ fetch: fetchImpl }), {
      message: 'hi',
    })) {
      frames.push(frame);
    }

    expect(frames[0]).toMatchObject({
      type: 'turn_started',
      conversation_id: 'cnv_01EXAMPLEEXAMPLEEXAMPLE01',
    });
    expect(frames.some((frame) => frame.type === 'text_delta')).toBe(true);
    expect(frames.at(-1)?.type).toBe('done');
  });
});
