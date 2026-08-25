import { AIProvider, ProviderConfig, ProviderModel } from './providers/base';
import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { OpenRouterProvider } from './providers/openrouter-provider';
import { OllamaProvider } from './providers/ollama-provider';
import { GrokProvider } from './providers/grok-provider';
import { CustomProvider, CustomProviderConfig } from './providers/custom-provider';
import { ModelPreset, getModelForPreset } from './model-presets';

export interface RegistryConfig {
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  openrouter?: ProviderConfig;
  ollama?: ProviderConfig;
  grok?: ProviderConfig;
  /**
   * Endpoints compatibles OpenAI configures par l'utilisateur.
   *
   * Une liste et non un objet unique : rien n'empeche d'utiliser en meme temps
   * une passerelle d'entreprise et un modele local, et un champ unique
   * obligerait a choisir. Chaque entree porte son propre `id`, sans quoi la
   * seconde ecraserait la premiere dans la Map du registry.
   */
  custom?: CustomProviderConfig[];
  defaultProvider?: string;
  defaultPreset?: ModelPreset;
}

/** Un modèle avec le provider qui le sert. */
export interface RegistryModel extends ProviderModel {
  providerId: string;
  providerName: string;
}

/** Clés de `RegistryConfig` portant un provider intégré. */
type BuiltInKey = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'grok';

interface BuiltInProvider {
  key: BuiltInKey;
  /**
   * Ollama tourne en local sans authentification, donc sa présence dans la
   * configuration suffit ; les autres restent inutilisables sans clé et sont
   * omis plutôt qu'enregistrés pour échouer au premier appel.
   */
  enabled: (config: ProviderConfig) => boolean;
  create: (config: ProviderConfig) => AIProvider;
  /** Ce provider est-il activé par l'environnement courant. */
  envActivated: () => boolean;
  /**
   * Configuration lue depuis l'environnement.
   *
   * Portée par chaque entrée plutôt que par une boucle générique : Ollama se lit
   * autrement que les autres (pas de clé, un hôte par défaut), et une boucle qui
   * connaîtrait cette exception ferait vivre la particularité d'Ollama ailleurs
   * qu'avec Ollama.
   */
  envConfig: () => ProviderConfig;
}

/** Lecture d'un provider à clé : la clé active, l'URL et le modèle sont optionnels. */
function keyedEnvConfig(
  keyVar: string,
  baseUrlVar: string,
  modelVar: string,
  fallbackModel: string,
): () => ProviderConfig {
  return () => ({
    apiKey: process.env[keyVar],
    baseUrl: process.env[baseUrlVar],
    defaultModel: process.env[modelVar] || fallbackModel,
  });
}

/**
 * Les providers intégrés, décrits plutôt qu'écrits.
 *
 * La liste apparaissait deux fois — une fois pour construire depuis la
 * configuration, une fois pour lire l'environnement — et deux listes qui
 * divergent font que l'application annonce une source de clé différente de celle
 * réellement employée. Une seule table supprime ce risque et retire aussi la
 * ramification qui faisait dépasser les deux méthodes.
 */
const BUILT_IN_PROVIDERS: readonly BuiltInProvider[] = [
  {
    key: 'openai',
    enabled: (config) => Boolean(config.apiKey),
    create: (config) => new OpenAIProvider(config),
    envActivated: () => Boolean(process.env.OPENAI_API_KEY),
    envConfig: keyedEnvConfig(
      'OPENAI_API_KEY',
      'OPENAI_BASE_URL',
      'OPENAI_DEFAULT_MODEL',
      'gpt-4.5-turbo',
    ),
  },
  {
    key: 'anthropic',
    enabled: (config) => Boolean(config.apiKey),
    create: (config) => new AnthropicProvider(config),
    envActivated: () => Boolean(process.env.ANTHROPIC_API_KEY),
    envConfig: keyedEnvConfig(
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_BASE_URL',
      'ANTHROPIC_DEFAULT_MODEL',
      'claude-opus-4.8',
    ),
  },
  {
    key: 'openrouter',
    enabled: (config) => Boolean(config.apiKey),
    create: (config) => new OpenRouterProvider(config),
    envActivated: () => Boolean(process.env.OPENROUTER_API_KEY),
    envConfig: keyedEnvConfig(
      'OPENROUTER_API_KEY',
      'OPENROUTER_BASE_URL',
      'OPENROUTER_DEFAULT_MODEL',
      'anthropic/claude-opus-4.8-fast',
    ),
  },
  {
    key: 'ollama',
    // Tourne en local sans authentification : sa présence dans la configuration
    // suffit, là où les autres restent inutilisables sans clé.
    enabled: () => true,
    create: (config) => new OllamaProvider(config),
    envActivated: () =>
      process.env.OLLAMA_HOST !== undefined || process.env.OLLAMA_ENABLED === 'true',
    envConfig: () => ({
      baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
      defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.1',
    }),
  },
  {
    key: 'grok',
    enabled: (config) => Boolean(config.apiKey),
    create: (config) => new GrokProvider(config),
    envActivated: () => Boolean(process.env.GROK_API_KEY),
    envConfig: keyedEnvConfig(
      'GROK_API_KEY',
      'GROK_BASE_URL',
      'GROK_DEFAULT_MODEL',
      'claude-opus-5:stable',
    ),
  },
];

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
    for (const entry of BUILT_IN_PROVIDERS) {
      const settings = config[entry.key];
      if (!settings || !entry.enabled(settings)) continue;
      this.register(entry.create(settings));
    }

    // Endpoints personnalisés. Enregistrés en dernier pour qu'un `id` réutilisant
    // celui d'un provider connu soit un remplacement explicite et non un conflit
    // dont l'issue dépendrait de l'ordre de lecture.
    for (const custom of config.custom ?? []) {
      if (!custom.baseUrl) continue;
      this.register(new CustomProvider(custom));
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

    for (const entry of BUILT_IN_PROVIDERS) {
      if (!entry.envActivated()) continue;
      config[entry.key] = entry.envConfig();
    }

    // Endpoint personnalisé.
    //
    // Une seule entrée depuis l'environnement, là où les réglages en acceptent
    // plusieurs : encoder une liste dans une variable demanderait un format à
    // parser et à documenter, alors que le cas que l'environnement sert — un
    // développeur ou un job CI qui pointe vers une passerelle — n'en a qu'une.
    if (process.env.CUSTOM_PROVIDER_BASE_URL) {
      config.custom = [
        {
          id: process.env.CUSTOM_PROVIDER_ID || 'custom',
          label: process.env.CUSTOM_PROVIDER_LABEL || 'Custom provider',
          baseUrl: process.env.CUSTOM_PROVIDER_BASE_URL,
          apiKey: process.env.CUSTOM_PROVIDER_API_KEY,
          defaultModel: process.env.CUSTOM_PROVIDER_DEFAULT_MODEL,
        },
      ];
    }

    // Provider par défaut
    config.defaultProvider = process.env.DEFAULT_AI_PROVIDER;

    return config;
  }

  /**
   * Catalogue agrégé de tous les providers enregistrés.
   *
   * Chaque modèle porte l'`id` de son provider : deux providers peuvent exposer
   * le même identifiant de modèle (une passerelle qui relaie OpenAI, par
   * exemple), et sans cette attribution le sélecteur ne saurait pas par où
   * router la requête.
   *
   * Les providers sont interrogés en parallèle et un échec n'en annule pas les
   * autres : une passerelle hors ligne ne doit pas vider tout le sélecteur.
   */
  async listModels(): Promise<RegistryModel[]> {
    const perProvider = await Promise.all(
      this.getAllProviders().map(async (provider) => {
        try {
          const models = await provider.listModels();
          return models.map((model) => ({
            ...model,
            providerId: provider.id,
            providerName: provider.name,
          }));
        } catch {
          return [];
        }
      }),
    );

    return perProvider.flat();
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
