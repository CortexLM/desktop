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
    expect(consumeBrowserLogin('anything')).toBe(false);
    expect(consumeBrowserLogin(undefined)).toBe(false);
  });

  it('accepts one matching, unexpired state and then burns it', () => {
    const state = beginBrowserLogin('github');
    expect(consumeBrowserLogin(state)).toBe(true);
    expect(consumeBrowserLogin(state)).toBe(false);
  });

  it('rejects a mismatched or expired state', () => {
    const state = beginBrowserLogin('google', 1_000);
    expect(consumeBrowserLogin('other', 1_001)).toBe(false);
    expect(consumeBrowserLogin(state, 1_001)).toBe(false);

    const next = beginBrowserLogin('google', 1_000);
    expect(consumeBrowserLogin(next, 1_000 + LOGIN_TTL_MS + 1)).toBe(false);
  });
});
