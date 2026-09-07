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
import { CortexApiError, isCortexApiError } from './errors.ts';
import { cortexUserSchema } from './schemas.ts';

export const BROWSER_LOGIN_PROVIDERS = ['google', 'github', 'apple', 'sso'] as const;
export type BrowserLoginProvider = (typeof BROWSER_LOGIN_PROVIDERS)[number];

export const DESKTOP_AUTH_CALLBACK = 'cortex://auth/callback';
export const DESKTOP_BRIDGE_URL = 'https://cortex.foundation/desktop/open';

export const LEGAL_PAGE_URLS = {
  privacy: 'https://cortex.foundation/privacy',
  terms: 'https://cortex.foundation/terms',
} as const;
export type LegalPage = keyof typeof LEGAL_PAGE_URLS;

const PROVIDER_QUERY: Record<BrowserLoginProvider, string> = {
  google: 'GoogleOAuth',
  github: 'GitHubOAuth',
  apple: 'AppleOAuth',
  sso: 'SSO',
};

/** Query the service's hosted login, asking to return through the desktop bridge. */
export function browserLoginUrl(
  baseUrl: string,
  provider: BrowserLoginProvider,
  state?: string,
  codeChallenge?: string,
): string {
  const params = new URLSearchParams({
    provider: PROVIDER_QUERY[provider],
    client: 'desktop',
    redirect_uri: DESKTOP_BRIDGE_URL,
  });
  if (state) params.set('state', state);
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${withoutTrailingSlashes(baseUrl)}/v1/auth/login?${params.toString()}`;
}

/**
 * GitHub App install for Code. Opens in the system browser. There is no PAT
 * field — the service must complete the install and return through the
 * desktop bridge. A missing route is a hard failure, not a folder picker.
 */
export function githubAppInstallUrl(
  baseUrl: string,
  state?: string,
  codeChallenge?: string,
): string {
  const params = new URLSearchParams({
    client: 'desktop',
    redirect_uri: DESKTOP_BRIDGE_URL,
  });
  if (state) params.set('state', state);
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${withoutTrailingSlashes(baseUrl)}/v1/integrations/github/install?${params.toString()}`;
}

/**
 * Confirms the GitHub App install route exists before opening a browser.
 *
 * Uses `exchange` so a 404 is readable. Following a 307 is fine: the probe
 * only cares that the route is not missing.
 */
export async function probeGitHubInstall(client: CortexApiClient): Promise<void> {
  const path = '/v1/integrations/github/install?client=desktop';
  const response = await client.exchange(path, { anonymous: true });
  if (response.status === 404 || response.status === 405) {
    throw new CortexApiError(
      'not_found',
      'Connecting GitHub is not available on this workspace yet. Open a folder on This PC instead.',
      { status: response.status, route: `GET ${path}` },
    );
  }
}

/** Strip trailing `/` without a regex so a long run of slashes cannot stall URL construction. */
function withoutTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}

/**
 * Exchanges an authorization code for the sealed session cookie.
 *
 * GET `/v1/auth/callback?code=` is the observed callback. Main calls it
 * because a `file://` renderer cannot. Desktop login also sends the PKCE
 * `code_verifier` stored with the pending transaction. No cookie in the
 * response is a hard failure — there is nothing honest to store.
 */
export async function exchangeAuthCode(
  client: CortexApiClient,
  code: string,
  codeVerifier?: string,
): Promise<string> {
  const search = new URLSearchParams({ code });
  if (codeVerifier) search.set('code_verifier', codeVerifier);
  const path = `/v1/auth/callback?${search.toString()}`;
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

function isMissingRoute(error: unknown): boolean {
  return (
    isCortexApiError(error) &&
    (error.code === 'not_found' || error.status === 404 || error.status === 405)
  );
}

/** Product copy for a failed browser or email sign-in. Never a raw vendor body. */
export function describeSignInError(error: unknown): string {
  if (isMissingRoute(error)) {
    return 'That sign-in method is not available on this workspace yet. Try another, or continue without an account.';
  }
  if (isCortexApiError(error) && error.isAuthFailure) {
    return 'That sign-in was not accepted. Try again, or continue without an account.';
  }
  return 'Sign-in did not complete. Try again, or continue without an account.';
}

/** Product copy when GitHub App install cannot start. */
export function describeGitHubInstallError(error: unknown): string {
  if (isMissingRoute(error)) {
    return 'Connecting GitHub is not available on this workspace yet. Open a folder on This PC instead.';
  }
  return 'Could not start GitHub. Open a folder on This PC, or try again.';
}

/** Product copy when SSH connect fails. */
export function describeSshConnectError(error: unknown): string {
  if (isMissingRoute(error)) {
    return 'Adding a server is not available on this workspace yet. This PC still works.';
  }
  return 'Could not add that server. Check the host and try again.';
}
