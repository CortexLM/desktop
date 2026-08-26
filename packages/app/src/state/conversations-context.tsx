import {
  createContext,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type JSX,
  type Resource,
} from 'solid-js';

import type { ChatMode, ConversationDetail, ConversationSummary } from '@cortex-ide/shared';

import { resolveChatHost, type ChatHost } from './chat-host.ts';

/**
 * The conversation list the Chat product reads from.
 *
 * Held above the routes for the same reason as the run store: the sidebar's
 * RECENTS and the conversation view show the same threads, and a reply that
 * streams in has to update both.
 *
 * Streaming is held as `streams` — a map of conversation id to the text
 * accumulated so far. The thread screen renders the stored messages plus the
 * live tail; when `done` arrives, the store refetches the thread (now
 * persisted) and drops the tail. Deltas patch a signal rather than refetching:
 * during a reply they arrive many times a second.
 */
export interface ConversationsContextValue {
  conversations: Resource<ConversationSummary[]>;
  modelLabel: Accessor<string>;
  /** Live reply text per conversation, while one streams. */
  streamed: (id: string) => string | undefined;
  /** True while a reply is streaming for the id. */
  replying: (id: string) => boolean;
  detail: (id: string) => Promise<ConversationDetail | null>;
  /** Bumps when a thread changes on disk; detail readers re-fetch on it. */
  revision: Accessor<number>;
  start: (prompt: string, mode: ChatMode) => Promise<string | null>;
  send: (id: string, prompt: string) => Promise<void>;
  stop: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => void;
  host: ChatHost;
}

const ConversationsContext = createContext<ConversationsContextValue>();

export interface ConversationsProviderProps {
  children: JSX.Element;
  /** Injected by the suites, which drive the screens without an Electron bridge. */
  host?: ChatHost;
}

interface StreamState {
  streams: () => Record<string, string>;
  setStreams: (update: (current: Record<string, string>) => Record<string, string>) => void;
  setRevision: (update: (value: number) => number) => void;
}

/** Applies one progress event to the live-tail map. */
function applyProgress(
  state: StreamState,
  event: { conversationId: string; delta?: string; done?: boolean },
  refetch: () => void,
): void {
  if (event.delta) {
    state.setStreams((current) => ({
      ...current,
      [event.conversationId]: (current[event.conversationId] ?? '') + event.delta,
    }));
  }
  if (event.done) {
    // The reply is persisted now; the stored thread supersedes the tail.
    state.setStreams((current) => {
      const { [event.conversationId]: _done, ...rest } = current;
      return rest;
    });
    state.setRevision((value) => value + 1);
    refetch();
  }
}

function createActions(
  host: ChatHost,
  state: StreamState,
  refetch: () => void,
): Pick<ConversationsContextValue, 'start' | 'send' | 'stop' | 'remove'> {
  return {
    start: async (prompt, mode) => {
      const conversation = await host.start(prompt, mode);
      // Mark the reply as live immediately: the first delta may take a beat, and
      // the thread screen shows the thinking state off this flag.
      state.setStreams((current) => ({ ...current, [conversation.id]: '' }));
      refetch();
      return conversation.id;
    },
    send: async (id, prompt) => {
      await host.send(id, prompt);
      state.setStreams((current) => ({ ...current, [id]: '' }));
      state.setRevision((value) => value + 1);
    },
    stop: (id) => host.stop(id),
    remove: async (id) => {
      await host.remove(id);
      state.setRevision((value) => value + 1);
      refetch();
    },
  };
}

export function ConversationsProvider(props: ConversationsProviderProps): JSX.Element {
  // The host is a capability, fixed for the app's lifetime; reading the prop once
  // is deliberate, not a lost reaction.
  const host = props.host ?? resolveChatHost();

  const [modelLabel, setModelLabel] = createSignal('No model configured');
  const [streams, setStreams] = createSignal<Record<string, string>>({});
  const [revision, setRevision] = createSignal(0);
  const state: StreamState = { streams, setStreams, setRevision };

  const [conversations, { refetch }] = createResource(
    async () => {
      try {
        const result = await host.list();
        setModelLabel(result.modelLabel);
        return result.conversations;
      } catch {
        return [];
      }
    },
    { initialValue: [] },
  );

  const refresh = () => void refetch();

  onMount(() => {
    const detach = host.onProgress((event) => applyProgress(state, event, refresh));
    onCleanup(detach);
  });

  const value: ConversationsContextValue = {
    conversations,
    modelLabel,
    streamed: (id) => streams()[id],
    replying: (id) => streams()[id] !== undefined,
    detail: (id) => host.get(id),
    revision,
    ...createActions(host, state, refresh),
    refresh,
    host,
  };

  return <ConversationsContext.Provider value={value}>{props.children}</ConversationsContext.Provider>;
}

export function useConversations(): ConversationsContextValue {
  const context = useContext(ConversationsContext);
  if (!context) throw new Error('useConversations must be used inside a ConversationsProvider');
  return context;
}
