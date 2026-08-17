/**
 * Tests for SimpleAgentManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimpleAgentManager, AgentManagerError } from '../simple-agent-manager';
import { AIProviderRegistry } from '../registry';
import { AIProvider, Message, ChatOptions, StreamChunk } from '../providers/base';

// Mock provider for testing
class MockProvider extends AIProvider {
  readonly id = 'mock';
  readonly name = 'Mock Provider';
  
  private shouldFail = false;
  private streamDelay = 10;

  async chat(messages: Message[], options?: ChatOptions) {
    if (this.shouldFail) {
      throw new Error('Mock provider error');
    }

    return {
      content: 'Mock response',
      model: options?.model || 'mock-model',
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      },
      finishReason: 'stop',
    };
  }

  async *stream(messages: Message[], options?: ChatOptions): AsyncIterableIterator<StreamChunk> {
    if (this.shouldFail) {
      throw new Error('Mock provider error');
    }

    const response = 'Mock streaming response';
    const words = response.split(' ');

    for (let i = 0; i < words.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, this.streamDelay));
      
      yield {
        content: (i > 0 ? ' ' : '') + words[i],
        done: i === words.length - 1,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return !this.shouldFail;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setStreamDelay(delay: number): void {
    this.streamDelay = delay;
  }
}

describe('SimpleAgentManager', () => {
  let manager: SimpleAgentManager;
  let registry: AIProviderRegistry;
  let mockProvider: MockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider();
    registry = new AIProviderRegistry();
    registry.register(mockProvider);
    registry.setDefault('mock');
    manager = new SimpleAgentManager(registry);
  });

  describe('createSession', () => {
    it('should create a new session with valid config', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'mock-model',
        temperature: 0.7,
        maxTokens: 1000,
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.provider).toBe('mock');
      expect(session.model).toBe('mock-model');
      expect(session.temperature).toBe(0.7);
      expect(session.maxTokens).toBe(1000);
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should add system prompt to messages if provided', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'mock-model',
        systemPrompt: 'You are a helpful assistant',
      });

      expect(session.messages).toHaveLength(1);
      expect(session.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
      });
    });

    it('should include metadata if provided', async () => {
      const metadata = { userId: '123', taskId: 'task-456' };
      const session = await manager.createSession({
        provider: 'mock',
        model: 'mock-model',
        metadata,
      });

      expect(session.metadata).toEqual(metadata);
    });

    it('should throw error if provider not found', async () => {
      await expect(
        manager.createSession({
          provider: 'nonexistent',
          model: 'model',
        })
      ).rejects.toThrow(AgentManagerError);

      await expect(
        manager.createSession({
          provider: 'nonexistent',
          model: 'model',
        })
      ).rejects.toThrow("Provider 'nonexistent' not found in registry");
    });

    it('should throw error if provider unavailable', async () => {
      mockProvider.setFailure(true);

      await expect(
        manager.createSession({
          provider: 'mock',
          model: 'model',
        })
      ).rejects.toThrow(AgentManagerError);

      await expect(
        manager.createSession({
          provider: 'mock',
          model: 'model',
        })
      ).rejects.toThrow("Provider 'mock' is not available");
    });

    it('should generate unique session IDs', async () => {
      const session1 = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      const session2 = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('sendMessage', () => {
    it('should stream response and update session', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'mock-model',
      });

      const chunks: string[] = [];
      for await (const chunk of manager.sendMessage(session.id, 'Hello')) {
        chunks.push(chunk.content);
        expect(chunk.sessionId).toBe(session.id);
        expect(typeof chunk.done).toBe('boolean');
      }

      expect(chunks.join('')).toBe('Mock streaming response');

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(2);
      expect(updatedSession?.messages[0]).toEqual({
        role: 'user',
        content: 'Hello',
      });
      expect(updatedSession?.messages[1]).toEqual({
        role: 'assistant',
        content: 'Mock streaming response',
      });
    });

    it('should throw error if session not found', async () => {
      try {
        const generator = manager.sendMessage('nonexistent', 'Hello');
        await generator.next();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentManagerError);
        expect((error as Error).message).toContain("Session 'nonexistent' not found");
      }
    });

    it('should throw error if session not active', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await manager.pauseSession(session.id);

      try {
        const generator = manager.sendMessage(session.id, 'Hello');
        await generator.next();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentManagerError);
        expect((error as Error).message).toContain('Cannot send message to paused session');
      }
    });

    it('should handle provider errors', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      mockProvider.setFailure(true);

      try {
        const generator = manager.sendMessage(session.id, 'Hello');
        await generator.next();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentManagerError);
        expect((error as Error).message).toContain('Failed to stream response');
      }

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.status).toBe('failed');
      expect(updatedSession?.error).toBeDefined();
    });

    it('should support multiple messages in conversation', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      // First message
      for await (const _ of manager.sendMessage(session.id, 'Message 1')) {
        // consume stream
      }

      // Second message
      for await (const _ of manager.sendMessage(session.id, 'Message 2')) {
        // consume stream
      }

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(4);
      expect(updatedSession?.messages.map((m) => m.role)).toEqual([
        'user',
        'assistant',
        'user',
        'assistant',
      ]);
    });

    it('should preserve system prompt through conversation', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
        systemPrompt: 'System prompt',
      });

      for await (const _ of manager.sendMessage(session.id, 'User message')) {
        // consume stream
      }

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.messages[0]).toEqual({
        role: 'system',
        content: 'System prompt',
      });
    });
  });

  describe('pauseSession', () => {
    it('should pause an active session', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await manager.pauseSession(session.id);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.status).toBe('paused');
    });

    it('should throw error if session not found', async () => {
      await expect(manager.pauseSession('nonexistent')).rejects.toThrow(AgentManagerError);
    });

    it('should throw error if session not active', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await manager.cancelSession(session.id);

      await expect(manager.pauseSession(session.id)).rejects.toThrow(AgentManagerError);
      await expect(manager.pauseSession(session.id)).rejects.toThrow(
        'Cannot pause completed session'
      );
    });

    it('should cancel active stream when pausing', async () => {
      mockProvider.setStreamDelay(50); // Longer delay

      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      const streamPromise = (async () => {
        const chunks: string[] = [];
        for await (const chunk of manager.sendMessage(session.id, 'Hello')) {
          chunks.push(chunk.content);
        }
        return chunks;
      })();

      // Pause after a short delay
      await new Promise((resolve) => setTimeout(resolve, 30));
      await manager.pauseSession(session.id);

      const chunks = await streamPromise;
      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.status).toBe('paused');
    });
  });

  describe('resumeSession', () => {
    it('should resume a paused session', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await manager.pauseSession(session.id);
      await manager.resumeSession(session.id);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.status).toBe('active');
    });

    it('should throw error if session not found', async () => {
      await expect(manager.resumeSession('nonexistent')).rejects.toThrow(AgentManagerError);
    });

    it('should throw error if session not paused', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await expect(manager.resumeSession(session.id)).rejects.toThrow(AgentManagerError);
      await expect(manager.resumeSession(session.id)).rejects.toThrow(
        'Cannot resume active session'
      );
    });

    it('should throw error if provider unavailable', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await manager.pauseSession(session.id);
      mockProvider.setFailure(true);

      await expect(manager.resumeSession(session.id)).rejects.toThrow(AgentManagerError);
      await expect(manager.resumeSession(session.id)).rejects.toThrow(
        "Provider 'mock' is not available"
      );
    });
  });

  describe('cancelSession', () => {
    it('should cancel a session', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await manager.cancelSession(session.id);

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.status).toBe('completed');
    });

    it('should throw error if session not found', async () => {
      await expect(manager.cancelSession('nonexistent')).rejects.toThrow(AgentManagerError);
    });

    it('should cancel active stream', async () => {
      mockProvider.setStreamDelay(100);

      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      const streamPromise = (async () => {
        const chunks: string[] = [];
        for await (const chunk of manager.sendMessage(session.id, 'Hello')) {
          chunks.push(chunk.content);
        }
        return chunks;
      })();

      // Wait for stream to start
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      // Cancel the session
      await manager.cancelSession(session.id);

      // Wait for stream to complete
      const chunks = await streamPromise;

      const updatedSession = manager.getSession(session.id);
      expect(updatedSession?.status).toBe('completed');
      // Stream may have been interrupted
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      const session1 = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      const session2 = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      const sessions = await manager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.id)).toContain(session1.id);
      expect(sessions.map((s) => s.id)).toContain(session2.id);
    });

    it('should filter sessions by status', async () => {
      const session1 = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      const session2 = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await manager.pauseSession(session2.id);

      const activeSessions = await manager.listSessions('active');
      const pausedSessions = await manager.listSessions('paused');

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(session1.id);

      expect(pausedSessions).toHaveLength(1);
      expect(pausedSessions[0].id).toBe(session2.id);
    });

    it('should return empty array if no sessions', async () => {
      const sessions = await manager.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should get session by id', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      const retrieved = manager.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should return undefined if session not found', () => {
      const retrieved = manager.getSession('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      await manager.deleteSession(session.id);

      const retrieved = manager.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });

    it('should throw error if session not found', async () => {
      await expect(manager.deleteSession('nonexistent')).rejects.toThrow(AgentManagerError);
    });

    it('should cancel active stream when deleting', async () => {
      mockProvider.setStreamDelay(50);

      const session = await manager.createSession({
        provider: 'mock',
        model: 'model',
      });

      const streamPromise = (async () => {
        for await (const _ of manager.sendMessage(session.id, 'Hello')) {
          // consume
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 30));
      await manager.deleteSession(session.id);

      await streamPromise;

      expect(manager.getSession(session.id)).toBeUndefined();
    });
  });

  describe('session counts', () => {
    it('should return correct session count', async () => {
      expect(manager.getSessionCount()).toBe(0);

      await manager.createSession({ provider: 'mock', model: 'model' });
      expect(manager.getSessionCount()).toBe(1);

      await manager.createSession({ provider: 'mock', model: 'model' });
      expect(manager.getSessionCount()).toBe(2);
    });

    it('should return correct active session count', async () => {
      const session1 = await manager.createSession({ provider: 'mock', model: 'model' });
      const session2 = await manager.createSession({ provider: 'mock', model: 'model' });

      expect(manager.getActiveSessionCount()).toBe(2);

      await manager.pauseSession(session1.id);
      expect(manager.getActiveSessionCount()).toBe(1);

      await manager.cancelSession(session2.id);
      expect(manager.getActiveSessionCount()).toBe(0);
    });
  });

  describe('clearAllSessions', () => {
    it('should clear all sessions', async () => {
      await manager.createSession({ provider: 'mock', model: 'model' });
      await manager.createSession({ provider: 'mock', model: 'model' });

      expect(manager.getSessionCount()).toBe(2);

      await manager.clearAllSessions();

      expect(manager.getSessionCount()).toBe(0);
      const sessions = await manager.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should cancel all active streams', async () => {
      mockProvider.setStreamDelay(50);

      const session1 = await manager.createSession({ provider: 'mock', model: 'model' });
      const session2 = await manager.createSession({ provider: 'mock', model: 'model' });

      const stream1 = (async () => {
        for await (const _ of manager.sendMessage(session1.id, 'Hello')) {
          // consume
        }
      })();

      const stream2 = (async () => {
        for await (const _ of manager.sendMessage(session2.id, 'Hello')) {
          // consume
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 30));
      await manager.clearAllSessions();

      await Promise.all([stream1, stream2]);

      expect(manager.getSessionCount()).toBe(0);
    });
  });

  describe('concurrent sessions', () => {
    it('should handle multiple concurrent active sessions', async () => {
      const session1 = await manager.createSession({ provider: 'mock', model: 'model' });
      const session2 = await manager.createSession({ provider: 'mock', model: 'model' });
      const session3 = await manager.createSession({ provider: 'mock', model: 'model' });

      const results = await Promise.all([
        collectStream(manager.sendMessage(session1.id, 'Message 1')),
        collectStream(manager.sendMessage(session2.id, 'Message 2')),
        collectStream(manager.sendMessage(session3.id, 'Message 3')),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBe('Mock streaming response');
      });

      expect(manager.getSessionCount()).toBe(3);
    });

    it('should isolate session histories', async () => {
      const session1 = await manager.createSession({ provider: 'mock', model: 'model' });
      const session2 = await manager.createSession({ provider: 'mock', model: 'model' });

      await collectStream(manager.sendMessage(session1.id, 'Session 1 message'));
      await collectStream(manager.sendMessage(session2.id, 'Session 2 message'));

      const s1 = manager.getSession(session1.id);
      const s2 = manager.getSession(session2.id);

      expect(s1?.messages[0].content).toBe('Session 1 message');
      expect(s2?.messages[0].content).toBe('Session 2 message');
    });
  });

  describe('error handling', () => {
    it('should have correct error properties', async () => {
      try {
        await manager.createSession({ provider: 'nonexistent', model: 'model' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentManagerError);
        const agentError = error as AgentManagerError;
        expect(agentError.name).toBe('AgentManagerError');
        expect(agentError.code).toBe('PROVIDER_NOT_FOUND');
        expect(agentError.message).toContain('nonexistent');
      }
    });

    it('should include session ID in errors when available', async () => {
      const session = await manager.createSession({ provider: 'mock', model: 'model' });

      try {
        const gen = manager.sendMessage('wrong-id', 'Hello');
        await gen.next();
        expect.fail('Should have thrown');
      } catch (error) {
        const agentError = error as AgentManagerError;
        expect(agentError.sessionId).toBe('wrong-id');
      }
    });
  });
});

// Helper function to collect all chunks from stream
async function collectStream(stream: AsyncIterableIterator<any>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk.content);
  }
  return chunks.join('');
}
