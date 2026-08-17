import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;
import { GrokProvider } from '../grok-provider';
import type { Message } from '../base';

// Mock fetch
const mockFetch = mock();
global.fetch = mockFetch as any;

describe('GrokProvider', () => {
  beforeEach(() => {
    // `mockReset()` et non `mockClear()` : `mockClear()` laisse les
    // `mockResolvedValueOnce` non consommés dans la file, si bien qu'un test
    // interrompu avant la fin lègue ses réponses au suivant. Un seul échec
    // produisait alors une cascade de rouges sans rapport avec sa cause.
    mockFetch.mockReset();
  });

  describe('Constructor', () => {
    it('should create provider with API key', () => {
      const provider = new GrokProvider({ apiKey: 'test-key' });
      expect(provider.id).toBe('grok');
      expect(provider.name).toBe('Grok');
    });

    it('should throw error without API key', () => {
      expect(() => {
        new GrokProvider({});
      }).toThrow('Grok API key is required');
    });

    it('should use default base URL', () => {
      const provider = new GrokProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const provider = new GrokProvider({ 
        apiKey: 'test-key',
        baseUrl: 'https://custom-grok.ai/v1'
      });
      expect(provider).toBeDefined();
    });

    it('should accept custom retry configuration', () => {
      const provider = new GrokProvider({ 
        apiKey: 'test-key',
        maxRetries: 5,
        retryDelay: 2000,
      });
      expect(provider).toBeDefined();
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-grok',
          model: 'claude-opus-5:stable',
          choices: [{
            message: { role: 'assistant', content: 'Hello from Grok!' },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 25,
            completion_tokens: 35,
            total_tokens: 60,
          },
        }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const response = await provider.chat(messages);

      expect(response.content).toBe('Hello from Grok!');
      expect(response.model).toBe('claude-opus-5:stable');
      expect(response.usage.inputTokens).toBe(25);
      expect(response.usage.outputTokens).toBe(35);
      expect(response.usage.totalTokens).toBe(60);
      expect(response.finishReason).toBe('stop');
    });

    it('should retry on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'gen-retry',
            model: 'claude-opus-5:stable',
            choices: [{ message: { role: 'assistant', content: 'Success after retry' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        });

      const provider = new GrokProvider({ apiKey: 'test-key', retryDelay: 10 });
      const response = await provider.chat([{ role: 'user', content: 'test' }]);

      expect(response.content).toBe('Success after retry');
      expect(mockFetch.mock.calls.length).toBe(3);
    });

    it('should retry on 429 rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'gen-rate-limit',
            model: 'claude-opus-5:stable',
            choices: [{ message: { role: 'assistant', content: 'Success' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        });

      const provider = new GrokProvider({ apiKey: 'test-key', retryDelay: 10 });
      const response = await provider.chat([{ role: 'user', content: 'test' }]);

      expect(response.content).toBe('Success');
      expect(mockFetch.mock.calls.length).toBe(2);
    });

    /**
     * Backoff exponentiel — sous horloge simulée.
     *
     * Ce test mesurait `Date.now() - startTime >= 150` sur du temps mural :
     * observé à 149ms pour un seuil de 150, vert en isolation, rouge sous charge
     * parallèle. L'ordonnanceur peut rendre la main en retard mais jamais en
     * avance, donc le temps écoulé mesurait la contention CPU, pas le backoff.
     *
     * `vi.useFakeTimers()` remplace la mesure par une vérification des délais
     * *demandés* : `retryDelay * 2^(tentative-1)`. GrokProvider n'ayant pas de
     * backoff propre (il hérite d'`OpenAICompatibleProvider`), ce test vérifie
     * que la configuration Grok — `retryDelay: 50` — produit bien la séquence
     * attendue.
     *
     * Quatre tentatives, pas trois : sur trois, exponentiel (50, 100) et
     * linéaire (50×1, 50×2) coïncident, et un backoff linéaire passerait le
     * test. Vérifié par mutation — c'est le troisième délai (200 contre 150) qui
     * distingue les deux courbes.
     */
    it('should use exponential backoff for retries', async () => {
      vi.useFakeTimers();

      try {
        const timerSpy = vi.spyOn(globalThis, 'setTimeout');

        mockFetch
          .mockResolvedValueOnce({ ok: false, status: 500 })
          .mockResolvedValueOnce({ ok: false, status: 500 })
          .mockResolvedValueOnce({ ok: false, status: 429 })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              id: 'gen-backoff',
              model: 'claude-opus-5:stable',
              choices: [{ message: { role: 'assistant', content: 'Success' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          });

        const provider = new GrokProvider({
          apiKey: 'test-key',
          maxRetries: 4,
          retryDelay: 50,
        });
        const pending = provider.chat([{ role: 'user', content: 'test' }]);

        await vi.runAllTimersAsync();
        const response = await pending;

        // 50, 100, 200 : le doublement est asserté, pas approché.
        expect(timerSpy.mock.calls.map(([, ms]) => ms)).toEqual([50, 100, 200]);
        expect(mockFetch.mock.calls.length).toBe(4);
        expect(response.content).toBe('Success');
      } finally {
        vi.useRealTimers();
      }
    });

    /**
     * Le versant « pas trop tôt » du contrat, que l'assertion `>=` d'origine ne
     * pouvait pas exprimer : à 1ms de l'échéance la tentative suivante n'est pas
     * partie, à l'échéance elle l'est.
     */
    it('should not retry before the backoff deadline', async () => {
      vi.useFakeTimers();

      try {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'gen-deadline',
            model: 'claude-opus-5:stable',
            choices: [{ message: { role: 'assistant', content: 'Late' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        });

        const provider = new GrokProvider({ apiKey: 'test-key', retryDelay: 50 });

        // Résultat capturé tout de suite : si une assertion échoue, la promesse
        // en suspens ne doit pas rejeter hors du test et polluer les suivants.
        const settled = provider
          .chat([{ role: 'user', content: 'test' }])
          .then((value) => ({ ok: true as const, value }))
          .catch((error: unknown) => ({ ok: false as const, error }));

        await vi.advanceTimersByTimeAsync(0);
        expect(mockFetch.mock.calls.length).toBe(1);

        await vi.advanceTimersByTimeAsync(49);
        expect(mockFetch.mock.calls.length).toBe(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(mockFetch.mock.calls.length).toBe(2);

        await vi.runAllTimersAsync();
        expect(await settled).toEqual({
          ok: true,
          value: expect.objectContaining({ content: 'Late' }),
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should fail after max retries', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: { message: 'Server error' } }) });

      const provider = new GrokProvider({ apiKey: 'test-key', maxRetries: 2, retryDelay: 10 });

      await expect(provider.chat([{ role: 'user', content: 'test' }])).rejects.toThrow();

      expect(mockFetch.mock.calls.length).toBe(2);
    });

    it('should not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Bad request' } }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });

      await expect(provider.chat([{ role: 'user', content: 'test' }])).rejects.toThrow();

      expect(mockFetch.mock.calls.length).toBe(1);
    });

    it('should use custom model from options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-custom',
          model: 'grok-2',
          choices: [{ message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      await provider.chat([{ role: 'user', content: 'test' }], { model: 'grok-2' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('grok-2');
    });

    it('should pass chat options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-options',
          model: 'claude-opus-5:stable',
          choices: [{ message: { role: 'assistant', content: 'test' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      await provider.chat([{ role: 'user', content: 'test' }], {
        temperature: 0.9,
        maxTokens: 4000,
        topP: 0.98,
        stop: ['STOP'],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.9);
      expect(body.max_tokens).toBe(4000);
      expect(body.top_p).toBe(0.98);
      expect(body.stop).toEqual(['STOP']);
    });

    it('should handle empty content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'gen-empty',
          model: 'claude-opus-5:stable',
          choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
        }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      const response = await provider.chat([{ role: 'user', content: 'test' }]);

      expect(response.content).toBe('');
    });
  });

  describe('stream', () => {
    it('should stream chat response', async () => {
      const streamData = [
        'data: {"id":"gen-1","model":"test","choices":[{"delta":{"content":"Hello "},"finish_reason":null}]}',
        'data: {"id":"gen-1","model":"test","choices":[{"delta":{"content":"Grok"},"finish_reason":null}]}',
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

      const provider = new GrokProvider({ apiKey: 'test-key' });
      const chunks: string[] = [];

      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(['Hello ', 'Grok']);
    });

    it('should retry stream on errors', async () => {
      const streamData = ['data: {"id":"gen-1","model":"test","choices":[{"delta":{"content":"Success"},"finish_reason":null}]}', 'data: [DONE]'];
      const encoder = new TextEncoder();
      
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              for (const line of streamData) {
                controller.enqueue(encoder.encode(line + '\n'));
              }
              controller.close();
            },
          }),
        });

      const provider = new GrokProvider({ apiKey: 'test-key', retryDelay: 10 });
      const chunks: string[] = [];

      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(['Success']);
      expect(mockFetch.mock.calls.length).toBe(2);
    });

    it('should handle stream errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Bad request' } }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });

      // `.rejects` needs a promise, so the consuming loop runs inside an IIFE.
      await expect(
        (async () => {
        for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
          // Should not reach here
        }
        })()
      ).rejects.toThrow();
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new GrokProvider({ apiKey: 'test-key' });
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });
});
