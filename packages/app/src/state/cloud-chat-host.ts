/**
 * Chat host backed by the live Cortex HTTP API (and the realtime transport).
 *
 * Used on the web when the origin can reach api.cortex.foundation. Desktop
 * keeps the SQLite IPC host. The browser never starts a local harness here.
 */

import {
  deleteConversation,
  listConversationMessages,
  listConversations,
  startGuestSession,
  type CortexApiClient,
  type StreamTransport,
} from '@cortex-ide/cortex-api';
import type { ChatMode, ChatProgressEvent, ConversationDetail, ConversationSummary } from '@cortex-ide/shared';

import type { ChatHost } from './chat-host.ts';

export interface CloudChatOptions {
  client: CortexApiClient;
  transport: StreamTransport;
}

export function createCloudChatHost(options: CloudChatOptions): ChatHost {
  const listeners = new Set<(event: ChatProgressEvent) => void>();
  const notify = (event: ChatProgressEvent) => {
    for (const listener of listeners) listener(event);
  };

  return {
    available: true,
    list: async () => {
      await ensureGuest(options.client);
      const rows = await listConversations(options.client);
      return { conversations: rows.map(toSummary), modelLabel: 'Cortex' };
    },
    get: async (id) => {
      await ensureGuest(options.client);
      return loadDetail(options.client, id);
    },
    start: async (prompt, mode) => runTurn({ ...options, prompt, mode, notify }),
    send: async (id, prompt) => runTurn({ ...options, prompt, conversationId: id, mode: 'search', notify }),
    stop: async () => {
      // No cancel route was observed on the live service.
    },
    remove: async (id) => {
      await deleteConversation(options.client, id);
    },
    onProgress: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}

async function ensureGuest(client: CortexApiClient): Promise<void> {
  if (client.isAuthenticated) return;
  await startGuestSession(client);
}

async function loadDetail(client: CortexApiClient, id: string): Promise<ConversationDetail | null> {
  const messages = await listConversationMessages(client, id);
  return {
    id,
    title: messages[0]?.text?.slice(0, 48) || 'Conversation',
    mode: 'search',
    createdAt: timestamp(messages[0]?.created_at),
    updatedAt: timestamp(messages.at(-1)?.created_at),
    messages: messages.map((row, index) => ({
      seq: index + 1,
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: row.text ?? '',
      at: timestamp(row.created_at),
    })),
  };
}

async function runTurn(
  input: CloudChatOptions & {
    prompt: string;
    conversationId?: string;
    mode: ChatMode;
    notify: (event: ChatProgressEvent) => void;
  },
): Promise<ConversationDetail> {
  await ensureGuest(input.client);
  const id = await pumpTurn(input);
  if (!id) throw new Error('The API did not return a conversation id');
  const detail = await loadDetail(input.client, id);
  return (
    detail ?? {
      id,
      title: input.prompt.slice(0, 48),
      mode: input.mode,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  );
}

async function pumpTurn(
  input: CloudChatOptions & {
    prompt: string;
    conversationId?: string;
    notify: (event: ChatProgressEvent) => void;
  },
): Promise<string> {
  let id = input.conversationId ?? '';
  for await (const event of input.transport.streamChat(input.prompt, input.conversationId)) {
    if (event.conversation_id) id = event.conversation_id;
    if (event.type === 'chat.token' && event.delta && id) {
      input.notify({ conversationId: id, delta: event.delta });
    }
    if (event.type === 'chat.done' && id) input.notify({ conversationId: id, done: true });
  }
  return id;
}

function toSummary(row: { id: string; title?: string; last_message_at?: string; model_slug?: string }): ConversationSummary {
  const at = timestamp(row.last_message_at);
  return {
    id: row.id,
    title: row.title ?? 'Conversation',
    mode: 'search',
    model: row.model_slug,
    createdAt: at,
    updatedAt: at,
  };
}

function timestamp(value?: string): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}
