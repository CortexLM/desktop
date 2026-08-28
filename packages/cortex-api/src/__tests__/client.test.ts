import { describe, expect, it } from 'vitest';

import { CortexApiClient, CORTEX_API_BASE_URL } from '../client.ts';
import { CortexApiError, CortexDeviceFlowError } from '../errors.ts';
import {
  AUTHORIZATION_PENDING_RESPONSE,
  AUTH_REQUIRED_RESPONSE,
  DEVICE_CODE_RESPONSE,
  HEALTH_RESPONSE,
  MODELS_RESPONSE,
  PROVIDERS_RESPONSE,
  stubFetch,
} from './fixtures.ts';

describe('CortexApiClient configuration', () => {
  it('defaults to the production base url', () => {
    expect(new CortexApiClient().baseUrl).toBe('https://api.cortex.foundation');
    expect(CORTEX_API_BASE_URL).toBe('https://api.cortex.foundation');
  });

  it('strips a trailing slash so paths do not double up', () => {
    expect(new CortexApiClient({ baseUrl: 'https://example.test/' }).baseUrl).toBe(
      'https://example.test',
    );
  });

  it('is unauthenticated until given a credential', () => {
    const client = new CortexApiClient();
    expect(client.isAuthenticated).toBe(false);

    client.setCredentials({ apiKey: 'sk-test' });
    expect(client.isAuthenticated).toBe(true);

    client.clearCredentials();
    client.setCredentials({ guestToken: 'guest-test-token' });
    expect(client.isAuthenticated).toBe(true);

    client.clearCredentials();
    expect(client.isAuthenticated).toBe(false);
  });

  it('points the redirect sign-in path at the service, not at WorkOS', () => {
    // The service's 307 carries the WorkOS client id and redirect uri, so the desktop app
    // must never build a WorkOS url itself.
    expect(new CortexApiClient().loginUrl).toBe('https://api.cortex.foundation/v1/auth/login');
  });
});

describe('credential headers', () => {
  it('sends an API key as x-api-key, never as a bearer token', async () => {
    // The service replies "Bearer JWT session auth is disabled" to Authorization: Bearer,
    // so a bearer header would only produce a confusing 401.
    const { fetch, calls } = stubFetch([{ body: {} }]);
    const client = new CortexApiClient({ fetch, credentials: { apiKey: 'sk-live-abc' } });

    await client.currentUser().catch(() => undefined);

    expect(calls[0]!.headers['x-api-key']).toBe('sk-live-abc');
    expect(calls[0]!.headers.authorization).toBeUndefined();
  });

  it('sends a WorkOS sealed session cookie when given one', async () => {
    const { fetch, calls } = stubFetch([{ body: {} }]);
    const client = new CortexApiClient({
      fetch,
      credentials: { sessionCookie: 'wos-session=sealed-value' },
    });

    await client.currentUser().catch(() => undefined);

    expect(calls[0]!.headers.cookie).toBe('wos-session=sealed-value');
  });

  it('scopes requests to an organisation when one is selected', async () => {
    const { fetch, calls } = stubFetch([{ body: {} }, { body: {} }]);
    const client = new CortexApiClient({ fetch, credentials: { apiKey: 'sk' } });

    client.setOrganization('org_123');
    await client.currentUser().catch(() => undefined);
    expect(calls[0]!.headers['x-organization-id']).toBe('org_123');

    client.setOrganization(undefined);
    await client.currentUser().catch(() => undefined);
    expect(calls[1]!.headers['x-organization-id']).toBeUndefined();
  });

  it('omits credentials from the public routes', async () => {
    // /health and /v1/models answer without auth; sending a key would leak it to a route
    // that has no use for it.
    const { fetch, calls } = stubFetch([
      { body: HEALTH_RESPONSE },
      { body: MODELS_RESPONSE },
    ]);
    const client = new CortexApiClient({ fetch, credentials: { apiKey: 'sk-secret' } });

    await client.health();
    await client.listModels();

    for (const call of calls) {
      expect(call.headers['x-api-key']).toBeUndefined();
    }
  });
});

describe('public routes', () => {
  it('reads the health probe', async () => {
    const { fetch, calls } = stubFetch([{ body: HEALTH_RESPONSE }]);
    const health = await new CortexApiClient({ fetch }).health();

    expect(calls[0]!.url).toBe('https://api.cortex.foundation/health');
    expect(health).toMatchObject({ status: 'healthy', version: '1.1.0' });
  });

  it('unwraps the OpenAI-shaped model list', async () => {
    const { fetch, calls } = stubFetch([{ body: MODELS_RESPONSE }]);
    const models = await new CortexApiClient({ fetch }).listModels();

    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/models');
    expect(models.map((model) => model.id)).toEqual(['cortex-codex', 'cortex-opus']);
  });

  it('unwraps the v1 items envelope and keys models by slug', async () => {
    // The deployed v1 answers { items: [{ slug, … }], has_more } — observed live on
    // 2026-08-26. Both the envelope and the key are normalised so consumers only
    // ever see `data` rows with an `id`.
    const { fetch } = stubFetch([
      {
        body: {
          items: [
            {
              slug: 'cortex-1-mini',
              display_name: 'Cortex 1 Mini',
              description: 'Preview — the model Cortex is serving today.',
              context_tokens: 262144,
              max_output_tokens: 32768,
              supports_reasoning: true,
              supports_tools: true,
              supports_vision: false,
              is_preview: true,
            },
          ],
          has_more: false,
        },
      },
    ]);

    const models = await new CortexApiClient({ fetch }).listModels();

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: 'cortex-1-mini',
      display_name: 'Cortex 1 Mini',
      is_preview: true,
      supports_tools: true,
    });
  });

  it('keeps credit multipliers as strings', async () => {
    // They arrive as "0.600". Parsing to float would quietly lose precision on a value
    // that ends up on an invoice.
    const { fetch } = stubFetch([{ body: MODELS_RESPONSE }]);
    const [codex] = await new CortexApiClient({ fetch }).listModels();

    expect(codex!.credit_multiplier_input).toBe('0.600');
    expect(typeof codex!.credit_multiplier_input).toBe('string');
  });

  it('preserves the server-side lock verdict on premium models', async () => {
    const { fetch } = stubFetch([{ body: MODELS_RESPONSE }]);
    const models = await new CortexApiClient({ fetch }).listModels();
    const opus = models.find((model) => model.id === 'cortex-opus')!;

    expect(opus.is_premium).toBe(true);
    expect(opus.locked).toBe(true);
  });

  it('reads the upstream provider list', async () => {
    const { fetch } = stubFetch([{ body: PROVIDERS_RESPONSE }]);
    const providers = await new CortexApiClient({ fetch }).listUpstreamProviders();

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ name: 'openrouter', default: true, healthy: true });
  });

  it('tolerates a field the client has never seen', async () => {
    // The service versions independently; a backwards-compatible addition must not break
    // the app.
    const { fetch } = stubFetch([
      {
        body: {
          ...MODELS_RESPONSE,
          data: [{ ...MODELS_RESPONSE.data[0], some_future_field: 'value' }],
        },
      },
    ]);

    const models = await new CortexApiClient({ fetch }).listModels();
    expect(models[0]).toMatchObject({ id: 'cortex-codex', some_future_field: 'value' });
  });
});

describe('error discrimination', () => {
  it('raises an application error for the {code, message} shape', async () => {
    const { fetch } = stubFetch([{ status: 401, body: AUTH_REQUIRED_RESPONSE }]);
    const client = new CortexApiClient({ fetch });

    const error = await client.currentUser().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CortexApiError);
    expect((error as CortexApiError).code).toBe('AUTH_REQUIRED');
    expect((error as CortexApiError).isAuthFailure).toBe(true);
  });

  it('raises a device-flow error for the {error, error_description} shape', async () => {
    // Same HTTP 400 either way; only the body says which kind of failure it is.
    const { fetch } = stubFetch([{ status: 400, body: AUTHORIZATION_PENDING_RESPONSE }]);
    const client = new CortexApiClient({ fetch });

    const error = await client.redeemDeviceCode('device-code').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CortexDeviceFlowError);
    expect((error as CortexDeviceFlowError).isPending).toBe(true);
    expect((error as CortexDeviceFlowError).isTerminal).toBe(false);
  });

  it('surfaces the request id on every error', async () => {
    // It is the only handle support has on a failed call.
    const { fetch } = stubFetch([{ status: 500, body: { code: 'BOOM', message: 'nope' } }]);
    const client = new CortexApiClient({ fetch });

    const error = (await client.currentUser().catch((caught: unknown) => caught)) as CortexApiError;

    expect(error.requestId).toBe('req-test-0001');
    expect(error.route).toBe('GET /v1/me');
    expect(String(error)).toContain('req-test-0001');
  });

  it('marks 5xx and transport failures retryable, and 401 not', async () => {
    const server = new CortexApiError('BOOM', 'x', { status: 503 });
    const network = new CortexApiError('NETWORK_ERROR', 'x', { status: 0 });
    const auth = new CortexApiError('AUTH_REQUIRED', 'x', { status: 401 });

    expect(server.isRetryable).toBe(true);
    expect(network.isRetryable).toBe(true);
    expect(auth.isRetryable).toBe(false);
    expect(auth.isAuthFailure).toBe(true);
  });

  it('reports a schema mismatch rather than handing back a broken object', async () => {
    const { fetch } = stubFetch([{ body: { object: 'list' } }]);
    const client = new CortexApiClient({ fetch });

    const error = (await client.listModels().catch((caught: unknown) => caught)) as CortexApiError;

    expect(error.code).toBe('SCHEMA_MISMATCH');
    expect(error.message).toContain('data');
  });

  it('surfaces problem+json code and detail instead of "unrecognised error body"', async () => {
    // The v1 service answers RFC 7807 for routing-level failures — including
    // "No such endpoint" after the /auth/* contract moved (observed live).
    const { fetch } = stubFetch([
      {
        status: 404,
        body: {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'No such endpoint. See https://docs.cortex.foundation/api.',
          code: 'not_found',
        },
      },
    ]);
    const client = new CortexApiClient({ fetch });

    const error = (await client.currentUser().catch((caught: unknown) => caught)) as CortexApiError;

    expect(error).toBeInstanceOf(CortexApiError);
    expect(error.code).toBe('not_found');
    expect(error.message).toContain('No such endpoint');
  });

  it('reports a non-JSON error body without throwing on the parse', async () => {
    const { fetch } = stubFetch([{ status: 502, text: '<html>gateway</html>' }]);
    const client = new CortexApiClient({ fetch });

    const error = (await client.health().catch((caught: unknown) => caught)) as CortexApiError;

    expect(error.code).toBe('UNPARSEABLE_ERROR');
    expect(error.status).toBe(502);
  });

  it('reports a non-JSON success body as an unparseable response', async () => {
    const { fetch } = stubFetch([{ status: 200, text: 'not json' }]);
    const client = new CortexApiClient({ fetch });

    const error = (await client.health().catch((caught: unknown) => caught)) as CortexApiError;

    expect(error.code).toBe('UNPARSEABLE_RESPONSE');
  });

  it('turns a transport failure into a network error rather than leaking it', async () => {
    const fetchImpl = (() => Promise.reject(new Error('ECONNREFUSED'))) as typeof globalThis.fetch;
    const client = new CortexApiClient({ fetch: fetchImpl });

    const error = (await client.health().catch((caught: unknown) => caught)) as CortexApiError;

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBe(0);
    expect(error.isRetryable).toBe(true);
  });

  it('keeps a callback-shaped OAuth error usable as an application error', async () => {
    // /auth/callback returns {error, code} - OAuth-shaped but carrying an application code
    // that is not an RFC 8628 state.
    const { fetch } = stubFetch([
      { status: 400, body: { error: 'Missing authorization code', code: 'missing_code' } },
    ]);
    const client = new CortexApiClient({ fetch });

    const error = (await client.currentUser().catch((caught: unknown) => caught)) as CortexApiError;

    expect(error).toBeInstanceOf(CortexApiError);
    expect(error.code).toBe('missing_code');
  });
});

describe('device authorisation', () => {
  it('starts a flow without credentials', async () => {
    // There are none yet; that is the point of the flow.
    const { fetch, calls } = stubFetch([{ body: DEVICE_CODE_RESPONSE }]);
    const client = new CortexApiClient({ fetch, credentials: { apiKey: 'sk' } });

    const code = await client.startDeviceAuthorization();

    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toBe('https://api.cortex.foundation/auth/device/code');
    expect(calls[0]!.headers['x-api-key']).toBeUndefined();
    expect(code.user_code).toBe('AWTFR9HR');
    expect(code.verification_uri).toBe('https://auth.cortex.foundation/device');
  });

  it('posts the device code when redeeming', async () => {
    const { fetch, calls } = stubFetch([{ body: { access_token: 'tok' } }]);
    const client = new CortexApiClient({ fetch });

    const token = await client.redeemDeviceCode('the-device-code');

    expect(calls[0]!.body).toEqual({ device_code: 'the-device-code' });
    expect(token.access_token).toBe('tok');
  });
});

describe('chat completions', () => {
  it('forces stream off on the non-streaming path', async () => {
    const { fetch, calls } = stubFetch([
      { body: { id: 'c1', object: 'chat.completion', choices: [] } },
    ]);
    const client = new CortexApiClient({ fetch, credentials: { apiKey: 'sk' } });

    await client.createChatCompletion({
      model: 'cortex-codex',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });

    expect(calls[0]!.body).toMatchObject({ stream: false, model: 'cortex-codex' });
  });

  it('sends credentials on inference, unlike the public routes', async () => {
    const { fetch, calls } = stubFetch([
      { body: { id: 'c1', object: 'chat.completion', choices: [] } },
    ]);
    const client = new CortexApiClient({ fetch, credentials: { apiKey: 'sk-live' } });

    await client.createChatCompletion({
      model: 'cortex-codex',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(calls[0]!.headers['x-api-key']).toBe('sk-live');
  });

  it('yields parsed frames from a server-sent event stream', async () => {
    const stream = [
      'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"He"}}]}\n\n',
      'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"llo"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const fetchImpl = (async () =>
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })) as typeof globalThis.fetch;

    const client = new CortexApiClient({ fetch: fetchImpl, credentials: { apiKey: 'sk' } });

    const frames: unknown[] = [];
    for await (const frame of client.streamChatCompletion({
      model: 'cortex-codex',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      frames.push(frame);
    }

    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ id: 'c1' });
  });

  it('reassembles a frame split across chunk boundaries', async () => {
    // A real socket does not respect frame boundaries, so a partial frame has to survive
    // until the rest arrives.
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"id":"c1","obj'));
        controller.enqueue(encoder.encode('ect":"chunk","choices":[]}\n\n'));
        controller.close();
      },
    });

    const fetchImpl = (async () => new Response(body, { status: 200 })) as typeof globalThis.fetch;
    const client = new CortexApiClient({ fetch: fetchImpl, credentials: { apiKey: 'sk' } });

    const frames: unknown[] = [];
    for await (const frame of client.streamChatCompletion({
      model: 'cortex-codex',
      messages: [],
    })) {
      frames.push(frame);
    }

    expect(frames).toEqual([{ id: 'c1', object: 'chunk', choices: [] }]);
  });

  it('skips a malformed frame instead of aborting a live stream', async () => {
    const stream = 'data: {broken\n\ndata: {"id":"c2","object":"chunk","choices":[]}\n\n';
    const fetchImpl = (async () => new Response(stream, { status: 200 })) as typeof globalThis.fetch;
    const client = new CortexApiClient({ fetch: fetchImpl, credentials: { apiKey: 'sk' } });

    const frames: unknown[] = [];
    for await (const frame of client.streamChatCompletion({ model: 'm', messages: [] })) {
      frames.push(frame);
    }

    expect(frames).toEqual([{ id: 'c2', object: 'chunk', choices: [] }]);
  });

  it('raises the API error when a stream is rejected before it starts', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify(AUTH_REQUIRED_RESPONSE), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof globalThis.fetch;

    const client = new CortexApiClient({ fetch: fetchImpl });
    const iterator = client.streamChatCompletion({ model: 'm', messages: [] });

    const error = await iterator.next().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CortexApiError);
    expect((error as CortexApiError).code).toBe('AUTH_REQUIRED');
  });
});

describe('timeouts', () => {
  it('aborts a request that outlives the timeout', async () => {
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })) as typeof globalThis.fetch;

    const client = new CortexApiClient({ fetch: fetchImpl, timeoutMs: 10 });
    const error = (await client.health().catch((caught: unknown) => caught)) as CortexApiError;

    expect(error.code).toBe('TIMEOUT');
    expect(error.message).toContain('10ms');
  });

  it('composes a caller signal with the timeout rather than replacing it', async () => {
    const controller = new AbortController();
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })) as typeof globalThis.fetch;

    const client = new CortexApiClient({ fetch: fetchImpl, timeoutMs: 60_000 });
    const pending = client.health(controller.signal).catch((caught: unknown) => caught);
    controller.abort();

    expect(((await pending) as CortexApiError).code).toBe('TIMEOUT');
  });
});
