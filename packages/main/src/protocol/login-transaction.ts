/**
 * One-shot browser-login transaction.
 *
 * A `cortex://auth/callback` is only accepted when it carries the state issued
 * by a login the user started in this app, and only once, within the TTL.
 * The authorization code is exchanged with the PKCE verifier stored here.
 * State, challenge and verifier never reach the renderer.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const LOGIN_TTL_MS = 10 * 60 * 1000;

export interface PendingBrowserLogin {
  state: string;
  verifier: string;
  challenge: string;
  provider: 'google' | 'github' | 'apple' | 'sso' | 'github-app';
  expiresAt: number;
}

export interface StartedBrowserLogin {
  state: string;
  challenge: string;
  verifier: string;
}

let pending: PendingBrowserLogin | undefined;

export function beginBrowserLogin(
  provider: PendingBrowserLogin['provider'],
  now = Date.now(),
): StartedBrowserLogin {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  pending = { state, verifier, challenge, provider, expiresAt: now + LOGIN_TTL_MS };
  return { state, challenge, verifier };
}

/** Matching, unexpired, unused transaction, or undefined. Always consumes. */
export function consumeBrowserLogin(
  state: string | undefined,
  now = Date.now(),
): PendingBrowserLogin | undefined {
  const current = pending;
  pending = undefined;
  if (!current || !state) return undefined;
  if (now > current.expiresAt) return undefined;
  if (!statesEqual(current.state, state)) return undefined;
  return current;
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
