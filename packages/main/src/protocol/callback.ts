/**
 * `cortex://` callback parsing.
 *
 * The renderer never sees these URLs. Main receives them from the OS
 * (`open-url` on macOS, second-instance argv on Windows and Linux) and
 * accepts only an authorization code with login state. Session credentials
 * in URLs are rejected even with state: only the main-process PKCE exchange
 * may obtain a session, and an intercepted deep-link must not bypass it.
 */

export const PROTOCOL_SCHEME = 'cortex';
export const AUTH_CALLBACK_PATH = '/callback';
export const DESKTOP_BRIDGE_ORIGIN = 'https://cortex.foundation';
export const DESKTOP_BRIDGE_PATH = '/desktop/open';

export const AUTH_CALLBACK_NOT_STARTED =
  'This sign-in link is not from a login you started in Cortex. Open the app and continue with Google, Apple, GitHub, or SSO.';

/** Providers the desktop browser-login path can start. */
export type BrowserLoginProvider = 'google' | 'github' | 'apple' | 'sso';

export type AuthCallbackResult =
  | { kind: 'code'; code: string; state: string }
  | { kind: 'error'; message: string }
  | { kind: 'ignored' };

/**
 * True when `url` is a Cortex desktop deep-link we should handle.
 *
 * Accepts `cortex://auth/callback…` and the HTTPS bridge
 * `https://cortex.foundation/desktop/open…`. Anything else is ignored so a
 * stray `cortex://` from another feature cannot be treated as a sign-in.
 */
export function isAuthCallbackUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  if (parsed.protocol === `${PROTOCOL_SCHEME}:`) {
    return parsed.hostname === 'auth' && (parsed.pathname === AUTH_CALLBACK_PATH || parsed.pathname === '');
  }
  if (parsed.protocol === 'https:' && parsed.hostname === 'cortex.foundation') {
    return parsed.pathname === DESKTOP_BRIDGE_PATH || parsed.pathname === `${DESKTOP_BRIDGE_PATH}/`;
  }
  return false;
}

/**
 * Reads a callback URL without echoing credentials.
 *
 * Only an authorization code (exchanged in main with PKCE) with `state`
 * is accepted. An `error`
 * query is a declined or failed sign-in, reported in product language.
 */
export function parseAuthCallback(url: string): AuthCallbackResult {
  if (!isAuthCallbackUrl(url)) return { kind: 'ignored' };

  const parsed = parseUrl(url);
  if (!parsed) return { kind: 'ignored' };

  const error = parsed.searchParams.get('error');
  if (error) {
    return { kind: 'error', message: callbackErrorMessage(error) };
  }

  const state = parsed.searchParams.get('state')?.trim();
  if (!state) {
    return { kind: 'error', message: AUTH_CALLBACK_NOT_STARTED };
  }

  return credentialFromParams(parsed.searchParams, state);
}

function credentialFromParams(params: URLSearchParams, state: string): AuthCallbackResult {
  const code = params.get('code')?.trim();
  if (code) return { kind: 'code', code, state };

  return {
    kind: 'error',
    message: 'Sign-in did not return a session. Try again from the Cortex app.',
  };
}

/** Picks a `cortex://` URL out of a process argv list (Windows / Linux). */
export function authCallbackFromArgv(argv: readonly string[]): string | undefined {
  return argv.find((entry) => isAuthCallbackUrl(entry));
}

function parseUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function callbackErrorMessage(code: string): string {
  if (code === 'access_denied') {
    return 'Sign-in was declined. You can try again, or continue without an account.';
  }
  return 'Sign-in did not complete. Try again from the Cortex app.';
}
