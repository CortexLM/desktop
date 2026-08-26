/**
 * The renderer's doorway to the Chat conversations IPC.
 *
 * Same shape as the session host: a typed facade over `window.cortex.chat` that
 * unwraps the `{ success, data }` envelopes, plus a detached stand-in for the
 * suites and the preview server, where no bridge exists.
 */

import type {
  ChatMode,
  ChatProgressEvent,
  ConversationDetail,
  ConversationSummary,
} from '@cortex-ide/shared';

export interface ChatHost {
  list: () => Promise<{ conversations: ConversationSummary[]; modelLabel: string }>;
  get: (id: string) => Promise<ConversationDetail | null>;
  start: (prompt: string, mode: ChatMode) => Promise<ConversationDetail>;
  send: (id: string, prompt: string) => Promise<ConversationDetail | null>;
  stop: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  onProgress: (callback: (event: ChatProgressEvent) => void) => () => void;
  /** False on the detached host, so screens can say why nothing works. */
  available: boolean;
}

interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

function unwrap<T>(response: IPCResponse<T>): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error?.message ?? 'The main process rejected the call');
  }
  return response.data;
}

/** Structural mirror of the preload bridge, so the suites can stub it. */
interface ChatBridge {
  list: () => Promise<IPCResponse<{ conversations: ConversationSummary[]; modelLabel: string }>>;
  get: (request: { id: string }) => Promise<IPCResponse<{ conversation: ConversationDetail | null }>>;
  start: (request: {
    prompt: string;
    mode?: ChatMode;
  }) => Promise<IPCResponse<{ conversation: ConversationDetail }>>;
  send: (request: {
    id: string;
    prompt: string;
  }) => Promise<IPCResponse<{ conversation: ConversationDetail | null }>>;
  stop: (request: { id: string }) => Promise<IPCResponse<{ stopped: true }>>;
  remove: (request: { id: string }) => Promise<IPCResponse<{ deleted: true }>>;
  onProgress: (callback: (event: ChatProgressEvent) => void) => () => void;
}

function attached(api: ChatBridge): ChatHost {
  return {
    available: true,
    list: async () => unwrap(await api.list()),
    get: async (id) => unwrap(await api.get({ id })).conversation,
    start: async (prompt, mode) => unwrap(await api.start({ prompt, mode })).conversation,
    send: async (id, prompt) => unwrap(await api.send({ id, prompt })).conversation,
    stop: async (id) => {
      unwrap(await api.stop({ id }));
    },
    remove: async (id) => {
      unwrap(await api.remove({ id }));
    },
    onProgress: (callback) => api.onProgress(callback),
  };
}

function unavailable(): Error {
  return new Error('Chat is only available inside the desktop app');
}

function detached(): ChatHost {
  return {
    available: false,
    list: async () => ({ conversations: [], modelLabel: 'No model configured' }),
    get: async () => null,
    start: () => Promise.reject(unavailable()),
    send: () => Promise.reject(unavailable()),
    stop: async () => {},
    remove: async () => {},
    onProgress: () => () => {},
  };
}

export function resolveChatHost(): ChatHost {
  const api = (globalThis as { cortex?: { chat?: ChatBridge } }).cortex?.chat;
  return api ? attached(api) : detached();
}
