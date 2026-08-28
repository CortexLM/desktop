/**
 * Chat IPC Handlers — the Chat product's conversations, seen from the renderer.
 *
 * A separate domain from `session:*` on purpose: a conversation is a linear
 * exchange with a provider, not a run with a repo and a timeline, and one
 * domain's vocabulary stretched over both would fit neither.
 *
 * There is no "give me the next chunk" channel. A reply streams in main at the
 * provider's pace and the renderer learns about it over `event:chat-progress`.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

import { IPC_CHANNELS } from '@cortex-ide/shared';
import type {
  ChatIdRequest,
  ChatProgressEvent,
  GetConversationRequest,
  GetConversationResponse,
  ListConversationsResponse,
  SendChatMessageRequest,
  SendChatMessageResponse,
  StartConversationRequest,
  StartConversationResponse,
} from '@cortex-ide/shared';

import { getConversationService } from '../../services/conversation-service';
import { createHandler } from './shared/handler-factory';

export const CONVERSATION_CHANNELS = [
  IPC_CHANNELS.CHAT_LIST,
  IPC_CHANNELS.CHAT_GET,
  IPC_CHANNELS.CHAT_START,
  IPC_CHANNELS.CHAT_SEND,
  IPC_CHANNELS.CHAT_STOP,
  IPC_CHANNELS.CHAT_DELETE,
] as const;

const NoPayloadSchema = z
  .object({})
  .optional()
  .transform(() => ({}) as Record<string, never>);

const IdSchema = z.object({ id: z.string().min(1) });

/** Same bound as a session prompt: a cap on one renderer call's database write. */
const StartSchema = z.object({
  prompt: z.string().min(1).max(32_000),
  mode: z.enum(['search', 'reason']).optional(),
});

const SendSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1).max(32_000),
});

export const handleListConversations = createHandler<
  Record<string, never>,
  ListConversationsResponse
>(NoPayloadSchema, async () => {
  const service = getConversationService();
  return { conversations: await service.list(), modelLabel: service.modelLabel() };
});

export const handleGetConversation = createHandler<
  GetConversationRequest,
  GetConversationResponse
>(IdSchema, async (request) => ({
  conversation: await getConversationService().get(request.id),
}));

export const handleStartConversation = createHandler<
  StartConversationRequest,
  StartConversationResponse
>(StartSchema, async (request) => ({
  conversation: await getConversationService().start(request.prompt, request.mode ?? 'search'),
}));

export const handleSendChatMessage = createHandler<
  SendChatMessageRequest,
  SendChatMessageResponse
>(SendSchema, async (request) => ({
  conversation: await getConversationService().send(request.id, request.prompt),
}));

export const handleStopChat = createHandler<ChatIdRequest, { stopped: true }>(
  IdSchema,
  async (request) => {
    getConversationService().stop(request.id);
    return { stopped: true };
  },
);

export const handleDeleteChat = createHandler<ChatIdRequest, { deleted: true }>(
  IdSchema,
  async (request) => {
    await getConversationService().remove(request.id);
    return { deleted: true };
  },
);

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

let eventCleanup: (() => void) | undefined;

/** Relays streaming replies to every window; a thread belongs to the app, not a window. */
export function setupChatEvents(): () => void {
  const service = getConversationService();
  const listener = (payload: ChatProgressEvent) => {
    broadcast(IPC_CHANNELS.EVENT_CHAT_PROGRESS, payload);
  };

  service.on('progress', listener);
  return () => service.off('progress', listener);
}

export function registerConversationHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CHAT_LIST, handleListConversations);
  ipcMain.handle(IPC_CHANNELS.CHAT_GET, handleGetConversation);
  ipcMain.handle(IPC_CHANNELS.CHAT_START, handleStartConversation);
  ipcMain.handle(IPC_CHANNELS.CHAT_SEND, handleSendChatMessage);
  ipcMain.handle(IPC_CHANNELS.CHAT_STOP, handleStopChat);
  ipcMain.handle(IPC_CHANNELS.CHAT_DELETE, handleDeleteChat);

  eventCleanup?.();
  eventCleanup = setupChatEvents();
}

export function unregisterConversationHandlers(): void {
  CONVERSATION_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
  eventCleanup?.();
  eventCleanup = undefined;
}
