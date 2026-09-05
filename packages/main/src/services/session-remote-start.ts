/**
 * Cloud and SSH session starts for the desktop app.
 *
 * Local runs stay on this machine (the agent loop plus the open folder). Cloud
 * and SSH go through the Cortex control plane so This PC cannot be silently
 * swapped for a cloud workspace. A missing route fails closed.
 */

import {
  createCodeSession,
  followUpCodeSession,
  isCortexApiError,
  type ApiCodeSessionDetail,
} from '@cortex-ide/cortex-api';
import type { SessionSummary, StartSessionRequest } from '@cortex-ide/shared';

import { getCortexAccountService } from './cortex-account-service';

const ACCOUNT_NEEDED =
  'Cloud and SSH sessions need a Cortex account. Sign in, or start on This PC.';

const ROUTE_MISSING =
  'Cloud sessions are not available on this workspace yet. Start on This PC, or try again later.';

export async function startRemoteCodeSession(request: StartSessionRequest): Promise<SessionSummary> {
  const service = getCortexAccountService();
  if (!service.state().user) {
    throw new Error(ACCOUNT_NEEDED);
  }

  try {
    const created = await createCodeSession(service.getApiClient(), {
      prompt: request.prompt,
      runtime: request.runtime,
      ...(request.repo ? { repository: request.repo } : {}),
      ...(request.branch ? { branch: request.branch } : {}),
      ...(request.model ? { model: request.model } : {}),
    });
    return toSummary(created, request);
  } catch (error) {
    throw new Error(describeRemoteStart(error));
  }
}

export async function followUpRemoteCodeSession(
  id: string,
  prompt: string,
  runtime: StartSessionRequest['runtime'] = 'cloud',
): Promise<SessionSummary> {
  const service = getCortexAccountService();
  if (!service.state().user) {
    throw new Error(ACCOUNT_NEEDED);
  }
  try {
    const updated = await followUpCodeSession(service.getApiClient(), id, { message: prompt });
    return toSummary(updated, { prompt, runtime });
  } catch (error) {
    throw new Error(describeRemoteStart(error));
  }
}

export function remoteSessionRow(
  created: SessionSummary,
  request: StartSessionRequest,
  workspacePath: string | null,
  now: number,
) {
  return {
    workspace_id: workspacePath,
    title: created.title,
    prompt: request.prompt,
    status: created.status,
    runtime: request.runtime,
    repo: created.repo ?? null,
    branch: created.branch ?? null,
    model: request.model ?? null,
    created_at: created.createdAt,
    updated_at: now,
  };
}

function describeRemoteStart(error: unknown): string {
  if (isCortexApiError(error) && (error.code === 'not_found' || error.status === 404)) {
    return ROUTE_MISSING;
  }
  if (isCortexApiError(error) && error.isAuthFailure) {
    return ACCOUNT_NEEDED;
  }
  return error instanceof Error ? error.message : ROUTE_MISSING;
}

function toSummary(row: ApiCodeSessionDetail, request: StartSessionRequest): SessionSummary {
  const now = Date.now();
  const repo = row.repository ?? request.repo;
  const branch = row.branch ?? request.branch;
  const summary: SessionSummary = {
    id: row.id,
    title: (row.title ?? request.prompt.trim().slice(0, 80)) || 'Session',
    status: 'queued',
    runtime: request.runtime,
    additions: row.additions ?? 0,
    deletions: row.deletions ?? 0,
    filesChanged: row.files_changed ?? 0,
    createdAt: now,
    updatedAt: now,
    archived: false,
  };
  if (repo) summary.repo = repo;
  if (branch) summary.branch = branch;
  return summary;
}
