import OpenAI from 'openai';
import type { ProviderConfig, Message } from '../types.js';
import {
  BaseProvider,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
} from './base.js';

/**
 * Base des providers exposant une API compatible OpenAI.
 *
 * Les sous-classes ne déclarent que leur identité, leur URL par défaut et leur
 * tarification : `chat`, `streamChat` et la conversion de messages sont
 * partagés.
 */
export abstract class OpenAICompatibleTestProvider extends BaseProvider {
  protected client: OpenAI;

  /**
   * @param defaultBaseURL utilisée si `config.baseURL` est absent. `undefined`
   *   laisse le SDK utiliser l'API OpenAI officielle.
   */
  constructor(config: ProviderConfig, defaultBaseURL?: string) {
    super(config);

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? defaultBaseURL,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
  }

  get model(): string {
    return this.config.model;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const startTime = Date.now();

    return this.withTimeout(
      this.withRetry(async () => {
        const completion = await this.client.chat.completions.create({
          model: this.config.model,
          messages: this.convertMessages(messages, options?.systemPrompt),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
          tools: options?.tools?.map((t) => ({
            type: 'function' as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })),
        });

        const latency = Date.now() - startTime;
        const choice = completion.choices[0];

        const tokensUsed = {
          prompt: completion.usage?.prompt_tokens ?? 0,
          completion: completion.usage?.completion_tokens ?? 0,
          total: completion.usage?.total_tokens ?? 0,
        };

        return {
          content: choice.message.content ?? '',
          tokensUsed,
          toolCalls: choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
            timestamp: Date.now(),
          })),
          finishReason: choice.finish_reason,
          latency,
          cost: this.calculateCost(tokensUsed),
        };
      })
    );
  }

  async *streamChat(
    messages: Message[],
    options?: ChatOptions
  ): AsyncGenerator<ChatStreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: this.convertMessages(messages, options?.systemPrompt),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield {
          content: delta.content,
          done: false,
        };
      }

      if (chunk.choices[0]?.finish_reason) {
        yield {
          content: '',
          done: true,
          tokensUsed: chunk.usage
            ? {
                prompt: chunk.usage.prompt_tokens,
                completion: chunk.usage.completion_tokens,
                total: chunk.usage.total_tokens,
              }
            : undefined,
        };
      }
    }
  }

  /**
   * Convertit les messages du harness au format OpenAI.
   *
   * Le `systemPrompt` est injecté en tête ; les rôles non supportés
   * (`tool`) sont ignorés.
   */
  protected convertMessages(
    messages: Message[],
    systemPrompt?: string
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') {
        result.push({ role: msg.role, content: msg.content });
      }
    }

    return result;
  }
}
