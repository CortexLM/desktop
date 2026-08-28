import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { eventFromTurnFrame } from '../realtime/events.ts';
import { createMockRealtime } from '../realtime/mock.ts';
import { createRealtimeSocket, type BrowserWebSocket } from '../realtime/socket.ts';
import { createStreamTransport } from '../realtime/transport.ts';
import { realtimeUrl } from '../realtime/url.ts';

class FakeSocket implements BrowserWebSocket {
  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.emit('close');
  }

  open(): void {
    this.readyState = 1;
    this.emit('open');
  }

  push(data: string): void {
    this.emit('message', { data });
  }

  emit(type: string, event: { data?: unknown } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe('realtime URL', () => {
  it('rewrites https to wss and appends /v1/realtime', () => {
    expect(realtimeUrl('https://api.cortex.foundation')).toBe(
      'wss://api.cortex.foundation/v1/realtime',
    );
  });
});

describe('event mapping', () => {
  it('maps observed SSE types onto the socket envelope', () => {
    const token = eventFromTurnFrame(
      { type: 'text_delta', delta: 'ok', message_id: 'msg_a' },
      { conversationId: 'cnv_1' },
    );
    expect(token).toMatchObject({ type: 'chat.token', delta: 'ok', conversation_id: 'cnv_1' });

    const done = eventFromTurnFrame({ type: 'done', finish_reason: 'stop' }, { conversationId: 'cnv_1' });
    expect(done).toMatchObject({ type: 'chat.done', finish_reason: 'stop' });
  });
});

describe('mock realtime', () => {
  it('records sends and fans events to subscribers', async () => {
    const mock = createMockRealtime();
    const seen: string[] = [];
    mock.subscribe((event) => seen.push(event.type));

    expect(await mock.connect()).toBe('connected');
    mock.send({ type: 'chat.turn', message: 'hi' });
    mock.emit({ type: 'chat.token', delta: 'He' });
    mock.emit({ type: 'bot.ask_user', mascot_id: 'm1', message: 'Wake the computer?' });

    expect(mock.sent[0]).toMatchObject({ type: 'chat.turn' });
    expect(seen).toEqual(['chat.token', 'bot.ask_user']);
  });
});

describe('socket client', () => {
  it('marks the route unavailable when open never comes', async () => {
    const fake = new FakeSocket();
    const client = createRealtimeSocket({
      baseUrl: 'https://api.cortex.foundation',
      connectTimeoutMs: 20,
      WebSocket: class {
        constructor() {
          return fake;
        }
      } as unknown as new (url: string) => BrowserWebSocket,
    });

    const status = await client.connect();
    expect(status).toBe('unavailable');
  });

  it('sends hello after open and parses inbound events', async () => {
    const fake = new FakeSocket();
    const client = createRealtimeSocket({
      baseUrl: 'https://api.cortex.foundation',
      WebSocket: class {
        constructor() {
          queueMicrotask(() => fake.open());
          return fake;
        }
      } as unknown as new (url: string) => BrowserWebSocket,
    });

    const seen: string[] = [];
    client.subscribe((event) => seen.push(event.type));
    await client.connect();
    expect(fake.sent[0]).toBe(JSON.stringify({ type: 'hello' }));

    fake.push(JSON.stringify({ type: 'notification', kind: 'mention', message: 'Ana mentioned you' }));
    expect(seen).toEqual(['notification']);
  });
});

describe('stream transport', () => {
  it('prefers the socket when connected and falls back to HTTP turns', async () => {
    const mock = createMockRealtime();
    await mock.connect();
    const transport = createStreamTransport(mock);

    const collected: string[] = [];
    const consume = (async () => {
      for await (const event of transport.streamChat('hi')) {
        collected.push(event.type);
        if (event.type === 'chat.done') break;
      }
    })();

    queueMicrotask(() => {
      mock.emit({ type: 'chat.token', delta: 'ok' });
      mock.emit({ type: 'chat.done' });
    });

    await consume;
    expect(mock.sent[0]).toMatchObject({ type: 'chat.turn', message: 'hi' });
    expect(collected).toEqual(['chat.token', 'chat.done']);
    expect(transport.channel()).toBe('realtime');
  });

  it('uses the HTTP turn stream when the socket is down', async () => {
    const stream = [
      'data: {"type":"text_delta","delta":"ok"}\n\n',
      'data: {"type":"done","finish_reason":"stop"}\n\n',
    ].join('');
    const fetchImpl = (async () =>
      new Response(stream, {
        status: 200,
        headers: { 'x-conversation-id': 'cnv_1', 'x-message-id': 'msg_1' },
      })) as typeof globalThis.fetch;

    const mock = createMockRealtime('unavailable');
    const transport = createStreamTransport(mock, new CortexApiClient({ fetch: fetchImpl }));

    const types: string[] = [];
    for await (const event of transport.streamChat('hi')) {
      types.push(event.type);
    }

    expect(transport.channel()).toBe('http');
    expect(types).toEqual(['hello', 'chat.token', 'chat.done']);
  });
});
