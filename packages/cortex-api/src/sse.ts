/**
 * Server-sent event reader shared by HTTP chat completions and conversation turns.
 *
 * A real socket does not respect frame boundaries, so a partial frame stays in
 * the buffer until the rest arrives. Malformed `data:` lines are skipped so a
 * live stream is not aborted for one bad frame.
 */

export function splitSseBuffer(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = [];
  let rest = buffer;
  let boundary = rest.indexOf('\n\n');
  while (boundary !== -1) {
    frames.push(rest.slice(0, boundary));
    rest = rest.slice(boundary + 2);
    boundary = rest.indexOf('\n\n');
  }
  return { frames, rest };
}

export function* parseEventFrame(frame: string): Generator<unknown, void, undefined> {
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '' || data === '[DONE]') continue;
    try {
      yield JSON.parse(data);
    } catch {
      // Skip; the caller still sees frames that did parse.
    }
  }
}

export async function* readEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const split = splitSseBuffer(buffer);
      buffer = split.rest;
      for (const frame of split.frames) {
        yield* parseEventFrame(frame);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
