import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { sessionTokenFromSetCookie } from '../cookies.ts';
import { CortexApiError } from '../errors.ts';
import {
  browserLoginUrl,
  describeGitHubInstallError,
  describeSignInError,
  describeSshConnectError,
  describeWorkspaceError,
  DESKTOP_AUTH_CALLBACK,
  DESKTOP_BRIDGE_URL,
  exchangeAuthCode,
  githubAppInstallUrl,
  LEGAL_PAGE_URLS,
  probeGitHubInstall,
  signInWithEmail,
} from '../desktop-auth.ts';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('browserLoginUrl', () => {
  it('stays on the Cortex API origin', () => {
    const url = browserLoginUrl('https://api.cortex.foundation', 'google');
    expect(url.startsWith('https://api.cortex.foundation/v1/auth/login?')).toBe(true);
    expect(url).toContain('provider=GoogleOAuth');
    expect(url).toContain(`redirect_uri=${encodeURIComponent(DESKTOP_BRIDGE_URL)}`);
    expect(url).toContain('client=desktop');
    expect(url).not.toContain('state=');
  });

  it('includes a login state when one is issued', () => {
    const url = browserLoginUrl('https://api.cortex.foundation', 'google', 'nonce-1');
    expect(url).toContain('state=nonce-1');
  });

  it('includes the PKCE challenge when one is issued', () => {
    const url = browserLoginUrl('https://api.cortex.foundation', 'google', 'nonce-1', 'challenge-1');
    expect(url).toContain('code_challenge=challenge-1');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('names GitHub, Apple and SSO as AuthKit provider queries', () => {
    expect(browserLoginUrl('https://api.cortex.foundation/', 'github')).toContain(
      'provider=GitHubOAuth',
    );
    expect(browserLoginUrl('https://api.cortex.foundation/', 'apple')).toContain(
      'provider=AppleOAuth',
    );
    expect(browserLoginUrl('https://api.cortex.foundation/', 'sso')).toContain('provider=SSO');
  });

  it('builds a GitHub App install URL without a token field', () => {
    const url = githubAppInstallUrl('https://api.cortex.foundation/', 'nonce-1', 'challenge-1');
    expect(url.startsWith('https://api.cortex.foundation/v1/integrations/github/install?')).toBe(
      true,
    );
    expect(url).toContain('client=desktop');
    expect(url).toContain(`redirect_uri=${encodeURIComponent(DESKTOP_BRIDGE_URL)}`);
    expect(url).toContain('state=nonce-1');
    expect(url).not.toMatch(/token|pat|ghp_/i);
  });

  it('points Privacy and Terms at the Cortex origin', () => {
    expect(LEGAL_PAGE_URLS.privacy).toBe('https://cortex.foundation/privacy');
    expect(LEGAL_PAGE_URLS.terms).toBe('https://cortex.foundation/terms');
  });

  it('strips trailing slashes from the API origin without a regex', () => {
    const url = browserLoginUrl('https://api.cortex.foundation///', 'google');
    expect(url.startsWith('https://api.cortex.foundation/v1/auth/login?')).toBe(true);
    expect(url).not.toContain('foundation///');
  });

  it('points the custom protocol at cortex://auth/callback', () => {
    expect(DESKTOP_AUTH_CALLBACK).toBe('cortex://auth/callback');
  });
});

describe('sessionTokenFromSetCookie', () => {
  it('reads the sealed session cookie name the service actually uses', () => {
    expect(sessionTokenFromSetCookie('wos-session=sealed; Path=/; HttpOnly')).toBe('sealed');
    expect(sessionTokenFromSetCookie('cortex_gt=guest')).toBeUndefined();
  });
});

describe('exchangeAuthCode', () => {
  it('sends the code on the callback route and stores the cookie', async () => {
    const fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain('/v1/auth/callback?code=auth-code');
      return jsonResponse(
        { ok: true },
        { headers: { 'set-cookie': 'wos-session=sealed-from-code; HttpOnly' } },
      );
    };
    const token = await exchangeAuthCode(new CortexApiClient({ fetch }), 'auth-code');
    expect(token).toBe('sealed-from-code');
  });

  it('sends the PKCE verifier with the code', async () => {
    const fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain('/v1/auth/callback?');
      expect(url).toContain('code=auth-code');
      expect(url).toContain('code_verifier=verifier-1');
      return jsonResponse(
        { ok: true },
        { headers: { 'set-cookie': 'wos-session=sealed-from-pkce; HttpOnly' } },
      );
    };
    const token = await exchangeAuthCode(new CortexApiClient({ fetch }), 'auth-code', 'verifier-1');
    expect(token).toBe('sealed-from-pkce');
  });

  it('fails closed when the callback has no session cookie', async () => {
    const fetch = async () => jsonResponse({ ok: true });
    await expect(exchangeAuthCode(new CortexApiClient({ fetch }), 'auth-code')).rejects.toThrow(
      /did not return a session/i,
    );
  });
});

describe('signInWithEmail', () => {
  it('posts the address to /v1/auth/login and reads the session cookie', async () => {
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.cortex.foundation/v1/auth/login');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        email: 'ada@example.com',
        password: 'test-password',
      });
      return jsonResponse(
        { ok: true },
        { headers: { 'set-cookie': 'wos-session=email-session; HttpOnly' } },
      );
    };
    const token = await signInWithEmail(
      new CortexApiClient({ fetch }),
      'ada@example.com',
      'test-password',
    );
    expect(token).toBe('email-session');
  });
});

describe('probeGitHubInstall', () => {
  it('fails closed when the install route is missing', async () => {
    const fetch = async () => jsonResponse({ title: 'Not Found', status: 404 }, { status: 404 });
    await expect(probeGitHubInstall(new CortexApiClient({ fetch }))).rejects.toThrow(
      /Open a folder on This PC/,
    );
  });

  it('accepts a live route so the browser can open', async () => {
    const fetch = async () => jsonResponse({ ok: true }, { status: 200 });
    await expect(probeGitHubInstall(new CortexApiClient({ fetch }))).resolves.toBeUndefined();
  });
});

describe('sign-in copy', () => {
  it('maps a missing route to product language, not a vendor body', () => {
    const error = new CortexApiError('not_found', 'WorkOS is not configured', { status: 404 });
    const copy = describeSignInError(error);
    expect(copy).toMatch(/not available on this workspace/);
    expect(copy.toLowerCase()).not.toContain('workos');
  });

  it('tells a GitHub install miss to use This PC', () => {
    const error = new CortexApiError('not_found', 'missing', { status: 404 });
    expect(describeGitHubInstallError(error)).toMatch(/This PC/);
    expect(describeGitHubInstallError(error).toLowerCase()).not.toContain('pat');
  });

  it('maps a missing SSH route to This PC, not a vendor body', () => {
    const error = new CortexApiError('not_found', 'WorkOS refused the host', { status: 404 });
    const copy = describeSshConnectError(error);
    expect(copy).toMatch(/This PC/);
    expect(copy.toLowerCase()).not.toContain('workos');
  });

  it('maps a workspace miss to product language', () => {
    const error = new CortexApiError('not_found', 'WorkOS is not configured', { status: 404 });
    const copy = describeWorkspaceError(error);
    expect(copy).toMatch(/not available on this workspace/);
    expect(copy.toLowerCase()).not.toContain('workos');
  });

  it('maps an expired session to sign-in, not a vendor body', () => {
    const error = new CortexApiError('AUTH_REQUIRED', 'WorkOS session expired', { status: 401 });
    const copy = describeWorkspaceError(error);
    expect(copy).toMatch(/Sign in to Cortex/);
    expect(copy.toLowerCase()).not.toContain('workos');
  });

  it('keeps a generic write failure free of status codes', () => {
    const copy = describeWorkspaceError(new Error('Request failed with status code 503'));
    expect(copy).toBe('That did not complete. Try again.');
    expect(copy).not.toMatch(/503|status/i);
  });
});
