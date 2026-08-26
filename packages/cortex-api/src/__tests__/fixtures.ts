/**
 * Response fixtures captured verbatim from https://api.cortex.foundation.
 *
 * These are real payloads, not invented ones. That matters for the two places the contract
 * is easy to get wrong: credit multipliers arrive as decimal strings, and the device
 * endpoints report "not approved yet" as an HTTP 400.
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
  user_code: 'AWTFR9HR',
  device_code: 'd1d93c54f2f73ac1112073976d9038cb9337ddac7126617e12b3e79a59e0b60a',
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
    const body = next.text ?? JSON.stringify(next.body ?? {});

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
