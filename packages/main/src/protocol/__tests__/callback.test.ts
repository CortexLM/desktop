import { describe, expect, it } from 'vitest';

import {
  AUTH_CALLBACK_NOT_STARTED,
  authCallbackFromArgv,
  isAuthCallbackUrl,
  parseAuthCallback,
  PROTOCOL_SCHEME,
} from '../callback';

const CALLBACK = 'cortex://auth/callback';
const BRIDGE = 'https://cortex.foundation/desktop/open';

describe('isAuthCallbackUrl', () => {
  it('accepts the custom protocol callback', () => {
    expect(isAuthCallbackUrl(`${CALLBACK}?code=abc`)).toBe(true);
    expect(isAuthCallbackUrl(CALLBACK)).toBe(true);
  });

  it('accepts the HTTPS bridge', () => {
    expect(isAuthCallbackUrl(`${BRIDGE}?code=abc`)).toBe(true);
    expect(isAuthCallbackUrl(`${BRIDGE}/?session=x`)).toBe(true);
  });

  it('rejects other schemes and hosts', () => {
    expect(isAuthCallbackUrl('https://evil.example/desktop/open?code=abc')).toBe(false);
    expect(isAuthCallbackUrl('javascript:alert(1)')).toBe(false);
    expect(isAuthCallbackUrl('cortex://other/path')).toBe(false);
    expect(isAuthCallbackUrl('file:///tmp/x')).toBe(false);
  });
});

describe('parseAuthCallback', () => {
  it('rejects a bare session deep-link with no login state', () => {
    expect(parseAuthCallback(`${CALLBACK}?session=attacker-session`)).toEqual({
      kind: 'error',
      message: AUTH_CALLBACK_NOT_STARTED,
    });
    expect(parseAuthCallback(`${CALLBACK}?access_token=tok-a`)).toEqual({
      kind: 'error',
      message: AUTH_CALLBACK_NOT_STARTED,
    });
    expect(parseAuthCallback(`${BRIDGE}?wos_session=tok-b`)).toEqual({
      kind: 'error',
      message: AUTH_CALLBACK_NOT_STARTED,
    });
  });

  it('rejects an authorization code with no login state', () => {
    expect(parseAuthCallback(`${CALLBACK}?code=authcode-1`)).toEqual({
      kind: 'error',
      message: AUTH_CALLBACK_NOT_STARTED,
    });
  });

  it('reads an authorization code only with state', () => {
    expect(parseAuthCallback(`${CALLBACK}?code=authcode-1&state=nonce-1`)).toEqual({
      kind: 'code',
      code: 'authcode-1',
      state: 'nonce-1',
    });
    expect(parseAuthCallback(`${CALLBACK}?session=sealed&state=nonce-2`)).toEqual({
      kind: 'session',
      token: 'sealed',
      state: 'nonce-2',
    });
  });

  it('prefers exchanging a code over a session in the same URL', () => {
    const url = `${CALLBACK}?code=auth-code&session=sealed-session-value&state=nonce-3`;
    expect(parseAuthCallback(url)).toEqual({
      kind: 'code',
      code: 'auth-code',
      state: 'nonce-3',
    });
  });

  it('accepts access_token and wos-session aliases when state is present', () => {
    expect(parseAuthCallback(`${CALLBACK}?access_token=tok-a&state=nonce-a`)).toEqual({
      kind: 'session',
      token: 'tok-a',
      state: 'nonce-a',
    });
    expect(parseAuthCallback(`${BRIDGE}?wos_session=tok-b&state=nonce-b`)).toEqual({
      kind: 'session',
      token: 'tok-b',
      state: 'nonce-b',
    });
  });

  it('maps a declined sign-in to product copy, without the vendor code', () => {
    const result = parseAuthCallback(`${CALLBACK}?error=access_denied`);
    expect(result).toEqual({
      kind: 'error',
      message: 'Sign-in was declined. You can try again, or continue without an account.',
    });
    expect(JSON.stringify(result).toLowerCase()).not.toContain('workos');
  });

  it('ignores URLs that are not the auth callback', () => {
    expect(parseAuthCallback('cortex://chat/new')).toEqual({ kind: 'ignored' });
  });

  it('fails closed when the callback has no credential', () => {
    expect(parseAuthCallback(CALLBACK).kind).toBe('error');
  });
});

describe('authCallbackFromArgv', () => {
  it('finds the callback among Windows second-instance argv', () => {
    const found = authCallbackFromArgv([
      'C:\\Program Files\\Cortex\\Cortex.exe',
      `${CALLBACK}?code=from-argv`,
    ]);
    expect(found).toBe(`${CALLBACK}?code=from-argv`);
  });

  it('returns nothing when argv has no callback', () => {
    expect(authCallbackFromArgv(['Cortex.exe', '--no-sandbox'])).toBeUndefined();
  });
});

describe('protocol scheme', () => {
  it('is cortex', () => {
    expect(PROTOCOL_SCHEME).toBe('cortex');
  });
});
