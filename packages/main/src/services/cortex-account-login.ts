/**
 * Desktop browser and email sign-in, kept off the account service so that
 * file stays about persistence and the device flow.
 *
 * Google, GitHub, Apple and SSO open the system browser at the Cortex login
 * URL. Email posts to the API from main. GitHub App install is a separate
 * browser start. None of these paths put a token in an event or a log.
 */

import {
  browserLoginUrl,
  describeGitHubInstallError,
  describeSignInError,
  exchangeAuthCode,
  githubAppInstallUrl,
  isCortexApiError,
  LEGAL_PAGE_URLS,
  probeGitHubInstall,
  signInWithEmail,
  type BrowserLoginProvider,
  type CortexApiClient,
  type LegalPage,
} from '@cortex-ide/cortex-api';
import type { CortexAccountState } from '@cortex-ide/shared';

import { openExternalSafe } from '../security';
import { AUTH_CALLBACK_NOT_STARTED, parseAuthCallback } from '../protocol/callback';
import { beginBrowserLogin, consumeBrowserLogin } from '../protocol/login-transaction';

export interface AccountLoginHost {
  getApiClient(): CortexApiClient;
  acceptAccessToken(token: string): Promise<CortexAccountState>;
}

export async function startBrowserLogin(
  service: AccountLoginHost,
  provider: BrowserLoginProvider,
): Promise<{ opened: boolean }> {
  const { state, challenge } = beginBrowserLogin(provider);
  const url = browserLoginUrl(service.getApiClient().baseUrl, provider, state, challenge);
  return { opened: await openExternalSafe(url) };
}

/**
 * Starts the GitHub App install in the system browser.
 *
 * Probes the install route first so a missing backend does not open a 404
 * tab and pretend the app was installed. No PAT is collected.
 */
export async function startGitHubInstall(
  service: AccountLoginHost,
): Promise<{ opened: boolean }> {
  try {
    await probeGitHubInstall(service.getApiClient());
  } catch (error) {
    throw new Error(describeGitHubInstallError(error));
  }
  const { state, challenge } = beginBrowserLogin('github-app');
  const url = githubAppInstallUrl(service.getApiClient().baseUrl, state, challenge);
  return { opened: await openExternalSafe(url) };
}

export async function openLegalPage(page: LegalPage): Promise<{ opened: boolean }> {
  return { opened: await openExternalSafe(LEGAL_PAGE_URLS[page]) };
}

export async function completeAuthCallback(
  service: AccountLoginHost,
  url: string,
): Promise<CortexAccountState> {
  const parsed = parseAuthCallback(url);
  if (parsed.kind === 'ignored') {
    throw new Error('Sign-in did not complete. Try again from the Cortex app.');
  }
  if (parsed.kind === 'error') {
    throw new Error(parsed.message);
  }
  const pending = consumeBrowserLogin(parsed.state);
  if (!pending) {
    throw new Error(AUTH_CALLBACK_NOT_STARTED);
  }

  const token =
    parsed.kind === 'session'
      ? parsed.token
      : await exchangeAuthCode(service.getApiClient(), parsed.code, pending.verifier);

  return service.acceptAccessToken(token);
}

export async function signInEmail(
  service: AccountLoginHost,
  email: string,
  password: string,
): Promise<CortexAccountState> {
  try {
    const token = await signInWithEmail(service.getApiClient(), email, password);
    return await service.acceptAccessToken(token);
  } catch (error) {
    throw new Error(describeEmailError(error));
  }
}

export function describeEmailError(error: unknown): string {
  if (isCortexApiError(error) && (error.code === 'not_found' || error.status === 404 || error.status === 405)) {
    return 'Email sign-in is not available on this workspace yet. Use Google, Apple, GitHub, or SSO, or continue without an account.';
  }
  if (isCortexApiError(error) && error.isAuthFailure) {
    return 'That email or password was not accepted. Check them and try again.';
  }
  return describeSignInError(error);
}
