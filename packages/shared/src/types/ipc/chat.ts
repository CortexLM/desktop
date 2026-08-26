/**
 * IPC contracts for the Chat product's conversations.
 *
 * A conversation is a linear exchange — user turns and assistant replies — with
 * none of a session run's machinery. The renderer addresses conversations by id
 * and receives streaming progress over `EVENT_CHAT_PROGRESS`.
 */

export type ChatMode = 'search' | 'reason';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  /** Stable within the conversation; the renderer keys the thread on it. */
  seq: number;
  role: ChatRole;
  content: string;
  at: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  mode: ChatMode;
  provider?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

// ── Requests / responses ─────────────────────────────────────────────────────

export interface ListConversationsResponse {
  conversations: ConversationSummary[];
  /** Bare-text label for the composer's model picker, e.g. "Cortex 2 · Auto". */
  modelLabel: string;
}

export interface GetConversationRequest {
  id: string;
}

export interface GetConversationResponse {
  conversation: ConversationDetail | null;
}

export interface StartConversationRequest {
  prompt: string;
  mode?: ChatMode;
}

export interface StartConversationResponse {
  conversation: ConversationDetail;
}

export interface SendChatMessageRequest {
  id: string;
  prompt: string;
}

export interface SendChatMessageResponse {
  conversation: ConversationDetail | null;
}

export interface ChatIdRequest {
  id: string;
}

/**
 * Streaming progress for one conversation.
 *
 * `delta` carries newly generated text; `done` closes the assistant turn (with
 * `error` naming the reason when it failed rather than finished).
 */
export interface ChatProgressEvent {
  conversationId: string;
  delta?: string;
  done?: boolean;
  error?: string;
}
