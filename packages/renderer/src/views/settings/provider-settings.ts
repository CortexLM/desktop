/**
 * Côté renderer du pont des réglages de providers.
 *
 * ---------------------------------------------------------------------------
 * La clé ne vit plus ici
 * ---------------------------------------------------------------------------
 * `SettingsView` écrivait la clé d'API dans `localStorage['cortex:settings']`,
 * où tout code du renderer peut la lire (et où `AIService` ne la lisait jamais).
 * Désormais : la clé part vers main par `settings:set-provider` et ne revient
 * jamais. Ce module ne détient donc que ce que l'utilisateur vient de taper,
 * en mémoire, le temps d'un Save.
 *
 * ---------------------------------------------------------------------------
 * Décalage d'identifiants
 * ---------------------------------------------------------------------------
 * L'UI parlait de `xai`, le registry connaît `grok`. Un passe-plat naïf n'aurait
 * jamais résolu ce provider. La frontière IPC utilise les identifiants du
 * registry (seuls valides pour `ProviderIdSchema`), et le libellé humain est une
 * pure affaire d'affichage — d'où `PROVIDER_LABELS` ci-dessous, qui donne
 * « xAI (Grok) » pour `grok`. `openrouter` existe dans le registry et
 * n'apparaissait pas du tout dans l'UI : il est désormais listé, sinon une clé
 * OpenRouter n'était configurable que par variable d'environnement.
 */

import type { ProviderId, ProviderSettingsView, SetProviderRequest } from '@cortex-ide/shared';

/** Libellés d'affichage, indexés par l'identifiant du registry. */
export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)',
  grok: 'xAI (Grok)',
};

/**
 * Ancienne clé de `localStorage` -> identifiant du registry.
 *
 * Sert uniquement à la migration des réglages écrits par les versions
 * précédentes. `xai` est le décalage qui aurait fait échouer toute résolution.
 */
export const LEGACY_PROVIDER_IDS: Record<string, ProviderId> = {
  openai: 'openai',
  anthropic: 'anthropic',
  openrouter: 'openrouter',
  ollama: 'ollama',
  xai: 'grok',
  grok: 'grok',
};

/** Modèles proposés à titre indicatif, par provider. */
export const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
  openrouter: ['anthropic/claude-opus-4.8-fast'],
  ollama: ['llama3', 'codellama', 'mistral'],
  grok: ['grok-beta'],
};

/** Providers qui exposent un endpoint configurable. */
export const PROVIDERS_WITH_BASE_URL: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'openrouter',
  'ollama',
  'grok',
]);

/**
 * Providers extraits d'un blob `localStorage` d'une version antérieure.
 *
 * Renvoie les requêtes à envoyer à main pour que ces clés servent enfin à
 * quelque chose, puis l'appelant retire `providers` du blob : laisser la clé
 * dans `localStorage` après migration serait garder exactement le stockage qu'on
 * cherche à quitter.
 */
export function migrationRequests(raw: unknown): SetProviderRequest[] {
  if (typeof raw !== 'object' || raw === null) return [];

  const providers = (raw as { providers?: unknown }).providers;
  if (typeof providers !== 'object' || providers === null) return [];

  const requests: SetProviderRequest[] = [];

  for (const [legacyId, value] of Object.entries(providers as Record<string, unknown>)) {
    const id = LEGACY_PROVIDER_IDS[legacyId];
    if (!id) continue;
    if (typeof value !== 'object' || value === null) continue;

    const entry = value as { enabled?: unknown; apiKey?: unknown; baseUrl?: unknown };
    const apiKey = typeof entry.apiKey === 'string' ? entry.apiKey.trim() : '';

    // Rien à migrer sans clé : envoyer un `enabled: false` sans clé écraserait
    // un réglage déjà fait côté main par un blob périmé.
    if (apiKey.length === 0) continue;

    const request: SetProviderRequest = {
      id,
      enabled: entry.enabled === true,
      apiKey,
    };
    if (typeof entry.baseUrl === 'string') request.baseUrl = entry.baseUrl;

    requests.push(request);
  }

  return requests;
}

/**
 * Phrase expliquant d'où vient la clé effectivement utilisée.
 *
 * « Rends la précédence visible » : un champ vide alors qu'une variable
 * d'environnement est active est un piège — l'utilisateur croit n'avoir rien
 * configuré alors que le service fonctionne, ou l'inverse.
 */
export function credentialSourceLabel(view: ProviderSettingsView): string {
  switch (view.credentialSource) {
    case 'settings':
      return view.envKeyPresent
        ? `Using the key saved here. ${view.envVar ?? 'An environment variable'} is also set but your setting takes precedence.`
        : 'Using the key saved here.';
    case 'env':
      return `Using ${view.envVar ?? 'an environment variable'} from the environment. Saving a key here will replace it.`;
    case 'none':
      return 'No key configured.';
  }
}
