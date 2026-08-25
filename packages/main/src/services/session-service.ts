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

import { dialog } from 'electron';
import { EventEmitter } from 'node:events';
import { basename } from 'node:path';

import type {
  RepositoryOption,
  SessionDetail,
  SessionDiffFile,
  SessionEvent,
  SessionRuntime,
  SessionStatus,
  SessionSummary,
  StartSessionRequest,
} from '@cortex-ide/shared';

import { getDatabaseService } from './database-service';
import { getAIService, type AIService } from './ai-service';
import { gitService } from './git-service';
import { activeWorkspaceManager, activeWorkspacePath } from './active-workspace';

/** Ce que le renderer peut demander sans qu'on lui donne un chemin disque. */
interface RepoBinding {
  id: string;
  path: string;
  branch?: string;
}

interface SessionRow {
  id: string;
  workspace_id: string | null;
  title: string | null;
  model: string | null;
  provider: string | null;
  prompt: string | null;
  status: string;
  runtime: string | null;
  repo: string | null;
  branch: string | null;
  additions: number;
  deletions: number;
  files_changed: number;
  archived: number;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  finished_at: number | null;
  error: string | null;
  pull_request_url: string | null;
}

interface EventRow {
  seq: number;
  kind: string;
  payload: string;
  created_at: number;
}

const RUN_STATUSES: readonly SessionStatus[] = [
  'queued',
  'running',
  'review',
  'merged',
  'failed',
  'stopped',
];

function toStatus(raw: string): SessionStatus {
  return (RUN_STATUSES as readonly string[]).includes(raw)
    ? (raw as SessionStatus)
    : 'queued';
}

function toRuntime(raw: string | null): SessionRuntime {
  return raw === 'cloud' || raw === 'ssh' ? raw : 'local';
}

function toSummary(row: SessionRow): SessionSummary {
  const summary: SessionSummary = {
    id: row.id,
    // The prompt is the title the user recognises. `title` is a fallback for rows
    // written by the older chat path, which set it to "New session".
    title: row.prompt?.trim() || row.title?.trim() || 'Untitled session',
    status: toStatus(row.status),
    runtime: toRuntime(row.runtime),
    additions: row.additions,
    deletions: row.deletions,
    filesChanged: row.files_changed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: row.archived === 1,
  };
  if (row.repo) summary.repo = row.repo;
  if (row.branch) summary.branch = row.branch;
  if (row.finished_at !== null) summary.finishedAt = row.finished_at;
  if (row.error) summary.error = row.error;
  if (row.pull_request_url) summary.pullRequestUrl = row.pull_request_url;
  return summary;
}

/**
 * Reads a persisted timeline row back into its discriminated form.
 *
 * Returns `null` on anything unrecognised rather than throwing. A row written by
 * a newer build, or a payload truncated by a crash mid-write, must not make the
 * whole session unopenable — the run still happened and the rest of it is still
 * worth showing.
 */
function toEvent(row: EventRow): SessionEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) return null;

  const event = { ...(payload as Record<string, unknown>), kind: row.kind, at: row.created_at };
  return event as SessionEvent;
}

/**
 * Turns a failure into something the user can act on.
 *
 * The engine's own messages are accurate and useless on their own: "No default AI
 * provider configured" is true, and says nothing about where a provider is
 * configured. A run that fails for a reason the user can fix should say what the
 * fix is, because the alternative is a dead end in the one place the product is
 * meant to work — a fresh install with no key.
 *
 * Anything unrecognised passes through verbatim rather than being replaced by
 * generic copy: a message we did not anticipate is still the best information
 * available about what went wrong.
 */
function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/no default ai provider configured/i.test(message)) {
    return 'No model is configured. Add a provider key in Settings, or sign in to use Cortex models.';
  }
  if (/provider "(.+)" is not available/i.test(message)) {
    return `${message}. Check the key and base URL in Settings.`;
  }
  if (/provider "(.+)" not found/i.test(message)) {
    return `${message}. Enable it in Settings.`;
  }
  return message;
}

export class SessionService extends EventEmitter {
  private readonly ai: AIService;

  /** Abort handles for runs in flight, so Stop is more than a status change. */
  private readonly running = new Map<string, AbortController>();

  /** Next timeline sequence per session, so ordering survives a restart. */
  private readonly nextSeq = new Map<string, number>();

  constructor(options: { ai?: AIService } = {}) {
    super();
    this.ai = options.ai ?? getAIService();
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
      files: await this.diffFor(row),
    };
    if (row.model) detail.model = row.model;
    if (row.provider) detail.provider = row.provider;
    return detail;
  }

  /**
   * The repositories the composer can offer.
   *
   * Only the active workspace today: a picker listing folders the user has not
   * opened would be offering to run an agent somewhere they have not pointed the
   * app at. Returns an empty list rather than throwing when no folder is open —
   * the composer then shows its own empty state.
   */
  async listRepositories(): Promise<
    Array<{ id: string; name: string; branch?: string; branches: string[]; dirty: boolean }>
  > {
    const binding = await this.activeRepo();
    if (!binding) return [];

    try {
      const [status, branchSummary] = await Promise.all([
        gitService.status(binding.path),
        gitService.branches(binding.path),
      ]);
      return [
        {
          id: binding.id,
          name: binding.id,
          branch: status.branch,
          // Local heads only: remote-tracking refs would list every branch anyone
          // has ever pushed, which is not a set the user can start work on here.
          branches: branchSummary.all.filter((name) => !name.startsWith('remotes/')),
          dirty: !status.isClean,
        },
      ];
    } catch {
      // Not a git repository, or git is unavailable. Still offerable as a plain
      // folder — the agent does not need git to read and edit files.
      return [{ id: binding.id, name: binding.id, branches: [], dirty: false }];
    }
  }

  /**
   * Opens the native folder picker and adopts the choice as the active workspace.
   *
   * Both steps in one call. The renderer has no use for a disk path — it addresses
   * repositories by id — so handing it one just to hand it back would be sending
   * the user's directory layout through the least-trusted process for nothing.
   */
  async openWorkspace(): Promise<{ cancelled: boolean; repositories: RepositoryOption[] }> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Open a folder to run agents in',
    });

    const path = result.filePaths[0];
    if (result.canceled || !path) {
      return { cancelled: true, repositories: await this.listRepositories() };
    }

    const manager = await activeWorkspaceManager();
    const workspace = await manager.addWorkspace(path);
    await manager.switchWorkspace(workspace.id);

    return { cancelled: false, repositories: await this.listRepositories() };
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
    const binding = await this.activeRepo();
    const now = Date.now();

    // The row is written *before* the provider is resolved, and that ordering is
    // the point. `AIService.createSession` throws "No default AI provider
    // configured" when no key is set — which is the state a new install is in. If
    // that threw out of here, the composer would surface a raw error, throw away
    // nothing it could recover, and leave no trace of the attempt. Instead the run
    // exists, lands in `failed` with a message that names the fix, and the user has
    // a row to click rather than a toast to re-read.
    const id = `session_${now}_${Math.random().toString(36).slice(2, 11)}`;

    const summary: SessionSummary = {
      id,
      title: request.prompt.trim() || 'Untitled session',
      status: 'queued',
      runtime: request.runtime,
      additions: 0,
      deletions: 0,
      filesChanged: 0,
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    if (request.repo ?? binding?.id) summary.repo = request.repo ?? binding?.id;
    if (request.branch ?? binding?.branch) summary.branch = request.branch ?? binding?.branch;

    await this.upsert(id, {
      workspace_id: binding?.path ?? null,
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
      workspacePath: binding?.path,
    });
    return summary;
  }

  /** Adds a turn to a session that has already finished one. */
  async followUp(id: string, prompt: string): Promise<SessionSummary | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    if (this.running.has(id)) return existing;

    await this.append(id, { kind: 'prompt', at: Date.now(), text: prompt });
    void this.run(id, prompt);
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
    const summary = await this.summary(id);
    if (summary) this.emitProgress(summary);
    return summary;
  }

  async remove(id: string): Promise<void> {
    this.running.get(id)?.abort();
    this.running.delete(id);
    this.ai.deleteSession(id);
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
   * Drives one agent turn and records it.
   *
   * Never rejects: a failed run is a recorded state, not an exception for the
   * caller to handle. The caller has already returned a session id to the UI.
   */
  private async run(
    id: string,
    prompt: string,
    options: { model?: string; workspacePath?: string } = {},
  ): Promise<void> {
    const abort = new AbortController();
    this.running.set(id, abort);

    await this.setStatus(id, 'running', { started_at: Date.now() });

    try {
      // Created here rather than in `start`, so a missing provider becomes a
      // recorded failure on an existing run instead of a rejected call.
      if (!this.ai.getSession(id)) {
        const session = await this.ai.createSession(undefined, options.model, {
          id,
          ...(options.workspacePath ? { workspacePath: options.workspacePath } : {}),
          ...(options.workspacePath ? { workspaceId: options.workspacePath } : {}),
        });
        await this.patch(id, {
          provider: session.providerId,
          model: options.model ?? session.model ?? null,
        });
      }

      const stream = this.ai.streamMessage(id, prompt);
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
   * The agent loop's events arrive already shaped (`tool`, `permission`, `plan`);
   * plain text is accumulated as the reply. Unknown chunk kinds are ignored
   * rather than stored, so a newer engine event cannot fill the timeline with
   * rows the UI has no way to render.
   */
  private async recordChunk(id: string, chunk: unknown): Promise<void> {
    if (typeof chunk !== 'object' || chunk === null) return;
    const record = chunk as Record<string, unknown>;
    const at = Date.now();

    const tool = record.tool as Record<string, unknown> | undefined;
    if (tool && typeof tool.name === 'string') {
      const event: SessionEvent = {
        kind: 'tool',
        at,
        name: tool.name,
        title: typeof tool.title === 'string' ? tool.title : tool.name,
      };
      if (typeof tool.detail === 'string') event.detail = tool.detail;
      if (typeof tool.ok === 'boolean') event.ok = tool.ok;
      if (typeof tool.output === 'string') event.output = tool.output.slice(0, 4000);
      if (typeof tool.additions === 'number') event.additions = tool.additions;
      if (typeof tool.deletions === 'number') event.deletions = tool.deletions;
      if (typeof tool.durationMs === 'number') event.durationMs = tool.durationMs;
      await this.append(id, event);
      return;
    }

    const permission = record.permission as Record<string, unknown> | undefined;
    if (permission && typeof permission.requestId === 'string') {
      await this.append(id, {
        kind: 'permission',
        at,
        requestId: permission.requestId,
        summary: typeof permission.summary === 'string' ? permission.summary : 'Permission needed',
        risk:
          permission.risk === 'dangerous' || permission.risk === 'caution'
            ? permission.risk
            : 'safe',
      });
      return;
    }

    const plan = record.plan as Record<string, unknown> | undefined;
    if (plan && Array.isArray(plan.steps)) {
      await this.append(id, {
        kind: 'plan',
        at,
        steps: plan.steps.map((step, index) => {
          const raw = (step ?? {}) as Record<string, unknown>;
          return {
            id: typeof raw.id === 'string' ? raw.id : `step-${index}`,
            label: typeof raw.label === 'string' ? raw.label : String(step),
            state:
              raw.state === 'done' || raw.state === 'current'
                ? raw.state
                : ('pending' as const),
          };
        }),
      });
      return;
    }

    if (typeof record.content === 'string' && record.content.length > 0) {
      await this.appendReply(id, record.content);
    }
  }

  /**
   * Appends assistant text, merging into the previous reply when there is one.
   *
   * Streaming delivers prose a token at a time. Stored as one row per chunk, a
   * single answer becomes hundreds of timeline entries — so the tail row is
   * extended instead, and the timeline keeps one entry per turn of speech.
   */
  private async appendReply(id: string, text: string): Promise<void> {
    const db = getDatabaseService();
    const tail = await db.query<{ seq: number; kind: string; payload: string }>(
      'SELECT seq, kind, payload FROM session_events WHERE session_id = ? ORDER BY seq DESC LIMIT 1',
      [id],
    );
    const last = tail.rows[0];

    if (last?.kind === 'reply') {
      let previous = '';
      try {
        previous = String((JSON.parse(last.payload) as { text?: unknown }).text ?? '');
      } catch {
        previous = '';
      }
      await db.execute([
        {
          query: 'UPDATE session_events SET payload = ? WHERE session_id = ? AND seq = ?',
          params: [JSON.stringify({ text: previous + text }), id, last.seq],
        },
      ]);
      return;
    }

    await this.append(id, { kind: 'reply', at: Date.now(), text });
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  private async upsert(id: string, columns: Record<string, unknown>): Promise<void> {
    const db = getDatabaseService();
    const names = Object.keys(columns);
    const placeholders = names.map(() => '?').join(', ');
    const updates = names.map((name) => `${name} = excluded.${name}`).join(', ');

    await db.execute([
      {
        query: `INSERT INTO sessions (id, ${names.join(', ')}) VALUES (?, ${placeholders})
              ON CONFLICT(id) DO UPDATE SET ${updates}`,
        params: [id, ...names.map((name) => columns[name] as never)],
      },
    ]);
  }

  private async patch(id: string, columns: Record<string, unknown>): Promise<void> {
    const names = Object.keys(columns);
    if (names.length === 0) return;

    const db = getDatabaseService();
    await db.execute([
      {
        query: `UPDATE sessions SET ${names.map((name) => `${name} = ?`).join(', ')} WHERE id = ?`,
        params: [...names.map((name) => columns[name] as never), id],
      },
    ]);
  }

  private async setStatus(
    id: string,
    status: SessionStatus,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.patch(id, { status, updated_at: Date.now(), ...extra });
    const summary = await this.summary(id);
    if (summary) this.emitProgress(summary);
  }

  /**
   * Appends a timeline row.
   *
   * `seq` is allocated from the persisted maximum on first use per session rather
   * than from a counter that starts at zero: after a restart, a fresh counter
   * would collide with the rows already stored and the UNIQUE constraint would
   * reject every event of a resumed session.
   */
  private async append(id: string, event: SessionEvent): Promise<void> {
    const db = getDatabaseService();

    let seq = this.nextSeq.get(id);
    if (seq === undefined) {
      const max = await db.query<{ seq: number | null }>(
        'SELECT MAX(seq) AS seq FROM session_events WHERE session_id = ?',
        [id],
      );
      seq = (max.rows[0]?.seq ?? -1) + 1;
    }
    this.nextSeq.set(id, seq + 1);

    const { kind, at, ...payload } = event as SessionEvent & Record<string, unknown>;
    await db.execute([
      {
        query: `INSERT INTO session_events (id, session_id, seq, kind, payload, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [`${id}:${seq}`, id, seq, kind, JSON.stringify(payload), at],
      },
      { query: 'UPDATE sessions SET updated_at = ? WHERE id = ?', params: [at, id] },
    ]);

    const summary = await this.summary(id);
    if (summary) this.emitProgress(summary, event);
  }

  private async summary(id: string): Promise<SessionSummary | null> {
    const db = getDatabaseService();
    const rows = await db.query<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
    const row = rows.rows[0];
    return row ? toSummary(row) : null;
  }

  private emitProgress(session: SessionSummary, event?: SessionEvent): void {
    this.emit('progress', event ? { session, event } : { session });
  }

  // ==========================================================================
  // Diff
  // ==========================================================================

  private async diffFor(row: SessionRow): Promise<SessionDiffFile[]> {
    if (!row.workspace_id) return [];

    try {
      const diff = await gitService.diff(row.workspace_id);
      return diff.diffs.map((file) => ({
        path: file.path,
        additions: file.additions,
        deletions: file.deletions,
        diff: file.diff,
      }));
    } catch {
      // Not a repository, or git failed. An empty change list is the honest answer
      // — better than failing to open the session over it.
      return [];
    }
  }

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

    const files = await this.diffFor(row);
    return {
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0),
      files_changed: files.length,
    };
  }

  // ==========================================================================
  // Workspace
  // ==========================================================================

  /**
   * The repository the active workspace points at.
   *
   * Returns the path for main's own use and an id for the renderer. The path never
   * crosses IPC: it is main's business, and sending it would leak the user's
   * directory layout into the process that renders content.
   *
   * Goes through `activeWorkspacePath` rather than the manager directly, because
   * the manager has to be initialised before it will answer — an uninitialised one
   * reports no active workspace even when a folder is registered, which is how the
   * composer's repository picker came to be permanently empty.
   */
  private async activeRepo(): Promise<RepoBinding | undefined> {
    const path = await activeWorkspacePath();
    if (!path) return undefined;
    return { id: basename(path), path };
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
