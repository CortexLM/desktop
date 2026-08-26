import { ProviderConfig } from './base';
import { OpenAICompatibleProvider } from './openai-compatible-provider';

/**
 * Provider défini par l'utilisateur : n'importe quel endpoint compatible OpenAI.
 *
 * Ce n'est pas un cas particulier ajouté à côté des providers connus, c'est le
 * même code : OpenRouter, Together, Groq, vLLM, LM Studio, un proxy interne ou
 * une passerelle d'entreprise exposent tous `POST /chat/completions`. Ce qui les
 * distingue tient dans trois champs — URL, clé, modèle — donc le support des
 * « providers personnalisés » et le support d'OpenRouter sont littéralement la
 * même implémentation.
 *
 * `id` est paramétrable pour qu'un utilisateur puisse en configurer plusieurs :
 * avec un identifiant fixe, ajouter un second endpoint écraserait le premier
 * dans le registry.
 */
export class CustomProvider extends OpenAICompatibleProvider {
  readonly id: string;
  readonly name: string;

  constructor(config: CustomProviderConfig) {
    if (!config.baseUrl) {
      throw new Error('A custom provider needs a base URL');
    }

    super(config, {
      // Pas de repli : un endpoint personnalisé n'a pas de modèle « par défaut »
      // devinable, et en inventer un ferait échouer la première requête avec une
      // erreur de modèle inconnu plutôt qu'avec une erreur de configuration.
      defaultBaseUrl: config.baseUrl,
      fallbackModel: config.defaultModel ?? '',
      defaultMaxRetries: 3,
    });

    this.id = config.id ?? 'custom';
    this.name = config.label ?? 'Custom provider';
  }

  /**
   * En-têtes supplémentaires fournis par l'utilisateur.
   *
   * Certaines passerelles exigent un en-tête maison (`X-Org-Id`, un jeton de
   * proxy). Sans ce point d'extension, ces endpoints resteraient inatteignables
   * alors qu'ils sont par ailleurs parfaitement compatibles.
   */
  protected override additionalHeaders(): Record<string, string> {
    const headers = (this.config as CustomProviderConfig).headers;
    return headers ?? {};
  }
}

export interface CustomProviderConfig extends ProviderConfig {
  /** Obligatoire : c'est ce qui définit le provider. */
  baseUrl: string;
  /** Identifiant dans le registry. Permet plusieurs endpoints simultanés. */
  id?: string;
  /** Libellé affiché dans le sélecteur. */
  label?: string;
  /** En-têtes exigés par la passerelle, le cas échéant. */
  headers?: Record<string, string>;
}
