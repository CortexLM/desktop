import { ProviderConfig } from './base';
import { OpenAICompatibleProvider } from './openai-compatible-provider';

/**
 * Provider OpenRouter (API compatible OpenAI).
 *
 * OpenRouter exige les en-têtes d'attribution `HTTP-Referer` et `X-Title`.
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    super(config, {
      defaultBaseUrl: 'https://openrouter.ai/api/v1',
      fallbackModel: 'anthropic/claude-opus-4.8-fast',
    });
  }

  /**
   * OpenRouter attributes requests to the referring app, and shows the title on
   * its leaderboards. Both name the product's real home; `cortex-ide.com` is not
   * a Cortex origin.
   */
  protected override additionalHeaders(): Record<string, string> {
    return {
      'HTTP-Referer': 'https://cortex.foundation',
      'X-Title': 'Cortex',
    };
  }
}
