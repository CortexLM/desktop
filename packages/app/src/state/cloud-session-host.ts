/**
 * Code host for the web renderer: Cloud or a paired Cortex Code host only.
 *
 * Never starts a local harness. A browser has no PTY, no git checkout and no
 * agent loop, so `runtime: 'local'` is refused rather than faked — the run
 * happens on Cloud, or on a machine that is already running Cortex Code and has
 * been paired to this account.
 *
 * Reads go over HTTP so the workbench survives a reload: before this, `get()`
 * always answered `null`, which made every cloud session open on "Session not
 * found". Live tokens and permission prompts still prefer the realtime socket,
 * because a turn in flight is a stream, not a poll.
 *
 * A 404 from the control plane is reported as `not_found`, never as an empty
 * inbox. "This backend has no Code routes" and "you have no sessions" are
 * different facts and the screens say different things about them.
 */

import {
  archiveCodeSession,
  createCodeSession,
  createHttpProductSurface,
  deleteCodeSession,
  followUpCodeSession,
  getCodeSession,
  isCortexApiError,
  listCodeRepositories,
  resolveCodePermission,
  stopCodeSession,
  type CortexApiClient,
  type StreamTransport,
} from '@cortex-ide/cortex-api';
import type {
  RepositoryOption,
  SessionDetail,
  SessionProgressEvent,
  SessionSummary,
  StartSessionRequest,
} from '@cortex-ide/shared';

import { toSessionDetail, toSessionSummary, toWireDecision } from './cloud-code-map.ts';
import type { SessionHost } from './session-host.ts';

const CLOUD_ONLY =
  'Code runs on Cloud or a connected Cortex Code host. The browser cannot start a local harness.';

/** A read that answers 404 means the route is absent. Treated as "nothing here". */
async function orNotFound<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isCortexApiError(error) && (error.code === 'not_found' || error.status === 404)) {
      return fallback;
    }
    throw error;
  }
}

interface CloudSessionOptions {
  client: CortexApiClient;
  transport: StreamTransport;
}

/**
 * Starts a run through the control plane, falling back to the socket.
 *
 * HTTP first because it returns the service's session id, which is what makes the
 * run findable again after a reload. The socket path is kept for a backend that
 * only speaks realtime, and it is honest about what it produced: that id is
 * provisional until a `code.session` event names the real one.
 */
async function startRun(
  options: CloudSessionOptions,
  request: StartSessionRequest,
): Promise<SessionSummary> {
  if (request.runtime === 'local') throw new Error(CLOUD_ONLY);

  try {
    return toSessionSummary(
      await createCodeSession(options.client, {
        prompt: request.prompt,
        runtime: request.runtime,
        ...(request.repo ? { repository: request.repo } : {}),
        ...(request.branch ? { branch: request.branch } : {}),
        ...(request.model ? { model: request.model } : {}),
      }),
    );
  } catch (error) {
    if (!isRouteMissing(error)) throw error;
    return startOverSocket(options.transport, request);
  }
}

async function followRun(
  options: CloudSessionOptions,
  id: string,
  prompt: string,
): Promise<SessionSummary | null> {
  try {
    return toSessionSummary(await followUpCodeSession(options.client, id, { message: prompt }));
  } catch (error) {
    if (!isRouteMissing(error)) throw error;
    if (options.transport.channel() !== 'realtime') throw new Error(CLOUD_ONLY);
    options.transport.send({ type: 'code.turn', session_id: id, message: prompt });
    return null;
  }
}

/**
 * Answers a permission prompt on whichever channel is up.
 *
 * The socket is preferred because the run is blocked on the other end of it, but a
 * read-only SSE fallback cannot carry the answer — so HTTP is not an optimisation
 * here, it is the difference between the user being able to unblock the run and not.
 */
async function answerPermission(
  options: CloudSessionOptions,
  id: string,
  requestId: string,
  decision: 'allow-once' | 'allow-always' | 'deny',
): Promise<void> {
  const wire = toWireDecision(decision);
  if (options.transport.channel() === 'realtime') {
    options.transport.send({
      type: 'code.permission',
      session_id: id,
      request_permission_id: requestId,
      decision: wire,
    });
    return;
  }
  await resolveCodePermission(options.client, id, {
    request_permission_id: requestId,
    decision: wire,
  });
}

export function createCloudSessionHost(options: CloudSessionOptions): SessionHost {
  const listeners = new Set<(event: SessionProgressEvent) => void>();
  const surface = createHttpProductSurface(options.client);

  return {
    list: async () =>
      (await orNotFound(() => surface.listCodeSessions(), [])).map((row) => toSessionSummary(row)),

    get: (id) =>
      orNotFound<SessionDetail | null>(
        async () => toSessionDetail(await getCodeSession(options.client, id)),
        null,
      ),

    start: (request) => startRun(options, request),

    followUp: (id, prompt) => followRun(options, id, prompt),

    stop: (id) =>
      orNotFound<SessionSummary | null>(
        async () => toSessionSummary(await stopCodeSession(options.client, id)),
        null,
      ),

    archive: (id, archived) =>
      orNotFound<SessionSummary | null>(
        async () => toSessionSummary(await archiveCodeSession(options.client, id, archived)),
        null,
      ),

    remove: async (id) => {
      await orNotFound(async () => {
        await deleteCodeSession(options.client, id);
      }, undefined);
    },

    resolvePermission: (id, requestId, decision) =>
      answerPermission(options, id, requestId, decision),

    listRepositories: async () =>
      (await orNotFound(() => listCodeRepositories(options.client), [])).flatMap((row) =>
        toRepositoryOption(row),
      ),

    /**
     * There is no folder picker in a browser, and a repository has to be one the
     * account can already see. Reporting `cancelled` is the truthful answer.
     */
    openWorkspace: async () => ({ cancelled: true, repositories: [] }),

    onProgress: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function isRouteMissing(error: unknown): boolean {
  return isCortexApiError(error) && (error.code === 'not_found' || error.status === 404);
}

function toRepositoryOption(row: {
  id?: string;
  name?: string;
  full_name?: string;
  default_branch?: string;
  branches?: string[];
}): RepositoryOption[] {
  const id = row.full_name ?? row.name ?? row.id;
  if (!id) return [];

  const branches = row.branches ?? (row.default_branch ? [row.default_branch] : []);
  // `dirty` is false because a remote repository has no working tree to be dirty
  // in — the concept only exists for a checkout on a machine.
  const option: RepositoryOption = { id, name: row.name ?? id, branches, dirty: false };
  if (row.default_branch) option.branch = row.default_branch;
  return [option];
}

/**
 * The socket-only start path.
 *
 * The id is minted locally because the socket does not answer with one. It is
 * marked `queued` rather than `running`: nothing has confirmed the run began, and
 * showing it as running would be the client asserting something it does not know.
 */
async function startOverSocket(
  transport: StreamTransport,
  request: StartSessionRequest,
): Promise<SessionSummary> {
  if (transport.channel() !== 'realtime') throw new Error(CLOUD_ONLY);
  const id = `ses_${Date.now().toString(36)}`;
  transport.send({ type: 'code.turn', session_id: id, message: request.prompt });

  const now = Date.now();
  return {
    id,
    title: request.prompt.slice(0, 80),
    status: 'queued',
    runtime: request.runtime === 'ssh' ? 'ssh' : 'cloud',
    additions: 0,
    deletions: 0,
    filesChanged: 0,
    createdAt: now,
    updatedAt: now,
    archived: false,
  };
}
