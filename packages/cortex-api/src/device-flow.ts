/**
 * Drives the RFC 8628 device authorisation flow.
 *
 * This is the desktop sign-in path, and what the "Auth Device Code" screen shows: the app
 * displays a short user code, the user approves it in a browser, and the app polls until a
 * token comes back. It avoids hosting a redirect listener inside Electron.
 *
 * The awkward part the loop exists to handle: the service reports "not approved yet" as
 * HTTP 400 with `{error: "authorization_pending"}`. A naive caller would treat the first
 * poll as a hard failure.
 */

import { CortexDeviceFlowError, isCortexDeviceFlowError } from './errors.ts';
import type { CortexApiClient } from './client.ts';
import type { DeviceCode, DeviceToken } from './schemas.ts';

/** RFC 8628 section 3.5: default to 5s when the server omits `interval`. */
const DEFAULT_INTERVAL_SECONDS = 5;
/** Increment applied on `slow_down`, per RFC 8628 section 3.5. */
const SLOW_DOWN_INCREMENT_SECONDS = 5;

export type DeviceFlowState =
  | { status: 'awaiting-authorization'; code: DeviceCode; secondsRemaining: number }
  | { status: 'authorized'; token: DeviceToken }
  | { status: 'denied' }
  | { status: 'expired' };

export interface PollDeviceTokenOptions {
  /** Reports each state change, for driving the screen's countdown and status copy. */
  onState?: (state: DeviceFlowState) => void;
  /** Cancels the flow, e.g. when the user closes the dialog. */
  signal?: AbortSignal;
  /** Injected in tests so the suite does not spend real seconds waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected in tests so expiry can be exercised without waiting 15 minutes. */
  now?: () => number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DeviceFlowAbortedError extends Error {
  readonly name = 'DeviceFlowAbortedError';
  constructor() {
    super('Device authorization was cancelled');
  }
}

/** What the loop should do next after a poll attempt. */
type PollOutcome =
  | { kind: 'token'; token: DeviceToken }
  | { kind: 'pending' }
  | { kind: 'slow-down' };

/**
 * Attempts one exchange.
 *
 * Returns rather than throws for the two non-failure states, so the loop reads as a state
 * machine instead of as exception control flow. Anything genuinely terminal still throws.
 */
async function attemptRedeem(
  client: CortexApiClient,
  code: DeviceCode,
  emit: (state: DeviceFlowState) => void,
  signal: AbortSignal | undefined,
): Promise<PollOutcome> {
  try {
    return { kind: 'token', token: await client.redeemDeviceCode(code.device_code, signal) };
  } catch (error) {
    if (!isCortexDeviceFlowError(error)) throw error;
    if (error.isSlowDown) return { kind: 'slow-down' };
    if (error.isPending) return { kind: 'pending' };

    emit({ status: error.code === 'access_denied' ? 'denied' : 'expired' });
    throw error;
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DeviceFlowAbortedError();
}

/**
 * A local expiry check as well as the server's. Without it, a server that kept answering
 * `authorization_pending` would keep the loop alive on a code that is already dead.
 */
function throwIfExpired(
  code: DeviceCode,
  expiresAt: number,
  now: () => number,
  emit: (state: DeviceFlowState) => void,
): void {
  if (now() < expiresAt) return;

  emit({ status: 'expired' });
  throw new CortexDeviceFlowError(
    'expired_token',
    `Device code expired after ${code.expires_in}s without being authorized`,
    { status: 0 },
  );
}

/**
 * Polls until the user approves, declines, or the code expires.
 *
 * Resolves with the token on approval. Throws `CortexDeviceFlowError` when the flow ends
 * without one, so a caller cannot mistake a declined sign-in for a successful one.
 */
export async function pollDeviceToken(
  client: CortexApiClient,
  code: DeviceCode,
  options: PollDeviceTokenOptions = {},
): Promise<DeviceToken> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const emit = (state: DeviceFlowState) => options.onState?.(state);

  const expiresAt = now() + code.expires_in * 1000;
  let intervalSeconds = code.interval ?? DEFAULT_INTERVAL_SECONDS;

  emit({ status: 'awaiting-authorization', code, secondsRemaining: code.expires_in });

  for (;;) {
    throwIfAborted(options.signal);

    // Waiting before the first poll is intentional: the user cannot possibly have approved
    // in the time it took to render the code, so an immediate poll only burns a request.
    await sleep(intervalSeconds * 1000);

    throwIfAborted(options.signal);
    throwIfExpired(code, expiresAt, now, emit);

    const outcome = await attemptRedeem(client, code, emit, options.signal);

    if (outcome.kind === 'token') {
      emit({ status: 'authorized', token: outcome.token });
      return outcome.token;
    }

    if (outcome.kind === 'slow-down') {
      intervalSeconds += SLOW_DOWN_INCREMENT_SECONDS;
      continue;
    }

    emit({
      status: 'awaiting-authorization',
      code,
      secondsRemaining: Math.max(0, Math.ceil((expiresAt - now()) / 1000)),
    });
  }
}

/** Starts a device flow and polls it to completion. */
export async function authorizeDevice(
  client: CortexApiClient,
  options: PollDeviceTokenOptions = {},
): Promise<DeviceToken> {
  const code = await client.startDeviceAuthorization(options.signal);
  return pollDeviceToken(client, code, options);
}
