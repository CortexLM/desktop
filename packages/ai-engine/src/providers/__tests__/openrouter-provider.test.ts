import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;
import { OpenRouterProvider } from '../openrouter-provider';
import type { Message } from '../base';

// Mock fetch
const mockFetch = mock();
global.fetch = mockFetch as any;

describe('OpenRouterProvider', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Constructor', () => {
    it('should create provider with API key', () => {
      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      expect(provider.id).toBe('openrouter');
      expect(provider.name).toBe('OpenRouter');
    });

    it('should throw error without API key', () => {
      expect(() => {
        new OpenRouterProvider({});
      }).toThrow('OpenRouter API key is required');
    });

    it('should use default base URL', () => {
      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const provider = new OpenRouterProvider({ 
        apiKey: 'test-key',
        baseUrl: 'https://custom.openrouter.com'
      });
      expect(provider).toBeDefined();
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-test',
          model: 'anthropic/claude-opus-4.8-fast',
          choices: [{
            message: { role: 'assistant', content: 'Hello from OpenRouter!' },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 30,
            total_tokens: 50,
          },
        }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const response = await provider.chat(messages);

      expect(response.content).toBe('Hello from OpenRouter!');
      expect(response.model).toBe('anthropic/claude-opus-4.8-fast');
      expect(response.usage.inputTokens).toBe(20);
      expect(response.usage.outputTokens).toBe(30);
      expect(response.usage.totalTokens).toBe(50);
      expect(response.finishReason).toBe('stop');
    });

    it('should include required headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-test',
          model: 'test-model',
          choices: [{ message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      await provider.chat([{ role: 'user', content: 'test' }]);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      
      expect(headers['Authorization']).toBe('Bearer test-key');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['HTTP-Referer']).toBe('https://cortex.foundation');
      expect(headers['X-Title']).toBe('Cortex');
    });

    it('should use custom model from options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-test',
          model: 'custom-model',
          choices: [{ message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      await provider.chat([{ role: 'user', content: 'test' }], { model: 'custom-model' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('custom-model');
    });

    it('should pass chat options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-test',
          model: 'test-model',
          choices: [{ message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      await provider.chat([{ role: 'user', content: 'test' }], {
        temperature: 0.9,
        maxTokens: 3000,
        topP: 0.98,
        stop: ['STOP'],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.9);
      expect(body.max_tokens).toBe(3000);
      expect(body.top_p).toBe(0.98);
      expect(body.stop).toEqual(['STOP']);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'Invalid request' },
        }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      
      await expect(provider.chat([{ role: 'user', content: 'test' }])).rejects.toThrow();
    });

    it('should handle empty content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-empty',
          model: 'test-model',
          choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
        }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      const response = await provider.chat([{ role: 'user', content: 'test' }]);

      expect(response.content).toBe('');
    });
  });

  describe('stream', () => {
    it('should stream chat response', async () => {
      const streamData = [
        'data: {"id":"gen-1","model":"test","choices":[{"delta":{"content":"Hello "},"finish_reason":null}]}',
        'data: {"id":"gen-1","model":"test","choices":[{"delta":{"content":"World"},"finish_reason":null}]}',
        'data: {"id":"gen-1","model":"test","choices":[{"delta":{},"finish_reason":"stop"}]}',
        'data: [DONE]',
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const line of streamData) {
            controller.enqueue(encoder.encode(line + '\n'));
          }
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      const chunks: string[] = [];

      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(['Hello ', 'World']);
    });

    it('should handle stream errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error',
        json: async () => ({ error: 'Stream failed' }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });

      // `.rejects` needs a promise, so the consuming loop runs inside an IIFE.
      await expect(
        (async () => {
        for await (const _chunk of provider.stream([{ role: 'user', content: 'test' }])) {
          // Should not reach here
        }
        })()
      ).rejects.toThrow();
    });

    it('should ignore malformed stream lines', async () => {
      const streamData = [
        'data: {"id":"gen-1","model":"test","choices":[{"delta":{"content":"Valid"},"finish_reason":null}]}',
        'data: {invalid json',
        'data: {"id":"gen-1","model":"test","choices":[{"delta":{"content":" content"},"finish_reason":null}]}',
        'data: [DONE]',
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const line of streamData) {
            controller.enqueue(encoder.encode(line + '\n'));
          }
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      const chunks: string[] = [];

      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(['Valid', ' content']);
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });
});
