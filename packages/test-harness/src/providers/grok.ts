import type { ProviderConfig } from '../types.js';
import type { TokenPricing } from './base.js';
import { OpenAICompatibleTestProvider } from './openai-compatible.js';

/** Endpoint OpenLux, compatible OpenAI. */
const OPENLUX_BASE_URL = 'https://api.openlux.ai/v1';

/**
 * Grok provider using OpenLux API (OpenAI-compatible endpoint)
 */
export class GrokProvider extends OpenAICompatibleTestProvider {
  constructor(config: ProviderConfig) {
    super(config, OPENLUX_BASE_URL);
  }

  get name(): string {
    return 'grok';
  }

  /** Tarifs Claude Opus via OpenLux (estimation). */
  protected override get pricing(): TokenPricing {
    return { promptPer1k: 0.015, completionPer1k: 0.075 };
  }
}
