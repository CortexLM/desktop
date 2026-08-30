import { describe, expect, it } from 'vitest';

import {
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
  it('reads an authorization code', () => {
    expect(parseAuthCallback(`${CALLBACK}?code=authcode-1`)).toEqual({
      kind: 'code',
      code: 'authcode-1',
    });
  });

  it('prefers a sealed session over a leftover code', () => {
    const url = `${CALLBACK}?code=leftover&session=sealed-session-value`;
    expect(parseAuthCallback(url)).toEqual({
      kind: 'session',
      token: 'sealed-session-value',
    });
  });

  it('accepts access_token and wos-session aliases', () => {
    expect(parseAuthCallback(`${CALLBACK}?access_token=tok-a`)).toEqual({
      kind: 'session',
      token: 'tok-a',
    });
    expect(parseAuthCallback(`${BRIDGE}?wos_session=tok-b`)).toEqual({
      kind: 'session',
      token: 'tok-b',
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
