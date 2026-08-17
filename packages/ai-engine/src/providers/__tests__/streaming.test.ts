import { describe, it, expect } from 'vitest';
import { readStreamLines, tryParseJSON } from '../streaming';

function streamOf(...payloads: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const payload of payloads) {
        controller.enqueue(encoder.encode(payload));
      }
      controller.close();
    },
  });
}

function bytesOf(...payloads: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const payload of payloads) {
        controller.enqueue(payload);
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const lines: string[] = [];
  for await (const line of readStreamLines(stream)) {
    lines.push(line);
  }
  return lines;
}

describe('readStreamLines', () => {
  it('splits a stream on newlines', async () => {
    expect(await collect(streamOf('a\nb\nc\n'))).toEqual(['a', 'b', 'c']);
  });

  it('reassembles lines split across chunks', async () => {
    expect(await collect(streamOf('{"par', 't":1}\n{"other":2}\n'))).toEqual([
      '{"part":1}',
      '{"other":2}',
    ]);
  });

  it('emits a trailing line with no final newline', async () => {
    expect(await collect(streamOf('first\nlast-without-newline'))).toEqual([
      'first',
      'last-without-newline',
    ]);
  });

  it('strips carriage returns from CRLF streams', async () => {
    expect(await collect(streamOf('a\r\nb\r\n'))).toEqual(['a', 'b']);
  });

  it('preserves empty lines between content', async () => {
    expect(await collect(streamOf('a\n\nb\n'))).toEqual(['a', '', 'b']);
  });

  it('yields nothing for an empty stream', async () => {
    expect(await collect(streamOf())).toEqual([]);
  });

  it('ignores a whitespace-only trailing buffer', async () => {
    expect(await collect(streamOf('a\n   '))).toEqual(['a']);
  });

  it('handles multi-byte characters split across chunks', async () => {
    // « é » en UTF-8 = 0xC3 0xA9, coupé entre deux chunks réseau
    const lines = await collect(
      bytesOf(new Uint8Array([0xc3]), new Uint8Array([0xa9, 0x0a]))
    );

    expect(lines).toEqual(['é']);
  });

  it('releases the reader when the consumer stops early', async () => {
    const stream = streamOf('a\nb\nc\n');

    for await (const line of readStreamLines(stream)) {
      if (line === 'a') break;
    }

    // Le lock est libéré : un nouveau getReader() ne doit pas lever
    expect(() => stream.getReader()).not.toThrow();
  });
});

describe('tryParseJSON', () => {
  it('parses valid JSON', () => {
    expect(tryParseJSON<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns null for malformed JSON', () => {
    expect(tryParseJSON('{not json')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(tryParseJSON('')).toBeNull();
  });

  it('parses JSON primitives', () => {
    expect(tryParseJSON<number>('42')).toBe(42);
    expect(tryParseJSON<boolean>('true')).toBe(true);
  });
});
