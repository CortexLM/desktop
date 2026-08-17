import type { ProviderConfig, Message, ToolCall } from '../types.js';

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  streamChat(messages: Message[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk>;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  systemPrompt?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  toolCalls?: ToolCall[];
  finishReason: string;
  latency: number;
  cost?: number;
}

export interface ChatStreamChunk {
  content: string;
  done: boolean;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Tarification d'un modèle, en dollars par millier de tokens.
 */
export interface TokenPricing {
  /** Coût pour 1000 tokens d'entrée */
  promptPer1k: number;
  /** Coût pour 1000 tokens de sortie */
  completionPer1k: number;
}

export abstract class BaseProvider implements AIProvider {
  protected config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = config;
  }
  
  abstract get name(): string;
  abstract get model(): string;
  
  abstract chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  abstract streamChat(messages: Message[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk>;
  
  /**
   * Tarification du provider. `undefined` => coût non calculé (0).
   *
   * Déclarer les tarifs suffit : la formule de calcul est partagée.
   */
  protected get pricing(): TokenPricing | undefined {
    return undefined;
  }
  
  protected calculateCost(tokensUsed: { prompt: number; completion: number }): number {
    const pricing = this.pricing;
    if (!pricing) {
      return 0;
    }
    
    return (
      (tokensUsed.prompt / 1000) * pricing.promptPer1k +
      (tokensUsed.completion / 1000) * pricing.completionPer1k
    );
  }
  
  /** Délai de base du backoff exponentiel (ms). Surchargeable pour les tests. */
  protected readonly retryBaseDelayMs: number = 1000;
  
  /** Plafond du backoff (ms). */
  protected readonly retryMaxDelayMs: number = 10000;
  
  protected async withRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (i < retries) {
          const delay = Math.min(this.retryBaseDelayMs * Math.pow(2, i), this.retryMaxDelayMs);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = this.config.timeout
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }
}
