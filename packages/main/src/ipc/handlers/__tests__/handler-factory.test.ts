import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// `handler-factory` importe `electron` via ses types uniquement, mais
// `toErrorResponse`/`createHandler` n'ont pas besoin du runtime Electron.
import { createHandler, toErrorResponse } from '../shared/handler-factory';
import { ErrorCode } from '../shared/error-codes';

const Schema = z.object({ name: z.string(), count: z.number().optional() });

/** `createHandler` ne lit jamais l'event : un objet vide suffit. */
const FAKE_EVENT = {} as never;

describe('createHandler', () => {
  it('returns the handler result on success', async () => {
    const handler = createHandler(Schema, async (request) => ({ greeting: `hi ${request.name}` }));

    const result = await handler(FAKE_EVENT, { name: 'ada' });

    expect(result).toEqual({ success: true, data: { greeting: 'hi ada' } });
  });

  it('passes the validated request to the handler', async () => {
    let received: unknown;
    const handler = createHandler(Schema, async (request) => {
      received = request;
      return { ok: true };
    });

    await handler(FAKE_EVENT, { name: 'ada', count: 2 });

    expect(received).toEqual({ name: 'ada', count: 2 });
  });

  it('strips unknown keys from the validated request', async () => {
    let received: unknown;
    const handler = createHandler(Schema, async (request) => {
      received = request;
      return { ok: true };
    });

    await handler(FAKE_EVENT, { name: 'ada', injected: 'nope' });

    expect(received).toEqual({ name: 'ada' });
  });

  it('forwards the event as the second argument', async () => {
    const event = { sender: 'renderer' } as never;
    let received: unknown;
    const handler = createHandler(Schema, async (_request, ipcEvent) => {
      received = ipcEvent;
      return { ok: true };
    });

    await handler(event, { name: 'ada' });

    expect(received).toBe(event);
  });

  it('rejects a payload that fails validation', async () => {
    const handler = createHandler(Schema, async () => ({ never: true }));

    const result = await handler(FAKE_EVENT, { name: 42 });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(result.error.message).toBe('Validation failed');
    expect(Array.isArray(result.error.details)).toBe(true);
  });

  it('does not invoke the handler when validation fails', async () => {
    let invocations = 0;
    const handler = createHandler(Schema, async () => {
      invocations += 1;
      return { ok: true };
    });

    await handler(FAKE_EVENT, {});

    expect(invocations).toBe(0);
  });

  it('converts a thrown Error into a failure response', async () => {
    const handler = createHandler(Schema, async () => {
      throw new Error('ENOENT: missing');
    });

    const result = await handler(FAKE_EVENT, { name: 'ada' });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(result.error.message).toBe('ENOENT: missing');
  });

  it('never lets an exception escape to the IPC boundary', async () => {
    const handler = createHandler(Schema, async () => {
      throw 'a bare string';
    });

    const result = await handler(FAKE_EVENT, { name: 'ada' });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });
});

describe('toErrorResponse', () => {
  it('maps a ZodError to VALIDATION_ERROR', () => {
    const parsed = Schema.safeParse({ name: 1 });
    if (parsed.success) throw new Error('expected a parse failure');

    const result = toErrorResponse(parsed.error);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('includes the stack for an Error', () => {
    const result = toErrorResponse(new Error('boom'));

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect((result.error.details as { stack?: string }).stack).toBeDefined();
  });

  it('maps a non-Error to UNKNOWN_ERROR and keeps the value', () => {
    const result = toErrorResponse({ weird: true });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.error.message).toBe('An unknown error occurred');
    expect(result.error.details).toEqual({ weird: true });
  });

  it('handles null', () => {
    const result = toErrorResponse(null);

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });
});
