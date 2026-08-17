/**
 * Memoization benchmark for the chat message list.
 *
 * Simulates the streaming hot path: a long-lived list of completed messages
 * plus one message whose content grows chunk by chunk. Measures how much
 * per-message work React performs across the whole stream, comparing a
 * naive (unmemoized) bubble against the memoized one used by ChatView.
 *
 * The dominant per-message cost is parsing the content into text/code segments,
 * so we count parse executions and wall-clock render time.
 */

import React, { useMemo } from 'react';
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseMessageContent } from '../views/agents/ChatView';

interface BenchMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

/** Realistic message body containing a fenced code block. */
function makeContent(seed: number): string {
  return [
    `Here is approach number ${seed}:`,
    '```typescript',
    `function handler${seed}(input: string): number {`,
    `  const parsed = JSON.parse(input);`,
    `  return parsed.value * ${seed};`,
    '}',
    '```',
    'Let me know if you want a different variant.',
  ].join('\n');
}

function makeMessages(count: number): BenchMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: (i % 2 === 0 ? 'user' : 'assistant') as BenchMessage['role'],
    content: makeContent(i),
    timestamp: 1_700_000_000_000 + i * 1000,
  }));
}

/** Counts how many times message bodies actually do parse work. */
let parseCount = 0;

function instrumentedParse(content: string) {
  parseCount++;
  return parseMessageContent(content);
}

/** Naive bubble: parses on every render, no memo barrier. */
const NaiveBubble: React.FC<{ message: BenchMessage }> = ({ message }) => {
  const segments = instrumentedParse(message.content);
  return (
    <div data-testid={message.id}>
      {segments.map((s) =>
        s.kind === 'text' ? (
          <p key={s.key}>{s.value}</p>
        ) : (
          <pre key={s.key}>
            <code>{s.code}</code>
          </pre>
        )
      )}
    </div>
  );
};

/** Memoized bubble: mirrors ChatView's React.memo + useMemo strategy. */
const MemoBubbleInner: React.FC<{ message: BenchMessage }> = ({ message }) => {
  const segments = useMemo(() => instrumentedParse(message.content), [message.content]);
  return (
    <div data-testid={message.id}>
      {segments.map((s) =>
        s.kind === 'text' ? (
          <p key={s.key}>{s.value}</p>
        ) : (
          <pre key={s.key}>
            <code>{s.code}</code>
          </pre>
        )
      )}
    </div>
  );
};

const MemoBubble = React.memo(
  MemoBubbleInner,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.isStreaming === next.message.isStreaming &&
    prev.message.role === next.message.role &&
    prev.message.timestamp === next.message.timestamp
);

const List: React.FC<{
  messages: BenchMessage[];
  Bubble: React.ComponentType<{ message: BenchMessage }>;
}> = ({ messages, Bubble }) => (
  <div>
    {messages.map((m) => (
      <Bubble key={m.id} message={m} />
    ))}
  </div>
);

interface BenchResult {
  parses: number;
  ms: number;
}

/**
 * Render `messages`, then stream `chunks` additional chunks into the last
 * message, re-rendering after each chunk the way setMessages would.
 */
function runStream(
  Bubble: React.ComponentType<{ message: BenchMessage }>,
  messageCount: number,
  chunks: number
): BenchResult {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;

  const base = makeMessages(messageCount);
  const streamId = 'msg-streaming';

  // Initial mount is setup, not part of the measured streaming cost.
  act(() => {
    root = createRoot(container);
    root.render(
      <List
        messages={[
          ...base,
          { id: streamId, role: 'assistant', content: '', timestamp: 1, isStreaming: true },
        ]}
        Bubble={Bubble}
      />
    );
  });

  parseCount = 0;
  const start = performance.now();

  let streamed = '';
  for (let i = 0; i < chunks; i++) {
    streamed += `token${i} `;
    // Each chunk produces a brand-new array and a new object for the streaming
    // message - exactly what setMessages(prev => prev.map(...)) does.
    const next: BenchMessage[] = [
      ...base.map((m) => ({ ...m })),
      { id: streamId, role: 'assistant' as const, content: streamed, timestamp: 1, isStreaming: true },
    ];
    act(() => {
      root!.render(<List messages={next} Bubble={Bubble} />);
    });
  }

  const ms = performance.now() - start;

  act(() => {
    root!.unmount();
  });
  container.remove();

  return { parses: parseCount, ms };
}

describe('chat message list memoization', () => {
  const MESSAGE_COUNT = 20;
  const CHUNKS = 30;

  it('memoized list parses only the streaming message, not the whole list', () => {
    const naive = runStream(NaiveBubble, MESSAGE_COUNT, CHUNKS);
    const memo = runStream(MemoBubble, MESSAGE_COUNT, CHUNKS);

    // Naive: every message re-parses on every chunk.
    const expectedNaive = (MESSAGE_COUNT + 1) * CHUNKS;
    // Memoized: only the growing message re-parses.
    const expectedMemo = CHUNKS;

    const reduction = ((naive.parses - memo.parses) / naive.parses) * 100;

    console.log(
      `\n  messages=${MESSAGE_COUNT} chunks=${CHUNKS}\n` +
        `  unmemoized : ${naive.parses} parses, ${naive.ms.toFixed(1)}ms\n` +
        `  memoized   : ${memo.parses} parses, ${memo.ms.toFixed(1)}ms\n` +
        `  work avoided: ${reduction.toFixed(1)}%  (${naive.parses - memo.parses} parses)\n` +
        `  speedup     : ${(naive.ms / memo.ms).toFixed(2)}x\n`
    );

    expect(naive.parses).toBe(expectedNaive);
    expect(memo.parses).toBe(expectedMemo);
    // Memoization must eliminate the vast majority of per-message work.
    expect(reduction).toBeGreaterThan(90);
  });

  it('scales: memoized work stays flat as the list grows', () => {
    const small = runStream(MemoBubble, 10, 20);
    const large = runStream(MemoBubble, 200, 20);

    // Parse count depends only on chunks, never on list length.
    expect(small.parses).toBe(20);
    expect(large.parses).toBe(20);

    const naiveLarge = runStream(NaiveBubble, 200, 20);
    expect(naiveLarge.parses).toBe(201 * 20);

    console.log(
      `\n  200 messages / 20 chunks:\n` +
        `  unmemoized : ${naiveLarge.parses} parses, ${naiveLarge.ms.toFixed(1)}ms\n` +
        `  memoized   : ${large.parses} parses, ${large.ms.toFixed(1)}ms\n` +
        `  speedup     : ${(naiveLarge.ms / large.ms).toFixed(2)}x\n`
    );
  });

  it('parseMessageContent extracts code blocks correctly', () => {
    const segments = parseMessageContent(
      'intro\n```python\nprint("hi")\n```\noutro'
    );
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ kind: 'text', value: 'intro\n' });
    expect(segments[1]).toMatchObject({
      kind: 'code',
      language: 'python',
      code: 'print("hi")',
    });
    expect(segments[2]).toMatchObject({ kind: 'text', value: '\noutro' });
  });

  it('parseMessageContent is stateless across repeated calls', () => {
    const input = 'a\n```js\nlet x = 1;\n```\nb';
    const first = parseMessageContent(input);
    const second = parseMessageContent(input);
    // A shared /g regex would make the second call miss the code block.
    expect(second).toEqual(first);
    expect(second.some((s) => s.kind === 'code')).toBe(true);
  });
});
