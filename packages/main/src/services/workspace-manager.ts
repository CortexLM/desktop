/**
 * Workspace Manager - Multi-workspace support
 * Gère plusieurs projets simultanément avec contextes isolés
 *
 * ## Persistence: SQLite, keyed by path
 *
 * This used to persist to `workspaces.json` while the SQLite schema had a
 * `workspaces` table that nothing ever wrote to. Two stores for one entity, and
 * the one the foreign keys pointed at was always empty — so every
 * `INSERT INTO tasks` failed with `FOREIGN KEY constraint failed` and Plans
 * could not save anything for anyone.
 *
 * SQLite is now the single store. See
 * `database/migrations/004_workspace_identity.ts` for why `id` is the workspace
 * path and what that costs.
 *
 * `workspaces.json` is imported once on first initialize and then renamed to
 * `workspaces.json.migrated` — kept, not deleted, so a migration that got
 * something wrong is still recoverable by hand.
 *
 * Runtime state (`activeSessions`, `openFiles`, `terminalIds`) stays in memory:
 * it describes the current process, not the user's data, and was never
 * persisted before either.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Workspace } from '@cortex-ide/shared';

import { getDatabaseService, type DatabaseService } from './database-service';
import type { DatabaseManager } from '../database/index';
import type { Workspace as WorkspaceRow } from '../database/types';

export interface WorkspaceContext {
  workspace: Workspace;
  activeSessions: Set<string>;
  openFiles: Set<string>;
  terminalIds: Set<string>;
  gitRepoPath?: string;
}

/** Key under which the active workspace id is stored in `app_state`. */
const ACTIVE_WORKSPACE_KEY = 'active_workspace_id';

/**
 * Shape of the legacy `workspaces.json` payload.
 *
 * Every field is optional: the file was written by older versions and may be
 * partial or hand-edited. Anything unusable is skipped rather than throwing,
 * because a malformed file must not stop the app from starting.
 */
interface LegacyWorkspacesFile {
  workspaces?: Array<{
    id?: unknown;
    name?: unknown;
    path?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    settings?: unknown;
  }>;
  activeWorkspaceId?: unknown;
}

/**
 * DB row -> the shared `Workspace` shape (camelCase timestamps).
 */
function fromRow(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: row.settings ?? {},
  };
}

export class WorkspaceManager extends EventEmitter {
  private workspaces: Map<string, WorkspaceContext> = new Map();
  private activeWorkspaceId: string | null = null;
  private workspacesFile: string;
  private readonly databaseService: DatabaseService;
  private manager: DatabaseManager | null = null;

  /**
   * @param dataDir userData directory. Still used to locate the legacy
   *   `workspaces.json` for the one-time import.
   * @param databaseService injectable for tests; defaults to the app singleton.
   */
  constructor(dataDir: string, databaseService: DatabaseService = getDatabaseService()) {
    super();
    this.workspacesFile = path.join(dataDir, 'workspaces.json');
    this.databaseService = databaseService;
  }

  /**
   * Initialise le manager et charge les workspaces sauvegardés
   *
   * Imports `workspaces.json` on the first run, then reads everything back out
   * of SQLite so the in-memory view and the stored one cannot disagree.
   */
  async initialize(): Promise<void> {
    this.manager = await this.databaseService.getManager();

    await this.importLegacyFile();

    this.workspaces = new Map();

    for (const row of this.manager.listWorkspaces()) {
      const workspace = fromRow(row);

      // A recorded folder can be gone (deleted, unmounted, external drive). It
      // is left out of the in-memory list so the UI does not offer a dead
      // entry, but the row is deliberately NOT deleted: its tasks, sessions and
      // automations are still there, and a cascade delete on a temporarily
      // missing mount point would destroy user data.
      try {
        await fs.access(workspace.path);
        this.workspaces.set(workspace.id, {
          workspace,
          activeSessions: new Set(),
          openFiles: new Set(),
          terminalIds: new Set(),
        });
      } catch {
        // Path is not reachable right now; skip it for this session.
      }
    }

    const storedActive = this.readActiveWorkspaceId();
    this.activeWorkspaceId = storedActive && this.workspaces.has(storedActive) ? storedActive : null;
  }

  /**
   * Imports a pre-existing `workspaces.json` into SQLite, once.
   *
   * Renames the file afterwards instead of deleting it: if this import loses
   * something, the original is still on disk. A missing file is the normal case
   * and is not an error.
   */
  private async importLegacyFile(): Promise<void> {
    let raw: string;

    try {
      raw = await fs.readFile(this.workspacesFile, 'utf-8');
    } catch {
      return; // No legacy file: nothing to import.
    }

    let parsed: LegacyWorkspacesFile;
    try {
      parsed = JSON.parse(raw) as LegacyWorkspacesFile;
    } catch (error) {
      // Leave the file in place: it is unreadable to us but may be repairable
      // by hand, and renaming it would hide that it ever existed.
      console.error(
        `[WorkspaceManager] Could not parse ${this.workspacesFile}; leaving it untouched:`,
        error
      );
      return;
    }

    const manager = this.requireManager();
    let imported = 0;

    for (const entry of parsed.workspaces ?? []) {
      // Path is the identity, so an entry without one cannot be imported.
      if (typeof entry?.path !== 'string' || entry.path.length === 0) continue;

      const name = typeof entry.name === 'string' && entry.name ? entry.name : undefined;
      manager.workspaces.ensure(entry.path, name);
      imported += 1;
    }

    // The legacy file keyed the active workspace by its generated `ws_...` id,
    // which no longer exists. Resolve it through the entry it pointed at so the
    // user's active workspace survives the import.
    const legacyActive = parsed.activeWorkspaceId;
    if (typeof legacyActive === 'string') {
      const match = (parsed.workspaces ?? []).find((entry) => entry?.id === legacyActive);
      if (match && typeof match.path === 'string' && match.path) {
        this.writeActiveWorkspaceId(match.path);
      }
    }

    try {
      await fs.rename(this.workspacesFile, `${this.workspacesFile}.migrated`);
    } catch (error) {
      // The data is in SQLite either way. A failed rename only means the import
      // will be retried next start, and `ensure()` is idempotent.
      console.error(`[WorkspaceManager] Imported ${imported} workspace(s) but could not rename ${this.workspacesFile}:`, error);
      return;
    }

    console.log(
      `[WorkspaceManager] Imported ${imported} workspace(s) from workspaces.json into SQLite ` +
        `(original kept as workspaces.json.migrated)`
    );
  }

  private requireManager(): DatabaseManager {
    if (!this.manager) {
      throw new Error('WorkspaceManager.initialize() must be awaited before use');
    }
    return this.manager;
  }

  private readActiveWorkspaceId(): string | null {
    const row = this.requireManager()
      .getDb()
      .prepare('SELECT value FROM app_state WHERE key = ?')
      .get<{ value: string | null }>(ACTIVE_WORKSPACE_KEY);

    return row?.value ?? null;
  }

  private writeActiveWorkspaceId(workspaceId: string | null): void {
    this.requireManager()
      .getDb()
      .prepare(
        `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(ACTIVE_WORKSPACE_KEY, workspaceId, Date.now());
  }

  /**
   * Sauvegarde l'état des workspaces
   *
   * Kept for API compatibility with the callers written against the JSON store.
   * Every mutation below now writes to SQLite as it happens, so the only thing
   * left to flush is the active-workspace pointer.
   */
  async save(): Promise<void> {
    if (!this.manager) return;
    this.writeActiveWorkspaceId(this.activeWorkspaceId);
  }

  /**
   * Crée ou ajoute un workspace
   */
  async addWorkspace(workspacePath: string, name?: string): Promise<Workspace> {
    // Vérifie que le path existe
    const stats = await fs.stat(workspacePath);
    if (!stats.isDirectory()) {
      throw new Error('Workspace path must be a directory');
    }

    // Vérifie si déjà ajouté
    for (const ctx of this.workspaces.values()) {
      if (ctx.workspace.path === workspacePath) {
        return ctx.workspace;
      }
    }

    const workspace = fromRow(
      this.requireManager().workspaces.ensure(workspacePath, name || path.basename(workspacePath))
    );

    this.workspaces.set(workspace.id, {
      workspace,
      activeSessions: new Set(),
      openFiles: new Set(),
      terminalIds: new Set(),
    });

    this.emit('workspace-added', workspace);

    // Si c'est le premier workspace, l'activer automatiquement
    if (this.workspaces.size === 1) {
      await this.switchWorkspace(workspace.id);
    }

    return workspace;
  }

  /**
   * Supprime un workspace
   *
   * Removes the row, which cascades to its sessions, missions, automations and
   * tasks — the behaviour the FK declares and `database.test.ts` covers.
   */
  async removeWorkspace(workspaceId: string): Promise<void> {
    const ctx = this.workspaces.get(workspaceId);
    if (!ctx) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    // Nettoie les ressources du workspace
    this.emit('workspace-cleanup', workspaceId, ctx);

    this.workspaces.delete(workspaceId);
    this.requireManager().deleteWorkspace(workspaceId);

    // Si c'était le workspace actif, switcher vers un autre
    if (this.activeWorkspaceId === workspaceId) {
      const remaining = Array.from(this.workspaces.keys());
      this.activeWorkspaceId = remaining.length > 0 ? remaining[0] : null;

      if (this.activeWorkspaceId) {
        this.emit('workspace-switched', this.activeWorkspaceId);
      }
    }

    await this.save();
    this.emit('workspace-removed', workspaceId);
  }

  /**
   * Switch vers un autre workspace
   */
  async switchWorkspace(workspaceId: string): Promise<void> {
    const ctx = this.workspaces.get(workspaceId);
    if (!ctx) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const previousId = this.activeWorkspaceId;
    this.activeWorkspaceId = workspaceId;

    await this.save();
    this.emit('workspace-switched', workspaceId, previousId);
  }

  /**
   * Récupère le workspace actif
   */
  getActiveWorkspace(): Workspace | null {
    if (!this.activeWorkspaceId) return null;
    const ctx = this.workspaces.get(this.activeWorkspaceId);
    return ctx?.workspace || null;
  }

  /**
   * Récupère le contexte du workspace actif
   */
  getActiveContext(): WorkspaceContext | null {
    if (!this.activeWorkspaceId) return null;
    return this.workspaces.get(this.activeWorkspaceId) || null;
  }

  /**
   * Liste tous les workspaces
   */
  listWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values()).map(ctx => ctx.workspace);
  }

  /**
   * Récupère un workspace par ID
   */
  getWorkspace(workspaceId: string): Workspace | null {
    const ctx = this.workspaces.get(workspaceId);
    return ctx?.workspace || null;
  }

  /**
   * Récupère le contexte d'un workspace
   */
  getContext(workspaceId: string): WorkspaceContext | null {
    return this.workspaces.get(workspaceId) || null;
  }

  /**
   * Ajoute une session à un workspace
   */
  addSession(workspaceId: string, sessionId: string): void {
    const ctx = this.workspaces.get(workspaceId);
    if (ctx) {
      ctx.activeSessions.add(sessionId);
      this.emit('session-added', workspaceId, sessionId);
    }
  }

  /**
   * Supprime une session d'un workspace
   */
  removeSession(workspaceId: string, sessionId: string): void {
    const ctx = this.workspaces.get(workspaceId);
    if (ctx) {
      ctx.activeSessions.delete(sessionId);
      this.emit('session-removed', workspaceId, sessionId);
    }
  }

  /**
   * Ajoute un fichier ouvert à un workspace
   */
  addOpenFile(workspaceId: string, filePath: string): void {
    const ctx = this.workspaces.get(workspaceId);
    if (ctx) {
      ctx.openFiles.add(filePath);
      this.emit('file-opened', workspaceId, filePath);
    }
  }

  /**
   * Supprime un fichier ouvert d'un workspace
   */
  removeOpenFile(workspaceId: string, filePath: string): void {
    const ctx = this.workspaces.get(workspaceId);
    if (ctx) {
      ctx.openFiles.delete(filePath);
      this.emit('file-closed', workspaceId, filePath);
    }
  }

  /**
   * Ajoute un terminal à un workspace
   */
  addTerminal(workspaceId: string, terminalId: string): void {
    const ctx = this.workspaces.get(workspaceId);
    if (ctx) {
      ctx.terminalIds.add(terminalId);
      this.emit('terminal-added', workspaceId, terminalId);
    }
  }

  /**
   * Supprime un terminal d'un workspace
   */
  removeTerminal(workspaceId: string, terminalId: string): void {
    const ctx = this.workspaces.get(workspaceId);
    if (ctx) {
      ctx.terminalIds.delete(terminalId);
      this.emit('terminal-removed', workspaceId, terminalId);
    }
  }

  /**
   * Met à jour les settings d'un workspace
   */
  async updateSettings(workspaceId: string, settings: Record<string, any>): Promise<void> {
    const ctx = this.workspaces.get(workspaceId);
    if (!ctx) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    ctx.workspace.settings = { ...ctx.workspace.settings, ...settings };
    ctx.workspace.updatedAt = Date.now();

    this.requireManager().updateWorkspace(workspaceId, {
      settings: ctx.workspace.settings,
    });

    this.emit('workspace-updated', workspaceId);
  }
}

// Instance singleton
let workspaceManager: WorkspaceManager | null = null;

export function getWorkspaceManager(dataDir: string): WorkspaceManager {
  if (!workspaceManager) {
    workspaceManager = new WorkspaceManager(dataDir);
  }
  return workspaceManager;
}

/** Réinitialise le singleton. Utilisé par les tests. */
export function resetWorkspaceManager(): void {
  workspaceManager = null;
}
