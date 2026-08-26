/**
 * AI IPC Handlers
 */

import { ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  CreateSessionRequestSchema,
  SendMessageRequestSchema,
} from '@cortex-ide/shared';

import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '@cortex-ide/shared';

import { CODING_TOOLS, composeSystemPrompt, type ChatResponse } from '@cortex-ide/ai-engine';

import { getAIService } from '../../services/ai-service';
import { createHandler } from './shared/handler-factory';
import { registerAIStreamHandler, cleanupAIStreamHandler } from './ai-stream-handler';

export const AI_CHANNELS = [
  IPC_CHANNELS.AI_CREATE_SESSION,
  IPC_CHANNELS.AI_SEND_MESSAGE,
] as const;

export const handleCreateSession = createHandler<CreateSessionRequest, CreateSessionResponse>(
  CreateSessionRequestSchema,
  async (request) => {
    const aiService = getAIService();
    const session = await aiService.createSession(request.provider, request.model, {
      workspacePath: request.workspacePath,
      workspaceId: request.workspaceId,
    });

    aiService.addSystemMessage(
      session.id,
      request.systemPrompt ??
        composeSystemPrompt({
          tools: CODING_TOOLS,
          mode: 'agent',
          autonomy: 'medium',
          runtime: 'interactive',
          workspaceRoot: request.workspacePath,
        })
    );

    return {
      sessionId: session.id,
      providerId: session.providerId,
      model: session.model,
      createdAt: session.createdAt,
    };
  }
);

export const handleSendMessage = createHandler<SendMessageRequest, SendMessageResponse>(
  SendMessageRequestSchema,
  async (request) => {
    const aiService = getAIService();
    const aiResponse: ChatResponse = await aiService.sendMessage(request.sessionId, request.message);

    return {
      content: aiResponse.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      finishReason: aiResponse.finishReason,
    };
  }
);

/**
 * Enregistre les handlers AI, incluant le streaming
 */
export function registerAIHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_CREATE_SESSION, handleCreateSession);
  ipcMain.handle(IPC_CHANNELS.AI_SEND_MESSAGE, handleSendMessage);
  registerAIStreamHandler();
}

/**
 * Désenregistre les handlers AI et nettoie les streams actifs
 */
export function unregisterAIHandlers(): void {
  AI_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
  cleanupAIStreamHandler();
}
