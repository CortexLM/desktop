import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { sessionTokenFromSetCookie } from '../cookies.ts';
import {
  browserLoginUrl,
  DESKTOP_AUTH_CALLBACK,
  DESKTOP_BRIDGE_URL,
  exchangeAuthCode,
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

  it('names GitHub as the GitHubOAuth provider query', () => {
    const url = browserLoginUrl('https://api.cortex.foundation/', 'github');
    expect(url).toContain('provider=GitHubOAuth');
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
