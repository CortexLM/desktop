import {
  createContext,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type JSX,
  type Resource,
} from 'solid-js';

import type { RepositoryOption, SessionSummary, StartSessionRequest } from '@cortex-ide/shared';

import { resolveSessionHost, type SessionHost } from './session-host.ts';

/**
 * The run list every screen reads from.
 *
 * Held above the routes on purpose. The inbox, Home's recent list and the sidebar
 * all show the same runs, and a run that finishes has to update all three — three
 * independent fetches would disagree with each other for as long as they take to
 * settle, and would each miss the progress events the others received.
 *
 * Progress is *patched* into the list rather than triggering a refetch. Main sends
 * the updated summary with every event, so a refetch would be a round trip to
 * learn something already in hand — and during a run those arrive several times a
 * second.
 */
export interface SessionsContextValue {
  sessions: Resource<SessionSummary[]>;
  /** Runs that are neither archived nor finished, newest first. */
  active: Accessor<SessionSummary[]>;
  /** Runs waiting for a human to look at the changes. */
  awaitingReview: Accessor<SessionSummary[]>;
  repositories: Resource<RepositoryOption[]>;
  /** Did the last read reach main? False under the preview server and the suites. */
  available: Accessor<boolean>;
  start: (request: StartSessionRequest) => Promise<SessionSummary>;
  stop: (id: string) => Promise<void>;
  archive: (id: string, archived: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => void;
  host: SessionHost;
}

const SessionsContext = createContext<SessionsContextValue>();

export interface SessionsProviderProps {
  children: JSX.Element;
  /** Injected by the suites, which drive the screens without an Electron bridge. */
  host?: SessionHost;
}

async function readList(
  host: SessionHost,
  setAvailable: (value: boolean) => void,
): Promise<SessionSummary[]> {
  try {
    const list = await host.list({ includeArchived: true });
    setAvailable(true);
    return list;
  } catch {
    setAvailable(false);
    return [];
  }
}

async function readRepositories(host: SessionHost): Promise<RepositoryOption[]> {
  try {
    return await host.listRepositories();
  } catch {
    return [];
  }
}

/** States in which a run is over. */
const FINISHED = new Set(['review', 'merged', 'failed', 'stopped']);

/**
 * Replaces one row in place, or prepends it when the run is new to this client.
 *
 * Re-sorted rather than left where it was: the list is ordered by recency, and a
 * run that just advanced is now the most recent one.
 */
function merge(current: readonly SessionSummary[], session: SessionSummary): SessionSummary[] {
  const index = current.findIndex((entry) => entry.id === session.id);
  if (index === -1) return [session, ...current];

  const next = [...current];
  next[index] = session;
  return next.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * The write half of the store.
 *
 * Every write patches the row from the response rather than refetching the list.
 * `start` in particular has to: the caller navigates straight to the new run, and
 * a refetch would land on a session the list does not yet contain.
 */
function createActions(
  host: SessionHost,
  patch: (session: SessionSummary) => void,
  drop: (id: string) => void,
): Pick<SessionsContextValue, 'start' | 'stop' | 'archive' | 'remove'> {
  return {
    start: async (request) => {
      const session = await host.start(request);
      patch(session);
      return session;
    },
    stop: async (id) => {
      const session = await host.stop(id);
      if (session) patch(session);
    },
    archive: async (id, archived) => {
      const session = await host.archive(id, archived);
      if (session) patch(session);
    },
    remove: async (id) => {
      await host.remove(id);
      drop(id);
    },
  };
}

export function SessionsProvider(props: SessionsProviderProps): JSX.Element {
  const host = props.host ?? resolveSessionHost();

  const [available, setAvailable] = createSignal(true);

  // Both reads swallow their failure and answer empty. An inbox with nothing in it
  // is a state the app supports, and `available` is what distinguishes "no runs"
  // from "no main process to ask" for anything that needs to say so.
  const [sessions, { refetch, mutate }] = createResource(
    () => readList(host, setAvailable),
    { initialValue: [] },
  );
  const [repositories] = createResource(() => readRepositories(host), { initialValue: [] });

  const patch = (session: SessionSummary) => mutate((current = []) => merge(current, session));

  onMount(() => {
    onCleanup(host.onProgress((event) => patch(event.session)));
  });

  const active = createMemo(() =>
    (sessions() ?? []).filter((session) => !session.archived && !FINISHED.has(session.status)),
  );

  const awaitingReview = createMemo(() =>
    (sessions() ?? []).filter((session) => !session.archived && session.status === 'review'),
  );

  return (
    <SessionsContext.Provider
      value={{
        sessions,
        active,
        awaitingReview,
        repositories,
        available,
        ...createActions(host, patch, (id) =>
          mutate((current = []) => current.filter((entry) => entry.id !== id)),
        ),
        refresh: () => void refetch(),
        host,
      }}
    >
      {props.children}
    </SessionsContext.Provider>
  );
}

export function useSessions(): SessionsContextValue {
  const context = useContext(SessionsContext);
  if (!context) throw new Error('useSessions must be used inside a SessionsProvider');
  return context;
}
