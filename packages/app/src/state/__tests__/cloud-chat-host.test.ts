import { describe, expect, it } from 'vitest';

import { CortexApiClient, createMockRealtime, createStreamTransport } from '@cortex-ide/cortex-api';

import { createCloudChatHost } from '../cloud-chat-host.ts';
import { liveApiBase } from '../live-api.ts';
import { applyRealtimeEvent } from '../realtime-bridge.ts';
import { mergeInbox } from '../inbox.ts';
import { resetLiveSession, sendBotTurn } from '../realtime-session.ts';

function jsonFetch(path: string, body: unknown, headers?: Record<string, string>) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith(path) || url.includes(path)) {
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...headers },
      });
    }
    return new Response(JSON.stringify({ items: [], has_more: false }), { status: 200 });
  }) as typeof globalThis.fetch;
}

describe('liveApiBase', () => {
  it('stays unset on localhost so tests never open a production guest session', () => {
    expect(liveApiBase()).toBeUndefined();
  });
});

describe('cloud chat host', () => {
  it('maps conversation rows and streams tokens through onProgress', async () => {
    const mock = createMockRealtime();
    await mock.connect();
    const client = new CortexApiClient({
      fetch: jsonFetch('/v1/conversations/cnv_1/messages', {
        items: [
          { id: 'msg_u', role: 'user', text: 'hello', created_at: '2026-08-28T00:00:00Z' },
          { id: 'msg_a', role: 'assistant', text: 'ok', created_at: '2026-08-28T00:00:01Z' },
        ],
        has_more: false,
      }),
      credentials: { guestToken: 'guest-test-token' },
    });

    const host = createCloudChatHost({ client, transport: createStreamTransport(mock, client) });
    const deltas: string[] = [];
    host.onProgress((event) => {
      if (event.delta) deltas.push(event.delta);
    });

    const started = host.start('hello', 'search');
    queueMicrotask(() => {
      mock.emit({ type: 'chat.token', conversation_id: 'cnv_1', delta: 'ok' });
      mock.emit({ type: 'chat.done', conversation_id: 'cnv_1' });
    });

    const conversation = await started;
    expect(conversation.id).toBe('cnv_1');
    expect(deltas).toEqual(['ok']);
    expect(conversation.messages[1]?.content).toBe('ok');
  });
});

describe('Bot turns', () => {
  it('stays local when the realtime socket is not connected', () => {
    resetLiveSession();
    expect(sendBotTurn('m1', 'hello')).toBe(false);
  });
});

describe('realtime inbox bridge', () => {
  it('posts Bot ask-user and Code permission events', () => {
    applyRealtimeEvent({ type: 'bot.ask_user', mascot_id: 'm1', message: 'Scout needs you' });
    applyRealtimeEvent({ type: 'code.permission', message: 'Allow git push?' });
    const kinds = mergeInbox([]).map((item) => item.kind);
    expect(kinds).toContain('bot-ask-user');
    expect(kinds).toContain('code-run-blocked');
  });
});
