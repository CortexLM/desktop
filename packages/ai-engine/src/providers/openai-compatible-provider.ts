/**
 * Base commune aux providers exposant une API compatible OpenAI
 * (`POST /chat/completions`, streaming SSE, `GET /models`).
 *
 * Les sous-classes ne déclarent que ce qui les distingue réellement :
 * identité, URL par défaut, modèle par défaut et en-têtes additionnels.
 */

import {
  AIProvider,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderConfig,
} from './base';
import { parseSSEStream } from './sse';

/**
 * Réponse `/chat/completions` (mode non-streaming)
 */
export interface OpenAICompatibleResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Paramètres fournis par la sous-classe à la construction
 */
export interface OpenAICompatibleOptions {
  /** URL de base utilisée si `config.baseUrl` est absent */
  defaultBaseUrl: string;
  /** Modèle utilisé si ni les options d'appel ni `config.defaultModel` ne le précisent */
  fallbackModel: string;
  /**
   * Nombre total de tentatives par requête si `config.maxRetries` est absent.
   * `1` désactive les retries.
   */
  defaultMaxRetries?: number;
  /** Délai de base du backoff exponentiel (ms) si `config.retryDelay` est absent */
  defaultRetryDelay?: number;
}

export abstract class OpenAICompatibleProvider extends AIProvider {
  protected readonly baseUrl: string;
  protected readonly fallbackModel: string;
  protected readonly maxRetries: number;
  protected readonly retryDelay: number;

  constructor(config: ProviderConfig, options: OpenAICompatibleOptions) {
    super(config);

    this.baseUrl = config.baseUrl || options.defaultBaseUrl;
    this.fallbackModel = options.fallbackModel;
    this.maxRetries = config.maxRetries ?? options.defaultMaxRetries ?? 1;
    this.retryDelay = config.retryDelay ?? options.defaultRetryDelay ?? 1000;
  }

  /**
   * En-têtes additionnels spécifiques au provider (ex: attribution OpenRouter).
   * `Authorization` et `Content-Type` sont déjà gérés.
   */
  protected additionalHeaders(): Record<string, string> {
    return {};
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      ...this.additionalHeaders(),
    };
  }

  /**
   * Construit le corps de la requête `/chat/completions`
   */
  protected buildRequestBody(
    messages: Message[],
    options: ChatOptions | undefined,
    stream: boolean
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: options?.model || this.config.defaultModel || this.fallbackModel,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stop,
    };

    if (stream) {
      body.stream = true;
    }

    return body;
  }

  /**
   * `fetch` avec backoff exponentiel sur 5xx et 429.
   *
   * Les erreurs réseau sont également retentées. `maxRetries = 1` équivaut à
   * une seule tentative.
   */
  protected async fetchWithRetry(
    url: string,
    init: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      const response = await fetch(url, init);

      if (this.shouldRetry(response.status) && attempt < this.maxRetries) {
        await this.backoff(attempt);
        return this.fetchWithRetry(url, init, attempt + 1);
      }

      return response;
    } catch (error) {
      if (attempt < this.maxRetries) {
        await this.backoff(attempt);
        return this.fetchWithRetry(url, init, attempt + 1);
      }
      throw error;
    }
  }

  private shouldRetry(status: number): boolean {
    return status >= 500 || status === 429;
  }

  private backoff(attempt: number): Promise<void> {
    const delay = this.retryDelay * Math.pow(2, attempt - 1);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Envoie la requête chat et lève une erreur si la réponse n'est pas OK
   */
  private async postChatCompletions(
    messages: Message[],
    options: ChatOptions | undefined,
    stream: boolean
  ): Promise<Response> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(this.buildRequestBody(messages, options, stream)),
    });

    if (!response.ok) {
      throw new Error(await this.extractErrorMessage(response));
    }

    return response;
  }

  /**
   * Extrait le message d'erreur du corps de réponse, avec repli sur `statusText`
   */
  private async extractErrorMessage(response: Response): Promise<string> {
    const payload = await response
      .json()
      .catch(() => ({ error: { message: response.statusText } }));

    const error = (payload as { error?: unknown }).error;

    if (typeof error === 'string') {
      return error || 'Request failed';
    }

    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message) {
        return message;
      }
    }

    return 'Request failed';
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    try {
      const response = await this.postChatCompletions(messages, options, false);
      const data = (await response.json()) as OpenAICompatibleResponse;
      const choice = data.choices[0];

      return {
        content: choice.message.content || '',
        model: data.model,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        finishReason: choice.finish_reason || undefined,
      };
    } catch (error) {
      this.handleError(error, 'chat failed');
    }
  }

  async *stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterableIterator<StreamChunk> {
    try {
      const response = await this.postChatCompletions(messages, options, true);

      if (!response.body) {
        throw new Error('Response body is null');
      }

      yield* parseSSEStream(response.body);
    } catch (error) {
      this.handleError(error, 'stream failed');
    }
  }

  /**
   * Vérifie la disponibilité via `GET /models`.
   *
   * Volontairement sans retry : un check de disponibilité doit être rapide.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
