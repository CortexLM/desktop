/**
 * The Code run surface over HTTP.
 *
 * This is what makes Code usable from a browser. The desktop app runs the agent
 * loop, the PTY and SQLite in its main process; a browser tab cannot, so every
 * Code surface that used to be Electron-only needs a route here instead. Runs
 * execute on Cloud or on a paired host that is already running Cortex Code —
 * never in the tab.
 *
 * Sessions stream over `/v1/realtime`; these are the request/response halves:
 * starting a run, reading its timeline, answering a permission, and the
 * repositories and usage the composer is driven by. Configuration lives in
 * `code-config.ts`.
 *
 * The public deployment answered 404 for all of it when this was written. That
 * is why callers get `not_found` rather than an empty list — an account with no
 * sessions and a backend with no session routes are different facts, and the UI
 * says different things about them.
 */

import type { CortexApiClient } from './client.ts';
import { listItems } from './lists.ts';
import { unknownSchema } from './schemas.ts';
import {
  codeRepositoryListSchema,
  codeSessionDetailSchema,
  codeUsageSchema,
  type ApiCodeRepository,
  type ApiCodeSessionDetail,
  type ApiCodeUsage,
} from './code-control-schemas.ts';

const SESSIONS = '/v1/code/sessions';

function sessionPath(id: string, suffix = ''): string {
  return `${SESSIONS}/${encodeURIComponent(id)}${suffix}`;
}

export function getCodeSession(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(sessionPath(id), codeSessionDetailSchema, { signal });
}

/**
 * Starts a run. Returns the session the service created.
 *
 * The id comes back from the service rather than being minted locally: a
 * client-invented id cannot be followed up on, stopped, or reopened later.
 */
export function createCodeSession(
  client: CortexApiClient,
  body: {
    prompt: string;
    runtime?: string;
    repository?: string;
    branch?: string;
    model?: string;
    host_id?: string;
    ticket_id?: string;
  },
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(SESSIONS, codeSessionDetailSchema, { method: 'POST', body, signal });
}

export function followUpCodeSession(
  client: CortexApiClient,
  id: string,
  body: { message: string },
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(sessionPath(id, '/turns'), codeSessionDetailSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export function stopCodeSession(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(sessionPath(id, '/stop'), codeSessionDetailSchema, {
    method: 'POST',
    body: {},
    signal,
  });
}

export function archiveCodeSession(
  client: CortexApiClient,
  id: string,
  archived: boolean,
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(sessionPath(id, '/archive'), codeSessionDetailSchema, {
    method: 'POST',
    body: { archived },
    signal,
  });
}

export async function deleteCodeSession(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(sessionPath(id), unknownSchema, { method: 'DELETE', signal });
}

/**
 * Answers an Allow / Always / Deny prompt.
 *
 * Also available on the realtime socket. This is the HTTP half, used when the
 * socket is down and the SSE fallback is read-only — a blocked run the user
 * cannot answer is worse than a slower answer.
 */
export async function resolveCodePermission(
  client: CortexApiClient,
  id: string,
  body: { request_permission_id: string; decision: 'allow' | 'always' | 'deny' },
  signal?: AbortSignal,
): Promise<void> {
  await client.request(sessionPath(id, '/permissions'), unknownSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export function listCodeRepositories(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeRepository[]> {
  return listItems(client, '/v1/code/repositories', codeRepositoryListSchema, { signal });
}

export function getCodeUsage(client: CortexApiClient, signal?: AbortSignal): Promise<ApiCodeUsage> {
  return client.request('/v1/code/usage', codeUsageSchema, { signal });
}
