/**
 * OpenClaw-style provider catalogue.
 *
 * A browsable list of inference providers plus the path used to list models.
 * Cortex models come from GET /v1/models; BYO providers take a key in Settings
 * and never return that key to the renderer. SSH / host keys are not in this
 * catalogue — they stay server-side.
 */

export type CatalogAuthKind = 'api-key' | 'none' | 'account';

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  /** Short line on the Settings row. */
  summary: string;
  auth: CatalogAuthKind;
  /** Where the user reads how to mint a key. */
  docsUrl: string;
  /** Relative path the host uses to list models, when it has one. */
  modelsPath?: string;
  /** Example key shape shown as a placeholder. Never a real key. */
  placeholder?: string;
}

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: 'cortex',
    name: 'Cortex',
    summary: 'Cortex models via GET /v1/models. Inference needs an account.',
    auth: 'account',
    docsUrl: 'https://api.cortex.foundation',
    modelsPath: '/v1/models',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    summary: 'GPT family through the official API.',
    auth: 'api-key',
    docsUrl: 'https://platform.openai.com/docs',
    modelsPath: '/v1/models',
    placeholder: 'sk-…',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    summary: 'Claude through the official API.',
    auth: 'api-key',
    docsUrl: 'https://docs.anthropic.com',
    placeholder: 'sk-ant-…',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    summary: 'One key, many upstream models.',
    auth: 'api-key',
    docsUrl: 'https://openrouter.ai/docs',
    placeholder: 'sk-or-…',
  },
  {
    id: 'grok',
    name: 'Grok',
    summary: 'xAI Grok models.',
    auth: 'api-key',
    docsUrl: 'https://docs.x.ai',
    placeholder: 'xai-…',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    summary: 'Local models. No key — the host URL is enough.',
    auth: 'none',
    docsUrl: 'https://github.com/ollama/ollama',
    modelsPath: '/api/tags',
  },
];

export function providerById(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((entry) => entry.id === id);
}
