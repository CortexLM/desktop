/**
 * Typed client for the Cortex API.
 *
 * Deliberately has no bearer-token mode. The service rejects `Authorization: Bearer` with
 * "Bearer JWT session auth is disabled; use WorkOS sealed session cookie or API key", so
 * offering one would only produce a confusing 401 at runtime. Credentials are either an
 * API key in `x-api-key` or a WorkOS sealed session cookie.
 *
 * Only the routes whose responses were actually observed are modelled as methods. The rest
 * exist but their shapes are unknown, so `request` is the typed escape hatch rather than a
 * set of invented signatures that would fail in production. See CONTRACT.md.
 */

import type { z } from 'zod';

import {
  CortexApiError,
  CortexDeviceFlowError,
  isDeviceFlowErrorCode,
  type CortexErrorContext,
} from './errors.ts';
import {
  applicationErrorSchema,
  chatCompletionSchema,
  cortexUserSchema,
  deviceCodeSchema,
  deviceTokenSchema,
  healthSchema,
  modelListSchema,
  oauthErrorSchema,
  organizationSchema,
  upstreamProviderListSchema,
  type ChatCompletion,
  type ChatCompletionRequest,
  type CortexModel,
  type CortexUser,
  type DeviceCode,
  type DeviceToken,
  type Health,
  type Organization,
  type UpstreamProvider,
} from './schemas.ts';

export const CORTEX_API_BASE_URL = 'https://api.cortex.foundation';

/** Header the service reads an API key from. */
const API_KEY_HEADER = 'x-api-key';
/** Header that scopes a request to one organisation. */
const ORGANIZATION_HEADER = 'x-organization-id';
/** Present on every response; the only handle support has on a failed call. */
const REQUEST_ID_HEADER = 'x-request-id';

export interface CortexCredentials {
  /** Sent as `x-api-key`. */
  apiKey?: string;
  /**
   * A WorkOS sealed session cookie, as `name=value`. In Electron the cookie jar usually
   * carries this automatically; this is for contexts where it has to be passed explicitly.
   */
  sessionCookie?: string;
}

export interface CortexApiClientOptions {
  baseUrl?: string;
  credentials?: CortexCredentials;
  /** Scopes requests to one organisation via `x-organization-id`. */
  organizationId?: string;
  /** Injected for tests and for Electron's net stack. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Per-request timeout. Long enough for a cold model start, short enough to not hang. */
  timeoutMs?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  /** Extra headers; merged over the client's defaults. */
  headers?: Record<string, string>;
  /** Skips credential headers. Used by the device flow, which runs before there are any. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export class CortexApiClient {
  readonly baseUrl: string;
  private credentials: CortexCredentials;
  private organizationId?: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: CortexApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? CORTEX_API_BASE_URL).replace(/\/+$/, '');
    this.credentials = options.credentials ?? {};
    this.organizationId = options.organizationId;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  /** True when the client has something to authenticate with. */
  get isAuthenticated(): boolean {
    return Boolean(this.credentials.apiKey ?? this.credentials.sessionCookie);
  }

  setCredentials(credentials: CortexCredentials): void {
    this.credentials = credentials;
  }

  clearCredentials(): void {
    this.credentials = {};
  }

  setOrganization(organizationId: string | undefined): void {
    this.organizationId = organizationId;
  }

  private buildHeaders(options: RequestOptions): Headers {
    const headers = new Headers({ Accept: 'application/json' });
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');

    if (!options.anonymous) {
      if (this.credentials.apiKey) headers.set(API_KEY_HEADER, this.credentials.apiKey);
      if (this.credentials.sessionCookie) headers.set('Cookie', this.credentials.sessionCookie);
      if (this.organizationId) headers.set(ORGANIZATION_HEADER, this.organizationId);
    }

    for (const [name, value] of Object.entries(options.headers ?? {})) {
      headers.set(name, value);
    }
    return headers;
  }

  /**
   * Turns a non-2xx response into the right error class.
   *
   * The two shapes are not interchangeable: a device endpoint returning
   * `{error: "authorization_pending"}` with HTTP 400 is the expected state during a device
   * flow, whereas `{code: "AUTH_REQUIRED"}` is a genuine failure. Discriminating on the
   * body rather than the status is what lets the poll loop tell them apart.
   */
  private async toError(response: Response, route: string): Promise<Error> {
    const context: CortexErrorContext = {
      status: response.status,
      requestId: response.headers.get(REQUEST_ID_HEADER) ?? undefined,
      route,
    };

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return new CortexApiError(
        'UNPARSEABLE_ERROR',
        `${response.status} ${response.statusText || 'error'} with a non-JSON body`,
        context,
      );
    }

    const oauth = oauthErrorSchema.safeParse(payload);
    if (oauth.success && isDeviceFlowErrorCode(oauth.data.error)) {
      return new CortexDeviceFlowError(
        oauth.data.error,
        oauth.data.error_description ?? oauth.data.error,
        context,
      );
    }

    const application = applicationErrorSchema.safeParse(payload);
    if (application.success) {
      return new CortexApiError(application.data.code, application.data.message, context);
    }

    if (oauth.success) {
      // `/auth/callback` returns both keys:
      //   { "error": "Missing authorization code", "code": "missing_code" }
      // Here `code` is the machine-readable identifier and `error` is the human message,
      // which is the opposite of how the device endpoints use them. When both are present,
      // prefer `code`, so callers can branch on a stable string rather than prose.
      const hybrid = payload as { code?: unknown };
      const code = typeof hybrid.code === 'string' ? hybrid.code : oauth.data.error;
      const message = oauth.data.error_description ?? oauth.data.error;
      return new CortexApiError(code, message, context);
    }

    return new CortexApiError(
      'UNKNOWN_ERROR',
      `${response.status} ${response.statusText || 'error'}`,
      context,
    );
  }

  /** Issues a request and validates the response against a schema. */
  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const route = `${method} ${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    // A caller-supplied signal has to compose with the timeout, not replace it.
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: this.buildHeaders(options),
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        // Sends and stores the WorkOS sealed session cookie in contexts that have a jar.
        credentials: 'include',
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new CortexApiError(
        aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        aborted
          ? `${route} timed out after ${this.timeoutMs}ms`
          : `${route} failed to reach ${this.baseUrl}: ${String(error)}`,
        { status: 0, route },
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }

    if (!response.ok) throw await this.toError(response, route);

    const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new CortexApiError(
        'UNPARSEABLE_RESPONSE',
        `${route} returned a body that is not JSON: ${String(error)}`,
        { status: response.status, requestId, route },
      );
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      // A schema mismatch means the contract moved. Surfacing the request id makes the
      // offending call findable in the service's logs.
      throw new CortexApiError(
        'SCHEMA_MISMATCH',
        `${route} returned a payload this client does not understand: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || '<root>'} ${issue.message}`)
          .join('; ')}`,
        { status: response.status, requestId, route },
      );
    }

    return parsed.data;
  }

  /* ---------------------------------------------------------------------- */
  /* Public routes                                                          */
  /* ---------------------------------------------------------------------- */

  /** `/health` needs no credentials, which makes it a usable reachability probe. */
  health(signal?: AbortSignal): Promise<Health> {
    return this.request('/health', healthSchema, { anonymous: true, signal });
  }

  /**
   * The model catalogue is public. That is what lets a signed-out client render the real
   * Cortex model list with premium entries marked locked, instead of an empty picker.
   */
  async listModels(signal?: AbortSignal): Promise<CortexModel[]> {
    const list = await this.request('/v1/models', modelListSchema, { anonymous: true, signal });
    return list.data;
  }

  /** Upstream providers Cortex itself routes through. Public. */
  listUpstreamProviders(signal?: AbortSignal): Promise<UpstreamProvider[]> {
    return this.request('/v1/providers', upstreamProviderListSchema, {
      anonymous: true,
      signal,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Device authorisation (RFC 8628)                                         */
  /* ---------------------------------------------------------------------- */

  /** Starts a device flow. Runs anonymously: there are no credentials yet. */
  startDeviceAuthorization(signal?: AbortSignal): Promise<DeviceCode> {
    return this.request('/auth/device/code', deviceCodeSchema, {
      method: 'POST',
      body: {},
      anonymous: true,
      signal,
    });
  }

  /**
   * Exchanges a device code for a token.
   *
   * Throws `CortexDeviceFlowError` with `isPending` while the user has not approved yet -
   * which the service reports as HTTP 400. Callers should use `pollDeviceToken` rather than
   * driving this directly.
   */
  redeemDeviceCode(deviceCode: string, signal?: AbortSignal): Promise<DeviceToken> {
    return this.request('/auth/device/token', deviceTokenSchema, {
      method: 'POST',
      body: { device_code: deviceCode },
      anonymous: true,
      signal,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Session                                                                */
  /* ---------------------------------------------------------------------- */

  currentUser(signal?: AbortSignal): Promise<CortexUser> {
    return this.request('/auth/me', cortexUserSchema, { signal });
  }

  listOrganizations(signal?: AbortSignal): Promise<Organization[]> {
    return this.request('/organizations', organizationSchema.array(), { signal });
  }

  logout(signal?: AbortSignal): Promise<CortexUser> {
    return this.request('/auth/logout', cortexUserSchema, { method: 'POST', body: {}, signal });
  }

  /**
   * URL to open in the system browser for the redirect sign-in path.
   *
   * The WorkOS client id and redirect URI are baked into the service's 307, so the desktop
   * app never needs to know them.
   */
  get loginUrl(): string {
    return `${this.baseUrl}/auth/login`;
  }

  /* ---------------------------------------------------------------------- */
  /* Inference                                                              */
  /* ---------------------------------------------------------------------- */

  /** OpenAI-compatible, authenticated. For streaming use `streamChatCompletion`. */
  createChatCompletion(
    body: ChatCompletionRequest,
    signal?: AbortSignal,
  ): Promise<ChatCompletion> {
    return this.request('/v1/chat/completions', chatCompletionSchema, {
      method: 'POST',
      body: { ...body, stream: false },
      signal,
    });
  }

  /**
   * Streams a completion as server-sent events.
   *
   * Not routed through `request`, which parses a whole JSON body: consuming a stream means
   * reading the response incrementally, and buffering it first would defeat the point.
   */
  async *streamChatCompletion(
    body: ChatCompletionRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<unknown, void, undefined> {
    const route = 'POST /v1/chat/completions';
    const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders({ body, headers: { Accept: 'text/event-stream' } }),
      body: JSON.stringify({ ...body, stream: true }),
      signal,
      credentials: 'include',
    });

    if (!response.ok) throw await this.toError(response, route);
    if (!response.body) {
      throw new CortexApiError('NO_STREAM_BODY', `${route} returned no readable body`, {
        status: response.status,
        requestId: response.headers.get(REQUEST_ID_HEADER) ?? undefined,
        route,
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line; a partial frame stays in the buffer until
        // the rest of it arrives.
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');

          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '' || data === '[DONE]') continue;
            try {
              yield JSON.parse(data);
            } catch {
              // A malformed frame is not worth aborting a live stream for; the caller sees
              // the frames that did parse.
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
