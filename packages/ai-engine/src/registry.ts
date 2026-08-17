import { AIProvider, ProviderConfig } from './providers/base';
import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { OpenRouterProvider } from './providers/openrouter-provider';
import { OllamaProvider } from './providers/ollama-provider';
import { GrokProvider } from './providers/grok-provider';
import { ModelPreset, getModelForPreset } from './model-presets';

export interface RegistryConfig {
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  openrouter?: ProviderConfig;
  ollama?: ProviderConfig;
  grok?: ProviderConfig;
  defaultProvider?: string;
  defaultPreset?: ModelPreset;
}

export class AIProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private defaultProviderId?: string;

  constructor(config?: RegistryConfig) {
    if (config) {
      this.initializeFromConfig(config);
    }
  }

  /**
   * Reconfigure le registry en place, en remplacant integralement son contenu.
   *
   * Il n'existait aucun chemin de reconfiguration a chaud : `register()` est
   * additif (`Map.set`) et `initializeFromConfig` etait prive, donc appliquer de
   * nouveaux reglages exigeait de construire un nouveau registry -- ce que les
   * porteurs de reference (`AIService`, `SimpleAgentManager`) ne voient pas,
   * puisqu'ils gardent l'instance recue au constructeur. La reconfiguration se
   * fait donc EN PLACE : l'identite de l'instance est preservee, donc tout code
   * qui detient deja ce registry voit les nouveaux providers.
   *
   * `providers.clear()` d'abord, sinon un provider retire des reglages resterait
   * resolvable avec son ANCIENNE cle : l'utilisateur decoche Anthropic,
   * `getProvider('anthropic')` continue de repondre, et le chat part avec une cle
   * qu'il croit avoir retiree. `defaultProviderId` est remis a zero pour la meme
   * raison -- il pointait peut-etre sur un provider qui n'existe plus, et
   * `getDefault()` aurait renvoye `undefined` sur une instance qui se croyait
   * pourtant configuree.
   */
  reconfigure(config: RegistryConfig): void {
    this.providers.clear();
    this.defaultProviderId = undefined;
    this.initializeFromConfig(config);
  }

  /**
   * Initialise le registry depuis une configuration
   */
  private initializeFromConfig(config: RegistryConfig): void {
    // OpenAI
    if (config.openai?.apiKey) {
      const provider = new OpenAIProvider(config.openai);
      this.register(provider);
    }

    // Anthropic
    if (config.anthropic?.apiKey) {
      const provider = new AnthropicProvider(config.anthropic);
      this.register(provider);
    }

    // OpenRouter
    if (config.openrouter?.apiKey) {
      const provider = new OpenRouterProvider(config.openrouter);
      this.register(provider);
    }

    // Ollama (pas besoin d'API key)
    if (config.ollama !== undefined) {
      const provider = new OllamaProvider(config.ollama);
      this.register(provider);
    }

    // Grok
    if (config.grok?.apiKey) {
      const provider = new GrokProvider(config.grok);
      this.register(provider);
    }

    // Définir le provider par défaut
    if (config.defaultProvider) {
      this.setDefault(config.defaultProvider);
    } else {
      // Auto-sélectionner le premier disponible
      const firstProvider = this.providers.values().next().value;
      if (firstProvider) {
        this.setDefault(firstProvider.id);
      }
    }
  }

  /**
   * Initialise le registry depuis les variables d'environnement
   */
  static fromEnv(): AIProviderRegistry {
    return new AIProviderRegistry(AIProviderRegistry.configFromEnv());
  }

  /**
   * Lit la configuration des providers depuis l'environnement, sans construire
   * de registry.
   *
   * Extrait de `fromEnv()` pour que la precedence reglages/environnement soit
   * calculable ailleurs (`provider-settings-service`) sans dupliquer la liste
   * des variables ni leurs modeles par defaut -- deux listes qui divergent
   * feraient que l'UI annonce une source de cle differente de celle
   * reellement utilisee.
   */
  static configFromEnv(): RegistryConfig {
    const config: RegistryConfig = {};

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      config.openai = {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4.5-turbo',
      };
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      config.anthropic = {
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-opus-4.8',
      };
    }

    // OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      config.openrouter = {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: process.env.OPENROUTER_BASE_URL,
        defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-opus-4.8-fast',
      };
    }

    // Ollama (activé par défaut si OLLAMA_HOST est défini ou par défaut localhost)
    if (process.env.OLLAMA_HOST !== undefined || process.env.OLLAMA_ENABLED === 'true') {
      config.ollama = {
        baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
        defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.1',
      };
    }

    // Grok
    if (process.env.GROK_API_KEY) {
      config.grok = {
        apiKey: process.env.GROK_API_KEY,
        baseUrl: process.env.GROK_BASE_URL,
        defaultModel: process.env.GROK_DEFAULT_MODEL || 'claude-opus-5:stable',
      };
    }

    // Provider par défaut
    config.defaultProvider = process.env.DEFAULT_AI_PROVIDER;

    return config;
  }

  /**
   * Enregistre un provider
   */
  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Récupère un provider par son ID
   */
  getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Récupère tous les providers enregistrés
   */
  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Récupère les IDs de tous les providers
   */
  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Définit le provider par défaut
   */
  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider ${id} not found in registry`);
    }
    this.defaultProviderId = id;
  }

  /**
   * Récupère le provider par défaut
   */
  getDefault(): AIProvider | undefined {
    if (!this.defaultProviderId) {
      return undefined;
    }
    return this.providers.get(this.defaultProviderId);
  }

  /**
   * Récupère le provider par défaut ou lance une erreur
   */
  getDefaultOrThrow(): AIProvider {
    const provider = this.getDefault();
    if (!provider) {
      throw new Error('No default AI provider configured');
    }
    return provider;
  }

  /**
   * Vérifie si un provider est disponible
   */
  async isProviderAvailable(id: string): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }
    return provider.isAvailable();
  }

  /**
   * Vérifie quels providers sont disponibles
   */
  async getAvailableProviders(): Promise<string[]> {
    const results = await Promise.all(
      Array.from(this.providers.entries()).map(async ([id, provider]) => {
        const available = await provider.isAvailable();
        return available ? id : null;
      })
    );
    return results.filter((id): id is string => id !== null);
  }

  /**
   * Vérifie si le registry a au moins un provider configuré
   */
  hasProviders(): boolean {
    return this.providers.size > 0;
  }

  /**
   * Récupère le modèle recommandé pour un preset et un provider.
   *
   * API publique stable, consommée par l'UI (`ModelSelector`, `PresetSelector`).
   * Elle répond à « quel modèle pour cette intention utilisateur ? » et ignore
   * délibérément la difficulté de la tâche et l'état de l'infrastructure.
   *
   * Pour une décision de routage complète — intention + complexité + santé des
   * providers — utiliser `UnifiedModelSelector` (`src/model-selection/`), qui
   * compose ce preset avec `routing/` et `orchestration/`.
   */
  getModelForPreset(preset: ModelPreset, providerId?: string): string | undefined {
    const targetProviderId = providerId || this.defaultProviderId;
    if (!targetProviderId) {
      return undefined;
    }
    return getModelForPreset(preset, targetProviderId);
  }

  /**
   * Configure un provider avec un preset
   */
  setProviderPreset(providerId: string, preset: ModelPreset): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found in registry`);
    }
    
    const model = getModelForPreset(preset, providerId);
    if (model) {
      provider['config'].defaultModel = model;
    }
  }

  /**
   * Configure tous les providers avec un preset
   */
  setGlobalPreset(preset: ModelPreset): void {
    for (const [providerId, provider] of this.providers.entries()) {
      const model = getModelForPreset(preset, providerId);
      if (model) {
        provider['config'].defaultModel = model;
      }
    }
  }
}
