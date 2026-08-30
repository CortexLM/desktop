/**
 * The renderer's view of the account host.
 *
 * In Electron the renderer cannot reach `api.cortex.foundation` itself. It is loaded from
 * `file://`, so its origin is opaque and the CORS preflight rejects the request before it is
 * sent — not something a header can fix. Every call goes through the main process, which has
 * no origin.
 *
 * On the web there is no such problem: a `cortex.foundation` origin calls the API directly
 * through `createCloudHost`. Which host `resolveHost` returns is the difference between a
 * browser that can sign in and one that cannot.
 *
 * This module is the seam. Screens depend on `CortexHost`, not on `window.cortex`, which is
 * what lets the suites drive them with a fake and keeps `window` out of component code.
 *
 * No method returns a token. Signing in yields a user code and a verification URL — both
 * meant to be displayed — and the outcome arrives through `onDeviceStatus`. The
 * `device_code`, which is exchangeable for a token, never leaves the host that holds it.
 */

import type {
  CortexAccountState,
  CortexDeviceStartResponse,
  CortexDeviceStatus,
  CortexModelView,
  CortexProductRequest,
  CortexProductResponse,
  IPCResponse,
} from '@cortex-ide/shared';

import { createCloudHost } from './cloud-host.ts';
import { hasElectronHost } from './electron-bridge.ts';
import { liveSession } from './realtime-session.ts';

export interface CortexHost {
  getState(): Promise<CortexAccountState>;
  /** The catalogue. Public, so it loads signed out as well as signed in. */
  listModels(): Promise<{ models: CortexModelView[]; error?: string }>;
  startDeviceFlow(): Promise<CortexDeviceStartResponse>;
  cancelDeviceFlow(): Promise<void>;
  /**
   * Opens the approval page in the system browser.
   *
   * Takes no URL: main opens the one from the flow it started. Resolves `false` when there
   * is no flow in progress, so the screen can say so rather than appear to have worked.
   */
  openVerificationPage(): Promise<boolean>;
  signOut(): Promise<CortexAccountState>;
  startBrowserLogin(provider: 'google' | 'github'): Promise<boolean>;
  /** In-app email form. Password crosses to main once and is never returned. */
  signInWithEmail(email: string, password: string): Promise<CortexAccountState>;
  /** The account's API keys. Empty when signed out — the screen gates the section. */
  listApiKeys(): Promise<Array<{ id: string; name: string; lastFour?: string }>>;
  /**
   * Creates a key.
   *
   * `key` comes back only here: a service that hashes its keys shows the value once.
   * The caller has to display it immediately, because there is no second chance.
   */
  createApiKey(name: string): Promise<{ id: string; name: string; key?: string }>;
  revokeApiKey(id: string): Promise<void>;
  productRequest(request: CortexProductRequest): Promise<CortexProductResponse>;
  onDeviceStatus(listener: (status: CortexDeviceStatus) => void): () => void;
  onAccountChanged(listener: (state: CortexAccountState) => void): () => void;
  onAuthComplete(listener: (event: { ok: boolean; message?: string }) => void): () => void;
}

/** The shape the preload bridge exposes. Declared structurally to avoid importing preload. */
interface CortexBridge {
  getState(): Promise<IPCResponse<CortexAccountState>>;
  listModels(): Promise<IPCResponse<{ models: CortexModelView[]; error?: string }>>;
  deviceStart(): Promise<IPCResponse<CortexDeviceStartResponse>>;
  deviceCancel(): Promise<IPCResponse<{ cancelled: true }>>;
  openVerification(): Promise<IPCResponse<{ opened: boolean }>>;
  signOut(): Promise<IPCResponse<CortexAccountState>>;
  startBrowserLogin(request: {
    provider: 'google' | 'github';
  }): Promise<IPCResponse<{ opened: boolean }>>;
  signInWithEmail(request: {
    email: string;
    password: string;
  }): Promise<IPCResponse<CortexAccountState>>;
  listApiKeys(): Promise<
    IPCResponse<{ keys: Array<{ id: string; name: string; lastFour?: string }> }>
  >;
  createApiKey(request: {
    name: string;
  }): Promise<IPCResponse<{ key: { id: string; name: string; key?: string } }>>;
  revokeApiKey(request: { id: string }): Promise<IPCResponse<{ revoked: true }>>;
  productRequest(request: CortexProductRequest): Promise<IPCResponse<CortexProductResponse>>;
  onDeviceStatus(callback: (event: { status: CortexDeviceStatus }) => void): () => void;
  onAccountChanged(callback: (state: CortexAccountState) => void): () => void;
  onAuthComplete(callback: (event: { ok: boolean; message?: string }) => void): () => void;
}

/**
 * Unwraps the `{ success, data }` envelope every handler returns.
 *
 * Throws on failure rather than returning a sentinel, so a caller cannot accidentally treat
 * an error as data. The message is the one main produced, which is the only description of
 * the failure the renderer has.
 */
function unwrap<T>(response: IPCResponse<T>): T {
  if (response.success) return response.data;
  throw new Error(response.error.message);
}

function bridge(): CortexBridge | undefined {
  return (globalThis as { cortex?: { cortex?: CortexBridge } }).cortex?.cortex;
}

export { hasElectronHost };

function electronHost(api: CortexBridge): CortexHost {
  return {
    getState: async () => unwrap(await api.getState()),
    listModels: async () => unwrap(await api.listModels()),
    startDeviceFlow: async () => unwrap(await api.deviceStart()),
    cancelDeviceFlow: async () => {
      unwrap(await api.deviceCancel());
    },
    openVerificationPage: async () => unwrap(await api.openVerification()).opened,
    signOut: async () => unwrap(await api.signOut()),
    startBrowserLogin: async (provider) => unwrap(await api.startBrowserLogin({ provider })).opened,
    signInWithEmail: async (email, password) =>
      unwrap(await api.signInWithEmail({ email, password })),
    listApiKeys: async () => unwrap(await api.listApiKeys()).keys,
    createApiKey: async (name) => unwrap(await api.createApiKey({ name })).key,
    revokeApiKey: async (id) => {
      unwrap(await api.revokeApiKey({ id }));
    },
    productRequest: async (request) => unwrap(await api.productRequest(request)),
    onDeviceStatus: (listener) => api.onDeviceStatus((event) => listener(event.status)),
    onAccountChanged: (listener) => api.onAccountChanged(listener),
    onAuthComplete: (listener) => api.onAuthComplete(listener),
  };
}

/**
 * The host used when the bridge is absent: the Vitest suites and the preview server that
 * the Paper parity screenshots are taken against.
 *
 * It reports `reachable: false` rather than pretending to be signed out, because those are
 * different situations and the UI says different things about them. Signing in rejects with
 * a message that names the real cause, instead of hanging on a promise that cannot settle.
 */
export function detachedHost(): CortexHost {
  const unavailable = () => new Error('The Cortex API is only reachable from the desktop app');

  return {
    getState: async () => ({ user: null, reachable: false, credentialsEncrypted: false }),
    listModels: async () => ({ models: [], error: unavailable().message }),
    startDeviceFlow: () => Promise.reject(unavailable()),
    cancelDeviceFlow: async () => {},
    openVerificationPage: async () => false,
    signOut: async () => ({ user: null, reachable: false, credentialsEncrypted: false }),
    startBrowserLogin: () => Promise.reject(unavailable()),
    signInWithEmail: () => Promise.reject(unavailable()),
    listApiKeys: async () => [],
    createApiKey: () => Promise.reject(unavailable()),
    revokeApiKey: () => Promise.reject(unavailable()),
    productRequest: () => Promise.reject(unavailable()),
    onDeviceStatus: () => () => {},
    onAccountChanged: () => () => {},
    onAuthComplete: () => () => {},
  };
}

/**
 * The host for the current environment.
 *
 * Electron first: main already holds the session, encrypted at rest, and its
 * cookie jar is the one the service set. A browser on an origin allowed to call
 * the API gets the cloud host — the same `CortexApiClient` the Chat, Code, and
 * Bot surfaces use, so a device flow completing here authenticates all of them.
 * Everything else is detached and says so.
 */
export function resolveHost(): CortexHost {
  const api = bridge();
  if (api) return electronHost(api);

  const live = liveSession();
  return live ? createCloudHost({ client: live.client }) : detachedHost();
}
