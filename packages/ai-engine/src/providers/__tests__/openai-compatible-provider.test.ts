import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;
import { OpenAICompatibleProvider } from '../openai-compatible-provider';
import type { ProviderConfig, Message } from '../base';
import { AIProviderError } from '../base';

const mockFetch = mock();
global.fetch = mockFetch as any;

/** Provider minimal pour exercer la base sans dépendre d'un vrai service. */
class TestProvider extends OpenAICompatibleProvider {
  readonly id = 'test';
  readonly name = 'Test';

  constructor(config: ProviderConfig = { apiKey: 'k' }, overrides: Record<string, unknown> = {}) {
    super(config, {
      defaultBaseUrl: 'https://test.local/v1',
      fallbackModel: 'test-fallback',
      ...overrides,
    });
  }
}

/** Provider ajoutant des en-têtes, comme OpenRouter. */
class HeaderProvider extends OpenAICompatibleProvider {
  readonly id = 'header';
  readonly name = 'Header';

  constructor(config: ProviderConfig = { apiKey: 'k' }) {
    super(config, { defaultBaseUrl: 'https://h.local/v1', fallbackModel: 'm' });
  }

  protected override additionalHeaders(): Record<string, string> {
    return { 'X-Custom': 'yes' };
  }
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

function chatPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'id-1',
    model: 'test-model',
    choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    ...overrides,
  };
}

function sseResponse(lines: string[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const line of lines) {
          controller.enqueue(encoder.encode(line + '\n'));
        }
        controller.close();
      },
    }),
  };
}

const USER_MESSAGE: Message[] = [{ role: 'user', content: 'hello' }];

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    // `mockReset()`, pas `mockClear()` : `mockClear()` remet les compteurs à
    // zéro mais laisse la file des `mockResolvedValueOnce` non consommés. Un
    // test qui échoue avant d'avoir épuisé sa file léguait donc ses réponses au
    // test suivant, qui échouait à son tour pour une raison sans rapport — un
    // seul défaut produisait une cascade de rouges et masquait sa propre cause.
    mockFetch.mockReset();
  });

  describe('configuration', () => {
    it('uses the default base URL when none is configured', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(chatPayload()));

      await new TestProvider().chat(USER_MESSAGE);

      expect(mockFetch.mock.calls[0][0]).toBe('https://test.local/v1/chat/completions');
    });

    it('prefers the configured base URL', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(chatPayload()));

      await new TestProvider({ apiKey: 'k', baseUrl: 'https://custom/v2' }).chat(USER_MESSAGE);

      expect(mockFetch.mock.calls[0][0]).toBe('https://custom/v2/chat/completions');
    });

    it('resolves the model by options > config > fallback', async () => {
      mockFetch.mockResolvedValue(jsonResponse(chatPayload()));

      await new TestProvider().chat(USER_MESSAGE);
      expect(JSON.parse(mockFetch.mock.calls[0][1].body).model).toBe('test-fallback');

      await new TestProvider({ apiKey: 'k', defaultModel: 'from-config' }).chat(USER_MESSAGE);
      expect(JSON.parse(mockFetch.mock.calls[1][1].body).model).toBe('from-config');

      await new TestProvider({ apiKey: 'k', defaultModel: 'from-config' }).chat(USER_MESSAGE, {
        model: 'from-options',
      });
      expect(JSON.parse(mockFetch.mock.calls[2][1].body).model).toBe('from-options');
    });

    it('sends auth and content-type headers', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(chatPayload()));

      await new TestProvider({ apiKey: 'secret' }).chat(USER_MESSAGE);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer secret');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('merges provider-specific headers', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(chatPayload()));

      await new HeaderProvider().chat(USER_MESSAGE);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Custom']).toBe('yes');
      expect(headers['Authorization']).toBe('Bearer k');
    });

    it('omits the stream flag for non-streaming calls', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(chatPayload()));

      await new TestProvider().chat(USER_MESSAGE);

      expect(JSON.parse(mockFetch.mock.calls[0][1].body).stream).toBeUndefined();
    });
  });

  describe('chat', () => {
    it('maps the response to a ChatResponse', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          chatPayload({
            model: 'mapped-model',
            choices: [{ message: { role: 'assistant', content: 'mapped' }, finish_reason: 'length' }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          })
        )
      );

      const response = await new TestProvider().chat(USER_MESSAGE);

      expect(response.content).toBe('mapped');
      expect(response.model).toBe('mapped-model');
      expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
      expect(response.finishReason).toBe('length');
    });

    it('forwards chat options as OpenAI parameters', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(chatPayload()));

      await new TestProvider().chat(USER_MESSAGE, {
        temperature: 0.4,
        maxTokens: 128,
        topP: 0.8,
        stop: ['END'],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.4);
      expect(body.max_tokens).toBe(128);
      expect(body.top_p).toBe(0.8);
      expect(body.stop).toEqual(['END']);
    });

    it('normalises a null finish_reason to undefined', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          chatPayload({
            choices: [{ message: { role: 'assistant', content: 'x' }, finish_reason: null }],
          })
        )
      );

      const response = await new TestProvider().chat(USER_MESSAGE);

      expect(response.finishReason).toBeUndefined();
    });

    it('wraps failures in an AIProviderError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'bad input' } }),
      });

      const promise = new TestProvider().chat(USER_MESSAGE);

      await expect(promise).rejects.toBeInstanceOf(AIProviderError);
      await expect(promise).rejects.toThrow('bad input');
    });

    it('extracts a string error payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'plain string error' }),
      });

      await expect(new TestProvider().chat(USER_MESSAGE)).rejects.toThrow('plain string error');
    });

    it('falls back to statusText when the body is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'I Am A Teapot',
        json: async () => {
          throw new Error('not json');
        },
      });

      await expect(new TestProvider().chat(USER_MESSAGE)).rejects.toThrow('I Am A Teapot');
    });
  });

  describe('retries', () => {
    it('does not retry by default', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

      await expect(new TestProvider().chat(USER_MESSAGE)).rejects.toThrow();

      expect(mockFetch.mock.calls.length).toBe(1);
    });

    it('retries 5xx up to maxRetries', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 502 })
        .mockResolvedValueOnce(jsonResponse(chatPayload()));

      const provider = new TestProvider({ apiKey: 'k', maxRetries: 3, retryDelay: 1 });
      const response = await provider.chat(USER_MESSAGE);

      expect(response.content).toBe('hi');
      expect(mockFetch.mock.calls.length).toBe(3);
    });

    it('retries 429 rate limits', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce(jsonResponse(chatPayload()));

      const provider = new TestProvider({ apiKey: 'k', maxRetries: 2, retryDelay: 1 });
      await provider.chat(USER_MESSAGE);

      expect(mockFetch.mock.calls.length).toBe(2);
    });

    it('does not retry 4xx other than 429', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });

      const provider = new TestProvider({ apiKey: 'k', maxRetries: 3, retryDelay: 1 });
      await expect(provider.chat(USER_MESSAGE)).rejects.toThrow();

      expect(mockFetch.mock.calls.length).toBe(1);
    });

    it('retries network errors then rethrows after the last attempt', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNRESET'));

      const provider = new TestProvider({ apiKey: 'k', maxRetries: 3, retryDelay: 1 });
      await expect(provider.chat(USER_MESSAGE)).rejects.toThrow('ECONNRESET');

      expect(mockFetch.mock.calls.length).toBe(3);
    });

    /**
     * Backoff exponentiel — sous horloge simulée.
     *
     * Ce test assertait `Date.now() - started >= 120` sur du temps mural. Il
     * passait en isolation et échouait sous charge parallèle (observé à 119ms
     * pour un seuil de 120) : l'ordonnanceur peut rendre la main tard, mais il
     * ne peut pas la rendre *tôt*, donc mesurer le temps écoulé ne teste pas le
     * backoff — ça teste la disponibilité du CPU.
     *
     * Relâcher le seuil aurait supprimé l'assertion utile ; `vi.useFakeTimers()`
     * la renforce au contraire. L'horloge n'avance que sur ordre, donc on peut
     * vérifier les deux moitiés du contrat, ce que le temps mural ne permettait
     * pas :
     *
     *   - PAS TROP TÔT : à 1ms de l'échéance, la tentative suivante n'a pas
     *     encore été émise.
     *   - PAS TROP TARD : à l'échéance exacte, elle l'est.
     *
     * L'ancienne assertion `>=` ne pouvait vérifier que la première moitié : un
     * backoff dix fois trop long la passait sans broncher.
     */
    it('waits retryDelay * 2^(attempt-1) before each retry', async () => {
      vi.useFakeTimers();

      try {
        mockFetch
          .mockResolvedValueOnce({ ok: false, status: 500 })
          .mockResolvedValueOnce({ ok: false, status: 500 })
          .mockResolvedValueOnce(jsonResponse(chatPayload()));

        const provider = new TestProvider({ apiKey: 'k', maxRetries: 3, retryDelay: 40 });

        // Le résultat est capturé immédiatement. Si une assertion ci-dessous
        // échoue, la promesse reste en suspens et finit par rejeter (queue de
        // mocks épuisée) : sans ce garde, ce rejet non géré ferait tomber les
        // tests suivants du fichier au lieu de celui-ci seul.
        const settled = provider
          .chat(USER_MESSAGE)
          .then((value) => ({ ok: true as const, value }))
          .catch((error: unknown) => ({ ok: false as const, error }));

        // Première tentative : immédiate, sans attente.
        await vi.advanceTimersByTimeAsync(0);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // 39ms : le premier backoff (40ms) n'est pas écoulé.
        await vi.advanceTimersByTimeAsync(39);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // 40ms pile : deuxième tentative.
        await vi.advanceTimersByTimeAsync(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Le deuxième backoff est de 80ms, pas 40 : à 119ms cumulés la
        // troisième tentative ne doit pas être partie.
        //
        // Note de portée, vérifiée par mutation : sur trois tentatives,
        // exponentiel (40, 80) et linéaire (40×1, 40×2) donnent la MÊME
        // séquence. Ce test verrouille donc les échéances, pas la forme de la
        // courbe ; c'est le test suivant, sur quatre tentatives, qui distingue
        // 10/20/40 de 10/20/30.
        await vi.advanceTimersByTimeAsync(79);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // 120ms cumulés : troisième tentative, celle qui réussit.
        await vi.advanceTimersByTimeAsync(1);
        expect(mockFetch).toHaveBeenCalledTimes(3);

        await vi.runAllTimersAsync();
        expect(await settled).toEqual({ ok: true, value: expect.objectContaining({ content: 'hi' }) });
      } finally {
        vi.useRealTimers();
      }
    });

    /**
     * Le même contrat, exprimé sur les délais *demandés* plutôt que sur les
     * échéances observées. Redondant par construction, mais le message d'échec
     * est directement lisible (`[40, 80]` attendu vs reçu) là où le test
     * ci-dessus ne dit que « appelé 2 fois au lieu de 3 ».
     */
    it('requests exactly the exponential delay sequence', async () => {
      vi.useFakeTimers();

      try {
        const timerSpy = vi.spyOn(globalThis, 'setTimeout');

        mockFetch
          .mockResolvedValueOnce({ ok: false, status: 500 })
          .mockResolvedValueOnce({ ok: false, status: 429 })
          .mockResolvedValueOnce({ ok: false, status: 503 })
          .mockResolvedValueOnce(jsonResponse(chatPayload()));

        const provider = new TestProvider({ apiKey: 'k', maxRetries: 4, retryDelay: 10 });
        const pending = provider.chat(USER_MESSAGE);

        await vi.runAllTimersAsync();
        await pending;

        const delays = timerSpy.mock.calls.map(([, ms]) => ms);
        expect(delays).toEqual([10, 20, 40]);
        expect(mockFetch).toHaveBeenCalledTimes(4);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('stream', () => {
    it('yields content chunks then a terminal chunk', async () => {
      mockFetch.mockResolvedValueOnce(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"a"},"finish_reason":null}]}',
          'data: {"choices":[{"delta":{"content":"b"},"finish_reason":null}]}',
          'data: [DONE]',
        ])
      );

      const chunks = [];
      for await (const chunk of new TestProvider().stream(USER_MESSAGE)) {
        chunks.push(chunk);
      }

      expect(chunks.map((c) => c.content)).toEqual(['a', 'b', '']);
      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('sets the stream flag on the request', async () => {
      mockFetch.mockResolvedValueOnce(sseResponse(['data: [DONE]']));

      for await (const _ of new TestProvider().stream(USER_MESSAGE)) {
        // drain
      }

      expect(JSON.parse(mockFetch.mock.calls[0][1].body).stream).toBe(true);
    });

    it('throws when the response body is null', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, body: null });

      const consume = async () => {
        for await (const _ of new TestProvider().stream(USER_MESSAGE)) {
          // drain
        }
      };

      await expect(consume()).rejects.toThrow('Response body is null');
    });

    it('wraps stream failures in an AIProviderError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'stream boom' } }),
      });

      const consume = async () => {
        for await (const _ of new TestProvider().stream(USER_MESSAGE)) {
          // drain
        }
      };

      await expect(consume()).rejects.toBeInstanceOf(AIProviderError);
    });
  });

  describe('isAvailable', () => {
    it('returns true on a successful models call', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      expect(await new TestProvider().isAvailable()).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toBe('https://test.local/v1/models');
    });

    it('returns false on a non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      expect(await new TestProvider().isAvailable()).toBe(false);
    });

    it('returns false on a network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('offline'));

      expect(await new TestProvider().isAvailable()).toBe(false);
    });

    it('does not retry the availability check', async () => {
      mockFetch.mockRejectedValue(new Error('offline'));

      const provider = new TestProvider({ apiKey: 'k', maxRetries: 3, retryDelay: 1 });
      await provider.isAvailable();

      expect(mockFetch.mock.calls.length).toBe(1);
    });
  });
});
