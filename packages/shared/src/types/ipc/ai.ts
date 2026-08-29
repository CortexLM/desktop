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
  workspacePath?: string;
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
  workspacePath?: string;
  mode?: 'agent' | 'plan' | 'mission' | 'ask';
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
  workspacePath?: string;
  mode?: 'agent' | 'plan' | 'mission' | 'ask';
}

export interface StreamToolPayload {
  id: string;
  name: string;
  title?: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
  additions?: number;
  deletions?: number;
  durationMs?: number;
}

export interface StreamPermissionPayload {
  id: string;
  tool: string;
  risk: string;
  summary: string;
  detail?: string;
}

export interface StreamPlanPayload {
  title: string;
  rationale: string;
  approved: boolean;
  steps: Array<{ id: string; title: string; status: string }>;
  mermaid?: string;
}

export interface StreamTaskPayload {
  id: string;
  phase: 'started' | 'progress' | 'completed' | 'failed';
  summary: string;
  artifact_id?: string;
}

export interface StreamChunk {
  type:
    | 'chunk'
    | 'done'
    | 'error'
    | 'thinking'
    | 'tool'
    | 'permission'
    | 'question'
    | 'plan'
    | 'task'
    | 'context_full';
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
  tool?: StreamToolPayload;
  permission?: StreamPermissionPayload;
  question?: { id: string; prompt: string; options?: string[] };
  plan?: StreamPlanPayload;
  task?: StreamTaskPayload;
}
