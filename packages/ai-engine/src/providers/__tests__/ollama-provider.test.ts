import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;
import { OllamaProvider } from '../ollama-provider';
import type { Message } from '../base';

// Mock fetch
const mockFetch = mock();
global.fetch = mockFetch as any;

describe('OllamaProvider', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Constructor', () => {
    it('should create provider with default config', () => {
      const provider = new OllamaProvider({});
      expect(provider.id).toBe('ollama');
      expect(provider.name).toBe('Ollama');
    });

    it('should use default base URL', () => {
      const provider = new OllamaProvider({});
      expect(provider).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const provider = new OllamaProvider({ 
        baseUrl: 'http://custom-ollama:11434'
      });
      expect(provider).toBeDefined();
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.1',
          message: {
            role: 'assistant',
            content: 'Hello from Ollama!',
          },
          done: true,
          total_duration: 1000000,
          prompt_eval_count: 50,
          eval_count: 100,
        }),
      });

      const provider = new OllamaProvider({});
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const response = await provider.chat(messages);

      expect(response.content).toBe('Hello from Ollama!');
      expect(response.model).toBe('llama3.1');
      expect(response.usage.inputTokens).toBe(50);
      expect(response.usage.outputTokens).toBe(100);
      expect(response.usage.totalTokens).toBe(150);
      expect(response.finishReason).toBe('stop');
    });

    it('should use custom model from options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'codellama',
          message: { role: 'assistant', content: 'test' },
          done: true,
        }),
      });

      const provider = new OllamaProvider({});
      await provider.chat([{ role: 'user', content: 'test' }], { model: 'codellama' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('codellama');
    });

    it('should use default model from config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'mistral',
          message: { role: 'assistant', content: 'test' },
          done: true,
        }),
      });

      const provider = new OllamaProvider({ defaultModel: 'mistral' });
      await provider.chat([{ role: 'user', content: 'test' }]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('mistral');
    });

    it('should pass chat options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.1',
          message: { role: 'assistant', content: 'test' },
          done: true,
        }),
      });

      const provider = new OllamaProvider({});
      await provider.chat([{ role: 'user', content: 'test' }], {
        temperature: 0.7,
        maxTokens: 1500,
        topP: 0.9,
        stop: ['STOP'],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.options.temperature).toBe(0.7);
      expect(body.options.num_predict).toBe(1500);
      expect(body.options.top_p).toBe(0.9);
      expect(body.options.stop).toEqual(['STOP']);
      expect(body.stream).toBe(false);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Model Not Found',
        json: async () => ({
          error: 'model not found',
        }),
      });

      const provider = new OllamaProvider({});
      
      await expect(provider.chat([{ role: 'user', content: 'test' }])).rejects.toThrow();
    });

    it('should handle missing token counts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.1',
          message: { role: 'assistant', content: 'test' },
          done: true,
        }),
      });

      const provider = new OllamaProvider({});
      const response = await provider.chat([{ role: 'user', content: 'test' }]);

      expect(response.usage.inputTokens).toBe(0);
      expect(response.usage.outputTokens).toBe(0);
      expect(response.usage.totalTokens).toBe(0);
    });
  });

  describe('stream', () => {
    it('should stream chat response', async () => {
      const streamData = [
        JSON.stringify({ model: 'llama3.1', message: { content: 'Hello ' }, done: false }),
        JSON.stringify({ model: 'llama3.1', message: { content: 'World' }, done: false }),
        JSON.stringify({ model: 'llama3.1', message: { content: '!' }, done: true }),
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

      const provider = new OllamaProvider({});
      const chunks: string[] = [];

      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
        if (chunk.done) break;
      }

      expect(chunks).toEqual(['Hello ', 'World', '!']);
    });

    it('should handle stream with empty content', async () => {
      const streamData = [
        JSON.stringify({ model: 'llama3.1', message: {}, done: false }),
        JSON.stringify({ model: 'llama3.1', message: { content: 'Text' }, done: false }),
        JSON.stringify({ model: 'llama3.1', done: true }),
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

      const provider = new OllamaProvider({});
      const chunks: string[] = [];

      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
        if (chunk.done) break;
      }

      expect(chunks).toEqual(['Text']);
    });

    it('should ignore malformed stream lines', async () => {
      const streamData = [
        JSON.stringify({ model: 'llama3.1', message: { content: 'Valid' }, done: false }),
        '{invalid json',
        '',
        JSON.stringify({ model: 'llama3.1', message: { content: ' content' }, done: false }),
        JSON.stringify({ model: 'llama3.1', done: true }),
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

      const provider = new OllamaProvider({});
      const chunks: string[] = [];

      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
        if (chunk.done) break;
      }

      expect(chunks).toEqual(['Valid', ' content']);
    });

    it('should handle stream errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error',
        json: async () => ({ error: 'Stream failed' }),
      });

      const provider = new OllamaProvider({});

      // `.rejects` needs a promise, so the consuming loop runs inside an IIFE.
      await expect(
        (async () => {
        for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
          // Should not reach here
        }
        })()
      ).rejects.toThrow();
    });

    it('should handle null response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const provider = new OllamaProvider({});

      // `.rejects` needs a promise, so the consuming loop runs inside an IIFE.
      await expect(
        (async () => {
        for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
          // Should not reach here
        }
        })()
      ).rejects.toThrow('Response body is null');
    });

    it('should pass options to stream', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ model: 'llama3.1', done: true }) + '\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const provider = new OllamaProvider({});
      
      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }], {
        model: 'codellama',
        temperature: 0.5,
      })) {
        // Consume stream
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('codellama');
      expect(body.options.temperature).toBe(0.5);
      expect(body.stream).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const provider = new OllamaProvider({});
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const provider = new OllamaProvider({});
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const provider = new OllamaProvider({});
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });
});
