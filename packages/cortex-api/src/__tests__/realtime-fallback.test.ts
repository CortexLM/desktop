import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { CortexApiError } from '../errors.ts';
import { createRealtimeSse } from '../realtime/sse-fallback.ts';
import { createRealtimeSocket, type BrowserWebSocket } from '../realtime/socket.ts';
import { eventFromTurnFrame } from '../realtime/events.ts';
import { createMockRealtime } from '../test-doubles.ts';

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

  push(data: unknown): void {
    this.emit('message', { data });
  }

  emit(type: string, event: { data?: unknown } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function socketClient(fake: FakeSocket) {
  return createRealtimeSocket({
    baseUrl: 'https://api.cortex.foundation',
    WebSocket: class {
      constructor() {
        queueMicrotask(() => fake.open());
        return fake;
      }
    } as unknown as new (url: string) => BrowserWebSocket,
  });
}

describe('SSE listen-only client', () => {
  it('fans parsed frames and stays read-only', async () => {
    const stream = [
      'data: {"type":"bot.ask_user","mascot_id":"mst_1","message":"Wake?"}\n\n',
      'data: {broken\n\n',
      'data: {"type":"send_to_user","text":"hi"}\n\n',
    ].join('');
    const fetchImpl = (async () => new Response(stream, { status: 200 })) as typeof fetch;
    const sse = createRealtimeSse(new CortexApiClient({ fetch: fetchImpl }));
    const seen: string[] = [];
    const unsub = sse.subscribe((event) => seen.push(event.type));

    expect(sse.writable).toBe(false);
    expect(sse.status).toBe('idle');
    expect(await sse.connect()).toBe('connected');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seen).toEqual(['bot.ask_user', 'send_to_user']);
    sse.join('mascot:mst_1');
    sse.leave('mascot:mst_1');
    unsub();
    sse.disconnect();
    expect(sse.status).toBe('disconnected');
  });

  it('marks a body-less stream unavailable and a 500 disconnected', async () => {
    const empty = createRealtimeSse(
      new CortexApiClient({
        fetch: (async () => new Response(null, { status: 204 })) as typeof fetch,
      }),
    );
    expect(await empty.connect()).toBe('unavailable');
    empty.disconnect();
    expect(empty.status).toBe('unavailable');

    const down = createRealtimeSse(
      new CortexApiClient({
        fetch: (async () => {
          throw new CortexApiError('BOOM', 'down', { status: 500 });
        }) as typeof fetch,
      }),
    );
    expect(await down.connect()).toBe('unavailable');
    expect(down.status).toBe('disconnected');
  });
});

describe('socket extras', () => {
  it('sends leave frames, ignores junk, and disconnects', async () => {
    const fake = new FakeSocket();
    const client = socketClient(fake);
    const seen: string[] = [];
    const unsub = client.subscribe((event) => seen.push(event.type));

    expect(client.writable).toBe(false);
    expect(await client.connect()).toBe('connected');
    expect(client.writable).toBe(true);
    client.leave('conversation:cnv_1');
    expect(fake.sent[0]).toBe(JSON.stringify({ type: 'unsubscribe', room: 'conversation:cnv_1' }));
    fake.push({ not: 'a string' });
    fake.push('{broken');
    fake.push(JSON.stringify({ nope: true }));
    fake.push(JSON.stringify({ type: 'bot.send_to_user', text: 'ok' }));
    expect(seen).toEqual(['bot.send_to_user']);
    unsub();
    client.disconnect();
    expect(client.status).toBe('disconnected');
    expect(client.writable).toBe(false);
  });

  it('refuses send before connect and reports no constructor as unavailable', async () => {
    const idle = createRealtimeSocket({
      baseUrl: 'https://api.cortex.foundation',
      WebSocket: class {
        constructor() {
          return new FakeSocket();
        }
      } as unknown as new (url: string) => BrowserWebSocket,
    });
    expect(() => idle.send({ type: 'chat.turn', message: 'hi' })).toThrow(CortexApiError);

    const original = globalThis.WebSocket;
    Object.defineProperty(globalThis, 'WebSocket', { value: undefined, configurable: true });
    try {
      const missing = createRealtimeSocket({ baseUrl: 'https://api.cortex.foundation' });
      expect(await missing.connect()).toBe('unavailable');
    } finally {
      Object.defineProperty(globalThis, 'WebSocket', { value: original, configurable: true });
    }
  });

  it('marks a constructor throw unavailable', async () => {
    const client = createRealtimeSocket({
      baseUrl: 'https://api.cortex.foundation',
      WebSocket: class {
        constructor() {
          throw new Error('no ws');
        }
      } as unknown as new (url: string) => BrowserWebSocket,
    });
    expect(await client.connect()).toBe('unavailable');
  });
});

describe('turn frame mapping extras', () => {
  it('maps reasoning and usage and drops unknown frames', () => {
    expect(eventFromTurnFrame('nope', {})).toBeUndefined();
    expect(eventFromTurnFrame({ type: 1 }, {})).toBeUndefined();
    expect(eventFromTurnFrame({ type: 'unknown' }, {})).toBeUndefined();
    expect(
      eventFromTurnFrame(
        { type: 'reasoning_delta', delta: 'think', conversation_id: 'cnv_x' },
        { conversationId: 'cnv_1', messageId: 'msg_1' },
      ),
    ).toMatchObject({ type: 'chat.reasoning', conversation_id: 'cnv_x' });
    expect(eventFromTurnFrame({ type: 'usage' }, { conversationId: 'cnv_1' })).toMatchObject({
      type: 'chat.usage',
    });
  });
});

describe('mock realtime extras', () => {
  it('records join and leave and honours a writable override', async () => {
    const mock = createMockRealtime('disconnected', { writable: false });
    expect(mock.writable).toBe(false);
    await mock.connect();
    expect(mock.writable).toBe(false);
    mock.join('mascot:mst_1');
    mock.leave('mascot:mst_1');
    expect(mock.sent).toEqual([
      { type: 'subscribe', room: 'mascot:mst_1' },
      { type: 'unsubscribe', room: 'mascot:mst_1' },
    ]);
    mock.disconnect();
    expect(mock.status).toBe('disconnected');
  });
});
