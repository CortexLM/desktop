/**
 * The account host for the web app.
 *
 * Electron routes account calls through main because a `file://` renderer fails
 * CORS before the request leaves (see `host.ts`). A browser on a
 * `cortex.foundation` origin has none of that problem, so it talks to
 * `api.cortex.foundation` directly — and without this host it could not sign in
 * at all, because the detached fallback rejects every write.
 *
 * Two things stay out of storage on purpose:
 *
 *   - **The `device_code`.** It is the value exchangeable for a session, so it
 *     lives in a closure for the lifetime of one flow and is never returned to a
 *     caller, mirroring the guarantee main makes.
 *   - **The access token.** It is applied to the client's in-memory credentials
 *     and nothing else. Writing it to `localStorage` would leave a session token
 *     readable by any script on the origin, and it would outlive the tab; a
 *     reload re-reads `/v1/me`, which the `wos-session` cookie answers.
 *
 * `reachable` is reported honestly: a 401 means the backend answered and nobody
 * is signed in, whereas a transport failure means we do not know. The two get
 * different copy, so they must not collapse into one flag here.
 */

import {
  CortexDeviceFlowError,
  isCortexApiError,
  pollDeviceToken,
  type CortexApiClient,
  type CortexModel,
  type CortexUser,
  type DeviceCode,
} from '@cortex-ide/cortex-api';
import type {
  CortexAccountState,
  CortexDeviceStartResponse,
  CortexDeviceStatus,
  CortexModelView,
  CortexProductRequest,
  CortexProductResponse,
  CortexUserView,
} from '@cortex-ide/shared';

import type { CortexHost } from './host.ts';

/**
 * Projects the API user onto what the renderer may see.
 *
 * Deliberately a second copy of main's `toUserView`: the renderer cannot import
 * from the main process, and `@cortex-ide/cortex-api` does not depend on
 * `@cortex-ide/shared`. A suite asserts both produce the same projection so the
 * two cannot drift into showing different names for one account.
 */
export function toUserView(user: CortexUser): CortexUserView {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  const displayName = user.name?.trim() || (full.length > 0 ? full : undefined);

  const view: CortexUserView = { id: user.id ?? user.email ?? 'unknown' };
  if (user.email) view.email = user.email;
  if (displayName) view.displayName = displayName;
  if (user.profile_picture_url) view.avatarUrl = user.profile_picture_url;
  if (user.organization_id) view.organizationId = user.organization_id;
  return view;
}

/** `locked` is the server's expression of plan gating; it is carried, not recomputed. */
export function toModelView(model: CortexModel): CortexModelView {
  const view: CortexModelView = {
    id: model.id,
    requiresAccount: model.locked === true || model.is_premium === true,
  };
  if (model.display_name) view.displayName = model.display_name;

  const slash = model.id.indexOf('/');
  if (slash > 0) view.provider = model.id.slice(0, slash);
  return view;
}

/** A guest session is not an account: it must not light up account-only UI. */
function isRealAccount(user: CortexUser): boolean {
  return user.is_guest !== true;
}

interface Flow {
  code: DeviceCode;
  controller: AbortController;
}

export interface CloudHostOptions {
  client: CortexApiClient;
  /** Injected by the suites; defaults to opening a tab. */
  openUrl?: (url: string) => void;
  /** Injected by the suites so polling does not spend real seconds. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Reads the session.
 *
 * `credentialsEncrypted: false` is the truthful answer for a browser: there is no
 * OS keyring here, the session lives in an httpOnly cookie the tab cannot read,
 * and claiming encryption-at-rest for something we do not store would be a
 * security claim we cannot back.
 */
async function readState(client: CortexApiClient): Promise<CortexAccountState> {
  try {
    const user = await client.currentUser();
    return {
      user: isRealAccount(user) ? toUserView(user) : null,
      reachable: true,
      credentialsEncrypted: false,
    };
  } catch (error) {
    return {
      user: null,
      // An answered 4xx proves the service is up; only a transport failure leaves
      // us unable to say whether it is.
      reachable: isCortexApiError(error) ? error.status > 0 : false,
      credentialsEncrypted: false,
    };
  }
}

/** The API-key half. Split out to keep the host factory readable. */
function apiKeyMethods(
  client: CortexApiClient,
): Pick<CortexHost, 'listApiKeys' | 'createApiKey' | 'revokeApiKey'> {
  return {
    listApiKeys: async () => {
      const keys = await client.listApiKeys();
      return keys.map((key) => {
        const row: { id: string; name: string; lastFour?: string } = {
          id: key.id,
          name: key.name ?? 'Key',
        };
        if (key.last_four) row.lastFour = key.last_four;
        return row;
      });
    },
    createApiKey: async (name) => {
      const created = await client.createApiKey(name);
      const row: { id: string; name: string; key?: string } = {
        id: created.id,
        name: created.name ?? name,
      };
      // Shown once. The service hashes it, so there is no second chance to read it.
      if (created.key) row.key = created.key;
      return row;
    },
    revokeApiKey: (id) => client.revokeApiKey(id),
  };
}

/** A set of listeners plus the subscribe function screens hand to `onCleanup`. */
function channel<T>(): {
  emit: (value: T) => void;
  subscribe: (listener: (value: T) => void) => () => boolean;
} {
  const listeners = new Set<(value: T) => void>();
  return {
    emit: (value) => {
      for (const listener of listeners) listener(value);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Polls one flow to its conclusion and reports what happened.
 *
 * Detached from `startDeviceFlow` so the screen can paint the user code immediately
 * instead of waiting on a promise that only settles once the user has finished in
 * another tab.
 */
async function pollFlow(
  options: CloudHostOptions,
  current: Flow,
  emitDevice: (status: CortexDeviceStatus) => void,
  emitAccount: (state: CortexAccountState) => void,
): Promise<void> {
  const { client } = options;
  try {
    const token = await pollDeviceToken(client, current.code, {
      signal: current.controller.signal,
      ...(options.sleep ? { sleep: options.sleep } : {}),
      onState: (state) => {
        if (state.status === 'awaiting-authorization') emitDevice({ kind: 'pending' });
      },
    });
    client.setCredentials({ accessToken: token.access_token });
    const state = await readState(client);
    emitDevice(
      state.user
        ? { kind: 'authorized', user: state.user }
        : { kind: 'error', message: 'Signed in, but the account could not be read.' },
    );
    emitAccount(state);
  } catch (error) {
    emitDevice(deviceFailure(error));
  }
}

/** The device-flow half: start, cancel, and open the approval page. */
function deviceFlowMethods(
  options: CloudHostOptions,
  emitDevice: (status: CortexDeviceStatus) => void,
  emitAccount: (state: CortexAccountState) => void,
): Pick<CortexHost, 'startDeviceFlow' | 'cancelDeviceFlow' | 'openVerificationPage'> {
  const { client } = options;
  let flow: Flow | undefined;

  const watch = async (current: Flow): Promise<void> => {
    try {
      await pollFlow(options, current, emitDevice, emitAccount);
    } finally {
      if (flow === current) flow = undefined;
    }
  };

  return {
    startDeviceFlow: async () => {
      flow?.controller.abort();
      const code = await client.startDeviceAuthorization();
      const current: Flow = { code, controller: new AbortController() };
      flow = current;
      void watch(current);
      return toStartResponse(code);
    },

    cancelDeviceFlow: async () => {
      flow?.controller.abort();
      flow = undefined;
    },

    openVerificationPage: async () => {
      const url = flow?.code.verification_uri_complete ?? flow?.code.verification_uri;
      // No flow in progress, so it says so rather than appearing to have worked.
      if (!url) return false;
      (options.openUrl ?? defaultOpen)(url);
      return true;
    },
  };
}

export function createCloudHost(options: CloudHostOptions): CortexHost {
  const { client } = options;
  const device = channel<CortexDeviceStatus>();
  const account = channel<CortexAccountState>();

  return {
    ...apiKeyMethods(client),
    ...deviceFlowMethods(options, device.emit, account.emit),

    getState: () => readState(client),

    listModels: async () => {
      try {
        const models = await client.listModels();
        return { models: models.map(toModelView) };
      } catch (error) {
        // The catalogue failing must not take the app down: the picker falls back
        // to whatever the account can already use, same as the anonymous path.
        return { models: [], error: messageFor(error) };
      }
    },

    signOut: async () => {
      try {
        await client.logout();
      } catch {
        // A failed logout call still means this client should forget what it has;
        // leaving the credentials in place would show a signed-in UI for a
        // session the user asked to end.
      }
      client.clearCredentials();
      const state: CortexAccountState = {
        user: null,
        reachable: true,
        credentialsEncrypted: false,
      };
      account.emit(state);
      return state;
    },

    productRequest: (request: CortexProductRequest): Promise<CortexProductResponse> =>
      exchange(client, request),

    onDeviceStatus: device.subscribe,
    onAccountChanged: account.subscribe,
  };
}

function toStartResponse(code: DeviceCode): CortexDeviceStartResponse {
  const response: CortexDeviceStartResponse = {
    userCode: code.user_code,
    verificationUri: code.verification_uri,
    expiresIn: code.expires_in,
  };
  if (code.verification_uri_complete) {
    response.verificationUriComplete = code.verification_uri_complete;
  }
  return response;
}

function deviceFailure(error: unknown): CortexDeviceStatus {
  if (error instanceof CortexDeviceFlowError) {
    if (error.code === 'access_denied') return { kind: 'denied' };
    if (error.code === 'expired_token') return { kind: 'expired' };
  }
  return { kind: 'error', message: messageFor(error) };
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs a raw product call and reports the response rather than throwing.
 *
 * Mirrors main's `productRequest` channel so callers behave the same on both
 * surfaces: a 404 has to arrive as a status the caller can branch on, because
 * "this backend has no such route" is a state the UI renders.
 */
async function exchange(
  client: CortexApiClient,
  request: CortexProductRequest,
): Promise<CortexProductResponse> {
  const response = await client.exchange(request.path, {
    method: request.method,
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return { status: response.status, headers, bodyText: await response.text() };
}

function defaultOpen(url: string): void {
  globalThis.open?.(url, '_blank', 'noopener,noreferrer');
}
