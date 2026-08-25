/**
 * The renderer's view of the Electron host.
 *
 * The renderer cannot reach `api.cortex.foundation` itself. It is loaded from `file://`, so
 * its origin is opaque and the CORS preflight rejects the request before it is sent — not
 * something a header can fix. Every call goes through the main process, which has no origin.
 *
 * This module is the seam. Screens depend on `CortexHost`, not on `window.cortex`, which is
 * what lets the suites drive them with a fake and keeps `window` out of component code.
 *
 * No method returns a token. Signing in yields a user code and a verification URL — both
 * meant to be displayed — and the outcome arrives through `onDeviceStatus`. The
 * `device_code`, which is exchangeable for a token, never leaves main.
 */

import type {
  CortexAccountState,
  CortexDeviceStartResponse,
  CortexDeviceStatus,
  CortexModelView,
  IPCResponse,
} from '@cortex-ide/shared';

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
  onDeviceStatus(listener: (status: CortexDeviceStatus) => void): () => void;
  onAccountChanged(listener: (state: CortexAccountState) => void): () => void;
}

/** The shape the preload bridge exposes. Declared structurally to avoid importing preload. */
interface CortexBridge {
  getState(): Promise<IPCResponse<CortexAccountState>>;
  listModels(): Promise<IPCResponse<{ models: CortexModelView[]; error?: string }>>;
  deviceStart(): Promise<IPCResponse<CortexDeviceStartResponse>>;
  deviceCancel(): Promise<IPCResponse<{ cancelled: true }>>;
  openVerification(): Promise<IPCResponse<{ opened: boolean }>>;
  signOut(): Promise<IPCResponse<CortexAccountState>>;
  onDeviceStatus(callback: (event: { status: CortexDeviceStatus }) => void): () => void;
  onAccountChanged(callback: (state: CortexAccountState) => void): () => void;
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

/** Is the app running inside Electron with the preload bridge installed? */
export function hasElectronHost(): boolean {
  return bridge() !== undefined;
}

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
    onDeviceStatus: (listener) => api.onDeviceStatus((event) => listener(event.status)),
    onAccountChanged: (listener) => api.onAccountChanged(listener),
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
    onDeviceStatus: () => () => {},
    onAccountChanged: () => () => {},
  };
}

/** The host for the current environment. */
export function resolveHost(): CortexHost {
  const api = bridge();
  return api ? electronHost(api) : detachedHost();
}
