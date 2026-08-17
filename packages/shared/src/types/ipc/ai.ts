/**
 * Types IPC - AI
 */

/**
 * Providers AI adressables via IPC.
 *
 * Nommé `AIProviderId` et non `AIProvider` pour ne pas entrer en collision
 * avec la classe abstraite `AIProvider` d'`ai-engine`.
 */
export type AIProviderId = 'openai' | 'anthropic' | 'openrouter' | 'ollama';

/**
 * Contexte de code joint à un message
 */
export interface MessageContext {
  files?: string[];
  selection?: {
    path: string;
    start: number;
    end: number;
  };
}

export interface CreateSessionRequest {
  workspaceId?: string;
  model: string;
  provider: AIProviderId;
  systemPrompt?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  providerId: string;
  model?: string;
  createdAt: number;
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
  context?: MessageContext;
}

export interface SendMessageResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface StreamResponseRequest {
  sessionId: string;
  message: string;
  context?: MessageContext;
}

export interface StreamChunk {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}
