/**
 * `cortex://` callback parsing.
 *
 * The renderer never sees these URLs. Main receives them from the OS
 * (`open-url` on macOS, second-instance argv on Windows and Linux) and
 * extracts either an authorization code or a sealed session value. The
 * session value is a credential: this module returns it to the account
 * service and never logs it.
 */

export const PROTOCOL_SCHEME = 'cortex';
export const AUTH_CALLBACK_PATH = '/callback';
export const DESKTOP_BRIDGE_ORIGIN = 'https://cortex.foundation';
export const DESKTOP_BRIDGE_PATH = '/desktop/open';

/** Providers the desktop browser-login path can start. */
export type BrowserLoginProvider = 'google' | 'github';

export type AuthCallbackResult =
  | { kind: 'code'; code: string; state?: string }
  | { kind: 'session'; token: string; state?: string }
  | { kind: 'error'; message: string }
  | { kind: 'ignored' };

const SESSION_PARAMS = ['session', 'access_token', 'wos_session', 'wos-session'] as const;

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
 * Preference: a sealed session in the query wins (the HTTPS bridge puts it
 * there after the identity service has already exchanged the code). A bare
 * `code` is the authorization code main must exchange itself. An `error`
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

  for (const name of SESSION_PARAMS) {
    const value = parsed.searchParams.get(name)?.trim();
    if (value) return withState({ kind: 'session', token: value }, state);
  }

  const code = parsed.searchParams.get('code')?.trim();
  if (code) return withState({ kind: 'code', code }, state);

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

function withState<T extends { kind: 'code' | 'session' }>(
  result: T,
  state: string | undefined,
): T {
  return state ? { ...result, state } : result;
}

function callbackErrorMessage(code: string): string {
  if (code === 'access_denied') {
    return 'Sign-in was declined. You can try again, or continue without an account.';
  }
  return 'Sign-in did not complete. Try again from the Cortex app.';
}
