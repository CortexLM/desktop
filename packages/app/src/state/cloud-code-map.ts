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

/** `kind`, or the role when the row only carries one. */
function timelineKind(entry: ApiCodeTimelineEntry): string | undefined {
  if (entry.kind) return entry.kind;
  if (entry.role === 'user') return 'prompt';
  if (entry.role === 'assistant') return 'reply';
  return undefined;
}

function toToolEvent(
  entry: ApiCodeTimelineEntry,
  at: number,
  text: string,
): Extract<SessionEvent, { kind: 'tool' }> {
  const event: Extract<SessionEvent, { kind: 'tool' }> = {
    kind: 'tool',
    at,
    name: entry.tool ?? 'Tool',
    title: text || (entry.tool ?? 'Tool call'),
  };
  // Absent while the tool is still running, which is not the same as failing.
  if (entry.status === 'ok') event.ok = true;
  if (entry.status === 'error') event.ok = false;
  return event;
}

const TIMELINE_BUILDERS: Record<
  string,
  (entry: ApiCodeTimelineEntry, at: number, text: string) => SessionEvent
> = {
  prompt: (_entry, at, text) => ({ kind: 'prompt', at, text }),
  reply: (_entry, at, text) => ({ kind: 'reply', at, text }),
  thinking: (_entry, at, text) => ({ kind: 'thinking', at, text }),
  error: (_entry, at, text) => ({ kind: 'error', at, message: text }),
  tool: toToolEvent,
};

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
  const kind = timelineKind(entry);
  const build = kind ? TIMELINE_BUILDERS[kind] : undefined;
  return build?.(entry, toEpoch(entry.created_at, now), entry.text ?? '');
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

function toRunDefaults(
  row: ApiCodeSettings['defaults'],
  fallback: WorkspaceRunSettings['defaults'],
): WorkspaceRunSettings['defaults'] {
  return {
    model: row?.model ?? fallback.model,
    repository: row?.repository ?? fallback.repository,
    baseBranch: row?.base_branch ?? fallback.baseBranch,
    branchPrefix: row?.branch_prefix ?? fallback.branchPrefix,
    createPullRequests: pick(PR_MODES, row?.create_pull_requests, fallback.createPullRequests),
  };
}

function toRunPermissions(
  row: ApiCodeSettings['permissions'],
  fallback: WorkspaceRunSettings['permissions'],
): WorkspaceRunSettings['permissions'] {
  return {
    runShellCommands: row?.run_shell_commands ?? fallback.runShellCommands,
    applyDatabaseMigrations: row?.apply_database_migrations ?? fallback.applyDatabaseMigrations,
    slackNotifications: row?.slack_notifications ?? fallback.slackNotifications,
    networkAccess: pick(NETWORK_MODES, row?.network_access, fallback.networkAccess),
  };
}

export function toRunSettings(
  row: ApiCodeSettings,
  defaults: WorkspaceRunSettings,
): WorkspaceRunSettings {
  return {
    defaults: toRunDefaults(row.defaults, defaults.defaults),
    permissions: toRunPermissions(row.permissions, defaults.permissions),
  };
}

/**
 * Copies the keys a caller actually set, renaming each to its wire name.
 *
 * Table-driven so "which fields exist" is one list rather than a chain of
 * `!== undefined` checks: adding a setting should not mean editing a branch.
 */
function renameSet(
  source: Record<string, unknown>,
  names: ReadonlyArray<readonly [string, string]>,
): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  for (const [from, to] of names) {
    const value = source[from];
    if (value !== undefined) wire[to] = value;
  }
  return wire;
}

/**
 * The camelCase-to-wire name pairs.
 *
 * The source keys are typed against `WorkspaceRunSettings` so a renamed field fails
 * to compile here rather than silently stopping being sent.
 */
const DEFAULT_NAMES: ReadonlyArray<readonly [keyof WorkspaceRunSettings['defaults'], string]> = [
  ['model', 'model'],
  ['repository', 'repository'],
  ['baseBranch', 'base_branch'],
  ['branchPrefix', 'branch_prefix'],
  ['createPullRequests', 'create_pull_requests'],
];

const PERMISSION_NAMES: ReadonlyArray<
  readonly [keyof WorkspaceRunSettings['permissions'], string]
> = [
  ['runShellCommands', 'run_shell_commands'],
  ['applyDatabaseMigrations', 'apply_database_migrations'],
  ['slackNotifications', 'slack_notifications'],
  ['networkAccess', 'network_access'],
];

/** Sends only what changed, so one tab's save cannot clobber another's. */
export function toSettingsPatch(patch: {
  defaults?: Partial<WorkspaceRunSettings['defaults']>;
  permissions?: Partial<WorkspaceRunSettings['permissions']>;
}): ApiCodeSettings {
  const body: ApiCodeSettings = {};
  if (patch.defaults) body.defaults = renameSet(patch.defaults, DEFAULT_NAMES);
  if (patch.permissions) body.permissions = renameSet(patch.permissions, PERMISSION_NAMES);
  return body;
}
