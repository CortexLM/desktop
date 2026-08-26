import { describe, expect, it, vi } from 'vitest';

import { CortexApiClient } from '../client.ts';
import {
  authorizeDevice,
  DeviceFlowAbortedError,
  pollDeviceToken,
  type DeviceFlowState,
} from '../device-flow.ts';
import { CortexApiError, CortexDeviceFlowError } from '../errors.ts';
import { AUTHORIZATION_PENDING_RESPONSE, DEVICE_CODE_RESPONSE, stubFetch } from './fixtures.ts';

/** Advances instantly, so the suite does not spend real seconds on a 5s poll interval. */
function instantSleep(): (ms: number) => Promise<void> {
  return () => Promise.resolve();
}

/** A clock the test drives, so expiry can be reached without waiting 15 minutes. */
function fakeClock(startMs = 1_000_000) {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

const PENDING = { status: 400, body: AUTHORIZATION_PENDING_RESPONSE } as const;
const TOKEN = { status: 200, body: { access_token: 'tok-live', token_type: 'Bearer' } } as const;

describe('device flow polling', () => {
  it('returns the token once the user approves', async () => {
    const { fetch } = stubFetch([PENDING, PENDING, TOKEN]);
    const client = new CortexApiClient({ fetch });

    const token = await pollDeviceToken(client, DEVICE_CODE_RESPONSE, { sleep: instantSleep() });

    expect(token.access_token).toBe('tok-live');
  });

  it('treats authorization_pending as a poll signal, not a failure', async () => {
    // The service reports it with HTTP 400, so a naive caller would abandon the flow on
    // the very first poll.
    const { fetch, calls } = stubFetch([PENDING, PENDING, PENDING, TOKEN]);
    const client = new CortexApiClient({ fetch });

    await pollDeviceToken(client, DEVICE_CODE_RESPONSE, { sleep: instantSleep() });

    expect(calls).toHaveLength(4);
  });

  it('waits before the first poll rather than burning a request', async () => {
    // The user cannot have approved in the time it took to render the code.
    const sleep = vi.fn(() => Promise.resolve());
    const { fetch } = stubFetch([TOKEN]);
    const client = new CortexApiClient({ fetch });

    await pollDeviceToken(client, DEVICE_CODE_RESPONSE, { sleep });

    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it('honours the interval the server asked for', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const { fetch } = stubFetch([TOKEN]);
    const client = new CortexApiClient({ fetch });

    await pollDeviceToken(client, { ...DEVICE_CODE_RESPONSE, interval: 11 }, { sleep });

    expect(sleep).toHaveBeenCalledWith(11_000);
  });

  it('falls back to the RFC 8628 default when the server omits an interval', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const { fetch } = stubFetch([TOKEN]);
    const client = new CortexApiClient({ fetch });
    const { interval: _interval, ...withoutInterval } = DEVICE_CODE_RESPONSE;

    await pollDeviceToken(client, withoutInterval, { sleep });

    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it('backs off by 5s on slow_down, as RFC 8628 requires', async () => {
    const waits: number[] = [];
    const sleep = (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    };
    const { fetch } = stubFetch([
      { status: 400, body: { error: 'slow_down', error_description: 'too fast' } },
      TOKEN,
    ]);
    const client = new CortexApiClient({ fetch });

    await pollDeviceToken(client, DEVICE_CODE_RESPONSE, { sleep });

    expect(waits).toEqual([5000, 10_000]);
  });

  it('fails loudly when the user declines', async () => {
    // Silently resolving would let a caller treat a refused sign-in as a success.
    const { fetch } = stubFetch([
      { status: 400, body: { error: 'access_denied', error_description: 'user declined' } },
    ]);
    const client = new CortexApiClient({ fetch });

    const error = await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: instantSleep(),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CortexDeviceFlowError);
    expect((error as CortexDeviceFlowError).code).toBe('access_denied');
    expect((error as CortexDeviceFlowError).isTerminal).toBe(true);
  });

  it('fails when the server says the code expired', async () => {
    const { fetch } = stubFetch([{ status: 400, body: { error: 'expired_token' } }]);
    const client = new CortexApiClient({ fetch });

    const error = await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: instantSleep(),
    }).catch((caught: unknown) => caught);

    expect((error as CortexDeviceFlowError).code).toBe('expired_token');
  });

  it('treats an unrecognised code as a device-flow failure, not a generic one', async () => {
    // Observed live: `POST /auth/device/token` with a code the service does not know answers
    // `{"error":"invalid_grant","error_description":"Invalid device code"}`. It is RFC 6749
    // rather than 8628, and before it was listed the loop still stopped — but the failure
    // arrived as a plain CortexApiError, so a caller could not tell "that code is not valid"
    // from "the service is broken".
    const { fetch } = stubFetch([
      { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid device code' } },
    ]);
    const client = new CortexApiClient({ fetch });

    const error = await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: instantSleep(),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CortexDeviceFlowError);
    expect((error as CortexDeviceFlowError).code).toBe('invalid_grant');
    expect((error as CortexDeviceFlowError).isTerminal).toBe(true);
    // Not a poll signal: retrying the same code can only fail again.
    expect((error as CortexDeviceFlowError).isPending).toBe(false);
    expect((error as CortexDeviceFlowError).isSlowDown).toBe(false);
  });

  it('gives up locally once the code outlives expires_in', async () => {
    // Without this the loop would poll a dead code forever if the server kept answering
    // authorization_pending.
    const clock = fakeClock();
    const { fetch } = stubFetch(Array.from({ length: 50 }, () => PENDING));
    const client = new CortexApiClient({ fetch });

    const error = await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: () => {
        clock.advance(500_000);
        return Promise.resolve();
      },
      now: clock.now,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CortexDeviceFlowError);
    expect((error as CortexDeviceFlowError).code).toBe('expired_token');
    expect((error as CortexDeviceFlowError).message).toContain('900s');
  });

  it('stops when the caller aborts', async () => {
    const controller = new AbortController();
    const { fetch } = stubFetch([PENDING, TOKEN]);
    const client = new CortexApiClient({ fetch });

    const error = await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: () => {
        controller.abort();
        return Promise.resolve();
      },
      signal: controller.signal,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DeviceFlowAbortedError);
  });

  it('propagates a non-device error instead of swallowing it in the loop', async () => {
    const { fetch } = stubFetch([{ status: 500, body: { code: 'BOOM', message: 'server down' } }]);
    const client = new CortexApiClient({ fetch });

    const error = await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: instantSleep(),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CortexApiError);
    expect((error as CortexApiError).code).toBe('BOOM');
  });
});

describe('device flow state reporting', () => {
  it('reports the code first so the screen can render it immediately', async () => {
    const states: DeviceFlowState[] = [];
    const { fetch } = stubFetch([TOKEN]);
    const client = new CortexApiClient({ fetch });

    await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: instantSleep(),
      onState: (state) => states.push(state),
    });

    expect(states[0]).toMatchObject({
      status: 'awaiting-authorization',
      secondsRemaining: 900,
    });
    expect(states.at(-1)).toMatchObject({ status: 'authorized' });
  });

  it('counts down the remaining seconds across polls', async () => {
    const clock = fakeClock();
    const states: DeviceFlowState[] = [];
    const { fetch } = stubFetch([PENDING, TOKEN]);
    const client = new CortexApiClient({ fetch });

    await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: () => {
        clock.advance(60_000);
        return Promise.resolve();
      },
      now: clock.now,
      onState: (state) => states.push(state),
    });

    const waiting = states.filter((state) => state.status === 'awaiting-authorization');
    expect(waiting[0]).toMatchObject({ secondsRemaining: 900 });
    expect(waiting[1]).toMatchObject({ secondsRemaining: 840 });
  });

  it('reports denied separately from expired', async () => {
    const states: DeviceFlowState[] = [];
    const { fetch } = stubFetch([{ status: 400, body: { error: 'access_denied' } }]);
    const client = new CortexApiClient({ fetch });

    await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: instantSleep(),
      onState: (state) => states.push(state),
    }).catch(() => undefined);

    expect(states.at(-1)).toEqual({ status: 'denied' });
  });

  it('reports an unrecognised code as invalid rather than as expired', async () => {
    const states: DeviceFlowState[] = [];
    const { fetch } = stubFetch([
      { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid device code' } },
    ]);
    const client = new CortexApiClient({ fetch });

    await pollDeviceToken(client, DEVICE_CODE_RESPONSE, {
      sleep: instantSleep(),
      onState: (state) => states.push(state),
    }).catch(() => undefined);

    // The mapping used to be "denied, else expired", which would have told the user to wait
    // for a code that had already failed.
    expect(states.at(-1)).toEqual({ status: 'invalid', reason: 'Invalid device code' });
  });
});

describe('authorizeDevice', () => {
  it('starts a flow and polls it to completion', async () => {
    const { fetch, calls } = stubFetch([{ body: DEVICE_CODE_RESPONSE }, PENDING, TOKEN]);
    const client = new CortexApiClient({ fetch });

    const token = await authorizeDevice(client, { sleep: instantSleep() });

    expect(token.access_token).toBe('tok-live');
    expect(calls[0]!.url).toContain('/auth/device/code');
    expect(calls[1]!.url).toContain('/auth/device/token');
  });
});
