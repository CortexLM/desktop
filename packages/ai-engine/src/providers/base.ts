// Interface de base pour tous les providers AI

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** JSON-schema tool the model may call. Independent of the agent-loop types. */
export interface ProviderTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
  tools?: ProviderTool[];
}

export interface ProviderTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /**
   * Tokens written to the provider's prompt cache.
   * Only set by providers that report it (Anthropic).
   */
  cacheCreationInputTokens?: number;
  /**
   * Tokens served from the provider's prompt cache.
   * Set by Anthropic (`cache_read_input_tokens`) and OpenAI
   * (`prompt_tokens_details.cached_tokens`).
   */
  cacheReadInputTokens?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: ProviderTokenUsage;
  finishReason?: string;
  toolCalls?: ProviderToolCall[];
}

export interface StreamChunk {
  content: string;
  done: boolean;
  toolCalls?: ProviderToolCall[];
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  /** Nombre de tentatives (1 = pas de retry). */
  maxRetries?: number;
  /** Délai initial du backoff, en ms. */
  retryDelay?: number;
  /**
   * Options additionnelles spécifiques au provider.
   *
   * Les champs connus sont déclarés ci-dessus : sous une signature d'index en
   * `unknown` seule, `config.maxRetries` s'élargissait à `unknown` et cassait
   * son usage numérique.
   */
  [key: string]: unknown;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public providerId: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export abstract class AIProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  
  protected config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  abstract chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse>;

  abstract stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterableIterator<StreamChunk>;

  abstract isAvailable(): Promise<boolean>;

  /**
   * Normalise n'importe quoi de levé par un SDK en `AIProviderError`.
   *
   * Les SDK lèvent des formes variées (Error, réponse HTTP, objet nu), d'où
   * `unknown` en entrée et une lecture défensive des champs.
   */
  protected handleError(error: unknown, context: string): never {
    const details = (error ?? {}) as {
      message?: unknown;
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      type?: unknown;
    };

    const message = typeof details.message === 'string' ? details.message : 'Unknown error';
    const rawStatus = details.status ?? details.statusCode;
    const statusCode = typeof rawStatus === 'number' ? rawStatus : undefined;
    const rawCode = details.code ?? details.type;
    const code = typeof rawCode === 'string' ? rawCode : undefined;
    
    throw new AIProviderError(
      `${this.name} ${context}: ${message}`,
      this.id,
      code,
      statusCode
    );
  }
}
