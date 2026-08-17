import type { ProviderConfig } from '../types.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GrokProvider } from './grok.js';
import type { AIProvider } from './base.js';

export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'grok':
      return new GrokProvider(config);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { GrokProvider } from './grok.js';
export { OpenAICompatibleTestProvider } from './openai-compatible.js';
export {
  BaseProvider,
  type AIProvider,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type TokenPricing,
} from './base.js';
