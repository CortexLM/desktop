/**
 * The renderer's view of runs.
 *
 * Same seam as `host.ts` and for the same reason: the renderer cannot reach the
 * database, git or the agent loop, all of which live in main. Screens depend on
 * `SessionHost`, not on `window.cortex`, which is what lets the suites drive them
 * with a fake.
 *
 * There is no polling method. A run advances in main and the renderer subscribes
 * through `onProgress`, which carries the updated summary alongside the event —
 * so a status change updates the inbox row and the timeline from one message
 * instead of two round trips that could disagree for a frame.
 */

import type {
  IPCResponse,
  ListSessionsRequest,
  RepositoryOption,
  SessionDetail,
  SessionProgressEvent,
  SessionSummary,
  StartSessionRequest,
} from '@cortex-ide/shared';

export interface SessionHost {
  list(request?: ListSessionsRequest): Promise<SessionSummary[]>;
  /** `null` when the id matches nothing — a stale link, not an error. */
  get(id: string): Promise<SessionDetail | null>;
  start(request: StartSessionRequest): Promise<SessionSummary>;
  followUp(id: string, prompt: string): Promise<SessionSummary | null>;
  stop(id: string): Promise<SessionSummary | null>;
  archive(id: string, archived: boolean): Promise<SessionSummary | null>;
  remove(id: string): Promise<void>;
  resolvePermission(
    id: string,
    requestId: string,
    decision: 'allow-once' | 'allow-always' | 'deny',
  ): Promise<void>;
  listRepositories(): Promise<RepositoryOption[]>;
  onProgress(listener: (event: SessionProgressEvent) => void): () => void;
}

/** The shape the preload bridge exposes. Declared structurally to avoid importing preload. */
interface SessionBridge {
  list(request?: ListSessionsRequest): Promise<IPCResponse<{ sessions: SessionSummary[] }>>;
  get(request: { id: string }): Promise<IPCResponse<{ session: SessionDetail | null }>>;
  start(request: StartSessionRequest): Promise<IPCResponse<{ session: SessionSummary }>>;
  followUp(request: {
    id: string;
    prompt: string;
  }): Promise<IPCResponse<{ session: SessionSummary | null }>>;
  stop(request: { id: string }): Promise<IPCResponse<{ session: SessionSummary | null }>>;
  archive(request: {
    id: string;
    archived: boolean;
  }): Promise<IPCResponse<{ session: SessionSummary | null }>>;
  remove(request: { id: string }): Promise<IPCResponse<{ deleted: true }>>;
  resolvePermission(request: {
    id: string;
    requestId: string;
    decision: string;
  }): Promise<IPCResponse<{ resolved: true }>>;
  listRepositories(): Promise<IPCResponse<{ repositories: RepositoryOption[] }>>;
  onProgress(callback: (event: SessionProgressEvent) => void): () => void;
}

function unwrap<T>(response: IPCResponse<T>): T {
  if (response.success) return response.data;
  throw new Error(response.error.message);
}

function bridge(): SessionBridge | undefined {
  return (globalThis as { cortex?: { session?: SessionBridge } }).cortex?.session;
}

function electronSessionHost(api: SessionBridge): SessionHost {
  return {
    list: async (request) => unwrap(await api.list(request)).sessions,
    get: async (id) => unwrap(await api.get({ id })).session,
    start: async (request) => unwrap(await api.start(request)).session,
    followUp: async (id, prompt) => unwrap(await api.followUp({ id, prompt })).session,
    stop: async (id) => unwrap(await api.stop({ id })).session,
    archive: async (id, archived) => unwrap(await api.archive({ id, archived })).session,
    remove: async (id) => {
      unwrap(await api.remove({ id }));
    },
    resolvePermission: async (id, requestId, decision) => {
      unwrap(await api.resolvePermission({ id, requestId, decision }));
    },
    listRepositories: async () => unwrap(await api.listRepositories()).repositories,
    onProgress: (listener) => api.onProgress(listener),
  };
}

/**
 * The host used when the bridge is absent: the suites and the preview server the
 * Paper parity captures are taken against.
 *
 * Reads answer empty rather than failing — an inbox with nothing in it is a state
 * the app supports. Writes reject with a message that names the real cause,
 * because pretending a run started would leave the UI waiting on something that
 * cannot happen.
 */
export function detachedSessionHost(): SessionHost {
  const unavailable = () => new Error('Runs are only available in the desktop app');

  return {
    list: async () => [],
    get: async () => null,
    start: () => Promise.reject(unavailable()),
    followUp: () => Promise.reject(unavailable()),
    stop: async () => null,
    archive: async () => null,
    remove: async () => {},
    resolvePermission: async () => {},
    listRepositories: async () => [],
    onProgress: () => () => {},
  };
}

export function resolveSessionHost(): SessionHost {
  const api = bridge();
  return api ? electronSessionHost(api) : detachedSessionHost();
}
