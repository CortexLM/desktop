import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicProvider } from '../anthropic-provider';
import type { Message } from '../base';

/**
 * Loose stand-ins for the Anthropic SDK request/response shapes.
 *
 * Declared explicitly rather than inferred from the default mock literal, so
 * the tests can set up cache-metric variants and read `mock.calls[0][0]`.
 */
interface MockMessageParams {
  // AnthropicProvider always sets these four
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  top_p?: number;
  metadata?: { thinking?: { type: string; budget_tokens: number } };
}

interface MockMessageResponse {
  id: string;
  type: string;
  role: string;
  model: string;
  content: Array<{ type: string; text: string }>;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

interface MockStreamEvent {
  type: string;
  delta?: { type: string; text: string };
}

// Mock Anthropic SDK
//
// `vi.mock` is hoisted above the imports, so the spies its factory closes over
// must be created inside `vi.hoisted` — plain `const`s above would still be in
// their temporal dead zone when the factory runs.
const { mockAnthropicCreate, mockAnthropicStream } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(
    (_params: MockMessageParams): Promise<MockMessageResponse> =>
      Promise.resolve({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4.8',
        content: [{ type: 'text', text: 'Hello from Claude!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      })
  ),

  mockAnthropicStream: vi.fn(
    async function* (): AsyncGenerator<MockStreamEvent, void, unknown> {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'from ' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Claude!' } };
      yield { type: 'message_stop' };
    }
  ),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    messages = {
      create: mockAnthropicCreate,
      stream: mockAnthropicStream,
    };
  },
}));

/**
 * Params of the first recorded `messages.create` call.
 * Throws instead of returning `undefined` so a missing call fails the test
 * with a clear message rather than a property access on `undefined`.
 */
function firstCreateParams(): MockMessageParams {
  const call = mockAnthropicCreate.mock.calls[0];
  if (!call) {
    throw new Error('messages.create was never called');
  }
  return call[0];
}

describe('AnthropicProvider', () => {
  beforeEach(() => {
    mockAnthropicCreate.mockClear();
    mockAnthropicStream.mockClear();
  });

  describe('Constructor', () => {
    it('should create provider with API key', () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      expect(provider.id).toBe('anthropic');
      expect(provider.name).toBe('Anthropic');
    });

    it('should throw error without API key', () => {
      expect(() => {
        new AnthropicProvider({});
      }).toThrow('Anthropic API key is required');
    });

    it('should accept custom base URL', () => {
      const provider = new AnthropicProvider({ 
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com'
      });
      expect(provider).toBeDefined();
    });

    it('should accept cache manager', () => {
      const mockCacheManager = {} as any;
      const provider = new AnthropicProvider({ 
        apiKey: 'test-key',
        cacheManager: mockCacheManager
      });
      expect(provider).toBeDefined();
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ];

      const response = await provider.chat(messages);

      expect(response.content).toBe('Hello from Claude!');
      expect(response.model).toBe('claude-opus-4.8');
      expect(response.usage.inputTokens).toBe(10);
      expect(response.usage.outputTokens).toBe(20);
      expect(response.usage.totalTokens).toBe(30);
      expect(response.finishReason).toBe('end_turn');
    });

    it('should handle system message', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const messages: Message[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ];

      await provider.chat(messages);

      expect(mockAnthropicCreate).toHaveBeenCalled();
      const callArgs = firstCreateParams();
      expect(callArgs.system).toBe('You are helpful');
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].content).toBe('Hello');
    });

    it('should use custom model from options', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await provider.chat(messages, { model: 'claude-3-opus' });

      const callArgs = firstCreateParams();
      expect(callArgs.model).toBe('claude-3-opus');
    });

    it('should use default model from config', async () => {
      const provider = new AnthropicProvider({ 
        apiKey: 'test-key',
        defaultModel: 'claude-3-sonnet'
      });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await provider.chat(messages);

      const callArgs = firstCreateParams();
      expect(callArgs.model).toBe('claude-3-sonnet');
    });

    it('should pass chat options', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await provider.chat(messages, {
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
      });

      const callArgs = firstCreateParams();
      expect(callArgs.temperature).toBe(0.7);
      expect(callArgs.max_tokens).toBe(1000);
      expect(callArgs.top_p).toBe(0.9);
    });

    it('should enable extended thinking', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Complex problem' }];

      await provider.chat(messages, { extendedThinking: true });

      const callArgs = firstCreateParams();
      expect(callArgs.metadata?.thinking).toEqual({ 
        type: 'enabled', 
        budget_tokens: 10000 
      });
    });

    it('should handle cache usage metrics', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        id: 'msg_cached',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4.8',
        content: [{ type: 'text', text: 'Cached response' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 50,
        },
      });

      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      const response = await provider.chat(messages);

      expect(response.usage.cacheCreationInputTokens).toBe(100);
      expect(response.usage.cacheReadInputTokens).toBe(50);
    });
  });

  describe('stream', () => {
    it('should stream chat response', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Stream test' }];

      const chunks: string[] = [];
      for await (const chunk of provider.stream(messages)) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(['Hello ', 'from ', 'Claude!']);
    });

    it('should handle system message in stream', async () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const messages: Message[] = [
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: 'Test' }
      ];

      for await (const chunk of provider.stream(messages)) {
        // Just consume the stream
      }

      expect(mockAnthropicStream).toHaveBeenCalled();
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4.8',
        content: [{ type: 'text', text: 'test' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockAnthropicCreate.mockRejectedValueOnce(new Error('API Error'));

      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

});
