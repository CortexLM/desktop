/**
 * SimpleAgentManager - In-memory agent session manager
 * Replacement for mission orchestrator with simplified architecture
 */

import { Message, ChatOptions } from './providers/base';
import { AIProviderRegistry } from './registry';

/**
 * Agent session status
 */
export type AgentSessionStatus = 'active' | 'paused' | 'completed' | 'failed';

/**
 * Configuration for creating a new agent session
 */
export interface AgentSessionConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Complete agent session with conversation history
 */
export interface AgentSession {
  id: string;
  messages: Message[];
  status: AgentSessionStatus;
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Streaming response chunk from agent
 */
export interface AgentStreamChunk {
  sessionId: string;
  content: string;
  done: boolean;
  finishReason?: string;
}

/**
 * Error thrown by SimpleAgentManager
 */
export class AgentManagerError extends Error {
  constructor(
    message: string,
    public code: string,
    public sessionId?: string
  ) {
    super(message);
    this.name = 'AgentManagerError';
  }
}

/**
 * SimpleAgentManager - Manages multiple concurrent agent sessions
 * 
 * Features:
 * - In-memory session storage
 * - Concurrent session support
 * - Streaming responses
 * - Session pause/resume/cancel
 * - Full conversation history
 */
export class SimpleAgentManager {
  private sessions: Map<string, AgentSession> = new Map();
  private registry: AIProviderRegistry;
  private activeStreams: Map<string, AbortController> = new Map();

  constructor(registry: AIProviderRegistry) {
    this.registry = registry;
  }

  /**
   * Creates a new agent session
   */
  async createSession(config: AgentSessionConfig): Promise<AgentSession> {
    // Validate provider exists
    const provider = this.registry.getProvider(config.provider);
    if (!provider) {
      throw new AgentManagerError(
        `Provider '${config.provider}' not found in registry`,
        'PROVIDER_NOT_FOUND'
      );
    }

    // Check provider availability
    const available = await provider.isAvailable();
    if (!available) {
      throw new AgentManagerError(
        `Provider '${config.provider}' is not available`,
        'PROVIDER_UNAVAILABLE'
      );
    }

    // Generate unique session ID
    const id = this.generateSessionId();

    // Initialize messages with system prompt if provided
    const messages: Message[] = [];
    if (config.systemPrompt) {
      messages.push({
        role: 'system',
        content: config.systemPrompt,
      });
    }

    // Create session
    const session: AgentSession = {
      id,
      messages,
      status: 'active',
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: config.metadata,
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Sends a message to an agent session and streams the response
   */
  async *sendMessage(
    sessionId: string,
    message: string
  ): AsyncIterableIterator<AgentStreamChunk> {
    const session = this.getSessionOrThrow(sessionId);

    // Verify session is active
    if (session.status !== 'active') {
      throw new AgentManagerError(
        `Cannot send message to ${session.status} session`,
        'SESSION_NOT_ACTIVE',
        sessionId
      );
    }

    // Get provider
    const provider = this.registry.getProvider(session.provider);
    if (!provider) {
      throw new AgentManagerError(
        `Provider '${session.provider}' not found`,
        'PROVIDER_NOT_FOUND',
        sessionId
      );
    }

    // Add user message to history
    const userMessage: Message = {
      role: 'user',
      content: message,
    };
    session.messages.push(userMessage);
    session.updatedAt = new Date();

    // Prepare chat options
    const options: ChatOptions = {
      model: session.model,
      temperature: session.temperature,
      maxTokens: session.maxTokens,
      stream: true,
    };

    // Setup abort controller for cancellation
    const abortController = new AbortController();
    this.activeStreams.set(sessionId, abortController);

    try {
      // Stream response from provider
      let fullContent = '';

      const stream = provider.stream(session.messages, options);

      for await (const chunk of stream) {
        // Check if cancelled
        if (abortController.signal.aborted) {
          break;
        }

        fullContent += chunk.content;

        yield {
          sessionId,
          content: chunk.content,
          done: chunk.done,
          finishReason: chunk.done ? 'stop' : undefined,
        };

      }

      // Add assistant response to history
      if (fullContent) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: fullContent,
        };
        session.messages.push(assistantMessage);
      }

      // If aborted, keep session paused (set by pauseSession/cancelSession)
      // Otherwise update timestamp
      if (!abortController.signal.aborted) {
        session.updatedAt = new Date();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      session.status = 'failed';
      session.error = message;
      session.updatedAt = new Date();

      throw new AgentManagerError(
        `Failed to stream response: ${message}`,
        'STREAM_ERROR',
        sessionId
      );
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  /**
   * Pauses an active agent session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const session = this.getSessionOrThrow(sessionId);

    if (session.status !== 'active') {
      throw new AgentManagerError(
        `Cannot pause ${session.status} session`,
        'SESSION_NOT_ACTIVE',
        sessionId
      );
    }

    // Set status first
    session.status = 'paused';
    session.updatedAt = new Date();

    // Cancel any active stream
    const abortController = this.activeStreams.get(sessionId);
    if (abortController) {
      abortController.abort();
    }
  }

  /**
   * Resumes a paused agent session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const session = this.getSessionOrThrow(sessionId);

    if (session.status !== 'paused') {
      throw new AgentManagerError(
        `Cannot resume ${session.status} session`,
        'SESSION_NOT_PAUSED',
        sessionId
      );
    }

    // Verify provider is still available
    const provider = this.registry.getProvider(session.provider);
    if (!provider) {
      throw new AgentManagerError(
        `Provider '${session.provider}' not found`,
        'PROVIDER_NOT_FOUND',
        sessionId
      );
    }

    const available = await provider.isAvailable();
    if (!available) {
      throw new AgentManagerError(
        `Provider '${session.provider}' is not available`,
        'PROVIDER_UNAVAILABLE',
        sessionId
      );
    }

    session.status = 'active';
    session.updatedAt = new Date();
  }

  /**
   * Cancels an agent session (marks as completed)
   */
  async cancelSession(sessionId: string): Promise<void> {
    const session = this.getSessionOrThrow(sessionId);

    // Set status first
    session.status = 'completed';
    session.updatedAt = new Date();

    // Cancel any active stream
    const abortController = this.activeStreams.get(sessionId);
    if (abortController) {
      abortController.abort();
    }
  }

  /**
   * Lists all sessions, optionally filtered by status
   */
  async listSessions(status?: AgentSessionStatus): Promise<AgentSession[]> {
    const sessions = Array.from(this.sessions.values());

    if (status) {
      return sessions.filter((s) => s.status === status);
    }

    return sessions;
  }

  /**
   * Gets a specific session by ID
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Deletes a session from memory
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AgentManagerError(
        `Session '${sessionId}' not found`,
        'SESSION_NOT_FOUND',
        sessionId
      );
    }

    // Cancel any active stream
    const abortController = this.activeStreams.get(sessionId);
    if (abortController) {
      abortController.abort();
    }

    this.sessions.delete(sessionId);
    this.activeStreams.delete(sessionId);
  }

  /**
   * Gets session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Gets active session count
   */
  getActiveSessionCount(): number {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'active'
    ).length;
  }

  /**
   * Clears all sessions
   */
  async clearAllSessions(): Promise<void> {
    // Cancel all active streams
    for (const abortController of this.activeStreams.values()) {
      abortController.abort();
    }

    this.sessions.clear();
    this.activeStreams.clear();
  }

  /**
   * Gets or throws error if session not found
   */
  private getSessionOrThrow(sessionId: string): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AgentManagerError(
        `Session '${sessionId}' not found`,
        'SESSION_NOT_FOUND',
        sessionId
      );
    }
    return session;
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `session_${timestamp}_${random}`;
  }
}
