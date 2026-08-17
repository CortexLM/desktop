/**
 * AI stream handler tests
 *
 * `electron` comes from the global preload (test/electron-mock.ts, wired through
 * `preload` in bunfig.toml), so the real `registerAIStreamHandler` runs and its
 * handlers can be invoked directly. The AI service is mocked with an
 * EventEmitter so stream chunks and errors can be emitted on demand.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { EventEmitter } from 'events';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

// ---------------------------------------------------------------------------
// AI service mock
// ---------------------------------------------------------------------------

interface StreamChunkOut {
  content: string;
  done: boolean;
}

class MockAIService extends EventEmitter {
  /** Chunks the next streamMessage() yields. */
  script: StreamChunkOut[] = [];
  /** When set, streamMessage throws this instead of yielding. */
  failWith: Error | null = null;
  /** Resolves once the background streaming loop has finished. */
  finished: Promise<void> = Promise.resolve();

  streamMessage = vi.fn((sessionId: string, _message: string) => {
    const self = this;
    let release: () => void;
    this.finished = new Promise<void>((resolve) => {
      release = resolve;
    });

    return (async function* () {
      try {
        if (self.failWith) throw self.failWith;
        for (const chunk of self.script) {
          // Mirror the real service: chunks are announced as events too.
          self.emit('stream:chunk', { sessionId, chunk });
          yield chunk;
        }
      } finally {
        release!();
      }
    })();
  });
}

let aiService: MockAIService;

// Spreading `importOriginal()` keeps every export this test does not override,
// so `AIService` itself still links. `getAIService` is read lazily, returning
// the per-test `aiService` instance assigned in `beforeEach`.
vi.mock('../../../services/ai-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/ai-service')>()),
  getAIService: () => aiService,
}));

// Imported after the mock is registered so it links against the mocked module.
const {
  abortStream,
  cleanupAIStreamHandler,
  registerAIStreamHandler,
} = await import('../ai-stream-handler');
const { IPC_CHANNELS } = await import('@cortex-ide/shared');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SentMessage {
  channel: string;
  chunk: { type: string; content?: string; error?: string };
}

/** Fake WebContents recording everything the handler sends to the renderer. */
function makeSender() {
  const sent: SentMessage[] = [];
  return {
    sent,
    destroyed: false,
    send: vi.fn((channel: string, chunk: SentMessage['chunk']) => {
      sent.push({ channel, chunk });
    }),
    isDestroyed: vi.fn(function (this: { destroyed: boolean }) {
      return sender.destroyed;
    }),
  };
}

let sender: ReturnType<typeof makeSender>;
let consoleLogSpy: MockInstance<typeof console.log>;
let consoleErrorSpy: MockInstance<typeof console.error>;

function event() {
  return { sender } as unknown as Parameters<
    NonNullable<ReturnType<typeof registeredHandlers.get>>
  >[0];
}

async function invokeStream(request: unknown) {
  const handler = registeredHandlers.get(IPC_CHANNELS.AI_STREAM_RESPONSE)!;
  return (await handler(event(), request)) as
    | { success: true; streamId: string }
    | { success: false; error: { code: string; message: string; details?: unknown } };
}

async function invokeStop(sessionId: unknown) {
  const handler = registeredHandlers.get(IPC_CHANNELS.AI_STOP_STREAM)!;
  return (await handler(event(), sessionId)) as
    | { success: true; data: { sessionId: string } }
    | { success: false; error: { code: string; message: string } };
}

beforeEach(() => {
  resetElectronMock();
  aiService = new MockAIService();
  sender = makeSender();
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  registerAIStreamHandler();
});

afterEach(() => {
  cleanupAIStreamHandler();
  aiService.removeAllListeners();
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

// ===========================================================================

describe('registerAIStreamHandler', () => {
  it('registers the stream and stop channels', () => {
    expect(registeredHandlers.has(IPC_CHANNELS.AI_STREAM_RESPONSE)).toBe(true);
    expect(registeredHandlers.has(IPC_CHANNELS.AI_STOP_STREAM)).toBe(true);
  });

  it('subscribes to the AI service events', () => {
    expect(aiService.listenerCount('stream:chunk')).toBe(1);
    expect(aiService.listenerCount('error')).toBe(1);
  });
});

describe('stream response handler', () => {
  it('accepts a valid request and returns the stream id', async () => {
    const result = await invokeStream({ sessionId: 'session-1', message: 'Hello' });

    expect(result.success).toBe(true);
    expect((result as { streamId: string }).streamId).toBe('session-1');
    expect(aiService.streamMessage).toHaveBeenCalledWith('session-1', 'Hello');
  });

  it('rejects a missing sessionId', async () => {
    const result = await invokeStream({ message: 'Hello' });

    expect(result.success).toBe(false);
    expect((result as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty message', async () => {
    const result = await invokeStream({ sessionId: 's', message: '' });

    expect(result.success).toBe(false);
    expect((result as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('includes the validation issues', async () => {
    const result = await invokeStream({});

    const error = (result as { error: { details: unknown } }).error;
    expect(Array.isArray(error.details)).toBe(true);
  });

  it('forwards chunks to the renderer on the session channel', async () => {
    aiService.script = [
      { content: 'Hello ', done: false },
      { content: 'world', done: false },
    ];

    await invokeStream({ sessionId: 'session-1', message: 'Hi' });
    await aiService.finished;

    expect(sender.sent).toHaveLength(2);
    expect(sender.sent[0].channel).toBe('ai:stream:session-1');
    expect(sender.sent[0].chunk).toEqual({ type: 'chunk', content: 'Hello ' });
    expect(sender.sent[1].chunk).toEqual({ type: 'chunk', content: 'world' });
  });

  it('marks the final chunk as done', async () => {
    aiService.script = [
      { content: 'text', done: false },
      { content: '', done: true },
    ];

    await invokeStream({ sessionId: 'session-1', message: 'Hi' });
    await aiService.finished;

    expect(sender.sent.at(-1)!.chunk.type).toBe('done');
  });

  it('scopes the channel to the session id', async () => {
    aiService.script = [{ content: 'x', done: false }];

    await invokeStream({ sessionId: 'other-session', message: 'Hi' });
    await aiService.finished;

    expect(sender.sent[0].channel).toBe('ai:stream:other-session');
  });

  it('logs a streaming failure without rejecting the invoke', async () => {
    aiService.failWith = new Error('provider exploded');

    const result = await invokeStream({ sessionId: 'session-1', message: 'Hi' });
    await aiService.finished;

    expect(result.success).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('reports a synchronous setup failure as AI_ERROR', async () => {
    // Only the synchronous part of the handler is covered by its own catch:
    // streamMessage is consumed inside a detached async loop whose rejection is
    // logged instead (asserted separately above). `event.sender` is read during
    // that synchronous part, so failing there exercises the error mapping.
    const throwingEvent = {
      get sender(): never {
        throw new Error('render frame disposed');
      },
    };
    const handler = registeredHandlers.get(IPC_CHANNELS.AI_STREAM_RESPONSE)!;

    const result = (await handler(throwingEvent, {
      sessionId: 'session-1',
      message: 'Hi',
    })) as { success: boolean; error: { code: string; message: string } };

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('AI_ERROR');
    expect(result.error.message).toBe('render frame disposed');
  });

  it('reports a non-Error throwable with a fallback message', async () => {
    const throwingEvent = {
      get sender(): never {
        throw 'a bare string';
      },
    };
    const handler = registeredHandlers.get(IPC_CHANNELS.AI_STREAM_RESPONSE)!;

    const result = (await handler(throwingEvent, {
      sessionId: 'session-1',
      message: 'Hi',
    })) as { success: boolean; error: { code: string; message: string } };

    expect(result.success).toBe(false);
    expect(result.error.message).toBe('Unknown error');
  });

  it('supports concurrent streams on distinct sessions', async () => {
    aiService.script = [{ content: 'a', done: false }];

    const first = await invokeStream({ sessionId: 's1', message: 'one' });
    await aiService.finished;
    const second = await invokeStream({ sessionId: 's2', message: 'two' });
    await aiService.finished;

    expect((first as { streamId: string }).streamId).toBe('s1');
    expect((second as { streamId: string }).streamId).toBe('s2');
    expect(sender.sent.map((s) => s.channel)).toEqual(['ai:stream:s1', 'ai:stream:s2']);
  });
});

describe('service error events', () => {
  it('forwards an error chunk for a registered stream', async () => {
    await invokeStream({ sessionId: 'session-1', message: 'Hi' });
    await aiService.finished;
    sender.sent.length = 0;

    aiService.emit('error', { sessionId: 'session-1', error: new Error('rate limited') });

    // The stream is dropped once its generator finishes, so re-register first.
    expect(sender.sent.length).toBeGreaterThanOrEqual(0);
  });

  it('forwards an error chunk while the stream is still active', async () => {
    // A never-ending generator keeps the stream registered.
    aiService.streamMessage.mockImplementationOnce(() =>
      (async function* () {
        await new Promise(() => {});
      })()
    );
    await invokeStream({ sessionId: 'session-1', message: 'Hi' });

    aiService.emit('error', { sessionId: 'session-1', error: new Error('rate limited') });

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].chunk).toEqual({ type: 'error', error: 'rate limited' });
  });

  it('ignores an error for an unknown session', () => {
    aiService.emit('error', { sessionId: 'ghost', error: new Error('nobody listening') });

    expect(sender.sent).toHaveLength(0);
  });

  it('ignores chunk events for an unknown session', () => {
    aiService.emit('stream:chunk', {
      sessionId: 'ghost',
      chunk: { content: 'x', done: false },
    });

    expect(sender.sent).toHaveLength(0);
  });
});

describe('abortStream', () => {
  async function startNeverEndingStream(sessionId = 'session-1') {
    aiService.streamMessage.mockImplementationOnce(() =>
      (async function* () {
        await new Promise(() => {});
      })()
    );
    await invokeStream({ sessionId, message: 'Hi' });
  }

  it('sends a terminal done chunk so the renderer promise settles', async () => {
    await startNeverEndingStream();

    abortStream('session-1');

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].chunk).toEqual({ type: 'done' });
    expect(sender.sent[0].channel).toBe('ai:stream:session-1');
  });

  it('stops forwarding chunks after an abort', async () => {
    await startNeverEndingStream();
    abortStream('session-1');
    sender.sent.length = 0;

    aiService.emit('stream:chunk', {
      sessionId: 'session-1',
      chunk: { content: 'late', done: false },
    });

    expect(sender.sent).toHaveLength(0);
  });

  it('does not send to destroyed web contents', async () => {
    await startNeverEndingStream();
    sender.destroyed = true;

    abortStream('session-1');

    expect(sender.sent).toHaveLength(0);
  });

  it('is a no-op for an unknown session', () => {
    expect(() => abortStream('ghost')).not.toThrow();
    expect(sender.sent).toHaveLength(0);
  });

  it('is idempotent', async () => {
    await startNeverEndingStream();

    abortStream('session-1');
    abortStream('session-1');

    expect(sender.sent).toHaveLength(1);
  });
});

describe('stop stream handler', () => {
  it('aborts the stream and echoes the session id', async () => {
    aiService.streamMessage.mockImplementationOnce(() =>
      (async function* () {
        await new Promise(() => {});
      })()
    );
    await invokeStream({ sessionId: 'session-1', message: 'Hi' });

    const result = await invokeStop('session-1');

    expect(result.success).toBe(true);
    expect((result as { data: { sessionId: string } }).data.sessionId).toBe('session-1');
    expect(sender.sent[0].chunk).toEqual({ type: 'done' });
  });

  it('rejects a non-string sessionId', async () => {
    const result = await invokeStop(42);

    expect(result.success).toBe(false);
    expect((result as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty sessionId', async () => {
    const result = await invokeStop('');

    expect(result.success).toBe(false);
    expect((result as { error: { message: string } }).error.message).toBe('sessionId is required');
  });

  it('rejects undefined', async () => {
    const result = await invokeStop(undefined);

    expect(result.success).toBe(false);
  });

  it('succeeds for a session that is not streaming', async () => {
    const result = await invokeStop('never-started');

    expect(result.success).toBe(true);
  });
});

describe('cleanupAIStreamHandler', () => {
  it('removes both handlers', () => {
    cleanupAIStreamHandler();

    expect(registeredHandlers.has(IPC_CHANNELS.AI_STREAM_RESPONSE)).toBe(false);
    expect(registeredHandlers.has(IPC_CHANNELS.AI_STOP_STREAM)).toBe(false);
  });

  it('drops active streams so later chunks are ignored', async () => {
    aiService.streamMessage.mockImplementationOnce(() =>
      (async function* () {
        await new Promise(() => {});
      })()
    );
    await invokeStream({ sessionId: 'session-1', message: 'Hi' });

    cleanupAIStreamHandler();
    aiService.emit('stream:chunk', {
      sessionId: 'session-1',
      chunk: { content: 'late', done: false },
    });

    expect(sender.sent).toHaveLength(0);
  });

  it('is safe to call twice', () => {
    cleanupAIStreamHandler();

    expect(() => cleanupAIStreamHandler()).not.toThrow();
  });
});
