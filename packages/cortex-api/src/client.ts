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
  /**
   * The `access_token` returned by the device flow, sent as the sealed session cookie.
   *
   * Why a cookie and not `Authorization: Bearer` — the service refuses bearer tokens
   * outright:
   *
   *   Authorization: Bearer x  ->  {"code":"INVALID_SESSION",
   *                                 "message":"Bearer JWT session auth is disabled;
   *                                            use WorkOS sealed session cookie or API key"}
   *
   * So the token has to travel as one of the two accepted modes. It is a session, not an
   * API key, and probing named the cookie: `wos-session` is recognised and rejected on its
   * *contents* (`{"code":"INVALID_SESSION","message":"invalid_session_cookie"}`), whereas
   * `workos-session` and any other name fall through to `AUTH_REQUIRED` — i.e. they are not
   * read at all. Only a recognised name can produce an unseal failure.
   *
   * Kept distinct from `sessionCookie` (which carries a full `name=value`) so callers do
   * not have to know the cookie name to use a token the device flow just handed them.
   */
  accessToken?: string;
}

/**
 * Name of the WorkOS sealed session cookie.
 *
 * Established by probing, not assumed — see `CortexCredentials.accessToken`.
 */
export const SESSION_COOKIE_NAME = 'wos-session';

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

      // An explicit `sessionCookie` wins: it carries a full `name=value` the caller chose,
      // so overriding it with a token we wrapped ourselves would discard their intent.
      const cookie =
        this.credentials.sessionCookie ??
        (this.credentials.accessToken
          ? `${SESSION_COOKIE_NAME}=${this.credentials.accessToken}`
          : undefined);
      if (cookie) headers.set('Cookie', cookie);

      if (this.organizationId) headers.set(ORGANIZATION_HEADER, this.organizationId);
    }

    for (const [name, value] of Object.entries(options.headers ?? {})) {
      headers.set(name, value);
    }
    return headers;
  }

  /**
   * Turns a parsed error body into the right error class.
   *
   * The two shapes are not interchangeable: a device endpoint returning
   * `{error: "authorization_pending"}` with HTTP 400 is the expected state during a device
   * flow, whereas `{code: "AUTH_REQUIRED"}` is a genuine failure. Discriminating on the
   * body rather than the status is what lets the poll loop tell them apart.
   */
  private static classifyError(payload: unknown, context: CortexErrorContext): Error {
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
      return new CortexApiError(code, oauth.data.error_description ?? oauth.data.error, context);
    }

    return new CortexApiError(
      'UNKNOWN_ERROR',
      `${context.status} unrecognised error body`,
      context,
    );
  }

  private errorContext(response: Response, route: string): CortexErrorContext {
    return {
      status: response.status,
      requestId: response.headers.get(REQUEST_ID_HEADER) ?? undefined,
      route,
    };
  }

  /** Reads and classifies a non-2xx response. */
  private async toError(response: Response, route: string): Promise<Error> {
    const context = this.errorContext(response, route);

    try {
      return CortexApiClient.classifyError(await response.json(), context);
    } catch {
      return new CortexApiError(
        'UNPARSEABLE_ERROR',
        `${response.status} ${response.statusText || 'error'} with a non-JSON body`,
        context,
      );
    }
  }

  /**
   * Performs the fetch, translating transport failures into API errors.
   *
   * A caller-supplied signal has to compose with the timeout rather than replace it, which
   * is why both feed one controller.
   */
  private async send(path: string, route: string, options: RequestOptions): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
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
  }

  /** Reads a 2xx body and validates it against a schema. */
  private async parse<T>(response: Response, schema: z.ZodType<T>, route: string): Promise<T> {
    const context = this.errorContext(response, route);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new CortexApiError(
        'UNPARSEABLE_RESPONSE',
        `${route} returned a body that is not JSON: ${String(error)}`,
        context,
      );
    }

    const parsed = schema.safeParse(payload);
    if (parsed.success) return parsed.data;

    // A schema mismatch means the contract moved. Surfacing the request id makes the
    // offending call findable in the service's logs.
    throw new CortexApiError(
      'SCHEMA_MISMATCH',
      `${route} returned a payload this client does not understand: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'} ${issue.message}`)
        .join('; ')}`,
      context,
    );
  }

  /** Issues a request and validates the response against a schema. */
  async request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    const route = `${options.method ?? 'GET'} ${path}`;
    const response = await this.send(path, route, options);

    if (!response.ok) throw await this.toError(response, route);
    return this.parse(response, schema, route);
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
      throw new CortexApiError(
        'NO_STREAM_BODY',
        `${route} returned no readable body`,
        this.errorContext(response, route),
      );
    }

    yield* readEventStream(response.body);
  }
}

/**
 * Yields the parsed payload of each `data:` line in a server-sent event stream.
 *
 * A real socket does not respect frame boundaries, so a partial frame has to survive in the
 * buffer until the rest of it arrives.
 */
async function* readEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        yield* parseEventFrame(frame);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function* parseEventFrame(frame: string): Generator<unknown, void, undefined> {
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data:')) continue;

    const data = line.slice(5).trim();
    if (data === '' || data === '[DONE]') continue;

    try {
      yield JSON.parse(data);
    } catch {
      // A malformed frame is not worth aborting a live stream for; the caller still sees
      // the frames that did parse.
    }
  }
}
