import { afterEach, describe, expect, it, vi } from 'vitest';

import { completeAuthCallback } from '../cortex-account-login';
import { beginBrowserLogin, resetBrowserLoginForTests } from '../../protocol/login-transaction';
import type { CortexApiClient } from '@cortex-ide/cortex-api';
import type { CortexAccountState } from '@cortex-ide/shared';

afterEach(() => {
  resetBrowserLoginForTests();
});

const ANONYMOUS: CortexAccountState = {
  user: null,
  reachable: true,
  credentialsEncrypted: true,
};

function host(accept: (token: string) => Promise<CortexAccountState> = async () => ANONYMOUS) {
  return {
    getApiClient: () => ({ baseUrl: 'https://api.cortex.foundation' }) as CortexApiClient,
    acceptAccessToken: accept,
  };
}

describe('completeAuthCallback', () => {
  it('does not persist a session that arrived without a login started here', async () => {
    const acceptAccessToken = vi.fn(async () => ANONYMOUS);
    await expect(
      completeAuthCallback(host(acceptAccessToken), 'cortex://auth/callback?session=attacker-session'),
    ).rejects.toThrow(/not from a login you started/i);
    expect(acceptAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a bare session even when a login is already pending', async () => {
    beginBrowserLogin('github');
    const acceptAccessToken = vi.fn(async () => ANONYMOUS);
    await expect(
      completeAuthCallback(host(acceptAccessToken), 'cortex://auth/callback?session=attacker-session'),
    ).rejects.toThrow(/not from a login you started/i);
    expect(acceptAccessToken).not.toHaveBeenCalled();
  });

  it('rejects session injection even when callback state matches the pending login', async () => {
    const { state } = beginBrowserLogin('github');
    const acceptAccessToken = vi.fn(async () => ANONYMOUS);
    await expect(completeAuthCallback(
      host(acceptAccessToken),
      `cortex://auth/callback?session=sealed-session&state=${state}`,
    )).rejects.toThrow('Sign-in did not return a session.');
    expect(acceptAccessToken).not.toHaveBeenCalled();
  });

  it('exchanges a code with the PKCE verifier from the pending login', async () => {
    const { state, verifier } = beginBrowserLogin('github');
    const open = vi.fn(async (path: string) => {
      expect(path).toContain('code=auth-code');
      expect(path).toContain(`code_verifier=${encodeURIComponent(verifier)}`);
      return new Response('{}', { headers: { 'set-cookie': 'wos-session=from-pkce; HttpOnly' } });
    });
    const acceptAccessToken = vi.fn(async (token: string) => {
      expect(token).toBe('from-pkce');
      return ANONYMOUS;
    });
    await completeAuthCallback(
      {
        getApiClient: () =>
          ({ baseUrl: 'https://api.cortex.foundation', open }) as unknown as CortexApiClient,
        acceptAccessToken,
      },
      `cortex://auth/callback?code=auth-code&state=${state}`,
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(acceptAccessToken).toHaveBeenCalledTimes(1);
  });
});
