/**
 * Honest Bot errors. A 404 on a Cortex Bot runtime route means the backend is too old.
 * A 503 on plugins means Composio is not configured. Neither is an empty list.
 */

import { CortexApiError, isCortexApiError } from './errors.ts';

export const BACKEND_TOO_OLD = 'backend_too_old';
export const PLUGIN_UNAVAILABLE = 'plugin_unavailable';

/** Codes the service uses when it refuses outright for want of an account. */
const ACCOUNT_REQUIRED_CODES: readonly string[] = [
  'account_required',
  'guest_forbidden',
  'guest_not_allowed',
  'guest_session',
  'unauthenticated',
];

/**
 * True when a call failed because there is no account behind it — no session at
 * all, or a guest one.
 *
 * Observed on `POST /v1/plugins/{slug}/connect` (2026-08-29):
 *
 *   no session   401 `unauthenticated`      "No session. Sign in, or begin a
 *                                            guest session at POST /v1/auth/guest."
 *   guest        403 `entitlement_required` "Connecting an app needs an account: a
 *                                            guest session cannot be signed back
 *                                            into to revoke it later. Sign in first."
 *
 * The code alone cannot decide the 403: `entitlement_required` is also how a
 * plan gate arrives (`POST /v1/projects` answers it with `required_plan`), and
 * sending a paying user to a sign-in screen because their plan is too small
 * would be a worse dead end than the message they came for. The wording is what
 * separates them, so the wording is what is matched.
 *
 * Callers open sign-in on this rather than showing the message: it explains a
 * server-side invariant — a session that cannot be signed back into could never
 * revoke what it connected — and there is nothing in it to act on.
 */
export function isAccountRequired(error: unknown): boolean {
  if (!isCortexApiError(error)) return false;
  if (error.status === 401) return true;
  if (error.status !== 403) return false;
  return ACCOUNT_REQUIRED_CODES.includes(error.code) || /\bguest\b/i.test(error.message);
}

export function isNotFound(error: unknown): boolean {
  return isCortexApiError(error) && (error.code === 'not_found' || error.status === 404);
}

export function isServiceUnavailable(error: unknown): boolean {
  return isCortexApiError(error) && error.status === 503;
}

export function classifyBotError(error: unknown): CortexApiError {
  if (isServiceUnavailable(error) && isCortexApiError(error)) {
    return new CortexApiError(
      PLUGIN_UNAVAILABLE,
      error.message || 'Plugins are not configured on this backend.',
      { status: error.status, requestId: error.requestId, route: error.route },
    );
  }
  if (isNotFound(error) && isCortexApiError(error)) {
    return new CortexApiError(
      BACKEND_TOO_OLD,
      'This backend is too old for this Bot surface.',
      { status: error.status, requestId: error.requestId, route: error.route },
    );
  }
  if (isCortexApiError(error)) return error;
  return new CortexApiError('UNKNOWN_ERROR', String(error), { status: 0 });
}

export function backendTooOldCopy(surface: string): { title: string; body: string } {
  return {
    title: 'Backend too old',
    body: `${surface} needs a newer Cortex API. This client will not invent a local copy.`,
  };
}

export function farmOfflineCopy(): { title: string; body: string } {
  return {
    title: 'Computer offline',
    body: 'The farm or local daemon is not connected. This is not a live desktop.',
  };
}
