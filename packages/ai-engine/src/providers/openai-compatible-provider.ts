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
  ProviderModel,
  ProviderTool,
  ProviderToolCall,
} from './base';
import { parseSSEStream, parseToolArguments } from './sse';

/** Appel d'outil au format OpenAI, tel qu'il circule sur le fil. */
export interface OpenAIToolCall {
  id: string;
  type?: string;
  function: {
    name: string;
    /** JSON sérialisé, pas un objet : c'est ce que renvoie l'API. */
    arguments: string;
  };
}

/**
 * Réponse `/chat/completions` (mode non-streaming)
 */
export interface OpenAICompatibleResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      /** Nul quand le modèle ne fait qu'appeler des outils. */
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

/** Entrée de `GET /models`, dans la forme la plus large observée. */
interface OpenAIModelEntry {
  id: string;
  name?: string;
  context_length?: number;
  top_provider?: { max_completion_tokens?: number | null };
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[] };
}

/**
 * Convertit un outil interne au schéma de fonction OpenAI.
 *
 * L'enveloppe `{ type: 'function', function: {...} }` est ce que réclament
 * OpenAI, OpenRouter, Together et Ollama : envoyer l'outil à plat est refusé.
 */
function toOpenAITool(tool: ProviderTool): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

export function toProviderToolCalls(calls: OpenAIToolCall[] | undefined): ProviderToolCall[] | undefined {
  if (!calls || calls.length === 0) return undefined;

  return calls.map((call) => ({
    id: call.id,
    name: call.function.name,
    arguments: parseToolArguments(call.function.arguments),
  }));
}

/**
 * Sérialise un message interne au format attendu sur le fil.
 *
 * Un message `tool` doit porter `tool_call_id`, et un message assistant doit
 * renvoyer ses `tool_calls` : sans cet appariement, le provider reçoit un
 * résultat qui ne correspond à aucune demande et rejette la requête entière.
 */
/**
 * Comptage de tokens depuis une réponse.
 *
 * Chaque champ est facultatif, et le bloc entier peut manquer : certaines
 * passerelles ne le renvoient pas du tout. Le lire sans garde levait une erreur
 * qui ne disait rien de ce que le provider avait réellement renvoyé.
 */
function toTokenUsage(usage: OpenAICompatibleResponse['usage']): ChatResponse['usage'] {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    cacheReadInputTokens: usage?.prompt_tokens_details?.cached_tokens,
  };
}

/** Convertit la réponse `/chat/completions` en `ChatResponse`. */
export function toChatResponse(data: OpenAICompatibleResponse): ChatResponse {
  const choice = data.choices[0];
  if (!choice) throw new Error('response contained no choices');

  return {
    content: choice.message.content ?? '',
    model: data.model,
    usage: toTokenUsage(data.usage),
    finishReason: choice.finish_reason || undefined,
    toolCalls: toProviderToolCalls(choice.message.tool_calls),
  };
}

export function toWireMessage(message: Message): Record<string, unknown> {
  const wire: Record<string, unknown> = { role: message.role, content: message.content };

  if (message.role === 'tool') {
    wire.tool_call_id = message.toolCallId;
    if (message.name) wire.name = message.name;
    return wire;
  }

  if (message.toolCalls?.length) {
    // `content` doit être nul et non vide sur un tour purement outil : certains
    // providers refusent une chaîne vide accompagnée de tool_calls.
    wire.content = message.content || null;
    wire.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.arguments) },
    }));
  }

  return wire;
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
  /**
   * Partie « outils » du corps de requête.
   *
   * Renvoie un objet vide quand il n'y a pas d'outil : un `tools: []` explicite
   * amène certains providers à refuser de répondre en prose. `tool_choice` n'est
   * jamais transmis seul — sans outils il ne veut rien dire.
   */
  private toolSection(options: ChatOptions | undefined): Record<string, unknown> {
    if (!options?.tools?.length) return {};

    const section: Record<string, unknown> = { tools: options.tools.map(toOpenAITool) };
    if (options.toolChoice) section.tool_choice = options.toolChoice;

    return section;
  }

  protected buildRequestBody(
    messages: Message[],
    options: ChatOptions | undefined,
    stream: boolean
  ): Record<string, unknown> {
    return {
      model: options?.model || this.config.defaultModel || this.fallbackModel,
      messages: messages.map(toWireMessage),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stop,
      // `tools` était déclaré dans ChatOptions mais jamais transmis : le typage
      // promettait un appel d'outil que la requête ne demandait pas, donc aucun
      // provider compatible OpenAI n'en émettait jamais.
      ...this.toolSection(options),
      // `include_usage` sans quoi la plupart des providers omettent `usage` en
      // streaming, et la comptabilisation des tokens d'un flux est perdue.
      ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
    };
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
      return toChatResponse(data);
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

  /**
   * Catalogue du provider, lu depuis `GET /models`.
   *
   * Les capacités viennent de `supported_parameters` quand le provider le
   * renseigne (OpenRouter le fait) : c'est la seule source qui dise si un modèle
   * accepte les outils, et un sélecteur qui propose un modèle sans outils pour
   * une session d'agent envoie l'utilisateur dans un mur.
   */
  override async listModels(): Promise<ProviderModel[]> {
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/models`, {
        headers: this.buildHeaders(),
      });
      if (!response.ok) return [];

      const payload = (await response.json()) as { data?: OpenAIModelEntry[] };

      return (payload.data ?? []).map((entry) => {
        const parameters = entry.supported_parameters ?? [];
        const modalities = entry.architecture?.input_modalities ?? [];

        return {
          id: entry.id,
          displayName: entry.name ?? entry.id,
          contextLength: entry.context_length,
          maxOutputTokens: entry.top_provider?.max_completion_tokens ?? undefined,
          // Absent `supported_parameters`, on ne prétend rien : `undefined` veut
          // dire « inconnu », ce qui n'est pas la même chose que « non supporté ».
          supportsTools: parameters.length > 0 ? parameters.includes('tools') : undefined,
          supportsStreaming: true,
          supportsVision: modalities.length > 0 ? modalities.includes('image') : undefined,
        };
      });
    } catch {
      return [];
    }
  }
}
