/**
 * Workspace Settings Service — les défauts et les permissions d'exécution.
 *
 * ---------------------------------------------------------------------------
 * Où c'est stocké, et pourquoi pas `localStorage`
 * ---------------------------------------------------------------------------
 * Dans la table `app_state` (migration 004), pas dans le renderer. Ces réglages
 * gouvernent ce que l'agent est autorisé à faire — lancer un shell, appliquer une
 * migration, sortir sur le réseau. Un contrôle d'autorisation dont la valeur est
 * lue depuis un stockage que le process rendu peut écrire n'est pas un contrôle :
 * c'est une suggestion. Le process main les détient et les applique.
 *
 * Le renderer les lit et demande des changements ; c'est main qui décide.
 *
 * ---------------------------------------------------------------------------
 * Une écriture partielle, jamais totale
 * ---------------------------------------------------------------------------
 * L'UI change un réglage à la fois. Renvoyer l'objet entier à chaque bascule
 * ferait qu'un second onglet ouvert sur Settings écrase, au prochain clic, tout ce
 * que le premier vient de modifier — avec la valeur qu'il avait au chargement.
 * Chaque écriture est donc fusionnée sur l'état lu à cet instant.
 */

import type {
  SetWorkspaceRunSettingsRequest,
  WorkspaceRunDefaults,
  WorkspaceRunPermissions,
  WorkspaceRunSettings,
} from '@cortex-ide/shared';

import { getDatabaseService } from './database-service';

const STORAGE_KEY = 'workspace_settings';

const DEFAULT_DEFAULTS: WorkspaceRunDefaults = {
  model: '',
  repository: '',
  baseBranch: '',
  branchPrefix: 'cortex/',
  createPullRequests: 'draft',
};

/**
 * `runShellCommands` par défaut à `true`.
 *
 * Un agent de code qui ne peut pas lancer de commande ne peut pas vérifier son
 * propre travail : il écrirait du code sans jamais exécuter un test. Les deux
 * autres sont à `false` parce qu'une migration appliquée et un message envoyé ne
 * se défont pas.
 */
const DEFAULT_PERMISSIONS: WorkspaceRunPermissions = {
  runShellCommands: true,
  applyDatabaseMigrations: false,
  slackNotifications: false,
  networkAccess: 'allowlist',
};

const PULL_REQUEST_MODES = new Set(['draft', 'ready', 'never']);
const NETWORK_MODES = new Set(['allowlist', 'all', 'none']);

function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
}

function asString(raw: unknown, fallback: string): string {
  return typeof raw === 'string' ? raw : fallback;
}

function asBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

/**
 * Ramène une valeur à l'un des variants attendus.
 *
 * Générique plutôt que deux gardes écrites à la main : c'est là que se joue le
 * risque — une valeur hors domaine relue depuis le disque — et une seule
 * implémentation est une seule chose à relire.
 */
function asEnum<T extends string>(raw: unknown, allowed: ReadonlySet<string>, fallback: T): T {
  return typeof raw === 'string' && allowed.has(raw) ? (raw as T) : fallback;
}

/**
 * Ramène un blob disque quelconque à la forme attendue.
 *
 * Étalé sur les défauts puis recoercé champ par champ. Le spread seul ne suffit
 * pas : il accepterait un `runShellCommands: "yes"` venu d'un fichier édité à la
 * main, et un contrôle d'autorisation dont la valeur est une chaîne serait vrai
 * par accident. Un fichier tronqué ou écrit par une version antérieure ne doit pas
 * non plus produire un objet dont `permissions` est `undefined` — la lecture
 * suivante planterait sur `permissions.runShellCommands`, et un contrôle qui
 * plante est pire qu'un contrôle absent.
 */
function normalise(raw: unknown): WorkspaceRunSettings {
  const source = asRecord(raw);
  const defaults = { ...DEFAULT_DEFAULTS, ...asRecord(source.defaults) };
  const permissions = { ...DEFAULT_PERMISSIONS, ...asRecord(source.permissions) };

  return {
    defaults: {
      model: asString(defaults.model, DEFAULT_DEFAULTS.model),
      repository: asString(defaults.repository, DEFAULT_DEFAULTS.repository),
      baseBranch: asString(defaults.baseBranch, DEFAULT_DEFAULTS.baseBranch),
      branchPrefix: asString(defaults.branchPrefix, DEFAULT_DEFAULTS.branchPrefix),
      createPullRequests: asEnum(
        defaults.createPullRequests,
        PULL_REQUEST_MODES,
        DEFAULT_DEFAULTS.createPullRequests
      ),
    },
    permissions: {
      runShellCommands: asBoolean(
        permissions.runShellCommands,
        DEFAULT_PERMISSIONS.runShellCommands
      ),
      applyDatabaseMigrations: asBoolean(
        permissions.applyDatabaseMigrations,
        DEFAULT_PERMISSIONS.applyDatabaseMigrations
      ),
      slackNotifications: asBoolean(
        permissions.slackNotifications,
        DEFAULT_PERMISSIONS.slackNotifications
      ),
      networkAccess: asEnum(
        permissions.networkAccess,
        NETWORK_MODES,
        DEFAULT_PERMISSIONS.networkAccess
      ),
    },
  };
}

export class WorkspaceRunSettingsService {
  /**
   * Cached because the agent loop reads the permissions on every tool call, and a
   * SQLite round trip per call would put the database on the hot path of a loop
   * that can make hundreds of them in a turn.
   */
  private cache?: WorkspaceRunSettings;

  async get(): Promise<WorkspaceRunSettings> {
    if (this.cache) return this.cache;

    try {
      const db = getDatabaseService();
      const result = await db.query<{ value: string }>(
        'SELECT value FROM app_state WHERE key = ?',
        [STORAGE_KEY],
      );
      const raw = result.rows[0]?.value;
      this.cache = normalise(raw ? JSON.parse(raw) : {});
    } catch (error) {
      // A database that is not ready yet, or a malformed row. Falling back to the
      // defaults keeps the app usable; failing here would block Settings from
      // opening, which is where the user would go to fix it.
      console.error(
        '[WorkspaceRunSettings] Could not read stored settings:',
        error instanceof Error ? error.name : typeof error,
      );
      this.cache = normalise({});
    }

    return this.cache;
  }

  async set(request: SetWorkspaceRunSettingsRequest): Promise<WorkspaceRunSettings> {
    const current = await this.get();

    // Merged onto the value read now, not onto a snapshot the caller sent. See the
    // module header: this is what stops a second window from reverting the first.
    const next: WorkspaceRunSettings = normalise({
      defaults: { ...current.defaults, ...request.defaults },
      permissions: { ...current.permissions, ...request.permissions },
    });

    const db = getDatabaseService();
    await db.execute([
      {
        query: `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        params: [STORAGE_KEY, JSON.stringify(next), Date.now()],
      },
    ]);

    this.cache = next;
    return next;
  }

  /** Drops the memo — used by the tests and after a database swap. */
  invalidate(): void {
    this.cache = undefined;
  }
}

let instance: WorkspaceRunSettingsService | null = null;

export function getWorkspaceRunSettingsService(): WorkspaceRunSettingsService {
  if (!instance) instance = new WorkspaceRunSettingsService();
  return instance;
}

export function resetWorkspaceRunSettingsService(): void {
  instance = null;
}
