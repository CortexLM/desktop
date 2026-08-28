/**
 * Maps the Code control plane's wire shapes onto the types the screens read.
 *
 * The screens were written against `SessionSummary` / `SessionDetail`, which main
 * produces from SQLite. Rather than teach every screen a second shape, the HTTP
 * rows are projected onto the same types here — so the workbench renders a cloud
 * run and a local run with one code path.
 *
 * Unknown values are narrowed rather than cast. A status the client does not
 * recognise becomes `queued`, not `merged`: guessing optimistically would show a
 * run as finished when nobody said it was.
 */

import type {
  ApiCodeSessionDetail,
  ApiCodeSettings,
  ApiCodeTimelineEntry,
} from '@cortex-ide/cortex-api';
import type {
  SessionDetail,
  SessionDiffFile,
  SessionEvent,
  SessionRuntime,
  SessionStatus,
  SessionSummary,
  WorkspaceRunSettings,
} from '@cortex-ide/shared';

const STATUSES: readonly SessionStatus[] = [
  'queued',
  'running',
  'review',
  'merged',
  'failed',
  'stopped',
];

const RUNTIMES: readonly SessionRuntime[] = ['local', 'cloud', 'ssh'];

export function toSessionStatus(value: string | undefined): SessionStatus {
  return STATUSES.find((status) => status === value) ?? 'queued';
}

/**
 * Defaults to `cloud` rather than `local`.
 *
 * A run the browser learned about over HTTP is by definition not running in the
 * browser, so `local` would be the one answer that cannot be true.
 */
export function toSessionRuntime(value: string | undefined): SessionRuntime {
  return RUNTIMES.find((runtime) => runtime === value) ?? 'cloud';
}

/** Epoch ms from an ISO string, falling back to now for a row without one. */
function toEpoch(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function toSessionSummary(row: ApiCodeSessionDetail, now = Date.now()): SessionSummary {
  const summary: SessionSummary = {
    id: row.id,
    title: row.title ?? 'Session',
    status: toSessionStatus(row.status),
    runtime: toSessionRuntime(row.runtime),
    additions: row.additions ?? 0,
    deletions: row.deletions ?? 0,
    filesChanged: row.files_changed ?? 0,
    createdAt: toEpoch(row.created_at, now),
    updatedAt: toEpoch(row.updated_at, now),
    archived: false,
  };
  if (row.repository) summary.repo = row.repository;
  if (row.branch) summary.branch = row.branch;
  if (row.pull_request?.url) summary.pullRequestUrl = row.pull_request.url;
  return summary;
}

/**
 * Projects one timeline row.
 *
 * Returns `undefined` for a kind this client does not model instead of coercing
 * it into a reply: an unrecognised entry rendered as agent prose would put words
 * in the agent's mouth.
 */
export function toSessionEvent(
  entry: ApiCodeTimelineEntry,
  now = Date.now(),
): SessionEvent | undefined {
  const at = toEpoch(entry.created_at, now);
  const text = entry.text ?? '';

  if (entry.kind === 'prompt' || entry.role === 'user') return { kind: 'prompt', at, text };
  if (entry.kind === 'reply' || entry.role === 'assistant') return { kind: 'reply', at, text };
  if (entry.kind === 'thinking') return { kind: 'thinking', at, text };
  if (entry.kind === 'error') return { kind: 'error', at, message: text };
  if (entry.kind === 'tool') {
    const event: Extract<SessionEvent, { kind: 'tool' }> = {
      kind: 'tool',
      at,
      name: entry.tool ?? 'Tool',
      title: text || (entry.tool ?? 'Tool call'),
    };
    if (entry.status === 'ok') event.ok = true;
    if (entry.status === 'error') event.ok = false;
    return event;
  }
  return undefined;
}

function toDiffFiles(row: ApiCodeSessionDetail): SessionDiffFile[] {
  return (row.changes ?? []).map((change) => ({
    path: change.path,
    additions: change.additions ?? 0,
    deletions: change.deletions ?? 0,
    diff: change.patch ?? '',
  }));
}

/**
 * Builds the workbench's view of a cloud run.
 *
 * A pending permission arrives on the detail row rather than only on the socket,
 * so a tab that reloads mid-run still shows the Allow / Always / Deny prompt
 * instead of a run that looks stuck.
 */
export function toSessionDetail(row: ApiCodeSessionDetail, now = Date.now()): SessionDetail {
  const events: SessionEvent[] = [];
  for (const entry of row.timeline ?? []) {
    const event = toSessionEvent(entry, now);
    if (event) events.push(event);
  }

  if (row.permission_request) {
    events.push({
      kind: 'permission',
      at: now,
      requestId: row.permission_request.id,
      summary:
        row.permission_request.summary ??
        row.permission_request.command ??
        `${row.permission_request.tool ?? 'The agent'} is waiting for a decision`,
      risk: 'caution',
    });
  }

  const detail: SessionDetail = {
    ...toSessionSummary(row, now),
    events,
    files: toDiffFiles(row),
  };
  if (row.model) detail.model = row.model;
  return detail;
}

/** Only `deny` and `always` have distinct wire names; the rest is `allow`. */
export function toWireDecision(
  decision: 'allow-once' | 'allow-always' | 'deny',
): 'allow' | 'always' | 'deny' {
  if (decision === 'deny') return 'deny';
  return decision === 'allow-always' ? 'always' : 'allow';
}

/* ------------------------------------------------------------------------- */
/* Settings                                                                  */
/* ------------------------------------------------------------------------- */

const PR_MODES = ['draft', 'ready', 'never'] as const;
const NETWORK_MODES = ['allowlist', 'all', 'none'] as const;

function pick<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
  fallback: T,
): T {
  return allowed.find((entry) => entry === value) ?? fallback;
}

export function toRunSettings(
  row: ApiCodeSettings,
  defaults: WorkspaceRunSettings,
): WorkspaceRunSettings {
  return {
    defaults: {
      model: row.defaults?.model ?? defaults.defaults.model,
      repository: row.defaults?.repository ?? defaults.defaults.repository,
      baseBranch: row.defaults?.base_branch ?? defaults.defaults.baseBranch,
      branchPrefix: row.defaults?.branch_prefix ?? defaults.defaults.branchPrefix,
      createPullRequests: pick(
        PR_MODES,
        row.defaults?.create_pull_requests,
        defaults.defaults.createPullRequests,
      ),
    },
    permissions: {
      runShellCommands:
        row.permissions?.run_shell_commands ?? defaults.permissions.runShellCommands,
      applyDatabaseMigrations:
        row.permissions?.apply_database_migrations ??
        defaults.permissions.applyDatabaseMigrations,
      slackNotifications:
        row.permissions?.slack_notifications ?? defaults.permissions.slackNotifications,
      networkAccess: pick(
        NETWORK_MODES,
        row.permissions?.network_access,
        defaults.permissions.networkAccess,
      ),
    },
  };
}

/** Sends only what changed, so one tab's save cannot clobber another's. */
export function toSettingsPatch(patch: {
  defaults?: Partial<WorkspaceRunSettings['defaults']>;
  permissions?: Partial<WorkspaceRunSettings['permissions']>;
}): ApiCodeSettings {
  const body: ApiCodeSettings = {};

  if (patch.defaults) {
    const wire: NonNullable<ApiCodeSettings['defaults']> = {};
    if (patch.defaults.model !== undefined) wire.model = patch.defaults.model;
    if (patch.defaults.repository !== undefined) wire.repository = patch.defaults.repository;
    if (patch.defaults.baseBranch !== undefined) wire.base_branch = patch.defaults.baseBranch;
    if (patch.defaults.branchPrefix !== undefined) {
      wire.branch_prefix = patch.defaults.branchPrefix;
    }
    if (patch.defaults.createPullRequests !== undefined) {
      wire.create_pull_requests = patch.defaults.createPullRequests;
    }
    body.defaults = wire;
  }

  if (patch.permissions) {
    const wire: NonNullable<ApiCodeSettings['permissions']> = {};
    const source = patch.permissions;
    if (source.runShellCommands !== undefined) wire.run_shell_commands = source.runShellCommands;
    if (source.applyDatabaseMigrations !== undefined) {
      wire.apply_database_migrations = source.applyDatabaseMigrations;
    }
    if (source.slackNotifications !== undefined) {
      wire.slack_notifications = source.slackNotifications;
    }
    if (source.networkAccess !== undefined) wire.network_access = source.networkAccess;
    body.permissions = wire;
  }

  return body;
}
