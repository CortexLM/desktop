/**
 * Desktop browser and email sign-in, kept off the account service so that
 * file stays about persistence and the device flow.
 *
 * Google/GitHub open the system browser at the Cortex login URL. Email posts
 * to the API from main. Neither path puts a token in an event or a log.
 */

import {
  browserLoginUrl,
  exchangeAuthCode,
  isCortexApiError,
  signInWithEmail,
  type BrowserLoginProvider,
  type CortexApiClient,
} from '@cortex-ide/cortex-api';
import type { CortexAccountState } from '@cortex-ide/shared';

import { openExternalSafe } from '../security';
import { parseAuthCallback } from '../protocol/callback';

export interface AccountLoginHost {
  getApiClient(): CortexApiClient;
  acceptAccessToken(token: string): Promise<CortexAccountState>;
}

export async function startBrowserLogin(
  service: AccountLoginHost,
  provider: BrowserLoginProvider,
): Promise<{ opened: boolean }> {
  const url = browserLoginUrl(service.getApiClient().baseUrl, provider);
  return { opened: await openExternalSafe(url) };
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

  const token =
    parsed.kind === 'session'
      ? parsed.token
      : await exchangeAuthCode(service.getApiClient(), parsed.code);

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
    return 'Email sign-in is not available on this workspace yet. Use Google or GitHub, or continue without an account.';
  }
  if (isCortexApiError(error) && error.isAuthFailure) {
    return 'That email or password was not accepted. Check them and try again.';
  }
  return 'Email sign-in did not complete. Try again, or continue without an account.';
}
