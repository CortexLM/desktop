/**
 * One-shot browser-login transaction.
 *
 * A `cortex://auth/callback` is only accepted when it carries the state issued
 * by a login the user started in this app, and only once, within the TTL.
 * The state is not a session credential; it never reaches the renderer.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

export const LOGIN_TTL_MS = 10 * 60 * 1000;

export interface PendingBrowserLogin {
  state: string;
  provider: 'google' | 'github';
  expiresAt: number;
}

let pending: PendingBrowserLogin | undefined;

export function beginBrowserLogin(
  provider: PendingBrowserLogin['provider'],
  now = Date.now(),
): string {
  const state = randomBytes(32).toString('base64url');
  pending = { state, provider, expiresAt: now + LOGIN_TTL_MS };
  return state;
}

/** True only for a matching, unexpired, unused transaction. Always consumes. */
export function consumeBrowserLogin(state: string | undefined, now = Date.now()): boolean {
  const current = pending;
  pending = undefined;
  if (!current || !state) return false;
  if (now > current.expiresAt) return false;
  return statesEqual(current.state, state);
}

export function resetBrowserLoginForTests(): void {
  pending = undefined;
}

function statesEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
