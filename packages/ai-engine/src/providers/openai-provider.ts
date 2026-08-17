/**
 * Enhanced OpenAI provider with prompt caching support.
 */

import OpenAI from 'openai';
import {
  AIProvider,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderConfig,
  ProviderTokenUsage,
} from './base';

export interface OpenAIChatOptions extends ChatOptions {
  /** Use structured outputs */
  structuredOutput?: boolean;
  /** Response format schema for structured outputs */
  /** Passé tel quel au SDK (`{ type: 'json_object' }`, schéma, ...). */
  responseFormat?: OpenAI.Chat.Completions.ChatCompletionCreateParams['response_format'];
}

export class OpenAIProvider extends AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ 
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: Message[], options?: OpenAIChatOptions): Promise<ChatResponse> {
    try {
      const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
        model: options?.model || this.config.defaultModel || 'gpt-4.5-turbo',
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stop,
      };

      // Add structured output if requested
      if (options?.structuredOutput && options?.responseFormat) {
        requestParams.response_format = options.responseFormat;
      }

      const response = await this.client.chat.completions.create(requestParams);

      const choice = response.choices[0];

      const usage: ProviderTokenUsage = {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      };

      // OpenAI reports cache hits under `prompt_tokens_details`
      const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens;
      if (cachedTokens != null) {
        usage.cacheReadInputTokens = cachedTokens;
      }

      return {
        content: choice?.message.content || '',
        model: response.model,
        usage,
        finishReason: choice?.finish_reason || undefined,
      };
    } catch (error) {
      this.handleError(error, 'chat failed');
    }
  }

  async *stream(messages: Message[], options?: OpenAIChatOptions): AsyncIterableIterator<StreamChunk> {
    try {
      // Typed as ...ParamsStreaming so the SDK resolves the streaming overload:
      // with an `any` param it returned a plain ChatCompletion and `for await`
      // iterated nothing.
      const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
        model: options?.model || this.config.defaultModel || 'gpt-4.5-turbo',
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stop,
        stream: true,
      };

      if (options?.structuredOutput && options?.responseFormat) {
        requestParams.response_format = options.responseFormat;
      }

      const stream = await this.client.chat.completions.create(requestParams);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        const done = chunk.choices[0]?.finish_reason !== null;
        yield { content, done };
      }
    } catch (error) {
      this.handleError(error, 'stream failed');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
