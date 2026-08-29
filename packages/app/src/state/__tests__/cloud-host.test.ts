import { afterEach, describe, expect, it, vi } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';
import type { CortexDeviceStatus } from '@cortex-ide/shared';

import { createCloudHost, toModelView, toUserView } from '../cloud-host.ts';
import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

function hostWith(responses: Parameters<typeof stubFetch>[0], openUrl = vi.fn()) {
  const { fetch, calls } = stubFetch(responses);
  const client = new CortexApiClient({ fetch });
  return {
    host: createCloudHost({ client, openUrl, sleep: async () => {} }),
    calls,
    client,
    openUrl,
  };
}

const UNAUTHORIZED = {
  status: 401,
  body: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
};

/** Waits for the detached polling loop to settle. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('projections', () => {
  it('builds a display name from the parts the API sends', () => {
    expect(toUserView({ id: 'u1', first_name: 'Ana', last_name: 'Moreno' }).displayName).toBe(
      'Ana Moreno',
    );
    expect(toUserView({ id: 'u1', name: 'Ana M' }).displayName).toBe('Ana M');
    // Nothing to build one from: absent rather than an empty string.
    expect(toUserView({ id: 'u1' }).displayName).toBeUndefined();
    // The email is the fallback identity when there is no id.
    expect(toUserView({ email: 'a@b.co' }).id).toBe('a@b.co');
    expect(toUserView({}).id).toBe('unknown');
  });

  it('carries the server-side lock through to the picker', () => {
    // Matches main's `toModelView`: the server is the only authority on this.
    expect(toModelView({ id: 'm', object: 'model', locked: true }).requiresAccount).toBe(true);
    expect(toModelView({ id: 'm', object: 'model', is_premium: true }).requiresAccount).toBe(true);
    expect(toModelView({ id: 'm', object: 'model' }).requiresAccount).toBe(false);
    expect(toModelView({ id: 'anthropic/claude-x', object: 'model' }).provider).toBe('anthropic');
    expect(toModelView({ id: 'cortex-opus', object: 'model' }).provider).toBeUndefined();
  });
});

describe('cloud account host', () => {
  it('reports a signed-in account', async () => {
    const { host } = hostWith([{ body: { id: 'u1', email: 'ana@cortex.foundation' } }]);

    const state = await host.getState();

    expect(state.user?.email).toBe('ana@cortex.foundation');
    expect(state.reachable).toBe(true);
    // No OS keyring in a browser, and the session is a cookie the tab cannot read.
    expect(state.credentialsEncrypted).toBe(false);
  });

  it('treats a guest session as signed out', async () => {
    const { host } = hostWith([{ body: { id: 'guest_1', is_guest: true } }]);
    const state = await host.getState();
    // A guest must not light up account-only UI.
    expect(state.user).toBeNull();
    expect(state.reachable).toBe(true);
  });

  it('separates signed out from unreachable', async () => {
    const answered = await hostWith([UNAUTHORIZED]).host.getState();
    // A 401 proves the service is up; only a transport failure leaves us unsure.
    expect(answered).toMatchObject({ user: null, reachable: true });

    const offline = createCloudHost({
      client: new CortexApiClient({
        fetch: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch,
      }),
    });
    expect(await offline.getState()).toMatchObject({ user: null, reachable: false });
  });

  it('reports a catalogue failure without taking the app down', async () => {
    const { host } = hostWith([UNAUTHORIZED]);
    const result = await host.listModels();
    expect(result.models).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it('lists the catalogue signed out', async () => {
    const { host } = hostWith([
      { body: { object: 'list', data: [{ id: 'cortex-opus', object: 'model', locked: true }] } },
    ]);
    const result = await host.listModels();
    expect(result.models).toEqual([{ id: 'cortex-opus', requiresAccount: true }]);
  });

  it('starts a device flow and never returns the device code', async () => {
    const { host } = hostWith([
      {
        body: {
          user_code: 'WDJB-MJHT',
          device_code: 'secret-value',
          verification_uri: 'https://auth.cortex.foundation/device',
          expires_in: 900,
          interval: 0,
        },
      },
      { status: 400, body: { error: 'authorization_pending' } },
    ]);

    const started = await host.startDeviceFlow();

    expect(started.userCode).toBe('WDJB-MJHT');
    expect(started.verificationUri).toBe('https://auth.cortex.foundation/device');
    expect(JSON.stringify(started)).not.toContain('secret-value');
    await host.cancelDeviceFlow();
  });

  it('authorises, applies the token in memory, and pushes the account', async () => {
    const { host, client } = hostWith([
      {
        body: {
          user_code: 'AAAA-BBBB',
          device_code: 'dc',
          verification_uri: 'https://auth.cortex.foundation/device',
          expires_in: 900,
          interval: 0,
        },
      },
      { body: { access_token: 'tok_live' } },
      { body: { id: 'u1', email: 'ana@cortex.foundation' } },
    ]);

    const statuses: CortexDeviceStatus[] = [];
    host.onDeviceStatus((status) => statuses.push(status));
    const changed: Array<string | null> = [];
    host.onAccountChanged((state) => changed.push(state.user?.id ?? null));

    await host.startDeviceFlow();
    await settle();
    await settle();

    expect(statuses.at(-1)).toEqual({
      kind: 'authorized',
      user: { id: 'u1', email: 'ana@cortex.foundation' },
    });
    expect(changed).toEqual(['u1']);
    expect(client.isAuthenticated).toBe(true);
    // The token is applied to the client and nowhere else.
    expect(globalThis.localStorage?.getItem('cortex.token')).toBeNull();
  });

  it('reports a declined sign-in as denied rather than as an error', async () => {
    const { host } = hostWith([
      {
        body: {
          user_code: 'AAAA-BBBB',
          device_code: 'dc',
          verification_uri: 'https://auth.cortex.foundation/device',
          expires_in: 900,
          interval: 0,
        },
      },
      { status: 400, body: { error: 'access_denied' } },
    ]);

    const statuses: CortexDeviceStatus[] = [];
    host.onDeviceStatus((status) => statuses.push(status));

    await host.startDeviceFlow();
    await settle();
    await settle();

    expect(statuses.at(-1)).toEqual({ kind: 'denied' });
  });

  it('opens the verification page only while a flow is in progress', async () => {
    const openUrl = vi.fn();
    const { host } = hostWith(
      [
        {
          body: {
            user_code: 'AAAA-BBBB',
            device_code: 'dc',
            verification_uri: 'https://auth.cortex.foundation/device',
            expires_in: 900,
            interval: 0,
          },
        },
        { status: 400, body: { error: 'authorization_pending' } },
      ],
      openUrl,
    );

    // Nothing started yet, so it reports false instead of appearing to work.
    await expect(host.openVerificationPage()).resolves.toBe(false);

    await host.startDeviceFlow();
    await expect(host.openVerificationPage()).resolves.toBe(true);
    expect(openUrl).toHaveBeenCalledWith('https://auth.cortex.foundation/device');
    await host.cancelDeviceFlow();
  });

  it('forgets its credentials even when logout fails', async () => {
    const { fetch } = stubFetch([{ status: 500, body: { code: 'BOOM', message: 'nope' } }]);
    const client = new CortexApiClient({ fetch, credentials: { accessToken: 'tok' } });
    const host = createCloudHost({ client });

    const state = await host.signOut();

    // Leaving the session in place would show a signed-in UI for a session the
    // user asked to end.
    expect(client.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('maps API keys and shows a created key exactly once', async () => {
    const { host } = hostWith([
      { body: [{ id: 'key_1', name: 'CI', last_four: '4242' }] },
      { body: { id: 'key_2', name: 'Laptop', key: 'sk-live-once' } },
      { status: 204 },
    ]);

    await expect(host.listApiKeys()).resolves.toEqual([
      { id: 'key_1', name: 'CI', lastFour: '4242' },
    ]);
    await expect(host.createApiKey('Laptop')).resolves.toEqual({
      id: 'key_2',
      name: 'Laptop',
      key: 'sk-live-once',
    });
    await expect(host.revokeApiKey('key_2')).resolves.toBeUndefined();
  });

  it('reports a product call as a status the caller can branch on', async () => {
    const { host, calls } = hostWith([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'nope' } },
    ]);

    const response = await host.productRequest({ method: 'POST', path: '/v1/mascots', body: { a: 1 } });

    // A 404 arrives as data, not as a throw: "no such route" is a state the UI renders.
    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toBe('req-test-0001');
    expect(JSON.parse(response.bodyText)).toMatchObject({ code: 'not_found' });
    expect(calls[0]!.body).toEqual({ a: 1 });
  });

  it('unsubscribes both listener kinds', () => {
    const { host } = hostWith([]);
    expect(host.onDeviceStatus(() => {})()).toBe(true);
    expect(host.onAccountChanged(() => {})()).toBe(true);
  });
});
