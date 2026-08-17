/**
 * Provider Settings Service — la clé d'API vit ici, et nulle part ailleurs.
 *
 * ---------------------------------------------------------------------------
 * Le pont qui manquait
 * ---------------------------------------------------------------------------
 * `SettingsView` écrivait la clé dans `localStorage['cortex:settings']` et
 * `AIService` ne lisait que `AIProviderRegistry.fromEnv()`. Les deux moitiés ne
 * se parlaient pas : saisir une clé, enregistrer, ouvrir le chat échouait sur
 * `Provider "anthropic" not found`. Ce service est le côté main de ce pont.
 *
 * ---------------------------------------------------------------------------
 * Où vit la clé
 * ---------------------------------------------------------------------------
 * Dans le process main uniquement. Le renderer l'envoie UNE fois à
 * l'enregistrement et ne la reçoit jamais en retour : `toView()` ne produit
 * qu'un masque (`sk-…4242`). `localStorage` est lisible par tout code du
 * renderer, et l'application embarque un composant `<webview>` (désactivé
 * aujourd'hui, mais présent) — une clé stockée là est lisible par tout script
 * qui s'y exécute.
 *
 * Chiffrement au repos via `safeStorage` quand l'OS le permet. Sinon, écriture
 * en clair dans le fichier de réglages, en `0o600` : c'est un recul assumé par
 * rapport au chiffrement, mais pas par rapport à `localStorage` (fichier lisible
 * par le seul utilisateur propriétaire, et hors de portée du renderer). L'état
 * est exposé par `isEncryptionAvailable()` pour que ce ne soit pas invisible.
 *
 * ---------------------------------------------------------------------------
 * Précédence : réglages UI > environnement
 * ---------------------------------------------------------------------------
 * L'UI gagne, parce que c'est le geste le plus récent et le plus explicite de
 * l'utilisateur : une variable d'environnement héritée du shell qui écraserait
 * la clé qu'on vient de saisir rendrait le formulaire inopérant sans rien dire.
 * L'environnement reste le défaut au premier lancement (aucun réglage
 * enregistré) et le repli quand un provider est activé sans clé propre.
 *
 * La précédence est *visible* : `ProviderSettingsView` porte `credentialSource`,
 * `envVar` et `envKeyPresent`, donc l'UI peut dire « une variable
 * d'environnement existe mais votre réglage la remplace » au lieu de laisser
 * croire à un champ vide.
 */

import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { AIProviderRegistry, type RegistryConfig } from '@cortex-ide/ai-engine';
import type {
  CredentialSource,
  ProviderId,
  ProviderSettingsView,
  SetProviderRequest,
} from '@cortex-ide/shared';

/** Les cinq providers que `AIProviderRegistry` sait construire. */
const PROVIDER_IDS: readonly ProviderId[] = [
  'openai',
  'anthropic',
  'openrouter',
  'ollama',
  'grok',
];

/**
 * Variable d'environnement porteuse d'une clé, par provider.
 *
 * `ollama` n'y figure pas : il n'a pas de clé d'API. Sa présence dans
 * l'environnement se lit sur `OLLAMA_HOST` / `OLLAMA_ENABLED`, ce que
 * `configFromEnv()` traduit déjà en entrée de configuration — d'où le test sur
 * la config plutôt que sur la variable pour ce cas.
 */
const ENV_VAR_BY_PROVIDER: Partial<Record<ProviderId, string>> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  grok: 'GROK_API_KEY',
};

/** Un provider tel qu'il est persisté sur disque. */
interface StoredProvider {
  enabled: boolean;
  /** Clé chiffrée par `safeStorage`, en base64. */
  apiKeyEnc?: string;
  /** Clé en clair — uniquement quand `safeStorage` est indisponible. */
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

interface StoredSettings {
  version: 1;
  providers: Partial<Record<ProviderId, StoredProvider>>;
}

const EMPTY: StoredSettings = { version: 1, providers: {} };

/**
 * Masque une clé pour l'affichage : `sk-…4242`.
 *
 * Le préfixe est conservé parce qu'il identifie le provider sans rien révéler
 * d'utilisable, et les 4 derniers caractères parce que c'est ce qui permet à
 * l'utilisateur de reconnaître *quelle* clé est enregistrée. Une clé trop courte
 * pour être découpée ainsi est masquée intégralement plutôt que partiellement
 * dévoilée.
 */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length <= 8) return '…';

  const head = trimmed.slice(0, 3);
  const tail = trimmed.slice(-4);
  return `${head}…${tail}`;
}

export class ProviderSettingsService {
  private readonly filePath: string;
  private cache?: StoredSettings;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'provider-settings.json');
  }

  /**
   * `safeStorage` est-il utilisable ?
   *
   * Testé par `typeof` et non par simple présence : le mock `electron` des tests
   * n'exposait pas `safeStorage` du tout, donc un appel direct levait
   * `Cannot read properties of undefined` et cassait le *link* de tous les tests
   * du package `main`. Le mock a été étendu, mais le contrôle reste : un
   * environnement Linux sans keyring renvoie légitimement `false` ici, et il ne
   * faut pas confondre « pas de chiffrement » avec « plantage ».
   */
  isEncryptionAvailable(): boolean {
    try {
      return (
        typeof safeStorage?.isEncryptionAvailable === 'function' &&
        safeStorage.isEncryptionAvailable()
      );
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Persistance
  // ==========================================================================

  private read(): StoredSettings {
    if (this.cache) return this.cache;

    if (!existsSync(this.filePath)) {
      this.cache = { ...EMPTY, providers: {} };
      return this.cache;
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      this.cache = normalizeStored(parsed);
    } catch (error) {
      // Volontairement sans le contenu ni l'erreur brute : un fichier tronqué
      // dont le JSON casse au milieu d'une clé ferait citer par V8 les premiers
      // caractères de cette clé dans le message de SyntaxError. Seul le *type*
      // d'échec est journalisé.
      console.error(
        '[ProviderSettings] Could not read stored provider settings:',
        error instanceof Error ? error.name : typeof error
      );
      this.cache = { ...EMPTY, providers: {} };
    }

    return this.cache;
  }

  private write(settings: StoredSettings): void {
    this.cache = settings;

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // `mode: 0o600` : le fichier peut contenir une clé en clair quand
    // `safeStorage` est indisponible. Un service de ce dépôt a déjà persisté des
    // données sensibles en clair sans restreindre les permissions.
    writeFileSync(this.filePath, JSON.stringify(settings, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  // ==========================================================================
  // Clés
  // ==========================================================================

  private decrypt(stored: StoredProvider): string | undefined {
    if (stored.apiKeyEnc !== undefined) {
      try {
        return safeStorage.decryptString(Buffer.from(stored.apiKeyEnc, 'base64'));
      } catch (error) {
        // Cas réel : le keyring a changé (autre machine, session recréée). La
        // clé est irrécupérable, ce qui n'est pas une raison de faire tomber les
        // réglages entiers.
        console.error(
          '[ProviderSettings] Stored key could not be decrypted:',
          error instanceof Error ? error.name : typeof error
        );
        return undefined;
      }
    }
    return stored.apiKey;
  }

  private encode(key: string): Pick<StoredProvider, 'apiKey' | 'apiKeyEnc'> {
    if (this.isEncryptionAvailable()) {
      return { apiKeyEnc: safeStorage.encryptString(key).toString('base64') };
    }
    return { apiKey: key };
  }

  // ==========================================================================
  // Lecture / écriture des réglages
  // ==========================================================================

  /**
   * Applique un enregistrement venu du renderer.
   *
   * `apiKey` absent signifie « garde la clé stockée » : l'UI n'affiche jamais la
   * clé courante, donc elle ne peut pas la renvoyer, et sans cette distinction
   * tout Save fait depuis un autre onglet l'effacerait. Une chaîne vide,
   * elle, efface explicitement.
   */
  setProvider(request: SetProviderRequest): void {
    const current = this.read();
    const previous = current.providers[request.id];

    const next: StoredProvider = { enabled: request.enabled };

    if (request.apiKey === undefined) {
      // Conservation : on recopie la forme stockée telle quelle, sans
      // déchiffrer-rechiffrer (inutile, et une passe de plus en clair en
      // mémoire).
      if (previous?.apiKeyEnc !== undefined) next.apiKeyEnc = previous.apiKeyEnc;
      else if (previous?.apiKey !== undefined) next.apiKey = previous.apiKey;
    } else {
      const trimmed = request.apiKey.trim();
      if (trimmed.length > 0) Object.assign(next, this.encode(trimmed));
    }

    if (request.baseUrl !== undefined) next.baseUrl = request.baseUrl;
    else if (previous?.baseUrl !== undefined) next.baseUrl = previous.baseUrl;

    if (request.defaultModel !== undefined) next.defaultModel = request.defaultModel;
    else if (previous?.defaultModel !== undefined) next.defaultModel = previous.defaultModel;

    this.write({
      version: 1,
      providers: { ...current.providers, [request.id]: next },
    });
  }

  /**
   * La configuration à donner au registry, précédence appliquée.
   *
   * Réglages UI d'abord, environnement en repli. Un provider n'entre dans la
   * configuration que s'il est activé ET dispose d'une clé (sauf `ollama`, qui
   * n'en demande pas) : sans clé, `new AnthropicProvider()` lève
   * « API key is required » et ferait échouer toute la reconstruction.
   */
  toRegistryConfig(env: RegistryConfig = AIProviderRegistry.configFromEnv()): RegistryConfig {
    const stored = this.read();
    const config: RegistryConfig = {};

    for (const id of PROVIDER_IDS) {
      const entry = stored.providers[id];
      const envEntry = env[id];

      // Aucun réglage pour ce provider : l'environnement fait foi (défaut au
      // premier lancement).
      if (!entry) {
        if (envEntry) config[id] = envEntry;
        continue;
      }

      // Désactivé dans l'UI : il n'est pas enregistré, même si une variable
      // d'environnement existe. C'est le sens de « l'UI gagne » — sinon
      // décocher un provider n'aurait aucun effet.
      if (!entry.enabled) continue;

      const settingsKey = this.decrypt(entry);
      const apiKey = settingsKey ?? envEntry?.apiKey;

      if (id === 'ollama') {
        config.ollama = {
          baseUrl: entry.baseUrl ?? envEntry?.baseUrl,
          defaultModel: entry.defaultModel ?? envEntry?.defaultModel,
        };
        continue;
      }

      if (!apiKey) continue;

      config[id] = {
        apiKey,
        baseUrl: entry.baseUrl ?? envEntry?.baseUrl,
        defaultModel: entry.defaultModel ?? envEntry?.defaultModel,
      };
    }

    if (env.defaultProvider) config.defaultProvider = env.defaultProvider;

    return config;
  }

  /**
   * L'état des providers tel que le renderer est autorisé à le voir.
   *
   * `activeProviderIds` vient du registry réel : `active` répond à « est-ce que
   * le chat va marcher ? » en le mesurant, plutôt qu'en le déduisant des
   * réglages — c'est précisément la déduction qui avait laissé passer le bug.
   */
  toView(
    activeProviderIds: readonly string[],
    env: RegistryConfig = AIProviderRegistry.configFromEnv()
  ): ProviderSettingsView[] {
    const stored = this.read();
    const active = new Set(activeProviderIds);

    return PROVIDER_IDS.map((id) => {
      const entry = stored.providers[id];
      const envEntry = env[id];
      const envVar = ENV_VAR_BY_PROVIDER[id];

      // Pour ollama, « présent dans l'environnement » se lit sur la config
      // dérivée (OLLAMA_HOST / OLLAMA_ENABLED), pas sur une variable de clé.
      const envKeyPresent =
        id === 'ollama' ? envEntry !== undefined : Boolean(envEntry?.apiKey);

      const settingsKey = entry ? this.decrypt(entry) : undefined;
      const hasSettingsKey = settingsKey !== undefined && settingsKey.length > 0;

      let credentialSource: CredentialSource = 'none';
      if (entry?.enabled === false) {
        // Désactivé : aucune clé ne sera utilisée, quoi qu'il y ait ailleurs.
        credentialSource = 'none';
      } else if (hasSettingsKey) {
        credentialSource = 'settings';
      } else if (envKeyPresent) {
        credentialSource = 'env';
      }

      const view: ProviderSettingsView = {
        id,
        enabled: entry?.enabled ?? envKeyPresent,
        credentialSource,
        envKeyPresent,
        active: active.has(id),
      };

      if (hasSettingsKey) view.maskedApiKey = maskApiKey(settingsKey);
      else if (credentialSource === 'env' && envEntry?.apiKey) {
        view.maskedApiKey = maskApiKey(envEntry.apiKey);
      }

      const baseUrl = entry?.baseUrl ?? envEntry?.baseUrl;
      if (baseUrl !== undefined) view.baseUrl = baseUrl;

      const defaultModel = entry?.defaultModel ?? envEntry?.defaultModel;
      if (defaultModel !== undefined) view.defaultModel = defaultModel;

      // Exposé même quand les réglages gagnent : c'est ce qui permet à l'UI de
      // signaler qu'une variable existe mais ne s'applique pas.
      if (envVar !== undefined && process.env[envVar]) view.envVar = envVar;

      return view;
    });
  }

  /** Vide le cache mémoire — utilisé par les tests et après un reset. */
  invalidate(): void {
    this.cache = undefined;
  }
}

/**
 * Ramène un blob disque quelconque à la forme attendue.
 *
 * Même raison que `normalizeSettings` côté renderer : un fichier écrit par une
 * version antérieure, tronqué ou édité à la main ne doit pas produire un objet
 * dont `providers` est `undefined` — la lecture suivante planterait sur
 * `stored.providers[id]`.
 */
function normalizeStored(raw: unknown): StoredSettings {
  if (typeof raw !== 'object' || raw === null) return { version: 1, providers: {} };

  const source = raw as { providers?: unknown };
  if (typeof source.providers !== 'object' || source.providers === null) {
    return { version: 1, providers: {} };
  }

  const providers: Partial<Record<ProviderId, StoredProvider>> = {};
  const rawProviders = source.providers as Record<string, unknown>;

  for (const id of PROVIDER_IDS) {
    const entry = rawProviders[id];
    if (typeof entry !== 'object' || entry === null) continue;

    const candidate = entry as Record<string, unknown>;
    const normalized: StoredProvider = {
      enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : false,
    };

    if (typeof candidate.apiKeyEnc === 'string') normalized.apiKeyEnc = candidate.apiKeyEnc;
    if (typeof candidate.apiKey === 'string') normalized.apiKey = candidate.apiKey;
    if (typeof candidate.baseUrl === 'string') normalized.baseUrl = candidate.baseUrl;
    if (typeof candidate.defaultModel === 'string') {
      normalized.defaultModel = candidate.defaultModel;
    }

    providers[id] = normalized;
  }

  return { version: 1, providers };
}

// ============================================================================
// Singleton
// ============================================================================

let instance: ProviderSettingsService | null = null;

export function getProviderSettingsService(): ProviderSettingsService {
  if (!instance) instance = new ProviderSettingsService();
  return instance;
}

/** Réinitialise le singleton (tests, et changement de userData). */
export function resetProviderSettingsService(): void {
  instance = null;
}
