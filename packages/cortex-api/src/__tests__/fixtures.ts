/**
 * Response fixtures for the Cortex API client tests.
 *
 * Credit multipliers and the device "not approved yet" HTTP 400 match the live
 * contract. Device-flow `user_code` / `device_code` values are invented fixtures,
 * not live credentials.
 */

export const HEALTH_RESPONSE = {
  status: 'healthy',
  version: '1.1.0',
  uptime_secs: 2177830,
} as const;

export const MODELS_RESPONSE = {
  object: 'list',
  data: [
    {
      id: 'cortex-codex',
      object: 'model',
      created: 1785464684,
      display_name: 'Cortex Codex',
      category: 'fast',
      is_premium: false,
      locked: false,
      cost_multiplier: 1.0,
      context_length: 128000,
      max_output_tokens: 16384,
      capabilities: {
        function_calling: true,
        json_mode: true,
        streaming: true,
        vision: true,
      },
      credit_multiplier_input: '0.600',
      credit_multiplier_output: '1.000',
      credit_multiplier_cached_input: '0.150',
      price_version: 1,
      stale: false,
    },
    {
      id: 'cortex-opus',
      object: 'model',
      created: 1785464684,
      display_name: 'Cortex Opus',
      category: 'reasoning',
      is_premium: true,
      locked: true,
      cost_multiplier: 2.5,
      context_length: 200000,
      max_output_tokens: 8192,
      capabilities: {
        function_calling: true,
        json_mode: true,
        streaming: true,
        vision: true,
      },
      credit_multiplier_input: '2.500',
      credit_multiplier_output: '4.000',
      credit_multiplier_cached_input: '0.250',
      price_version: 1,
      stale: false,
    },
  ],
} as const;

export const PROVIDERS_RESPONSE = [
  {
    name: 'openrouter',
    configured: true,
    default: true,
    healthy: true,
    active_model_count: 0,
  },
] as const;

export const DEVICE_CODE_RESPONSE = {
  user_code: 'TESTCODE',
  device_code: 'test-device-code-not-a-real-credential',
  verification_uri: 'https://auth.cortex.foundation/device',
  expires_in: 900,
  interval: 5,
} as const;

/** Arrives with HTTP 400 while the user has not approved the device. */
export const AUTHORIZATION_PENDING_RESPONSE = {
  error: 'authorization_pending',
  error_description: 'User has not yet authorized this device',
} as const;

export const AUTH_REQUIRED_RESPONSE = {
  code: 'AUTH_REQUIRED',
  message: 'Authentication required',
} as const;

/** What the service says when you try `Authorization: Bearer`. */
export const INVALID_SESSION_RESPONSE = {
  code: 'INVALID_SESSION',
  message: 'Bearer JWT session auth is disabled; use WorkOS sealed session cookie or API key',
} as const;

export interface StubCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface StubResponse {
  status?: number;
  body?: unknown;
  /** Raw text body, for exercising the non-JSON paths. */
  text?: string;
  headers?: Record<string, string>;
}

/**
 * A fetch stub that records calls and replays queued responses.
 *
 * Deliberately not a mock of the client: these tests exercise the real request building,
 * error discrimination and schema validation against real payloads. Only the socket is fake.
 */
/** Statuses the Response constructor refuses to pair with a body. */
const NO_BODY_STATUSES = new Set([204, 205, 304]);

export function stubFetch(responses: StubResponse[]): {
  fetch: typeof globalThis.fetch;
  calls: StubCall[];
} {
  const calls: StubCall[] = [];
  const queue = [...responses];

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => {
      headers[name] = value;
    });

    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });

    const next = queue.shift();
    if (!next) throw new Error(`stubFetch: no response queued for ${init?.method ?? 'GET'} ${String(input)}`);

    const status = next.status ?? 200;

    // 204 and 304 are defined to carry no body, and the Response constructor
    // throws rather than ignoring one — which surfaced as a bogus NETWORK_ERROR.
    // A DELETE answering 204 is the common case, so it has to be expressible.
    const body = NO_BODY_STATUSES.has(status)
      ? null
      : (next.text ?? JSON.stringify(next.body ?? {}));

    return new Response(body, {
      status,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'req-test-0001',
        ...next.headers,
      },
    });
  }) as typeof globalThis.fetch;

  return { fetch: fetchImpl, calls };
}
