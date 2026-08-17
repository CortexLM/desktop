/**
 * Façade AI
 */

import type {
  AIProviderId,
  CreateSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  StreamResponseRequest,
  StreamChunk,
} from '@cortex-ide/shared';

import { getAPI, unwrapResponse } from './client';

export type { AIProviderId };

export const ai = {
  /**
   * Crée une session AI
   */
  async createSession(
    model: string,
    provider: AIProviderId,
    workspaceId?: string,
    systemPrompt?: string
  ): Promise<CreateSessionResponse> {
    return unwrapResponse(
      await getAPI().ai.createSession({ model, provider, workspaceId, systemPrompt })
    );
  },

  /**
   * Envoie un message (réponse complète)
   */
  async sendMessage(
    sessionId: string,
    message: string,
    context?: SendMessageRequest['context']
  ): Promise<SendMessageResponse> {
    return unwrapResponse(await getAPI().ai.sendMessage({ sessionId, message, context }));
  },

  /**
   * Envoie un message et reçoit la réponse en streaming
   *
   * @param onChunk appelé pour chaque fragment, puis une dernière fois avec
   *   `type: 'done'` ou `type: 'error'`
   */
  async streamResponse(
    sessionId: string,
    message: string,
    onChunk: (chunk: StreamChunk) => void,
    context?: StreamResponseRequest['context']
  ): Promise<void> {
    await getAPI().ai.streamResponse({ sessionId, message, context }, onChunk);
  },

  /**
   * Interrompt un streaming en cours
   */
  async stopStream(sessionId: string): Promise<void> {
    await getAPI().ai.stopStream(sessionId);
  },
};
