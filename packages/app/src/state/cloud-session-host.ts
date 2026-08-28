/**
 * Code host for the web renderer: Cloud or a named Cortex Code host only.
 *
 * Never starts a local harness. Permissions and tool events prefer the
 * realtime socket. HTTP session list is used when the route exists; a 404
 * is an empty inbox, not a fake run.
 */

import {
  createHttpProductSurface,
  isCortexApiError,
  type CortexApiClient,
  type StreamTransport,
} from '@cortex-ide/cortex-api';
import type { SessionProgressEvent, SessionSummary, StartSessionRequest } from '@cortex-ide/shared';

import type { SessionHost } from './session-host.ts';

const CLOUD_ONLY =
  'Code runs on Cloud or a connected Cortex Code host. The browser cannot start a local harness.';

export function createCloudSessionHost(options: {
  client: CortexApiClient;
  transport: StreamTransport;
}): SessionHost {
  const listeners = new Set<(event: SessionProgressEvent) => void>();
  const surface = createHttpProductSurface(options.client);

  return {
    list: async () => readSessions(surface),
    get: async () => null,
    start: (request) => startCloudRun(options.transport, request),
    followUp: async (id, prompt) => followCloudRun(options.transport, id, prompt),
    stop: async () => null,
    archive: async () => null,
    remove: async () => {},
    resolvePermission: async (id, requestId, decision) => {
      sendPermission(options.transport, id, requestId, decision);
    },
    listRepositories: async () => [],
    openWorkspace: async () => ({ cancelled: true, repositories: [] }),
    onProgress: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

async function readSessions(surface: ReturnType<typeof createHttpProductSurface>): Promise<SessionSummary[]> {
  try {
    const rows = await surface.listCodeSessions();
    return rows.map((row) => ({
      id: row.id,
      title: row.title ?? 'Session',
      status: row.status === 'running' ? 'running' : 'queued',
      runtime: 'cloud',
      additions: 0,
      deletions: 0,
      filesChanged: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      archived: false,
    }));
  } catch (error) {
    if (isCortexApiError(error) && error.code === 'not_found') return [];
    throw error;
  }
}

async function startCloudRun(
  transport: StreamTransport,
  request: StartSessionRequest,
): Promise<SessionSummary> {
  if (request.runtime === 'local') throw new Error(CLOUD_ONLY);
  if (transport.channel() !== 'realtime') throw new Error(CLOUD_ONLY);
  const id = `ses_${Date.now().toString(36)}`;
  transport.send({ type: 'code.turn', session_id: id, message: request.prompt });
  return cloudSummary(id, request.prompt);
}

async function followCloudRun(
  transport: StreamTransport,
  id: string,
  prompt: string,
): Promise<SessionSummary> {
  if (transport.channel() !== 'realtime') throw new Error(CLOUD_ONLY);
  transport.send({ type: 'code.turn', session_id: id, message: prompt });
  return cloudSummary(id, prompt);
}

function sendPermission(
  transport: StreamTransport,
  sessionId: string,
  requestId: string,
  decision: 'allow-once' | 'allow-always' | 'deny',
): void {
  if (transport.channel() !== 'realtime') throw new Error(CLOUD_ONLY);
  const mapped = decision === 'allow-always' ? 'always' : decision === 'deny' ? 'deny' : 'allow';
  transport.send({
    type: 'code.permission',
    session_id: sessionId,
    request_permission_id: requestId,
    decision: mapped,
  });
}

function cloudSummary(id: string, title: string): SessionSummary {
  const now = Date.now();
  return {
    id,
    title: title.slice(0, 80),
    status: 'running',
    runtime: 'cloud',
    additions: 0,
    deletions: 0,
    filesChanged: 0,
    createdAt: now,
    updatedAt: now,
    archived: false,
  };
}
