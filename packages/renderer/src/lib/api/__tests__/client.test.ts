import { describe, it, expect, afterEach } from 'vitest';
import { IPCError, getAPI, unwrapResponse } from '../client';

/**
 * `getAPI()` lit `window.cortex`. On substitue le global le temps du test
 * plutôt que de dépendre d'un vrai environnement DOM.
 */
type WindowStub = { cortex?: unknown } | undefined;

const globals = globalThis as { window?: WindowStub };
const originalWindow: WindowStub = globals.window;

function setWindow(value: WindowStub) {
  globals.window = value;
}

describe('getAPI', () => {
  afterEach(() => {
    setWindow(originalWindow);
  });

  it('returns the bridge exposed on window.cortex', () => {
    const bridge = { fs: {} };
    setWindow({ cortex: bridge });

    expect(getAPI()).toBe(bridge);
  });

  it('throws a helpful error when the preload has not run', () => {
    setWindow({});

    expect(() => getAPI()).toThrow('Cortex API not available');
  });

  it('throws when window.cortex is undefined', () => {
    setWindow({ cortex: undefined });

    expect(() => getAPI()).toThrow('Cortex API not available');
  });
});

describe('unwrapResponse', () => {
  it('returns the data of a successful response', () => {
    expect(unwrapResponse({ success: true, data: { count: 3 } })).toEqual({ count: 3 });
  });

  it('returns falsy data unchanged', () => {
    expect(unwrapResponse({ success: true, data: 0 })).toBe(0);
    expect(unwrapResponse({ success: true, data: null })).toBeNull();
    expect(unwrapResponse({ success: true, data: false })).toBe(false);
  });

  it('throws an IPCError for a failed response', () => {
    const call = () =>
      unwrapResponse({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'missing.txt' },
      });

    expect(call).toThrow(IPCError);
    expect(call).toThrow('missing.txt');
  });

  it('preserves the error code and details', () => {
    try {
      unwrapResponse({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{ path: ['name'] }],
        },
      });
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(IPCError);
      const ipcError = error as IPCError;
      expect(ipcError.code).toBe('VALIDATION_ERROR');
      expect(ipcError.details).toEqual([{ path: ['name'] }]);
      expect(ipcError.name).toBe('IPCError');
    }
  });

  it('leaves details undefined when the handler omits them', () => {
    try {
      unwrapResponse({ success: false, error: { code: 'GIT_ERROR', message: 'push rejected' } });
      throw new Error('expected a throw');
    } catch (error) {
      expect((error as IPCError).details).toBeUndefined();
    }
  });
});

describe('IPCError', () => {
  it('is an Error subclass carrying the IPC code', () => {
    const error = new IPCError('DATABASE_ERROR', 'locked');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('locked');
    expect(error.code).toBe('DATABASE_ERROR');
  });
});
