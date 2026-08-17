import type { ProviderConfig } from '../types.js';
import type { TokenPricing } from './base.js';
import { OpenAICompatibleTestProvider } from './openai-compatible.js';

export class OpenAIProvider extends OpenAICompatibleTestProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  get name(): string {
    return 'openai';
  }

  /** Tarifs GPT-4. */
  protected override get pricing(): TokenPricing {
    return { promptPer1k: 0.03, completionPer1k: 0.06 };
  }
}
