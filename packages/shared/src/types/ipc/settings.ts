/**
 * IPC Types — réglages de providers AI.
 *
 * ---------------------------------------------------------------------------
 * Invariant central : la clé d'API ne revient JAMAIS au renderer
 * ---------------------------------------------------------------------------
 * Le renderer est le process le moins fiable (il rend du contenu distant, et le
 * composant `<webview>` existe même si `webviewTag` est désactivé partout —
 * cf. `main/src/security.ts`). Une clé `sk-live-…` lisible depuis le renderer
 * est lisible par tout script qui s'y exécute.
 *
 * D'où l'asymétrie assumée de ce contrat :
 *
 *   renderer -> main : `apiKey` en clair, UNE fois, au moment de
 *                      l'enregistrement (`SetProviderRequest.apiKey`).
 *   main -> renderer : jamais la clé. Seulement `maskedApiKey`
 *                      (`sk-…4242`) et de quoi expliquer d'où elle vient.
 *
 * `ProviderSettingsView` n'a donc délibérément pas de champ `apiKey`. Un test
 * (`settings-service.test.ts`) vérifie qu'aucune valeur de clé ne traverse la
 * frontière dans ce sens.
 */

/** Identifiants des providers acceptés par `AIProviderRegistry`. */
export type ProviderId = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'grok';

/**
 * D'où vient la clé effectivement utilisée par le registry.
 *
 * Rendu visible dans l'UI : un champ qui semble vide alors qu'une variable
 * d'environnement est active est un piège — l'utilisateur croit n'avoir rien
 * configuré alors que le service fonctionne, ou l'inverse.
 */
export type CredentialSource = 'settings' | 'env' | 'none';

/**
 * État d'un provider tel que le renderer est autorisé à le voir.
 *
 * Aucune clé en clair. `maskedApiKey` est `undefined` quand aucune clé n'est
 * connue, et sert de valeur d'affichage (placeholder) sinon.
 */
export interface ProviderSettingsView {
  id: ProviderId;
  /** Le provider est-il demandé par l'utilisateur dans les réglages ? */
  enabled: boolean;
  /** `sk-…4242`, ou absent si aucune clé n'est configurée pour ce provider. */
  maskedApiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  /**
   * Source de la clé qui serait effectivement utilisée, après application de la
   * précédence (réglages UI > variable d'environnement).
   */
  credentialSource: CredentialSource;
  /**
   * Nom de la variable d'environnement qui fournit une clé pour ce provider,
   * quand il y en a une — qu'elle gagne ou non la précédence.
   *
   * Présent même lorsque `credentialSource === 'settings'` : c'est ce qui permet
   * à l'UI de dire « une variable d'environnement existe mais votre réglage la
   * remplace » au lieu de laisser croire qu'elle n'a jamais existé.
   */
  envVar?: string;
  /** Une variable d'environnement fournit-elle une clé pour ce provider ? */
  envKeyPresent: boolean;
  /**
   * Le provider est-il actuellement résolvable par le registry ?
   *
   * C'est la réponse à « est-ce que le chat va marcher ? », mesurée sur le
   * registry réel plutôt que déduite des réglages.
   */
  active: boolean;
}

export interface GetProviderSettingsRequest {
  /** Sans payload : le renderer demande l'état complet. */
  _?: never;
}

export interface GetProviderSettingsResponse {
  providers: ProviderSettingsView[];
  /**
   * Précédence appliquée par ce build. Exposée pour que l'UI l'affiche au lieu
   * de la coder en dur de son côté (deux descriptions qui divergent sont pires
   * qu'aucune).
   */
  precedence: 'settings-over-env';
}

export interface SetProviderRequest {
  id: ProviderId;
  enabled: boolean;
  /**
   * Clé en clair, transmise une seule fois.
   *
   * - absente / `undefined` : conserver la clé déjà stockée (l'UI n'affiche
   *   jamais la clé, donc elle ne peut pas la renvoyer ; ne rien envoyer est
   *   comment un Save qui ne touche pas au champ préserve la clé) ;
   * - chaîne vide : effacer la clé stockée.
   */
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Réponse à un enregistrement.
 *
 * `providers` est l'état complet re-lu APRÈS reconstruction du registry, pas un
 * écho de la requête : c'est ce qui rend le succès vérifiable côté UI
 * (`active: true`) au lieu d'un simple « ok ».
 */
export interface SetProviderResponse {
  providers: ProviderSettingsView[];
  /** IDs que le registry résout après reconstruction. */
  activeProviders: ProviderId[];
}
