import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIProvider } from '../openai-provider';
import type { Message } from '../base';

/**
 * Loose stand-ins for the OpenAI SDK request/response shapes.
 *
 * Declared explicitly rather than inferred from the default mock literal:
 * inference would pin the mock to that one literal and reject the variants the
 * tests set up (`prompt_tokens_details`, `content: null`, streaming
 * generators), and would type `mock.calls` as an empty tuple.
 */
interface MockChatParams {
  // OpenAIProvider always sets these two
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  response_format?: unknown;
}

interface MockChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: { cached_tokens: number };
  };
}

interface MockChatChunk {
  choices: Array<{
    index: number;
    delta: { content?: string };
    finish_reason: string | null;
  }>;
}

type MockChatStream = AsyncGenerator<MockChatChunk, void, unknown>;

/**
 * The SDK's `create` returns a completion when `stream` is unset and a stream
 * when it is set. Both branches are awaited here (a bare
 * `Promise<Completion> | AsyncGenerator<...>` union makes
 * `mockResolvedValueOnce` resolve to `never`), which matches how the provider
 * consumes it: `await create(...)` then `for await (...)`.
 */
type MockCreateResult = Promise<MockChatCompletion | MockChatStream>;

// Mock OpenAI SDK
//
// `vi.mock` is hoisted above all imports, so its factory runs before any
// top-level `const` in this file is initialised. The spies it closes over must
// therefore be created inside `vi.hoisted`, which is lifted with it.
const { mockOpenAICreate, mockModelsList } = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn(
    (_params: MockChatParams): MockCreateResult =>
      Promise.resolve({
        id: 'chat_test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello from GPT!',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40,
        },
      })
  ),

  mockModelsList: vi.fn(
    (): Promise<{ data: Array<{ id: string }> }> => Promise.resolve({ data: [] })
  ),
}));

const mockOpenAIStream = vi.fn(async function* (): AsyncGenerator<MockChatChunk, void, unknown> {
  yield { 
    choices: [{ index: 0, delta: { content: 'Hello ' }, finish_reason: null }] 
  };
  yield { 
    choices: [{ index: 0, delta: { content: 'from ' }, finish_reason: null }] 
  };
  yield { 
    choices: [{ index: 0, delta: { content: 'GPT!' }, finish_reason: null }] 
  };
  yield { 
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] 
  };
});

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: mockOpenAICreate,
      },
    };
    models = {
      list: mockModelsList,
    };
  },
}));

/**
 * Params of the first recorded `chat.completions.create` call.
 * Throws instead of returning `undefined` so a missing call fails the test
 * with a clear message rather than a property access on `undefined`.
 */
function firstCreateParams(): MockChatParams {
  const call = mockOpenAICreate.mock.calls[0];
  if (!call) {
    throw new Error('chat.completions.create was never called');
  }
  return call[0];
}

describe('OpenAIProvider', () => {
  beforeEach(() => {
    mockOpenAICreate.mockClear();
    mockOpenAIStream.mockClear();
    mockModelsList.mockClear();
  });

  describe('Constructor', () => {
    it('should create provider with API key', () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      expect(provider.id).toBe('openai');
      expect(provider.name).toBe('OpenAI');
    });

    it('should throw error without API key', () => {
      expect(() => {
        new OpenAIProvider({});
      }).toThrow('OpenAI API key is required');
    });

    it('should accept custom base URL', () => {
      const provider = new OpenAIProvider({ 
        apiKey: 'test-key',
        baseUrl: 'https://custom.openai.com'
      });
      expect(provider).toBeDefined();
    });

    it('should accept cache manager', () => {
      const mockCacheManager = {} as any;
      const provider = new OpenAIProvider({ 
        apiKey: 'test-key',
        cacheManager: mockCacheManager
      });
      expect(provider).toBeDefined();
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ];

      const response = await provider.chat(messages);

      expect(response.content).toBe('Hello from GPT!');
      expect(response.model).toBe('gpt-4.5-turbo');
      expect(response.usage.inputTokens).toBe(15);
      expect(response.usage.outputTokens).toBe(25);
      expect(response.usage.totalTokens).toBe(40);
      expect(response.finishReason).toBe('stop');
    });

    it('should handle system message', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ];

      await provider.chat(messages);

      expect(mockOpenAICreate).toHaveBeenCalled();
      const callArgs = firstCreateParams();
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[0].content).toBe('You are helpful');
    });

    it('should use custom model from options', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await provider.chat(messages, { model: 'gpt-4o' });

      const callArgs = firstCreateParams();
      expect(callArgs.model).toBe('gpt-4o');
    });

    it('should use default model from config', async () => {
      const provider = new OpenAIProvider({ 
        apiKey: 'test-key',
        defaultModel: 'gpt-4-turbo'
      });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await provider.chat(messages);

      const callArgs = firstCreateParams();
      expect(callArgs.model).toBe('gpt-4-turbo');
    });

    it('should pass chat options', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await provider.chat(messages, {
        temperature: 0.8,
        maxTokens: 2000,
        topP: 0.95,
        stop: ['END'],
      });

      const callArgs = firstCreateParams();
      expect(callArgs.temperature).toBe(0.8);
      expect(callArgs.max_tokens).toBe(2000);
      expect(callArgs.top_p).toBe(0.95);
      expect(callArgs.stop).toEqual(['END']);
    });

    it('should handle structured output', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Generate JSON' }];
      // `as const` so `type` narrows to the literal the SDK's
      // response_format union requires (it is no longer typed as `any`).
      const schema = {
        type: 'json_object',
        schema: { properties: { name: { type: 'string' } } },
      } as const;

      await provider.chat(messages, {
        structuredOutput: true,
        responseFormat: schema,
      });

      const callArgs = firstCreateParams();
      expect(callArgs.response_format).toEqual(schema);
    });

    it('should handle cache metrics', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        id: 'chat_cached',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4.5-turbo',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Cached response' },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40,
          prompt_tokens_details: {
            cached_tokens: 10,
          },
        },
      });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      const response = await provider.chat(messages);

      expect(response.usage.cacheReadInputTokens).toBe(10);
    });

    it('should handle empty content', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        id: 'chat_empty',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4.5-turbo',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: null },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      const response = await provider.chat(messages);

      expect(response.content).toBe('');
    });
  });

  describe('stream', () => {
    beforeEach(() => {
      mockOpenAICreate.mockImplementation((params) => {
        if (params.stream) {
          return Promise.resolve(mockOpenAIStream());
        }
        return Promise.resolve({
          id: 'chat_test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4.5-turbo',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Hello from GPT!' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
        });
      });
    });

    it('should stream chat response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Stream test' }];

      const chunks: string[] = [];
      for await (const chunk of provider.stream(messages)) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(['Hello ', 'from ', 'GPT!']);
    });

    it('should mark last chunk as done', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Stream test' }];

      let lastChunk;
      for await (const chunk of provider.stream(messages)) {
        lastChunk = chunk;
      }

      expect(lastChunk?.done).toBe(true);
    });

    it('should pass options to stream', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      for await (const chunk of provider.stream(messages, {
        model: 'gpt-4o',
        temperature: 0.5,
      })) {
        // Consume stream
      }

      expect(mockOpenAICreate).toHaveBeenCalled();
      const callArgs = firstCreateParams();
      expect(callArgs.model).toBe('gpt-4o');
      expect(callArgs.temperature).toBe(0.5);
      expect(callArgs.stream).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      mockModelsList.mockResolvedValueOnce({ data: [{ id: 'gpt-4' }] });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockModelsList.mockRejectedValueOnce(new Error('API Error'));

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

});
