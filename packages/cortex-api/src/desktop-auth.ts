/**
 * Desktop browser-login helpers.
 *
 * Google and GitHub open the system browser at `/v1/auth/login`. The identity
 * service owns the upstream client id and redirect; this client only names
 * which provider the user picked and asks the service to return through the
 * HTTPS bridge (`https://cortex.foundation/desktop/open`) so the desktop app
 * can reopen via `cortex://auth/callback`.
 *
 * Email stays in-process: POST `/v1/auth/login` with the address and password.
 * If that route is missing, the call fails closed — it does not invent a
 * session.
 */

import type { CortexApiClient } from './client.ts';
import { sessionTokenFromSetCookie } from './cookies.ts';
import { CortexApiError } from './errors.ts';
import { cortexUserSchema } from './schemas.ts';

export type BrowserLoginProvider = 'google' | 'github';

export const DESKTOP_AUTH_CALLBACK = 'cortex://auth/callback';
export const DESKTOP_BRIDGE_URL = 'https://cortex.foundation/desktop/open';

const PROVIDER_QUERY: Record<BrowserLoginProvider, string> = {
  google: 'GoogleOAuth',
  github: 'GitHubOAuth',
};

/** Query the service's hosted login, asking to return through the desktop bridge. */
export function browserLoginUrl(
  baseUrl: string,
  provider: BrowserLoginProvider,
  state?: string,
): string {
  const params = new URLSearchParams({
    provider: PROVIDER_QUERY[provider],
    client: 'desktop',
    redirect_uri: DESKTOP_BRIDGE_URL,
  });
  if (state) params.set('state', state);
  return `${baseUrl.replace(/\/+$/, '')}/v1/auth/login?${params.toString()}`;
}

/**
 * Exchanges an authorization code for the sealed session cookie.
 *
 * GET `/v1/auth/callback?code=` is the observed callback. Main calls it
 * because a `file://` renderer cannot. No cookie in the response is a hard
 * failure — there is nothing honest to store.
 */
export async function exchangeAuthCode(client: CortexApiClient, code: string): Promise<string> {
  const path = `/v1/auth/callback?code=${encodeURIComponent(code)}`;
  const response = await client.open(path, { anonymous: true });
  const token = tokenFromResponse(response);
  if (!token) {
    throw new CortexApiError(
      'INVALID_SESSION',
      'Sign-in did not return a session. Try again from the Cortex app.',
      { status: response.status, route: `GET ${path}` },
    );
  }
  return token;
}

/**
 * Email + password against POST `/v1/auth/login`.
 *
 * The hosted login page is GET (a 307). This is the in-app form. A 404 or 405
 * means the service has not shipped this route yet — fail closed, do not
 * fabricate a cookie.
 */
export async function signInWithEmail(
  client: CortexApiClient,
  email: string,
  password: string,
): Promise<string> {
  const response = await client.open('/v1/auth/login', {
    method: 'POST',
    body: { email, password },
    anonymous: true,
  });
  const token = tokenFromResponse(response);
  if (!token) {
    throw new CortexApiError(
      'INVALID_SESSION',
      'Sign-in did not return a session. Check the address and try again.',
      { status: response.status, route: 'POST /v1/auth/login' },
    );
  }
  return token;
}

/** Confirms a stored token by reading `/v1/me`. */
export async function verifySession(client: CortexApiClient) {
  return client.request('/v1/me', cortexUserSchema);
}

function tokenFromResponse(response: Response): string | undefined {
  const header =
    response.headers.get('set-cookie') ?? response.headers.getSetCookie?.().join(', ') ?? null;
  return sessionTokenFromSetCookie(header);
}
