import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  beginBrowserLogin,
  consumeBrowserLogin,
  LOGIN_TTL_MS,
  resetBrowserLoginForTests,
} from '../login-transaction';

describe('browser login transaction', () => {
  it('rejects a callback that was not started in this app', () => {
    resetBrowserLoginForTests();
    expect(consumeBrowserLogin('anything')).toBeUndefined();
    expect(consumeBrowserLogin(undefined)).toBeUndefined();
  });

  it('issues a PKCE challenge that matches the verifier', () => {
    const login = beginBrowserLogin('github');
    expect(login.challenge).toBe(createHash('sha256').update(login.verifier).digest('base64url'));
    expect(login.state).not.toBe(login.verifier);
  });

  it('accepts one matching, unexpired state and then burns it', () => {
    const { state } = beginBrowserLogin('github');
    const pending = consumeBrowserLogin(state);
    expect(pending?.state).toBe(state);
    expect(pending?.verifier).toBeTruthy();
    expect(consumeBrowserLogin(state)).toBeUndefined();
  });

  it('rejects a mismatched or expired state', () => {
    const { state } = beginBrowserLogin('google', 1_000);
    expect(consumeBrowserLogin('other', 1_001)).toBeUndefined();
    expect(consumeBrowserLogin(state, 1_001)).toBeUndefined();

    const next = beginBrowserLogin('google', 1_000);
    expect(consumeBrowserLogin(next.state, 1_000 + LOGIN_TTL_MS + 1)).toBeUndefined();
  });
});
