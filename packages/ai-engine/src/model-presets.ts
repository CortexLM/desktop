// Configuration des modèles AI et presets recommandés

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  tags?: string[];
  contextWindow?: number;
  pricing?: {
    input: number;  // prix par million de tokens
    output: number;
  };
}

export type ModelPreset = 'fastest' | 'smartest' | 'cheapest' | 'reasoning';

export interface PresetConfig {
  name: string;
  description: string;
  models: {
    openai?: string;
    anthropic?: string;
    openrouter?: string;
    grok?: string;
  };
}

/**
 * Modèles recommandés par provider (2026)
 */
export const RECOMMENDED_MODELS: Record<string, ModelInfo[]> = {
  openai: [
    {
      id: 'gpt-4.5-turbo',
      name: 'GPT-4.5 Turbo',
      provider: 'openai',
      description: 'Modèle le plus récent et performant (2026)',
      tags: ['latest', 'recommended'],
      contextWindow: 128000,
    },
    {
      id: 'o3-mini',
      name: 'O3 Mini',
      provider: 'openai',
      description: 'Modèle de raisonnement optimisé',
      tags: ['reasoning', 'fast'],
      contextWindow: 128000,
    },
    {
      id: 'gpt-4o-2024-11-20',
      name: 'GPT-4o (Nov 2024)',
      provider: 'openai',
      description: 'Version stable précédente',
      tags: ['stable'],
      contextWindow: 128000,
    },
  ],
  anthropic: [
    {
      id: 'claude-opus-4.8',
      name: 'Claude Opus 4.8',
      provider: 'anthropic',
      description: 'Modèle le plus puissant (2026)',
      tags: ['latest', 'recommended', 'smartest'],
      contextWindow: 200000,
    },
    {
      id: 'claude-sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      provider: 'anthropic',
      description: 'Équilibre vitesse/qualité',
      tags: ['fast', 'recommended'],
      contextWindow: 200000,
    },
  ],
  openrouter: [
    {
      id: 'anthropic/claude-opus-4.8-fast',
      name: 'Claude Opus 4.8 (Fast)',
      provider: 'openrouter',
      description: 'Via OpenRouter avec latence optimisée',
      tags: ['latest', 'recommended'],
      contextWindow: 200000,
    },
    {
      id: 'openai/gpt-4.5-turbo',
      name: 'GPT-4.5 Turbo',
      provider: 'openrouter',
      description: 'Via OpenRouter',
      tags: ['latest'],
      contextWindow: 128000,
    },
    {
      id: 'google/gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'openrouter',
      description: 'Modèle Google le plus récent',
      tags: ['latest', 'long-context'],
      contextWindow: 1000000,
    },
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1',
      provider: 'openrouter',
      description: 'Modèle de raisonnement open source',
      tags: ['reasoning', 'open-source', 'cheapest'],
      contextWindow: 64000,
    },
  ],
  grok: [
    {
      id: 'claude-opus-5:stable',
      name: 'Claude Opus 5 (Grok)',
      provider: 'grok',
      description: 'Via OpenLux API',
      tags: ['experimental'],
      contextWindow: 200000,
    },
  ],
};

/**
 * Presets de modèles selon les cas d'usage
 */
export const MODEL_PRESETS: Record<ModelPreset, PresetConfig> = {
  fastest: {
    name: 'Fastest',
    description: 'Réponses ultra-rapides avec bonne qualité',
    models: {
      openai: 'o3-mini',
      anthropic: 'claude-sonnet-4.5',
      openrouter: 'anthropic/claude-opus-4.8-fast',
      grok: 'claude-opus-5:stable',
    },
  },
  smartest: {
    name: 'Smartest',
    description: 'Meilleure qualité pour tâches complexes',
    models: {
      openai: 'gpt-4.5-turbo',
      anthropic: 'claude-opus-4.8',
      openrouter: 'anthropic/claude-opus-4.8-fast',
      grok: 'claude-opus-5:stable',
    },
  },
  cheapest: {
    name: 'Cheapest',
    description: 'Prix minimal, qualité correcte',
    models: {
      openai: 'gpt-4o-2024-11-20',
      anthropic: 'claude-sonnet-4.5',
      openrouter: 'deepseek/deepseek-r1',
      grok: 'claude-opus-5:stable',
    },
  },
  reasoning: {
    name: 'Reasoning',
    description: 'Optimisé pour raisonnement complexe',
    models: {
      openai: 'o3-mini',
      anthropic: 'claude-opus-4.8',
      openrouter: 'deepseek/deepseek-r1',
      grok: 'claude-opus-5:stable',
    },
  },
};

/**
 * Récupère le modèle recommandé pour un preset et un provider
 */
export function getModelForPreset(preset: ModelPreset, providerId: string): string | undefined {
  const presetConfig = MODEL_PRESETS[preset];
  return presetConfig.models[providerId as keyof typeof presetConfig.models];
}

/**
 * Récupère les informations d'un modèle
 */
export function getModelInfo(providerId: string, modelId: string): ModelInfo | undefined {
  const providerModels = RECOMMENDED_MODELS[providerId];
  if (!providerModels) return undefined;
  return providerModels.find(m => m.id === modelId);
}

/**
 * Récupère tous les modèles avec un tag spécifique
 */
export function getModelsByTag(tag: string): ModelInfo[] {
  return Object.values(RECOMMENDED_MODELS)
    .flat()
    .filter(model => model.tags?.includes(tag));
}

/**
 * Liste tous les modèles recommandés pour un provider
 */
export function getProviderModels(providerId: string): ModelInfo[] {
  return RECOMMENDED_MODELS[providerId] || [];
}
