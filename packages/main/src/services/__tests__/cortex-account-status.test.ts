import { CortexApiError, CortexDeviceFlowError } from '@cortex-ide/cortex-api';
import { describe, expect, it } from 'vitest';

import { describeError, isAuthFailure, toDeviceStatus } from '../cortex-account-status';

describe('isAuthFailure', () => {
  it('is true only for a Cortex auth rejection', () => {
    expect(isAuthFailure(new CortexApiError('AUTH_REQUIRED', 'need login', { status: 401 }))).toBe(
      true,
    );
    expect(isAuthFailure(new Error('offline'))).toBe(false);
  });
});

describe('toDeviceStatus', () => {
  it('maps device-flow denials and expiry', () => {
    expect(toDeviceStatus(new CortexDeviceFlowError('access_denied', 'no', { status: 400 }))).toEqual(
      { kind: 'denied' },
    );
    expect(toDeviceStatus(new CortexDeviceFlowError('expired_token', 'gone', { status: 400 }))).toEqual(
      { kind: 'expired' },
    );
  });

  it('explains a retired auth endpoint', () => {
    const status = toDeviceStatus(
      new CortexApiError('not_found', 'No such endpoint.', { status: 404 }),
    );
    expect(status.kind).toBe('error');
    expect(status).toMatchObject({ kind: 'error' });
    if (status.kind === 'error') {
      expect(status.message).toMatch(/retired this endpoint/);
    }
  });

  it('falls back to the error message', () => {
    expect(toDeviceStatus(new Error('boom'))).toEqual({ kind: 'error', message: 'boom' });
    expect(toDeviceStatus('plain')).toEqual({ kind: 'error', message: 'plain' });
  });
});

describe('describeError', () => {
  it('uses Error.message or String()', () => {
    expect(describeError(new Error('x'))).toBe('x');
    expect(describeError(12)).toBe('12');
  });
});
