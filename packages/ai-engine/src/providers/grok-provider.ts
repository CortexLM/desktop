import { ProviderConfig } from './base';
import { OpenAICompatibleProvider } from './openai-compatible-provider';

/**
 * Provider Grok (API compatible OpenAI).
 *
 * Retries activés par défaut (3 tentatives) : l'API est sujette au
 * rate-limiting.
 */
export class GrokProvider extends OpenAICompatibleProvider {
  readonly id = 'grok';
  readonly name = 'Grok';

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Grok API key is required');
    }

    super(config, {
      defaultBaseUrl: 'https://api.openlux.ai/v1',
      fallbackModel: 'claude-opus-5:stable',
      defaultMaxRetries: 3,
      defaultRetryDelay: 1000,
    });
  }
}
