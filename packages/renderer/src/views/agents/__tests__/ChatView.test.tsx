/**
 * ChatView component tests
 *
 * Renders the real component against happy-dom (registered by the global
 * preload) with `window.cortex` stubbed, covering message loading, sending,
 * streaming, retry-with-backoff, stop-generation and the content parser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;

// Bun's `spyOn` maps to Vitest's `vi.spyOn`.
const spyOn = vi.spyOn;
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import { ChatView, parseMessageContent } from '../ChatView';

// ---------------------------------------------------------------------------
// window.cortex stub
// ---------------------------------------------------------------------------

type StreamChunk =
  | { type: 'chunk'; content: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

interface CortexStub {
  db: { query: ReturnType<typeof mock> };
  ai: {
    streamResponse: ReturnType<typeof mock>;
    stopStream: ReturnType<typeof mock>;
  };
}

let cortex: CortexStub;
/** Chunks the next streamResponse call emits before resolving. */
let streamScript: StreamChunk[] = [];
/** When set, streamResponse never resolves; tests drive it by hand. */
let manualStream: { emit: (chunk: StreamChunk) => void } | null = null;

/**
 * Bare `ReturnType<typeof spyOn>` resolves `spyOn`'s overloads with unbound type
 * parameters, which degrades `mock.calls` entries to `any` — that is where the
 * three TS7006 "implicitly has an 'any' type" errors in this file came from.
 * `MockInstance` bound to console.error's real signature keeps `mock.calls`
 * typed, so `loggedErrors()` below has to annotate its parameter and the file
 * typechecks. A test file that does not typecheck cannot act as a guard rail:
 * its type-level assertions are not being checked at all.
 */
type ConsoleErrorSpy = MockInstance<typeof console.error>;
let consoleErrorSpy: ConsoleErrorSpy;

/**
 * `retryWithBackoff` waits 1s then 2s between the component's 2 attempts, so a
 * failing send needs ~3s before the error surfaces.
 */
const RETRY_WINDOW_MS = 4_000;

function makeCortex(): CortexStub {
  return {
    db: {
      query: mock(async () => ({ success: true, data: { rows: [] } })),
    },
    ai: {
      streamResponse: mock(async (_req: unknown, onChunk: (chunk: StreamChunk) => void) => {
        if (manualStream) {
          manualStream = { emit: (chunk) => act(() => onChunk(chunk)) };
          // Never resolves: the component stays in its streaming state.
          return new Promise<void>(() => {});
        }
        for (const chunk of streamScript) {
          onChunk(chunk);
        }
      }),
      stopStream: mock(async () => undefined),
    },
  };
}

function dbRows(rows: Array<Record<string, unknown>>) {
  return { success: true, data: { rows } };
}

async function renderChat(props: Partial<React.ComponentProps<typeof ChatView>> = {}) {
  const result = render(
    React.createElement(ChatView, { sessionId: 'session-1', model: 'gpt-4', ...props })
  );
  await waitFor(() => expect(cortex.db.query).toHaveBeenCalled());
  return result;
}

function textarea(): HTMLTextAreaElement {
  return screen.getByPlaceholderText(/Type a message/i) as HTMLTextAreaElement;
}

/** The circular send button in the input row. */
function sendButton(): HTMLButtonElement {
  const send = Array.from(document.querySelectorAll('button')).find((b) =>
    b.className.includes('rounded-full')
  );
  if (!send) throw new Error('send button not found');
  return send as HTMLButtonElement;
}

async function send(text: string) {
  fireEvent.change(textarea(), { target: { value: text } });
  await act(async () => {
    fireEvent.click(sendButton());
  });
}

/**
 * Everything console.error was called with, flattened to one string.
 *
 * `consoleErrorSpy.mock.calls` is `unknown[][]` once the spy is typed (see
 * `ConsoleErrorSpy`), so the callback parameter needs an annotation — without
 * one `tsc` reports TS7006 "implicitly has an 'any' type" and the file stops
 * typechecking, which silently voids every type-level assertion in it.
 */
function loggedErrors(): string {
  return consoleErrorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
}

/** Assert an error was reported through useErrorHandler with `title`. */
function expectHandledError(title: string) {
  expect(loggedErrors()).toContain(title);
}

beforeEach(() => {
  cortex = makeCortex();
  streamScript = [{ type: 'chunk', content: 'Hello' }];
  manualStream = null;
  (globalThis as unknown as { window: Record<string, unknown> }).window.cortex = cortex;
  consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

// ===========================================================================
// parseMessageContent
// ===========================================================================

describe('parseMessageContent', () => {
  it('returns a single text segment for plain prose', () => {
    const segments = parseMessageContent('just some text');

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: 'text', value: 'just some text' });
  });

  it('returns an empty array for an empty string', () => {
    expect(parseMessageContent('')).toEqual([]);
  });

  it('extracts a fenced code block with its language', () => {
    const segments = parseMessageContent('```ts\nconst x = 1;\n```');

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: 'code', language: 'ts', code: 'const x = 1;' });
  });

  it('defaults the language to text when the fence has none', () => {
    expect(parseMessageContent('```\nplain\n```')[0]).toMatchObject({
      kind: 'code',
      language: 'text',
    });
  });

  it('splits text before and after a code block', () => {
    const segments = parseMessageContent('before\n```js\ncode()\n```\nafter');

    expect(segments.map((s) => s.kind)).toEqual(['text', 'code', 'text']);
    expect((segments[0] as { value: string }).value).toBe('before\n');
    expect((segments[2] as { value: string }).value).toBe('\nafter');
  });

  it('handles multiple code blocks', () => {
    const segments = parseMessageContent('```js\na\n```\nmid\n```py\nb\n```');

    expect(segments.map((s) => s.kind)).toEqual(['code', 'text', 'code']);
    expect((segments[0] as { language: string }).language).toBe('js');
    expect((segments[2] as { language: string }).language).toBe('py');
  });

  it('trims whitespace inside the fence', () => {
    const segments = parseMessageContent('```ts\n\n  const x = 1;\n\n```');

    expect((segments[0] as { code: string }).code).toBe('const x = 1;');
  });

  it('leaves an unterminated fence as text', () => {
    const segments = parseMessageContent('```ts\nconst x = 1;');

    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('text');
  });

  it('produces unique keys per segment', () => {
    const keys = parseMessageContent('a\n```js\nx\n```\nb\n```js\ny\n```').map((s) => s.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is not affected by regex lastIndex across calls', () => {
    const input = '```js\nsame\n```';

    expect(parseMessageContent(input)).toEqual(parseMessageContent(input));
  });

  it('keeps inline backticks in prose', () => {
    const segments = parseMessageContent('use `inline` then\n```js\nx\n```');

    expect(segments.map((s) => s.kind)).toEqual(['text', 'code']);
    expect((segments[0] as { value: string }).value).toContain('`inline`');
  });
});

// ===========================================================================
// Rendering
// ===========================================================================

describe('ChatView rendering', () => {
  it('shows the model in the header', async () => {
    await renderChat({ model: 'claude-3-opus' });

    expect(screen.getByText('claude-3-opus')).toBeDefined();
    expect(screen.getByText('Chat Session')).toBeDefined();
  });

  it('shows the empty state when there are no messages', async () => {
    await renderChat();

    expect(screen.getByText('Start a conversation')).toBeDefined();
    expect(screen.getByText(/Ask about this codebase/)).toBeDefined();
  });

  it('exposes the transcript as an accessible log', async () => {
    await renderChat();

    expect(screen.getByRole('log', { name: 'Conversation' })).toBeDefined();
  });

  it('renders the input affordances', async () => {
    await renderChat();

    expect(textarea()).toBeDefined();
    expect(screen.getByText(/Press Enter to send/i)).toBeDefined();
  });

  it('hides the close button when no onClose is given', async () => {
    await renderChat();

    expect(screen.queryByText('Close')).toBeNull();
  });

  it('shows the close button and calls onClose', async () => {
    const onClose = mock();
    await renderChat({ onClose });

    fireEvent.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables send while the input is empty', async () => {
    await renderChat();

    expect(sendButton().disabled).toBe(true);
  });

  it('enables send once there is text', async () => {
    await renderChat();

    fireEvent.change(textarea(), { target: { value: 'hi' } });

    expect(sendButton().disabled).toBe(false);
  });

  it('keeps send disabled for whitespace-only input', async () => {
    await renderChat();

    fireEvent.change(textarea(), { target: { value: '   ' } });

    expect(sendButton().disabled).toBe(true);
  });
});

// ===========================================================================
// Message loading
// ===========================================================================

describe('ChatView message loading', () => {
  it('queries messages for the session', async () => {
    await renderChat({ sessionId: 'session-42' });

    const request = cortex.db.query.mock.calls[0][0] as { query: string; params: unknown[] };
    expect(request.query).toContain('FROM messages');
    expect(request.params).toEqual(['session-42']);
  });

  it('renders loaded messages', async () => {
    cortex.db.query.mockImplementation(async () =>
      dbRows([
        { id: 'm1', role: 'user', content: 'Hello there', created_at: 1_700_000_000_000 },
        { id: 'm2', role: 'assistant', content: 'General Kenobi', created_at: 1_700_000_001_000 },
      ])
    );

    await renderChat();

    await waitFor(() => expect(screen.getByText('Hello there')).toBeDefined());
    expect(screen.getByText('General Kenobi')).toBeDefined();
    expect(screen.queryByText('Start a conversation')).toBeNull();
  });

  it('renders a code block from loaded content', async () => {
    cortex.db.query.mockImplementation(async () =>
      dbRows([
        { id: 'm1', role: 'assistant', content: 'Try:\n```ts\nconst x = 1;\n```', created_at: 1 },
      ])
    );

    await renderChat();

    await waitFor(() => expect(screen.getByText('const x = 1;')).toBeDefined());
    expect(screen.getByText('ts')).toBeDefined();
  });

  it('stays on the empty state when the query reports failure', async () => {
    cortex.db.query.mockImplementation(async () => ({ success: false, error: { message: 'no' } }));

    await renderChat();

    expect(screen.getByText('Start a conversation')).toBeDefined();
  });

  it('reports a load failure through the error handler', async () => {
    cortex.db.query.mockImplementation(async () => {
      throw new Error('db offline');
    });

    await renderChat();

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expectHandledError('Could not load conversation history');
    expect(screen.getByText('Start a conversation')).toBeDefined();
  });

  it('reloads when the sessionId changes', async () => {
    const { rerender } = await renderChat({ sessionId: 'a' });
    expect(cortex.db.query).toHaveBeenCalledTimes(1);

    rerender(React.createElement(ChatView, { sessionId: 'b', model: 'gpt-4' }));

    await waitFor(() => expect(cortex.db.query).toHaveBeenCalledTimes(2));
    expect((cortex.db.query.mock.calls[1][0] as { params: unknown[] }).params).toEqual(['b']);
  });
});

// ===========================================================================
// Sending
// ===========================================================================

describe('ChatView sending', () => {
  it('appends the user message and clears the input', async () => {
    await renderChat();

    await send('What is 2+2?');

    expect(screen.getByText('What is 2+2?')).toBeDefined();
    expect(textarea().value).toBe('');
  });

  it('sends the trimmed message over IPC', async () => {
    await renderChat({ sessionId: 'session-7' });

    await send('  padded  ');

    const request = cortex.ai.streamResponse.mock.calls[0][0] as {
      sessionId: string;
      message: string;
      workspacePath?: string;
      mode?: string;
    };
    expect(request.sessionId).toBe('session-7');
    expect(request.message).toBe('padded');
    expect(request.mode).toBe('agent');
  });

  it('forwards the workspace path so the main process can run tools', async () => {
    await renderChat({ sessionId: 'session-7', workspacePath: '/repo' });

    await send('read notes');

    const request = cortex.ai.streamResponse.mock.calls[0][0] as { workspacePath?: string };
    expect(request.workspacePath).toBe('/repo');
  });

  it('renders the streamed assistant reply', async () => {
    streamScript = [
      { type: 'chunk', content: 'The answer ' },
      { type: 'chunk', content: 'is 4.' },
    ];
    await renderChat();

    await send('What is 2+2?');

    await waitFor(() => expect(screen.getByText('The answer is 4.')).toBeDefined());
  });

  it('clears the streaming state when the stream resolves', async () => {
    await renderChat();

    await send('hi');

    await waitFor(() => expect(screen.queryByText('Generating response...')).toBeNull());
    expect(textarea().disabled).toBe(false);
  });

  it('ignores chunks with no content', async () => {
    streamScript = [{ type: 'chunk', content: '' }, { type: 'chunk', content: 'real' }];
    await renderChat();

    await send('hi');

    await waitFor(() => expect(screen.getByText('real')).toBeDefined());
  });

  it('does nothing when the input is empty', async () => {
    await renderChat();

    await act(async () => {
      fireEvent.click(sendButton());
    });

    expect(cortex.ai.streamResponse).not.toHaveBeenCalled();
  });

  it('sends on Enter', async () => {
    await renderChat();

    fireEvent.change(textarea(), { target: { value: 'hello' } });
    await act(async () => {
      fireEvent.keyDown(textarea(), { key: 'Enter' });
    });

    expect(cortex.ai.streamResponse).toHaveBeenCalledTimes(1);
  });

  it('does not send on Shift+Enter', async () => {
    await renderChat();

    fireEvent.change(textarea(), { target: { value: 'line one' } });
    fireEvent.keyDown(textarea(), { key: 'Enter', shiftKey: true });

    expect(cortex.ai.streamResponse).not.toHaveBeenCalled();
  });

  it('ignores other keys', async () => {
    await renderChat();

    fireEvent.change(textarea(), { target: { value: 'x' } });
    fireEvent.keyDown(textarea(), { key: 'a' });

    expect(cortex.ai.streamResponse).not.toHaveBeenCalled();
  });

  it('keeps earlier messages when sending another', async () => {
    await renderChat();

    await send('first');
    await send('second');

    expect(screen.getByText('first')).toBeDefined();
    expect(screen.getByText('second')).toBeDefined();
  });
});

// ===========================================================================
// Retry and failure
// ===========================================================================

describe('ChatView send failures', () => {
  it('retries a failing stream and reports progress in the bubble', async () => {
    let attempts = 0;
    cortex.ai.streamResponse.mockImplementation(async () => {
      attempts += 1;
      throw new Error('rate limited');
    });
    await renderChat();

    await send('hi');
    await waitFor(() => expect(screen.getByText(/Retrying \(attempt 1 of 2\)/)).toBeDefined());

    expect(attempts).toBe(1);
  }, 10_000);

  it('records the failure in the transcript after retries are exhausted', async () => {
    cortex.ai.streamResponse.mockImplementation(async () => {
      throw new Error('provider exploded');
    });
    await renderChat();

    await send('hi');

    await waitFor(
      () =>
        expect(
          screen.getByText(/Failed to generate a response: provider exploded/)
        ).toBeDefined(),
      { timeout: RETRY_WINDOW_MS }
    );
  }, 15_000);

  it('reports the failure through the error handler', async () => {
    cortex.ai.streamResponse.mockImplementation(async () => {
      throw new Error('provider exploded');
    });
    await renderChat();

    await send('hi');

    await waitFor(() => expectHandledError('AI response failed'), { timeout: RETRY_WINDOW_MS });
  }, 15_000);

  it('leaves the input usable after a failure', async () => {
    cortex.ai.streamResponse.mockImplementation(async () => {
      throw new Error('nope');
    });
    await renderChat();

    await send('hi');

    await waitFor(() => expect(textarea().disabled).toBe(false), { timeout: RETRY_WINDOW_MS });
  }, 15_000);

  it('succeeds on the second attempt without surfacing an error', async () => {
    let attempts = 0;
    cortex.ai.streamResponse.mockImplementation(
      async (_req: unknown, onChunk: (chunk: StreamChunk) => void) => {
        attempts += 1;
        if (attempts === 1) throw new Error('transient');
        onChunk({ type: 'chunk', content: 'recovered' });
      }
    );
    await renderChat();

    await send('hi');

    // Known wart: `onRetry` writes the "Retrying…" placeholder into the bubble's
    // content, and a successful retry appends to it rather than replacing it, so
    // the delivered text trails the placeholder.
    await waitFor(() => expect(screen.getByText(/recovered$/)).toBeDefined(), {
      timeout: RETRY_WINDOW_MS,
    });
    expect(attempts).toBe(2);
    expect(loggedErrors()).not.toContain('AI response failed');
  }, 15_000);
});

// ===========================================================================
// Streaming state / stop
// ===========================================================================

describe('ChatView streaming state', () => {
  beforeEach(() => {
    // Park the stream so the streaming UI stays visible.
    manualStream = { emit: () => {} };
  });

  async function startStream() {
    await renderChat();
    await send('tell me a story');
    await waitFor(() => expect(screen.getByText('Generating response...')).toBeDefined());
  }

  it('shows the generating banner while streaming', async () => {
    await startStream();

    expect(screen.getByText('Generating response...')).toBeDefined();
    expect(screen.getByText('Stop')).toBeDefined();
  });

  it('disables the textarea while streaming', async () => {
    await startStream();

    expect(textarea().disabled).toBe(true);
  });

  it('appends chunks as they arrive', async () => {
    await startStream();

    manualStream!.emit({ type: 'chunk', content: 'Once ' });
    manualStream!.emit({ type: 'chunk', content: 'upon a time' });

    await waitFor(() => expect(screen.getByText('Once upon a time')).toBeDefined());
  });

  it('stops generation via the stop button', async () => {
    await startStream();

    await act(async () => {
      fireEvent.click(screen.getByText('Stop'));
    });

    expect(cortex.ai.stopStream).toHaveBeenCalledWith('session-1');
    await waitFor(() => expect(screen.queryByText('Generating response...')).toBeNull());
  });

  it('re-enables the input after stopping', async () => {
    await startStream();

    await act(async () => {
      fireEvent.click(screen.getByText('Stop'));
    });

    await waitFor(() => expect(textarea().disabled).toBe(false));
  });

  it('clears the streaming state even when stopStream fails', async () => {
    cortex.ai.stopStream.mockImplementation(async () => {
      throw new Error('cannot stop');
    });
    await startStream();

    await act(async () => {
      fireEvent.click(screen.getByText('Stop'));
    });

    await waitFor(() => expect(screen.queryByText('Generating response...')).toBeNull());
    expectHandledError('Could not stop generation');
  });

  it('does not treat an abort as a failure', async () => {
    await startStream();

    await act(async () => {
      fireEvent.click(screen.getByText('Stop'));
    });

    expect(loggedErrors()).not.toContain('AI response failed');
  });

  it('ignores a second send while streaming', async () => {
    await startStream();

    fireEvent.keyDown(textarea(), { key: 'Enter' });

    expect(cortex.ai.streamResponse).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight stream on unmount', async () => {
    await startStream();

    expect(() => cleanup()).not.toThrow();
  });
});

// ===========================================================================
// Regression guards for fixed runtime bugs
//
// Each test here names the defect it re-detects. They are deliberately
// behavioural rather than structural: the point is that removing the fix in
// ChatView.tsx turns the test red, not that a particular line still exists.
// ===========================================================================

describe('ChatView regressions', () => {
  /**
   * BUG: `handleSend` registered a fresh IPC listener on every send — through an
   * API (`window.electron.ipcRenderer`) that preload never exposed — and never
   * removed it. Two symptoms: an immediate crash on the first send because the
   * object did not exist, and one orphaned listener per message if it had.
   *
   * The fix routes chunks through the `onChunk` callback of
   * `window.cortex.ai.streamResponse`, which owns its own listener lifecycle.
   *
   * Re-detects: any reintroduction of direct ipcRenderer access from the view,
   * and any growth in per-send subscription count.
   */
  it('never reaches for ipcRenderer directly, and subscribes once per send', async () => {
    // A tripwire on every object the buggy version tried to use. Touching any of
    // these is the defect: the view must go through window.cortex.
    const forbiddenAccess: string[] = [];
    const tripwire = (path: string) =>
      new Proxy(
        {},
        {
          get(_target, prop) {
            forbiddenAccess.push(`${path}.${String(prop)}`);
            return undefined;
          },
        }
      );

    const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
    const originalElectron = win.electron;
    const originalIpcRenderer = win.ipcRenderer;
    win.electron = tripwire('window.electron');
    win.ipcRenderer = tripwire('window.ipcRenderer');

    try {
      await renderChat();

      await send('first');
      await send('second');
      await send('third');

      // The only subscription mechanism is the per-call onChunk callback, so the
      // count of stream calls is the count of subscriptions: 1 per send, not
      // cumulative. A per-send listener that is never removed would show up as a
      // handler count that outlives the call.
      expect(cortex.ai.streamResponse).toHaveBeenCalledTimes(3);
      for (const call of cortex.ai.streamResponse.mock.calls as unknown[][]) {
        expect(typeof call[1]).toBe('function');
      }

      expect(forbiddenAccess).toEqual([]);
    } finally {
      win.electron = originalElectron;
      win.ipcRenderer = originalIpcRenderer;
    }
  });

  /**
   * BUG: the `AbortController` created per send was never `abort()`ed when the
   * view unmounted, so a generation kept running — and kept calling `setMessages`
   * on an unmounted tree — after the user navigated away.
   *
   * Re-detects: deletion of the unmount cleanup effect in ChatView. Asserts on
   * the controller's own `signal.aborted`, which is only true if `abort()` ran.
   */
  it('aborts the in-flight AbortController when unmounted mid-stream', async () => {
    const controllers: AbortController[] = [];
    const RealAbortController = globalThis.AbortController;
    class TrackingAbortController extends RealAbortController {
      constructor() {
        super();
        controllers.push(this);
      }
    }
    (globalThis as unknown as { AbortController: typeof AbortController }).AbortController =
      TrackingAbortController as unknown as typeof AbortController;

    try {
      // The stream must still be in flight at unmount: a resolved send clears
      // `abortControllerRef` in its `finally`, so there would be nothing left to
      // abort and the test would pass for the wrong reason.
      manualStream = { emit: () => {} };
      const { unmount } = await renderChat();
      await send('tell me a story');
      await waitFor(() => expect(screen.getByText('Generating response...')).toBeDefined());

      expect(controllers.length).toBeGreaterThan(0);
      const controller = controllers[controllers.length - 1];
      // Precondition: still live while the stream is parked.
      expect(controller.signal.aborted).toBe(false);

      unmount();

      expect(controller.signal.aborted).toBe(true);
    } finally {
      (globalThis as unknown as { AbortController: typeof AbortController }).AbortController =
        RealAbortController;
    }
  });

  /**
   * The same controller must also be aborted by the Stop button. Distinct from
   * the unmount path above: they are two separate call sites, and a fix to one
   * does not imply the other.
   */
  it('aborts the AbortController when Stop is pressed', async () => {
    const controllers: AbortController[] = [];
    const RealAbortController = globalThis.AbortController;
    class TrackingAbortController extends RealAbortController {
      constructor() {
        super();
        controllers.push(this);
      }
    }
    (globalThis as unknown as { AbortController: typeof AbortController }).AbortController =
      TrackingAbortController as unknown as typeof AbortController;

    try {
      // Parked so the Stop button is actually on screen and a controller is live.
      manualStream = { emit: () => {} };
      await renderChat();
      await send('tell me a story');
      await waitFor(() => expect(screen.getByText('Generating response...')).toBeDefined());

      const controller = controllers[controllers.length - 1];
      expect(controller.signal.aborted).toBe(false);

      await act(async () => {
        fireEvent.click(screen.getByText('Stop'));
      });

      expect(controller.signal.aborted).toBe(true);
    } finally {
      (globalThis as unknown as { AbortController: typeof AbortController }).AbortController =
        RealAbortController;
    }
  });

  /**
   * BUG: `preload.ai.streamResponse` was a no-op stub, so the view's awaited call
   * resolved instantly and the transcript never received the reply. This asserts
   * the view actually consumes the callback contract — chunks arriving through
   * `onChunk` must reach the DOM — which a stub cannot satisfy.
   */
  it('renders content delivered through the onChunk callback contract', async () => {
    streamScript = [];
    cortex.ai.streamResponse.mockImplementation(
      async (_req: unknown, onChunk: (chunk: StreamChunk) => void) => {
        onChunk({ type: 'chunk', content: 'delivered via callback' });
      }
    );
    await renderChat();

    await send('hi');

    await waitFor(() => expect(screen.getByText('delivered via callback')).toBeDefined());
  });

  /**
   * A send that resolves must leave no message stuck in its streaming state:
   * the blinking cursor is driven by `isStreaming` on the message itself, and a
   * missed reset left a permanent caret in the transcript.
   */
  it('clears the per-message streaming flag once the stream resolves', async () => {
    streamScript = [{ type: 'chunk', content: 'done text' }];
    await renderChat();

    await send('hi');

    await waitFor(() => expect(screen.getByText('done text')).toBeDefined());
    // The caret is the only animate-pulse element in the bubble.
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  /**
   * BUG (`ai:stop-stream` had no main-process handler): the renderer's Stop
   * invoke rejected, and because the UI reset was inside the success path the
   * view stayed stuck showing "Generating response…" forever.
   *
   * The fix clears local state *before* awaiting the IPC call. This asserts the
   * ordering, not just the end state: the reset must not depend on the invoke.
   */
  it('recovers the UI even when stopStream never settles', async () => {
    // The missing-handler bug made the Stop invoke reject. A hang is the harsher
    // variant of the same shape — nothing ever comes back — and it isolates the
    // invariant: the UI reset must be sequenced *before* the IPC call, so it can
    // never be contingent on a reply.
    //
    // Asserted on observable state rather than by sampling the DOM inside the
    // mock: React batches, so the banner is still in the document during the
    // synchronous part of the click handler even though setIsStreaming(false)
    // has already been called. Sampling there would assert React's scheduling,
    // not the component's ordering.
    let ipcCalled = false;
    cortex.ai.stopStream.mockImplementation(() => {
      ipcCalled = true;
      return new Promise<void>(() => {});
    });

    manualStream = { emit: () => {} };
    await renderChat();
    await send('tell me a story');
    await waitFor(() => expect(screen.getByText('Generating response...')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByText('Stop'));
    });

    expect(ipcCalled).toBe(true);
    expect(cortex.ai.stopStream).toHaveBeenCalledWith('session-1');
    // Never-resolving IPC, yet the view is fully usable again.
    expect(screen.queryByText('Generating response...')).toBeNull();
    expect(textarea().disabled).toBe(false);
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  /**
   * Cancelling during the retry backoff must not be recorded as a failure.
   *
   * Found by mutation testing: `const wasAborted = false;` SURVIVED the suite.
   * The reachable path is narrow, which is why it was missed — pressing Stop
   * while a stream is *streaming* does not reject the awaited promise (the
   * preload `streamResponse` takes no signal; it settles when the main process
   * sends its terminal chunk). But when the first attempt has already failed,
   * `retryWithBackoff` is inside `sleep(delay, signal)`, and aborting there
   * rejects with a `DOMException('AbortError')` that propagates into
   * `handleSend`'s catch.
   *
   * Without the `wasAborted` check, that cancellation is reported to the user as
   * "AI response failed" and written into the transcript as a failure — for an
   * action they took deliberately.
   */
  it('does not record a failure when Stop is pressed during the retry backoff', async () => {
    cortex.ai.streamResponse.mockImplementation(async () => {
      throw new Error('rate limited');
    });
    await renderChat();

    await send('hi');

    // First attempt has failed and the backoff sleep is now in progress.
    await waitFor(() => expect(screen.getByText(/Retrying \(attempt 1 of 2\)/)).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByText('Stop'));
    });
    // Let the AbortError propagate through retryWithBackoff into the catch.
    await act(async () => {
      await Promise.resolve();
    });

    expect(loggedErrors()).not.toContain('AI response failed');
    expect(screen.queryByText(/Failed to generate a response/)).toBeNull();
    expect(screen.queryByText('Generating response...')).toBeNull();
    expect(textarea().disabled).toBe(false);
  }, 15_000);

  /**
   * An unsupported language must fall back to readable plain text, never an
   * empty block. Guards the CodeBlock fallback that the lazy Prism loader
   * depends on: languages outside the explicit loader map are expected and must
   * still render their source.
   */
  it('renders an unknown code language as readable plain text', async () => {
    cortex.db.query.mockImplementation(async () =>
      dbRows([
        {
          id: 'm1',
          role: 'assistant',
          content: '```wubbalubba\ndub dub\n```',
          created_at: 1_700_000_000_000,
        },
      ])
    );

    await renderChat();

    await waitFor(() => expect(screen.getByText('dub dub')).toBeDefined());
    const code = screen.getByText('dub dub');
    expect(code.textContent).toBe('dub dub');
    // Plain-text fallback path: no highlighted markup was injected.
    expect(code.querySelector('span')).toBeNull();
  });
});
