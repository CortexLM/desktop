import Anthropic from '@anthropic-ai/sdk';
import type { ProviderConfig, Message } from '../types.js';
import {
  BaseProvider,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type TokenPricing,
} from './base.js';

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;
  
  constructor(config: ProviderConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
  }
  
  get name(): string {
    return 'anthropic';
  }
  
  get model(): string {
    return this.config.model;
  }
  
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const startTime = Date.now();
    
    return this.withTimeout(
      this.withRetry(async () => {
        const { systemPrompt, userMessages } = this.convertMessages(messages, options?.systemPrompt);
        
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
          system: systemPrompt,
          messages: userMessages,
          tools: options?.tools?.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: {
              type: 'object',
              ...(t.parameters as Record<string, unknown>),
            },
          })),
        });
        
        const latency = Date.now() - startTime;
        
        const tokensUsed = {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        };
        
        const textContent = response.content
          .filter(c => c.type === 'text')
          .map(c => (c as Anthropic.TextBlock).text)
          .join('');
        
        const toolUseBlocks = response.content.filter(
          c => c.type === 'tool_use'
        ) as Anthropic.ToolUseBlock[];
        
        return {
          content: textContent,
          tokensUsed,
          toolCalls: toolUseBlocks.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.input as Record<string, unknown>,
            timestamp: Date.now(),
          })),
          finishReason: response.stop_reason ?? 'end_turn',
          latency,
          cost: this.calculateCost(tokensUsed),
        };
      })
    );
  }
  
  async *streamChat(messages: Message[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk> {
    const { systemPrompt, userMessages } = this.convertMessages(messages, options?.systemPrompt);
    
    const stream = await this.client.messages.create({
      model: this.config.model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      system: systemPrompt,
      messages: userMessages,
      stream: true,
    });
    
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield {
          content: event.delta.text,
          done: false,
        };
      }
      
      if (event.type === 'message_stop') {
        yield {
          content: '',
          done: true,
        };
      }
    }
  }
  
  /** Tarifs Claude Opus. */
  protected override get pricing(): TokenPricing {
    return { promptPer1k: 0.015, completionPer1k: 0.075 };
  }
  
  private convertMessages(messages: Message[], systemPrompt?: string): {
    systemPrompt?: string;
    userMessages: Anthropic.MessageParam[];
  } {
    const userMessages: Anthropic.MessageParam[] = [];
    let extractedSystem = systemPrompt;
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        extractedSystem = extractedSystem ? `${extractedSystem}\n\n${msg.content}` : msg.content;
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        userMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }
    
    return { systemPrompt: extractedSystem, userMessages };
  }
}
