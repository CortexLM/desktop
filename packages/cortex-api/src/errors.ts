/**
 * The Cortex API returns two error shapes, and they are not interchangeable.
 *
 *   application  { code: "AUTH_REQUIRED", message: "Authentication required" }
 *   OAuth device { error: "authorization_pending", error_description: "..." }
 *
 * The device endpoints return `authorization_pending` with HTTP 400, so status alone cannot
 * tell a caller whether something went wrong: during a device flow that response is the
 * expected steady state. Modelling the two shapes separately is what lets the poll loop
 * distinguish "keep waiting" from "give up".
 */

/** RFC 8628 section 3.5 device-flow error codes. */
export const DEVICE_FLOW_ERRORS = [
  'authorization_pending',
  'slow_down',
  'access_denied',
  'expired_token',
] as const;

export type DeviceFlowErrorCode = (typeof DEVICE_FLOW_ERRORS)[number];

export function isDeviceFlowErrorCode(value: string): value is DeviceFlowErrorCode {
  return (DEVICE_FLOW_ERRORS as readonly string[]).includes(value);
}

export interface CortexErrorContext {
  /** HTTP status, or 0 for a transport failure that never reached the service. */
  status: number;
  /** Value of the `x-request-id` response header, the only handle support has on a call. */
  requestId?: string;
  /** Method and path, for a message that says what actually failed. */
  route?: string;
}

/** An application-level error: `{ code, message }`. */
export class CortexApiError extends Error {
  readonly name = 'CortexApiError';
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly route?: string;

  constructor(code: string, message: string, context: CortexErrorContext) {
    super(message);
    this.code = code;
    this.status = context.status;
    this.requestId = context.requestId;
    this.route = context.route;
  }

  /** True when re-authenticating could plausibly fix this. */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.code === 'AUTH_REQUIRED' || this.code === 'INVALID_SESSION';
  }

  /** True when the caller is not entitled to the resource; signing in again will not help. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** True when backing off and retrying is reasonable. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }

  toString(): string {
    const parts = [`${this.code}: ${this.message}`];
    if (this.route) parts.push(`(${this.route})`);
    if (this.requestId) parts.push(`[request ${this.requestId}]`);
    return parts.join(' ');
  }
}

/** An OAuth device-flow error: `{ error, error_description }`. */
export class CortexDeviceFlowError extends Error {
  readonly name = 'CortexDeviceFlowError';
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(code: string, description: string, context: CortexErrorContext) {
    super(description);
    this.code = code;
    this.status = context.status;
    this.requestId = context.requestId;
  }

  /**
   * The user has not approved the device yet. This arrives as HTTP 400 but is the normal
   * state for most of a device flow's life, so a poll loop must treat it as "keep going".
   */
  get isPending(): boolean {
    return this.code === 'authorization_pending';
  }

  /** The service is asking for a longer poll interval. Also not a failure. */
  get isSlowDown(): boolean {
    return this.code === 'slow_down';
  }

  /** The flow is over and cannot recover: the code expired or the user declined. */
  get isTerminal(): boolean {
    return this.code === 'expired_token' || this.code === 'access_denied';
  }
}

/** Narrows an unknown thrown value to a Cortex error without instanceof across bundles. */
export function isCortexApiError(value: unknown): value is CortexApiError {
  return value instanceof Error && value.name === 'CortexApiError';
}

export function isCortexDeviceFlowError(value: unknown): value is CortexDeviceFlowError {
  return value instanceof Error && value.name === 'CortexDeviceFlowError';
}
