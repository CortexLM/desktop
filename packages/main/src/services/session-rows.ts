/**
 * Reading a run's row back, and saying what went wrong.
 *
 * Split out of `SessionService` so the service is about behaviour — starting a
 * turn, recording it, stopping it — and this is about shape. Everything here is
 * pure and drivable by a test without a database.
 */

import type {
  SessionEvent,
  SessionRuntime,
  SessionStatus,
  SessionSummary,
} from '@cortex-ide/shared';

export interface SessionRow {
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

export interface EventRow {
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

export function toStatus(raw: string): SessionStatus {
  return (RUN_STATUSES as readonly string[]).includes(raw)
    ? (raw as SessionStatus)
    : 'queued';
}

export function toRuntime(raw: string | null): SessionRuntime {
  return raw === 'cloud' || raw === 'ssh' ? raw : 'local';
}

export function toSummary(row: SessionRow): SessionSummary {
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
  if (row.started_at !== null) summary.startedAt = row.started_at;
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
export function toEvent(row: EventRow): SessionEvent | null {
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
export function explain(error: unknown): string {
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


/**
 * The summary a freshly-created run starts life as.
 *
 * The request wins over the workspace binding, and the binding over nothing: the
 * user may have picked a repository the active workspace is not.
 */
export function newRun(
  id: string,
  request: { prompt: string; runtime: SessionRuntime; repo?: string; branch?: string },
  now: number,
  binding?: { id: string; branch?: string },
): SessionSummary {
  const repo = request.repo || binding?.id;
  const branch = request.branch || binding?.branch;

  return {
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
    ...(repo ? { repo } : {}),
    ...(branch ? { branch } : {}),
  };
}
