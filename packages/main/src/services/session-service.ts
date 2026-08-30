/**
 * Session Service — les exécutions, persistées.
 *
 * ---------------------------------------------------------------------------
 * Ce qu'il n'est pas
 * ---------------------------------------------------------------------------
 * Ce n'est pas un second orchestrateur. `AgentServer` et `runAgentTurn`
 * (`@cortex-ide/ai-engine`) mènent déjà la boucle d'outils, les permissions et
 * les checkpoints, et `AIService` détient le registre de providers, le pont MCP
 * et le streaming. Écrire une deuxième boucle ici donnerait deux modèles de
 * session divergents — le dépôt en a déjà fait l'expérience avec
 * `SimpleAgentManager`, laissé derrière et jamais appelé.
 *
 * Ce service ajoute les deux choses qui manquaient :
 *
 *   1. **La persistance qui tient un redémarrage.** `AIService` gardait ses
 *      sessions dans une `Map` et écrivait au mieux quelques lignes en base,
 *      sans jamais les relire. L'app affichait donc une liste vide à chaque
 *      lancement pendant que la base contenait les lignes.
 *   2. **La forme que le renderer affiche.** Un état que l'inbox trie, un dépôt,
 *      une branche, une statistique de diff, et une chronologie où un appel
 *      d'outil est une entrée structurée plutôt que de la prose dans un message.
 *
 * ---------------------------------------------------------------------------
 * Le diff vient de git, pas de l'agent
 * ---------------------------------------------------------------------------
 * L'agent rapporte des `additions`/`deletions` par appel d'outil, ce qui est
 * utile pour la chronologie et faux comme total : deux éditions du même fichier
 * comptent deux fois, et une édition annulée par une autre compte quand même.
 * Le total et la liste de fichiers sont donc lus sur le dépôt via `GitService`,
 * qui est la seule autorité sur ce que le disque contient réellement.
 */

import { EventEmitter } from 'node:events';

import type {
  SessionDetail,
  SessionEvent,
  SessionStatus,
  SessionSummary,
  StartSessionRequest,
} from '@cortex-ide/shared';

import { getDatabaseService } from './database-service';
import { getAIService, type AIService } from './ai-service';
import { diffForWorkspace, diffTotals } from './session-diff';
import { toSessionEvent } from './session-events';
import { SessionStore } from './session-store';
import {
  explain,
  newRun,
  toEvent,
  toSummary,
  type EventRow,
  type SessionRow,
} from './session-rows';
import { isRemoteRuntime, requireThisPcFolder } from './session-this-pc';
import { activeRepoBinding, listBoundRepositories, openBoundWorkspace } from './session-folder';
import {
  followUpRemoteCodeSession,
  remoteSessionRow,
  startRemoteCodeSession,
} from './session-remote-start';


export class SessionService extends EventEmitter {
  private readonly ai: AIService;

  /** Abort handles for runs in flight, so Stop is more than a status change. */
  private readonly running = new Map<string, AbortController>();

  private readonly store = new SessionStore();

  constructor(options: { ai?: AIService } = {}) {
    super();
    this.ai = options.ai ?? getAIService();
    // Fire-and-forget: recovery must not delay construction, and a failure to
    // recover must not take the service down with it.
    void this.recoverInterrupted().catch(() => undefined);
  }

  /**
   * Settles runs a previous process left in flight.
   *
   * A `running` row whose process is gone is not running — its agent loop, its
   * abort handle and its permission gate died with the process. Left as-is, the
   * inbox shows it working forever and the detail screen waits on a permission
   * nobody can grant. `stopped` rather than `failed`: nothing about the run went
   * wrong, the app was closed under it.
   *
   * Runs in `this.running` are exempt by construction: this executes before the
   * first `start()` of this process can possibly have registered one.
   */
  private async recoverInterrupted(): Promise<void> {
    const db = getDatabaseService();
    await db.execute([
      {
        query: `UPDATE sessions SET status = 'stopped', finished_at = ?, updated_at = ?
                WHERE status IN ('queued', 'running')`,
        params: [Date.now(), Date.now()],
      },
    ]);
  }

  // ==========================================================================
  // Reads
  // ==========================================================================

  async list(options: { includeArchived?: boolean; limit?: number } = {}): Promise<
    SessionSummary[]
  > {
    const db = getDatabaseService();
    const where = options.includeArchived ? '' : 'WHERE archived = 0';
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

    const result = await db.query<SessionRow>(
      `SELECT * FROM sessions ${where} ORDER BY updated_at DESC LIMIT ?`,
      [limit],
    );
    return result.rows.map(toSummary);
  }

  async get(id: string): Promise<SessionDetail | null> {
    const db = getDatabaseService();
    const rows = await db.query<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
    const row = rows.rows[0];
    if (!row) return null;

    const events = await db.query<EventRow>(
      'SELECT seq, kind, payload, created_at FROM session_events WHERE session_id = ? ORDER BY seq ASC',
      [id],
    );

    const detail: SessionDetail = {
      ...toSummary(row),
      events: events.rows.map(toEvent).filter((event): event is SessionEvent => event !== null),
      files: await diffForWorkspace(row.workspace_id),
    };
    if (row.model) detail.model = row.model;
    if (row.provider) detail.provider = row.provider;
    return detail;
  }

  async listRepositories() {
    return listBoundRepositories();
  }

  async openWorkspace() {
    return openBoundWorkspace();
  }

  // ==========================================================================
  // Writes
  // ==========================================================================

  /**
   * Creates a run and starts it.
   *
   * The row is written and returned *before* the agent turn begins, so the UI can
   * navigate to a session that exists rather than to an id that may never appear.
   * The turn then runs in the background and reports through `progress`.
   */
  async start(request: StartSessionRequest): Promise<SessionSummary> {
    if (isRemoteRuntime(request.runtime)) {
      return this.startRemote(request);
    }
    return this.startOnThisPc(request);
  }

  /**
   * This PC: the open folder is the workspace the agent may read and write.
   * No folder is a hard failure — never process.cwd, never a silent Cloud run.
   */
  private async startOnThisPc(request: StartSessionRequest): Promise<SessionSummary> {
    const binding = await activeRepoBinding();
    const folder = requireThisPcFolder(binding?.path);
    const now = Date.now();
    const id = `session_${now}_${Math.random().toString(36).slice(2, 11)}`;
    const summary = newRun(id, request, now, binding);

    await this.upsert(id, {
      workspace_id: folder,
      title: summary.title,
      prompt: request.prompt,
      status: 'queued',
      runtime: request.runtime,
      repo: summary.repo ?? null,
      branch: summary.branch ?? null,
      model: request.model ?? null,
      created_at: now,
      updated_at: now,
    });

    await this.append(id, { kind: 'prompt', at: now, text: request.prompt });
    void this.run(id, request.prompt, {
      model: request.model,
      workspacePath: folder,
      mode: request.mode,
    });
    return summary;
  }

  private async startRemote(request: StartSessionRequest): Promise<SessionSummary> {
    const created = await startRemoteCodeSession(request);
    const now = Date.now();
    await this.upsert(created.id, remoteSessionRow(created, request, null, now));
    await this.append(created.id, { kind: 'prompt', at: now, text: request.prompt });
    return created;
  }

  /** Adds a turn to a session that has already finished one. */
  async followUp(id: string, prompt: string): Promise<SessionSummary | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    if (this.running.has(id)) return existing;

    if (isRemoteRuntime(existing.runtime)) {
      return followUpRemoteCodeSession(id, prompt, existing.runtime);
    }

    await this.append(id, { kind: 'prompt', at: Date.now(), text: prompt });
    void this.run(id, prompt, { workspacePath: await this.workspacePathOf(id) });
    return existing;
  }

  /**
   * Stops a run.
   *
   * Aborts the turn in flight rather than only flipping the status: a status a
   * still-running agent keeps overwriting is a lie, and the tool calls would keep
   * touching the user's files after they asked it to stop.
   */
  async stop(id: string): Promise<SessionSummary | null> {
    this.running.get(id)?.abort();
    this.running.delete(id);
    await this.setStatus(id, 'stopped', { finished_at: Date.now() });
    return (await this.get(id)) ?? null;
  }

  async archive(id: string, archived: boolean): Promise<SessionSummary | null> {
    await this.patch(id, { archived: archived ? 1 : 0, updated_at: Date.now() });
    const summary = await this.store.summary(id);
    if (summary) this.emitProgress(summary);
    return summary;
  }

  async remove(id: string): Promise<void> {
    this.running.get(id)?.abort();
    this.running.delete(id);
    this.ai.deleteSession(id);
    this.store.forget(id);
    const db = getDatabaseService();
    // `session_events` and `messages` cascade on the foreign key.
    await db.execute([{ query: 'DELETE FROM sessions WHERE id = ?', params: [id] }]);
  }

  resolvePermission(
    id: string,
    requestId: string,
    decision: 'allow-once' | 'allow-always' | 'deny',
  ): void {
    this.ai.resolvePermission(id, requestId, decision);
  }

  // ==========================================================================
  // The run
  // ==========================================================================

  /**
   * Creates the agent session on first use, if it does not exist yet.
   *
   * Here rather than in `start`, so a missing provider becomes a recorded failure
   * on an existing run instead of a rejected call with nothing to show — see the
   * comment in `start` for why that ordering matters.
   */
  private async ensureAgentSession(
    id: string,
    options: { model?: string; workspacePath?: string },
  ): Promise<void> {
    if (this.ai.getSession(id)) return;

    const workspace = options.workspacePath;
    const session = await this.ai.createSession(undefined, options.model, {
      id,
      ...(workspace ? { workspacePath: workspace, workspaceId: workspace } : {}),
    });

    await this.patch(id, {
      provider: session.providerId,
      model: options.model ?? session.model ?? null,
    });
  }

  private async workspacePathOf(id: string): Promise<string | undefined> {
    const db = getDatabaseService();
    const rows = await db.query<SessionRow>('SELECT workspace_id FROM sessions WHERE id = ?', [id]);
    return rows.rows[0]?.workspace_id ?? undefined;
  }

  /**
   * Drives one agent turn and records it.
   *
   * Never rejects: a failed run is a recorded state, not an exception for the
   * caller to handle. The caller has already returned a session id to the UI.
   */
  private async run(
    id: string,
    prompt: string,
    options: { model?: string; workspacePath?: string; mode?: StartSessionRequest['mode'] } = {},
  ): Promise<void> {
    const abort = new AbortController();
    this.running.set(id, abort);

    await this.setStatus(id, 'running', { started_at: Date.now() });

    try {
      await this.ensureAgentSession(id, options);

      const folder = requireThisPcFolder(options.workspacePath);
      const stream = this.ai.streamMessage(id, prompt, undefined, {
        workspacePath: folder,
        ...(options.mode ? { mode: options.mode } : {}),
      });
      for await (const chunk of stream) {
        if (abort.signal.aborted) break;
        await this.recordChunk(id, chunk);
      }

      if (abort.signal.aborted) return;

      const stats = await this.refreshDiffStats(id);
      // `review` rather than `merged`: the run produced changes and a human has
      // not looked at them yet. A run that changed nothing is still complete.
      await this.setStatus(id, 'review', { finished_at: Date.now(), ...stats });
    } catch (error) {
      const message = explain(error);
      await this.append(id, { kind: 'error', at: Date.now(), message });
      await this.setStatus(id, 'failed', { finished_at: Date.now(), error: message });
    } finally {
      this.running.delete(id);
    }
  }

  /**
   * Translates one stream chunk into a timeline entry.
   *
   * The translation itself lives in `session-events.ts`, which is pure and testable
   * on its own — this only decides what to do with the result. Unknown chunk kinds
   * yield nothing rather than a row, so a newer engine event cannot fill the
   * timeline with entries the UI has no way to render.
   */
  private async recordChunk(id: string, chunk: unknown): Promise<void> {
    const translated = toSessionEvent(chunk, Date.now());
    if (!translated) return;

    if (translated.kind === 'reply') {
      await this.appendReply(id, translated.text);
      return;
    }
    await this.append(id, translated);
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================
  //
  // Delegated to `SessionStore`. The methods below stay as thin wrappers because
  // every one of them also has to emit progress, and threading the emitter into the
  // store would give it a reason to know about the event bus.

  private upsert(id: string, columns: Record<string, unknown>): Promise<void> {
    return this.store.upsert(id, columns);
  }

  private patch(id: string, columns: Record<string, unknown>): Promise<void> {
    return this.store.patch(id, columns);
  }

  private async setStatus(
    id: string,
    status: SessionStatus,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.store.patch(id, { status, updated_at: Date.now(), ...extra });
    const summary = await this.store.summary(id);
    if (summary) this.emitProgress(summary);
  }

  private async append(id: string, event: SessionEvent): Promise<void> {
    await this.store.append(id, event);
    const summary = await this.store.summary(id);
    if (summary) this.emitProgress(summary, event);
  }

  private async appendReply(id: string, text: string): Promise<void> {
    await this.store.appendReply(id, text);
    const summary = await this.store.summary(id);
    if (summary) this.emitProgress(summary);
  }

  private emitProgress(session: SessionSummary, event?: SessionEvent): void {
    this.emit('progress', event ? { session, event } : { session });
  }

  // ==========================================================================
  // Diff
  // ==========================================================================

  /**
   * Recomputes the diff stat from git.
   *
   * Not summed from the tool events: two edits to one file would count twice, and
   * an edit reverted by a later one would still count. Git is the only authority
   * on what the working tree actually holds.
   */
  private async refreshDiffStats(id: string): Promise<Record<string, number>> {
    const db = getDatabaseService();
    const rows = await db.query<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
    const row = rows.rows[0];
    if (!row) return {};

    return diffTotals(await diffForWorkspace(row.workspace_id));
  }

  dispose(): void {
    for (const controller of this.running.values()) controller.abort();
    this.running.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: SessionService | null = null;

export function getSessionService(): SessionService {
  if (!instance) instance = new SessionService();
  return instance;
}

export function resetSessionService(): void {
  instance?.dispose();
  instance = null;
}
