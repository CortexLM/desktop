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

import { classifyError } from './classify.ts';
import { cookieHeader, GUEST_COOKIE_NAME, SESSION_COOKIE_NAME } from './cookies.ts';
import { unwrapList } from './envelopes.ts';
import { CortexApiError, type CortexErrorContext } from './errors.ts';
import { readEventStream } from './sse.ts';
import {
  apiKeyListSchema,
  apiKeySchema,
  unknownSchema,
  chatCompletionSchema,
  cortexUserSchema,
  deviceCodeSchema,
  deviceTokenSchema,
  healthSchema,
  modelListSchema,
  organizationSchema,
  upstreamProviderListSchema,
  type CortexApiKey,
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
export { GUEST_COOKIE_NAME, SESSION_COOKIE_NAME };



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
   * Not `Authorization: Bearer`, because the service refuses bearer tokens outright. It has
   * to travel as one of the two accepted modes, and it is a session rather than an API key.
   * The cookie name was established by probing the live service; CONTRACT.md records the
   * responses that identify it.
   *
   * Kept distinct from `sessionCookie` (a full `name=value`) so callers need not know the
   * cookie name to use a token the device flow just handed them.
   */
  accessToken?: string;
  /**
   * Guest session token from POST /v1/auth/guest, sent as `cortex_gt`.
   * Observed 2026-08-28. Not an API key.
   */
  guestToken?: string;
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
    return Boolean(
      this.credentials.apiKey ??
        this.credentials.sessionCookie ??
        this.credentials.accessToken ??
        this.credentials.guestToken,
    );
  }

  setCredentials(credentials: CortexCredentials): void {
    this.credentials = credentials;
  }

  /** Applies a `cortex_gt` value captured from Set-Cookie (Node / Electron). */
  applyGuestToken(token: string): void {
    this.credentials = { ...this.credentials, guestToken: token };
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
      const cookie = cookieHeader(this.credentials);
      if (cookie) headers.set('Cookie', cookie);

      if (this.organizationId) headers.set(ORGANIZATION_HEADER, this.organizationId);
    }

    for (const [name, value] of Object.entries(options.headers ?? {})) {
      headers.set(name, value);
    }
    return headers;
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
      return classifyError(await response.json(), context);
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

  /**
   * Performs the request and returns the Response if it is 2xx.
   *
   * Product streams (conversation turns) need headers and a body they can
   * consume incrementally, which `request` cannot give them.
   */
  async open(path: string, options: RequestOptions = {}): Promise<Response> {
    const route = `${options.method ?? 'GET'} ${path}`;
    const response = await this.send(path, route, options);
    if (!response.ok) throw await this.toError(response, route);
    return response;
  }

  /**
   * Same as `open`, but returns the Response on 4xx/5xx so a main-process
   * proxy can reconstruct it for the renderer without leaking credentials.
   */
  exchange(path: string, options: RequestOptions = {}): Promise<Response> {
    const route = `${options.method ?? 'GET'} ${path}`;
    return this.send(path, route, options);
  }

  /** Validates a 2xx JSON body. Public so product helpers can parse `open` results. */
  async readJson<T>(response: Response, schema: z.ZodType<T>, route: string): Promise<T> {
    return this.parse(response, schema, route);
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
    if (response.status === 204) return undefined as T;
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
    return this.request('/v1/me', cortexUserSchema, { signal });
  }

  /**
   * The account's API keys.
   *
   * Authenticated, so it only works signed in. `OPTIONS` on the route reports
   * `GET,POST,PUT,DELETE`, so the three methods below exist; their response shapes
   * could not be observed, because reaching them needs a session that only a human
   * approving a device flow can produce. The schemas are correspondingly lenient and
   * say so.
   */
  async listApiKeys(signal?: AbortSignal): Promise<CortexApiKey[]> {
    // The envelope is unwrapped before validation rather than matched by a union: a
    // bare array, `{ data: [...] }` and `{ api_keys: [...] }` are all common, the
    // shape could not be observed, and picking one would fail on the others with a
    // validation error instead of a useful message.
    const raw = await this.request('/auth/api-keys', unknownSchema, { signal });
    return apiKeyListSchema.parse(unwrapList(raw));
  }

  createApiKey(name: string, signal?: AbortSignal): Promise<CortexApiKey> {
    return this.request('/auth/api-keys', apiKeySchema, {
      method: 'POST',
      body: { name },
      signal,
    });
  }

  revokeApiKey(id: string, signal?: AbortSignal): Promise<void> {
    // `unknownSchema` rather than a shape: the response body is not read, and
    // declaring one would be inventing a contract for something ignored.
    return this.request(`/auth/api-keys/${encodeURIComponent(id)}`, unknownSchema, {
      method: 'DELETE',
      signal,
    }).then(() => undefined);
  }

  listOrganizations(signal?: AbortSignal): Promise<Organization[]> {
    return this.request('/organizations', organizationSchema.array(), { signal });
  }

  logout(signal?: AbortSignal): Promise<void> {
    return this.request('/v1/auth/logout', unknownSchema, {
      method: 'POST',
      body: {},
      signal,
    }).then(() => undefined);
  }

  /**
   * URL to open in the system browser for the redirect sign-in path.
   *
   * The WorkOS client id and redirect URI are baked into the service's 307, so the desktop
   * app never needs to know them.
   */
  get loginUrl(): string {
    return `${this.baseUrl}/v1/auth/login`;
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
