/**
 * The Plugins route, guest and all.
 *
 * The bug this suite exists for: Connect used to POST
 * `/v1/plugins/{slug}/connect` whatever the session was, so a guest got the
 * service's refusal — "a guest session cannot be signed back into to revoke it
 * later" — as an error, having already chosen an app. The API is right; the
 * client has to ask for the account first and then finish the job.
 *
 * These are the only plugin tests that exercise the store, the screen and the
 * router together, which is where that mistake actually lived: the screen alone
 * cannot tell you that Connect never reaches the network.
 */

import { render, screen, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';
import type { CortexAccountState, CortexUserView } from '@cortex-ide/shared';

import { setBotClientForTests } from '../../state/bot-client.ts';
import { forgetPluginConnect, pendingPluginConnect } from '../../state/pending-connect.ts';
import { resetPluginsForTests } from '../../state/plugins.ts';
import { AccountProvider } from '../../state/session-context.tsx';
import { detachedHost, type CortexHost } from '../../state/host.ts';
import { PluginsRoute } from '../chat-product-routes.tsx';
import { SignInRoute } from '../auth-routes.tsx';

const GUEST_REFUSAL = {
  status: 403,
  body: {
    type: 'https://docs.cortex.sh/problems/entitlement_required',
    title: 'Your plan does not include this',
    status: 403,
    code: 'entitlement_required',
    detail:
      'Connecting an app needs an account: a guest session cannot be signed back into to revoke it later. Sign in first.',
  },
};

const CATALOGUE = {
  body: {
    items: [{ slug: 'gmail', name: 'Gmail', description: 'Email.', category: 'email' }],
    is_live: true,
    provider: 'composio',
    source: 'marketplace',
  },
};

interface Reply {
  status?: number;
  body?: unknown;
}

/**
 * Routed by method and path, not by call order: the route reconciles on mount
 * and again after a successful connect, so an ordered queue would make each
 * assertion depend on how many times an effect happened to run.
 */
function routedFetch(routes: Record<string, Reply>) {
  const calls: Array<{ url: string; method: string }> = [];

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method });

    const key = Object.keys(routes).find((candidate) => {
      const [wanted, path] = candidate.split(' ');
      return wanted === method && url.endsWith(path!);
    });
    const reply = key ? routes[key]! : { status: 404, body: { code: 'not_found', message: url } };

    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls };
}

/** A host whose account can be changed mid-test, as a real sign-in does. */
function fakeHost(initial: CortexUserView | null) {
  const listeners = new Set<(state: CortexAccountState) => void>();
  let user = initial;

  const state = (): CortexAccountState => ({
    user,
    reachable: true,
    credentialsEncrypted: false,
  });

  const host: CortexHost = {
    ...detachedHost(),
    getState: async () => state(),
    listModels: async () => ({ models: [] }),
    onAccountChanged: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    host,
    signIn: () => {
      user = { id: 'usr_1', email: 'ada@example.com' };
      for (const listener of listeners) listener(state());
    },
  };
}

function mount(host: CortexHost, path = '/plugins') {
  const history = createMemoryHistory();
  history.set({ value: path, replace: true });

  return render(() => (
    <AccountProvider host={host}>
      <MemoryRouter history={history}>
        <Route path="/plugins" component={PluginsRoute} />
        <Route path="/sign-in" component={SignInRoute} />
        <Route path="/sign-in/device" component={() => <p>Device code</p>} />
        <Route path="/" component={() => <p>Home</p>} />
      </MemoryRouter>
    </AccountProvider>
  ));
}

const connectCalls = (calls: Array<{ url: string; method: string }>) =>
  calls.filter((call) => call.method === 'POST' && call.url.includes('/connect'));

beforeEach(() => {
  forgetPluginConnect();
  resetPluginsForTests();
});

afterEach(() => {
  setBotClientForTests(undefined);
  forgetPluginConnect();
  resetPluginsForTests();
});

describe('connecting an app as a guest', () => {
  it('opens sign-in instead of asking the API, and keeps the slug', async () => {
    const { fetch, calls } = routedFetch({
      'GET /v1/plugins/catalog': CATALOGUE,
      'GET /v1/plugins/connections': { body: { items: [], has_more: false } },
      'POST /v1/plugins/gmail/connect': GUEST_REFUSAL,
    });
    setBotClientForTests(new CortexApiClient({ fetch }));

    mount(fakeHost(null).host);

    const connect = await screen.findByRole('button', { name: 'Connect Gmail' });
    connect.click();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument());

    // The point of the fix: the refusal is never provoked, so it can never be shown.
    expect(connectCalls(calls)).toEqual([]);
    expect(screen.queryByText(/guest session/i)).toBeNull();
    expect(pendingPluginConnect()).toEqual({
      slug: 'gmail',
      surfaces: ['chat', 'bot'],
      returnTo: '/plugins',
    });
  });

  it('says up front why Connect will ask for an account', async () => {
    const { fetch } = routedFetch({
      'GET /v1/plugins/catalog': CATALOGUE,
      'GET /v1/plugins/connections': { body: { items: [], has_more: false } },
    });
    setBotClientForTests(new CortexApiClient({ fetch }));

    mount(fakeHost(null).host);

    expect(
      await screen.findByText('Connecting an app needs a Cortex account'),
    ).toBeInTheDocument();
  });

  it('finishes the connection it remembered, once there is an account', async () => {
    const { fetch, calls } = routedFetch({
      'GET /v1/plugins/catalog': CATALOGUE,
      'GET /v1/plugins/connections': { body: { items: [], has_more: false } },
      'POST /v1/plugins/gmail/connect': { body: { slug: 'gmail', status: 'connected' } },
    });
    setBotClientForTests(new CortexApiClient({ fetch }));

    const account = fakeHost(null);
    const view = mount(account.host);

    (await screen.findByRole('button', { name: 'Connect Gmail' })).click();
    await waitFor(() => expect(pendingPluginConnect()?.slug).toBe('gmail'));

    // The device flow completes elsewhere and pushes the new session, then sends
    // the user back to where they were. Both halves are simulated here.
    account.signIn();
    view.unmount();
    mount(account.host, pendingPluginConnect()!.returnTo);

    await waitFor(() => expect(connectCalls(calls)).toHaveLength(1));
    expect(connectCalls(calls)[0]!.url).toContain('/v1/plugins/gmail/connect');
    // Consumed, so a later visit does not connect an app nobody asked for again.
    expect(pendingPluginConnect()).toBeUndefined();
  });

  it('drops the pending connection when the user declines the account', async () => {
    const { fetch } = routedFetch({
      'GET /v1/plugins/catalog': CATALOGUE,
      'GET /v1/plugins/connections': { body: { items: [], has_more: false } },
    });
    setBotClientForTests(new CortexApiClient({ fetch }));

    mount(fakeHost(null).host);

    (await screen.findByRole('button', { name: 'Connect Gmail' })).click();
    const dismiss = await screen.findByRole('button', { name: 'Continue without an account' });
    dismiss.click();

    await waitFor(() => expect(pendingPluginConnect()).toBeUndefined());
  });
});

describe('connecting an app with an account', () => {
  it('opens sign-in when the service says the session is a guest after all', async () => {
    // The renderer can believe it is signed in while the service disagrees — a
    // stale session, or a guest cookie main never projected. The refusal still
    // has to become a sign-in rather than a message.
    const { fetch } = routedFetch({
      'GET /v1/plugins/catalog': CATALOGUE,
      'GET /v1/plugins/connections': { body: { items: [], has_more: false } },
      'POST /v1/plugins/gmail/connect': GUEST_REFUSAL,
    });
    setBotClientForTests(new CortexApiClient({ fetch }));

    mount(fakeHost({ id: 'usr_1', email: 'ada@example.com' }).host);

    (await screen.findByRole('button', { name: 'Connect Gmail' })).click();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument());
    expect(screen.queryByText(/guest session/i)).toBeNull();
  });

  it('shows a failure that signing in would not fix, and stays put', async () => {
    const { fetch } = routedFetch({
      'GET /v1/plugins/catalog': CATALOGUE,
      'GET /v1/plugins/connections': { body: { items: [], has_more: false } },
      'POST /v1/plugins/gmail/connect': {
        status: 503,
        body: { code: 'unavailable', message: 'The marketplace is not answering.' },
      },
    });
    setBotClientForTests(new CortexApiClient({ fetch }));

    mount(fakeHost({ id: 'usr_1', email: 'ada@example.com' }).host);

    (await screen.findByRole('button', { name: 'Connect Gmail' })).click();

    // The service's own message never reaches the page — it has been seen
    // carrying the name of the marketplace we install through.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Plugins are not available on this workspace right now.');
    expect(alert.textContent ?? '').not.toMatch(/marketplace is not answering/i);
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
  });
});
