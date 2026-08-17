/**
 * Enhanced Anthropic provider with prompt caching support.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderConfig,
  ProviderTokenUsage,
} from './base';

export interface AnthropicChatOptions extends ChatOptions {
  /** Enable extended thinking mode (Claude Opus 4.8+) */
  extendedThinking?: boolean;
}

/**
 * Prompt-cache counters returned by the Messages API.
 *
 * `@anthropic-ai/sdk@0.32.1` does not declare them on `Anthropic.Usage`, even
 * though the API sends them whenever `cache_control` is used. Declared here so
 * the values can be read without an `any` cast; drop this once the SDK is
 * upgraded to a version that types them.
 */
interface UsageWithCacheMetrics extends Anthropic.Usage {
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Corps d'une requête `messages.create` / `messages.stream`.
 *
 * Dérivé des types du SDK pour rester vérifié, avec `metadata` élargi :
 * `metadata.thinking` (extended thinking) n'est pas encore décrit par le SDK.
 * Beaucoup plus sûr qu'un `any` sur tout le payload.
 */
type AnthropicRequestParams = Omit<Anthropic.MessageCreateParamsNonStreaming, 'metadata'> & {
  metadata?: Anthropic.MessageCreateParamsNonStreaming['metadata'] & {
    thinking?: { type: 'enabled'; budget_tokens: number };
  };
};

export class AnthropicProvider extends AIProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.client = new Anthropic({ 
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: Message[], options?: AnthropicChatOptions): Promise<ChatResponse> {
    try {
      // Separate system message
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      // Build system prompt
      const system: string = systemMessage?.content || '';

      const requestParams: AnthropicRequestParams = {
        model: options?.model || this.config.defaultModel || 'claude-opus-4.8',
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature,
        top_p: options?.topP,
        system,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        ...(options?.tools?.length
          ? {
              tools: options.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters as Anthropic.Tool['input_schema'],
              })),
            }
          : {}),
      };

      // Enable extended thinking if requested
      if (options?.extendedThinking) {
        requestParams.metadata = {
          ...requestParams.metadata,
          thinking: { type: 'enabled', budget_tokens: 10000 },
        };
      }

      const response = await this.client.messages.create(requestParams);

      const textContent = response.content.find(c => c.type === 'text');
      
      // Track cache usage if available
      const rawUsage: UsageWithCacheMetrics = response.usage;

      const usage: ProviderTokenUsage = {
        inputTokens: rawUsage.input_tokens,
        outputTokens: rawUsage.output_tokens,
        totalTokens: rawUsage.input_tokens + rawUsage.output_tokens,
      };

      if (rawUsage.cache_creation_input_tokens != null) {
        usage.cacheCreationInputTokens = rawUsage.cache_creation_input_tokens;
      }
      if (rawUsage.cache_read_input_tokens != null) {
        usage.cacheReadInputTokens = rawUsage.cache_read_input_tokens;
      }

      const toolCalls = response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
        .map((block) => ({
          id: block.id,
          name: block.name,
          arguments: (block.input ?? {}) as Record<string, unknown>,
        }));

      return {
        content: textContent?.type === 'text' ? textContent.text : '',
        model: response.model,
        usage,
        finishReason: response.stop_reason || undefined,
        toolCalls: toolCalls.length ? toolCalls : undefined,
      };
    } catch (error) {
      this.handleError(error, 'chat failed');
    }
  }

  async *stream(messages: Message[], options?: AnthropicChatOptions): AsyncIterableIterator<StreamChunk> {
    try {
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      // Build system prompt
      const system: string = systemMessage?.content || '';

      const requestParams: AnthropicRequestParams = {
        model: options?.model || this.config.defaultModel || 'claude-opus-4.8',
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature,
        top_p: options?.topP,
        system,
        messages: conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      };

      if (options?.extendedThinking) {
        requestParams.metadata = {
          ...requestParams.metadata,
          thinking: { type: 'enabled', budget_tokens: 10000 },
        };
      }

      const stream = this.client.messages.stream(requestParams);

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield { content: chunk.delta.text, done: false };
        } else if (chunk.type === 'message_stop') {
          yield { content: '', done: true };
        }
      }
    } catch (error) {
      this.handleError(error, 'stream failed');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.config.defaultModel || 'claude-opus-4.8',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
