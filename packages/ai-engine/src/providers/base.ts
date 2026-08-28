// Interface de base pour tous les providers AI

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  role: MessageRole;
  /**
   * Peut être vide sur un message assistant qui ne fait qu'appeler des outils :
   * le modèle répond alors uniquement par `toolCalls`.
   */
  content: string;
  /**
   * Outils demandés par l'assistant. Doivent être renvoyés tels quels au tour
   * suivant : sans eux, le provider reçoit un résultat d'outil qui ne correspond
   * à aucun appel et rejette la requête.
   */
  toolCalls?: ProviderToolCall[];
  /**
   * Identifiant de l'appel auquel ce message répond. Obligatoire sur un message
   * `tool` — c'est ce qui apparie le résultat à sa demande.
   */
  toolCallId?: string;
  /** Nom de l'outil, attendu par certains providers sur un message `tool`. */
  name?: string;
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

/**
 * Contrainte sur l'appel d'outil.
 *
 * `required` force le modèle à appeler un outil au lieu de répondre en prose :
 * indispensable quand la boucle attend une action et non un commentaire.
 */
export type ToolChoice = 'auto' | 'none' | 'required';

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
  tools?: ProviderTool[];
  toolChoice?: ToolChoice;
}

/** Un modèle exposé par un provider, tel que le sélecteur l'affiche. */
export interface ProviderModel {
  id: string;
  /** Libellé lisible. Retombe sur `id` quand le provider n'en fournit pas. */
  displayName: string;
  contextLength?: number;
  maxOutputTokens?: number;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  supportsVision?: boolean;
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

  /** The configured default model, when the user or environment named one. */
  get defaultModel(): string | undefined {
    return this.config.defaultModel;
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
   * Modèles exposés par ce provider.
   *
   * Retourne une liste vide par défaut : tous les providers ne publient pas de
   * catalogue, et un sélecteur vide est plus honnête qu'une liste inventée.
   */
  listModels(): Promise<ProviderModel[]> {
    return Promise.resolve([]);
  }

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
