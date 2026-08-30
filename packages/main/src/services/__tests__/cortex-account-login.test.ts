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

  it('persists a session only when the callback state matches the pending login', async () => {
    const state = beginBrowserLogin('github');
    const acceptAccessToken = vi.fn(async (token: string) => {
      expect(token).toBe('sealed-session');
      return ANONYMOUS;
    });
    await completeAuthCallback(
      host(acceptAccessToken),
      `cortex://auth/callback?session=sealed-session&state=${state}`,
    );
    expect(acceptAccessToken).toHaveBeenCalledTimes(1);
  });
});
