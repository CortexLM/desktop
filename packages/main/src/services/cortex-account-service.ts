/**
 * Cortex Account Service — le jeton d'accès vit ici, et nulle part ailleurs.
 *
 * ---------------------------------------------------------------------------
 * Pourquoi le client d'API est dans main
 * ---------------------------------------------------------------------------
 * Le renderer est chargé depuis `file://`, donc son origine est opaque : un
 * `fetch` vers `api.cortex.foundation` est rejeté au contrôle CORS avant même
 * de partir. Ce n'est pas contournable côté client — c'est le modèle d'origine
 * appliqué à une page locale. Le process main n'a pas d'origine, et pour lui la
 * question ne se pose pas.
 *
 * Cette contrainte tombe bien, parce qu'elle coïncide avec ce qu'on voudrait
 * pour des raisons de sécurité de toute façon (cf. `provider-settings-service`) :
 * le jeton n'a aucune raison d'entrer dans le process qui rend du contenu.
 *
 * ---------------------------------------------------------------------------
 * Le flux d'appareil est mené ici de bout en bout
 * ---------------------------------------------------------------------------
 * RFC 8628 : l'app affiche un code court, l'utilisateur l'approuve dans un
 * navigateur, l'app sonde jusqu'à obtenir un jeton. La boucle de sondage tourne
 * dans main. Le renderer reçoit `user_code` et `verification_uri` — faits pour
 * être affichés — puis apprend l'issue par un événement.
 *
 * Ce qu'il ne reçoit jamais : `device_code`. C'est le secret échangeable contre
 * un jeton ; l'exposer reviendrait à exposer le jeton avec une étape de plus.
 *
 * ---------------------------------------------------------------------------
 * Persistance
 * ---------------------------------------------------------------------------
 * Chiffrement au repos par `safeStorage` quand l'OS le permet, sinon écriture en
 * `0o600` — même compromis assumé et même exposition de l'état
 * (`credentialsEncrypted`) que pour les clés de providers, pour que « pas de
 * chiffrement » ne soit pas silencieux.
 */

import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  CortexApiClient,
  DeviceFlowAbortedError,
  pollDeviceToken,
  type CortexModel,
  type CortexUser,
  type DeviceCode,
} from '@cortex-ide/cortex-api';

import { describeError, isAuthFailure, toDeviceStatus } from './cortex-account-status';
import type {
  CortexAccountState,
  CortexDeviceStartResponse,
  CortexDeviceStatus,
  CortexModelView,
  CortexUserView,
} from '@cortex-ide/shared';

import { openExternalSafe } from '../security';

/** Le jeton tel qu'il est persisté sur disque. */
interface StoredSession {
  version: 1;
  /** Jeton chiffré par `safeStorage`, en base64. */
  accessTokenEnc?: string;
  /** Jeton en clair — uniquement quand `safeStorage` est indisponible. */
  accessToken?: string;
  organizationId?: string;
}

/**
 * Projette l'utilisateur de l'API vers ce que le renderer peut voir.
 *
 * L'API renvoie `first_name`/`last_name`/`name` de façon inconstante selon le
 * fournisseur d'identité en amont. Le nom affichable est reconstruit ici plutôt
 * que dans l'UI, pour que la sidebar et l'écran de compte n'aient pas chacun
 * leur propre variante de ce repli.
 */
export function toUserView(user: CortexUser): CortexUserView {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  const displayName = user.name?.trim() || (full.length > 0 ? full : undefined);

  const view: CortexUserView = { id: user.id ?? user.email ?? 'unknown' };
  if (user.email) view.email = user.email;
  if (displayName) view.displayName = displayName;
  if (user.profile_picture_url) view.avatarUrl = user.profile_picture_url;
  if (user.organization_id) view.organizationId = user.organization_id;
  return view;
}

/**
 * Projette un modèle du catalogue.
 *
 * `locked` est l'expression côté serveur du gating par plan. Il est reporté tel
 * quel sur `requiresAccount` plutôt que recalculé dans le renderer : le serveur
 * est la seule autorité sur ce qu'un appelant peut réellement utiliser.
 */
export function toModelView(model: CortexModel): CortexModelView {
  const view: CortexModelView = {
    id: model.id,
    requiresAccount: model.locked === true || model.is_premium === true,
  };
  if (model.display_name) view.displayName = model.display_name;

  // L'API ne porte pas de champ `provider`. Le préfixe de l'identifiant
  // (`anthropic/claude-…`) est la seule indication disponible, et seulement
  // quand il y en a un.
  const slash = model.id.indexOf('/');
  if (slash > 0) view.provider = model.id.slice(0, slash);

  return view;
}

export type DeviceStatusListener = (status: CortexDeviceStatus) => void;
export type AccountChangedListener = (state: CortexAccountState) => void;

export class CortexAccountService {
  private readonly filePath: string;
  private readonly client: CortexApiClient;

  private user: CortexUserView | null = null;
  private reachable = true;

  /** Annule la boucle de sondage en cours, s'il y en a une. */
  private deviceAbort: AbortController | null = null;

  /**
   * L'URL d'approbation du flux en cours.
   *
   * Retenue ici pour que `openVerificationPage()` n'ait pas besoin qu'on la lui
   * passe : le renderer demande « ouvre la page », sans fournir d'URL. Rien à
   * valider, donc rien à contourner.
   */
  private verificationUri: string | null = null;

  private readonly deviceListeners = new Set<DeviceStatusListener>();
  private readonly accountListeners = new Set<AccountChangedListener>();

  constructor(options: { filePath?: string; client?: CortexApiClient } = {}) {
    this.filePath =
      options.filePath ?? join(app.getPath('userData'), 'cortex-session.json');
    this.client = options.client ?? new CortexApiClient();
  }

  // ==========================================================================
  // Chiffrement
  // ==========================================================================

  /**
   * `safeStorage` est-il utilisable ?
   *
   * Testé par `typeof` et non par simple présence, pour la même raison que dans
   * `ProviderSettingsService` : un mock `electron` qui n'expose pas
   * `safeStorage` ferait lever `Cannot read properties of undefined`, et un
   * Linux sans keyring renvoie légitimement `false` ici. « Pas de chiffrement »
   * et « plantage » ne doivent pas se confondre.
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

  private readStored(): StoredSession | null {
    if (!existsSync(this.filePath)) return null;

    try {
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'));
      if (typeof parsed !== 'object' || parsed === null) return null;

      const raw = parsed as Record<string, unknown>;
      const stored: StoredSession = { version: 1 };
      if (typeof raw.accessTokenEnc === 'string') stored.accessTokenEnc = raw.accessTokenEnc;
      if (typeof raw.accessToken === 'string') stored.accessToken = raw.accessToken;
      if (typeof raw.organizationId === 'string') stored.organizationId = raw.organizationId;
      return stored;
    } catch (error) {
      // Sans le contenu ni l'erreur brute : un fichier tronqué au milieu du
      // jeton ferait citer par V8 les premiers caractères de ce jeton dans le
      // message de SyntaxError.
      console.error(
        '[CortexAccount] Could not read stored session:',
        error instanceof Error ? error.name : typeof error,
      );
      return null;
    }
  }

  private writeStored(accessToken: string, organizationId?: string): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const stored: StoredSession = { version: 1 };
    if (this.isEncryptionAvailable()) {
      stored.accessTokenEnc = safeStorage.encryptString(accessToken).toString('base64');
    } else {
      stored.accessToken = accessToken;
    }
    if (organizationId) stored.organizationId = organizationId;

    // `0o600` : le fichier porte un jeton en clair quand `safeStorage` est
    // indisponible.
    writeFileSync(this.filePath, JSON.stringify(stored, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  private decryptStored(stored: StoredSession): string | undefined {
    if (stored.accessTokenEnc !== undefined) {
      try {
        return safeStorage.decryptString(Buffer.from(stored.accessTokenEnc, 'base64'));
      } catch (error) {
        // Cas réel : le keyring a changé (autre machine, session recréée). Le
        // jeton est irrécupérable — ce qui veut dire « reconnecte-toi », pas
        // « plante au démarrage ».
        console.error(
          '[CortexAccount] Stored token could not be decrypted:',
          error instanceof Error ? error.name : typeof error,
        );
        return undefined;
      }
    }
    return stored.accessToken;
  }

  // ==========================================================================
  // Cycle de vie
  // ==========================================================================

  /**
   * Restaure la session au lancement.
   *
   * Le jeton stocké est *vérifié* contre `/auth/me` plutôt que présumé valide :
   * un jeton révoqué ou expiré produirait sinon une UI connectée dont chaque
   * appel échoue. Un échec réseau, en revanche, ne déconnecte pas — le jeton est
   * gardé et `reachable` passe à `false`, parce que « hors ligne » et
   * « déconnecté » demandent deux messages différents.
   */
  async restore(): Promise<CortexAccountState> {
    const stored = this.readStored();
    if (!stored) return this.state();

    const token = this.decryptStored(stored);
    if (!token) {
      this.clearStored();
      return this.state();
    }

    this.client.setCredentials({ accessToken: token });
    if (stored.organizationId) this.client.setOrganization(stored.organizationId);

    try {
      this.user = toUserView(await this.client.currentUser());
      this.reachable = true;
    } catch (error) {
      if (isAuthFailure(error)) {
        // Le jeton n'est plus bon. On repart proprement déconnecté.
        this.client.clearCredentials();
        this.clearStored();
        this.user = null;
        this.reachable = true;
      } else {
        this.reachable = false;
      }
    }

    return this.state();
  }

  state(): CortexAccountState {
    return {
      user: this.user,
      reachable: this.reachable,
      credentialsEncrypted: this.isEncryptionAvailable(),
    };
  }

  /**
   * Le catalogue de modèles.
   *
   * Public : il se charge déconnecté aussi bien que connecté. C'est ce qui
   * permet au picker d'un utilisateur anonyme de montrer les vrais modèles
   * Cortex marqués verrouillés, plutôt qu'une liste vide — bien meilleure
   * explication de ce qu'un compte apporte qu'un contrôle désactivé et creux.
   */
  async listModels(): Promise<{ models: CortexModelView[]; error?: string }> {
    try {
      const models = await this.client.listModels();
      this.reachable = true;
      return { models: models.map(toModelView) };
    } catch (error) {
      this.reachable = false;
      return { models: [], error: describeError(error) };
    }
  }

  /**
   * Les clés d'API du compte.
   *
   * Authentifié : la route exige une session. Renvoie une liste vide plutôt que de
   * lever quand on est déconnecté — l'écran gate déjà la section, et une exception
   * ferait échouer son chargement pour un état qu'il sait afficher.
   */
  async listApiKeys(): Promise<Array<{ id: string; name: string; lastFour?: string }>> {
    if (!this.user) return [];

    try {
      const keys = await this.client.listApiKeys();
      return keys.map((key) => ({
        id: key.id,
        name: key.name ?? key.id,
        ...(key.last_four ? { lastFour: key.last_four } : {}),
      }));
    } catch (error) {
      console.error(
        '[CortexAccount] Could not list API keys:',
        error instanceof Error ? error.name : typeof error,
      );
      return [];
    }
  }

  /**
   * Crée une clé.
   *
   * `key` n'est présent que dans cette réponse : un service qui hache ses clés ne
   * les montre qu'une fois. C'est au renderer de l'afficher immédiatement, et il
   * n'aura pas de seconde chance.
   */
  async createApiKey(name: string): Promise<{ id: string; name: string; key?: string }> {
    const created = await this.client.createApiKey(name);
    return {
      id: created.id,
      name: created.name ?? name,
      ...(created.key ? { key: created.key } : {}),
    };
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.client.revokeApiKey(id);
  }

  // ==========================================================================
  // Flux d'appareil (RFC 8628)
  // ==========================================================================

  /**
   * Démarre un flux et lance la boucle de sondage en tâche de fond.
   *
   * Renvoie tout de suite ce qui s'affiche — le code et l'URL — pour que l'écran
   * puisse peindre sans attendre l'approbation, qui prend le temps qu'un humain
   * met à ouvrir un navigateur.
   */
  async startDeviceFlow(): Promise<CortexDeviceStartResponse> {
    // Un flux déjà en cours est annulé : deux boucles concurrentes sonderaient
    // avec deux codes différents et le premier jeton obtenu gagnerait au hasard.
    this.cancelDeviceFlow();

    const code = await this.client.startDeviceAuthorization();
    const abort = new AbortController();
    this.deviceAbort = abort;
    this.verificationUri = code.verification_uri_complete ?? code.verification_uri;

    void this.runDeviceFlow(code, abort);

    const response: CortexDeviceStartResponse = {
      userCode: code.user_code,
      verificationUri: code.verification_uri,
      expiresIn: code.expires_in,
    };
    if (code.verification_uri_complete) {
      response.verificationUriComplete = code.verification_uri_complete;
    }
    return response;
  }

  /** La boucle de sondage. Ne rejette pas : toute issue est un événement. */
  private async runDeviceFlow(code: DeviceCode, abort: AbortController): Promise<void> {
    try {
      const token = await pollDeviceToken(this.client, code, {
        signal: abort.signal,
        onState: (flowState) => {
          if (flowState.status === 'awaiting-authorization') {
            this.emitDevice({ kind: 'pending' });
          }
        },
      });

      this.client.setCredentials({ accessToken: token.access_token });

      const user = toUserView(await this.client.currentUser());
      this.user = user;
      this.reachable = true;
      this.writeStored(token.access_token, user.organizationId);

      this.emitDevice({ kind: 'authorized', user });
      this.emitAccountChanged();
    } catch (error) {
      // Une annulation est un geste de l'utilisateur, pas un échec à signaler.
      if (error instanceof DeviceFlowAbortedError || abort.signal.aborted) return;
      this.emitDevice(toDeviceStatus(error));
    } finally {
      if (this.deviceAbort === abort) this.deviceAbort = null;
    }
  }

  cancelDeviceFlow(): void {
    this.deviceAbort?.abort();
    this.deviceAbort = null;
    this.verificationUri = null;
  }

  /**
   * Ouvre la page d'approbation dans le navigateur système.
   *
   * Sans paramètre : l'URL est celle du flux que ce service a démarré. Le
   * renderer ne peut donc pas faire ouvrir autre chose, et il n'y a pas d'URL
   * fournie par un process moins fiable à valider. `openExternalSafe` revalide
   * quand même contre l'allowlist de domaines — deux barrières indépendantes
   * plutôt qu'une.
   */
  async openVerificationPage(): Promise<{ opened: boolean }> {
    if (!this.verificationUri) return { opened: false };
    return { opened: await openExternalSafe(this.verificationUri) };
  }

  // ==========================================================================
  // Déconnexion
  // ==========================================================================

  /**
   * Déconnecte.
   *
   * L'appel serveur est tenté mais son échec n'empêche pas la déconnexion
   * locale : un utilisateur qui clique « se déconnecter » hors ligne doit se
   * retrouver déconnecté, pas coincé connecté.
   */
  async signOut(): Promise<CortexAccountState> {
    this.cancelDeviceFlow();

    try {
      await this.client.logout();
    } catch {
      // Volontairement ignoré, cf. ci-dessus.
    }

    this.client.clearCredentials();
    this.clearStored();
    this.user = null;
    this.emitAccountChanged();
    return this.state();
  }

  private clearStored(): void {
    try {
      if (existsSync(this.filePath)) rmSync(this.filePath);
    } catch (error) {
      console.error(
        '[CortexAccount] Could not remove stored session:',
        error instanceof Error ? error.name : typeof error,
      );
    }
  }

  // ==========================================================================
  // Événements
  // ==========================================================================

  onDeviceStatus(listener: DeviceStatusListener): () => void {
    this.deviceListeners.add(listener);
    return () => this.deviceListeners.delete(listener);
  }

  onAccountChanged(listener: AccountChangedListener): () => void {
    this.accountListeners.add(listener);
    return () => this.accountListeners.delete(listener);
  }

  private emitDevice(status: CortexDeviceStatus): void {
    for (const listener of this.deviceListeners) listener(status);
  }

  private emitAccountChanged(): void {
    const state = this.state();
    for (const listener of this.accountListeners) listener(state);
  }

  /** Libère la boucle de sondage et les abonnés. Appelé à la fermeture. */
  dispose(): void {
    this.cancelDeviceFlow();
    this.deviceListeners.clear();
    this.accountListeners.clear();
  }

  /** Main-only. The renderer never receives this client or its tokens. */
  getApiClient(): CortexApiClient {
    return this.client;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: CortexAccountService | null = null;

export function getCortexAccountService(): CortexAccountService {
  if (!instance) instance = new CortexAccountService();
  return instance;
}

export function resetCortexAccountService(): void {
  instance?.dispose();
  instance = null;
}
