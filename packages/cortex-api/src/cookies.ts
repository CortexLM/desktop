/**
 * Cookie names observed on the live service.
 *
 * `wos-session` is the WorkOS sealed session (probed earlier). Guest sessions
 * created at POST /v1/auth/guest set `cortex_gt` (observed 2026-08-28).
 */

export const SESSION_COOKIE_NAME = 'wos-session';
export const GUEST_COOKIE_NAME = 'cortex_gt';

/** Reads `cortex_gt=<token>` out of a Set-Cookie header. Returns undefined when absent. */
export function guestTokenFromSetCookie(header: string | null | undefined): string | undefined {
  return cookieValue(header, GUEST_COOKIE_NAME);
}

/** Reads the sealed session (`wos-session`) out of Set-Cookie. */
export function sessionTokenFromSetCookie(header: string | null | undefined): string | undefined {
  return cookieValue(header, SESSION_COOKIE_NAME);
}

function cookieValue(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

export function cookieHeader(input: {
  sessionCookie?: string;
  accessToken?: string;
  guestToken?: string;
}): string | undefined {
  if (input.sessionCookie) return input.sessionCookie;
  if (input.accessToken) return `${SESSION_COOKIE_NAME}=${input.accessToken}`;
  if (input.guestToken) return `${GUEST_COOKIE_NAME}=${input.guestToken}`;
  return undefined;
}
