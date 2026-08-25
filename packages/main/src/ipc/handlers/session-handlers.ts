/**
 * Session IPC Handlers — les exécutions, vues du renderer.
 *
 * Un domaine distinct de `ai:*`, qui transporte une conversation. Ici on
 * transporte une exécution : un état que l'inbox trie, un dépôt, une branche,
 * une statistique de diff, une chronologie. Cf. `shared/types/ipc/session.ts`.
 *
 * Il n'y a pas de canal « donne-moi le prochain événement ». Une exécution
 * avance dans main, à son rythme, et le renderer l'apprend par
 * `event:session-progress`. Un canal de sondage rendrait le renderer
 * responsable d'une cadence qu'il ne connaît pas, et ferait payer un
 * aller-retour par tick pour un flux qui n'en a pas besoin.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

import { IPC_CHANNELS } from '@cortex-ide/shared';
import type {
  ArchiveSessionRequest,
  FollowUpSessionRequest,
  GetSessionRequest,
  GetSessionResponse,
  ListRepositoriesResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  OpenWorkspaceResponse,
  ResolveSessionPermissionRequest,
  SessionIdRequest,
  SessionProgressEvent,
  SessionSummary,
  StartSessionRequest,
  StartSessionResponse,
} from '@cortex-ide/shared';

import { getSessionService } from '../../services/session-service';
import { createHandler } from './shared/handler-factory';

export const SESSION_CHANNELS = [
  IPC_CHANNELS.SESSION_LIST,
  IPC_CHANNELS.SESSION_GET,
  IPC_CHANNELS.SESSION_START,
  IPC_CHANNELS.SESSION_FOLLOW_UP,
  IPC_CHANNELS.SESSION_STOP,
  IPC_CHANNELS.SESSION_ARCHIVE,
  IPC_CHANNELS.SESSION_DELETE,
  IPC_CHANNELS.SESSION_RESOLVE_PERMISSION,
  IPC_CHANNELS.SESSION_LIST_REPOSITORIES,
  IPC_CHANNELS.SESSION_OPEN_WORKSPACE,
] as const;

/** `.optional()` parce que le renderer invoque sans argument pour les listes. */
const NoPayloadSchema = z
  .object({})
  .optional()
  .transform(() => ({}) as Record<string, never>);

const ListSchema = z
  .object({
    workspaceId: z.string().optional(),
    includeArchived: z.boolean().optional(),
    limit: z.number().int().positive().optional(),
  })
  .optional()
  .transform((value) => value ?? {});

const IdSchema = z.object({ id: z.string().min(1) });

/**
 * `prompt` est borné à 32 000 caractères.
 *
 * Pas une limite de modèle — c'est une borne sur ce qu'un process moins fiable
 * peut faire écrire en base d'un seul appel. Le contexte est de toute façon
 * compacté en amont par l'engine.
 */
const StartSchema = z.object({
  prompt: z.string().min(1).max(32_000),
  runtime: z.enum(['local', 'cloud', 'ssh']),
  repo: z.string().optional(),
  branch: z.string().optional(),
  model: z.string().optional(),
});

const FollowUpSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1).max(32_000),
});

const ArchiveSchema = z.object({ id: z.string().min(1), archived: z.boolean() });

const ResolvePermissionSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  decision: z.enum(['allow-once', 'allow-always', 'deny']),
});

export const handleListSessions = createHandler<ListSessionsRequest, ListSessionsResponse>(
  ListSchema,
  async (request) => ({
    sessions: await getSessionService().list({
      ...(request.includeArchived !== undefined
        ? { includeArchived: request.includeArchived }
        : {}),
      ...(request.limit !== undefined ? { limit: request.limit } : {}),
    }),
  }),
);

export const handleGetSession = createHandler<GetSessionRequest, GetSessionResponse>(
  IdSchema,
  async (request) => ({ session: await getSessionService().get(request.id) }),
);

export const handleStartSession = createHandler<StartSessionRequest, StartSessionResponse>(
  StartSchema,
  async (request) => ({ session: await getSessionService().start(request) }),
);

export const handleFollowUpSession = createHandler<
  FollowUpSessionRequest,
  { session: SessionSummary | null }
>(FollowUpSchema, async (request) => ({
  session: await getSessionService().followUp(request.id, request.prompt),
}));

export const handleStopSession = createHandler<
  SessionIdRequest,
  { session: SessionSummary | null }
>(IdSchema, async (request) => ({ session: await getSessionService().stop(request.id) }));

export const handleArchiveSession = createHandler<
  ArchiveSessionRequest,
  { session: SessionSummary | null }
>(ArchiveSchema, async (request) => ({
  session: await getSessionService().archive(request.id, request.archived),
}));

export const handleDeleteSession = createHandler<SessionIdRequest, { deleted: true }>(
  IdSchema,
  async (request) => {
    await getSessionService().remove(request.id);
    return { deleted: true };
  },
);

export const handleResolveSessionPermission = createHandler<
  ResolveSessionPermissionRequest,
  { resolved: true }
>(ResolvePermissionSchema, async (request) => {
  getSessionService().resolvePermission(request.id, request.requestId, request.decision);
  return { resolved: true };
});

export const handleListRepositories = createHandler<
  Record<string, never>,
  ListRepositoriesResponse
>(NoPayloadSchema, async () => ({
  repositories: await getSessionService().listRepositories(),
}));

export const handleOpenWorkspace = createHandler<Record<string, never>, OpenWorkspaceResponse>(
  NoPayloadSchema,
  async () => getSessionService().openWorkspace(),
);

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

let eventCleanup: (() => void) | undefined;

/**
 * Relaie l'avancement d'une exécution vers le renderer.
 *
 * Diffusé à toutes les fenêtres : une exécution appartient à l'espace de
 * travail, pas à une fenêtre. Une seconde fenêtre ouverte sur l'inbox doit voir
 * avancer un run lancé depuis la première.
 */
export function setupSessionEvents(): () => void {
  const service = getSessionService();
  const listener = (payload: SessionProgressEvent) => {
    broadcast(IPC_CHANNELS.EVENT_SESSION_PROGRESS, payload);
  };

  service.on('progress', listener);
  return () => service.off('progress', listener);
}

export function registerSessionHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, handleListSessions);
  ipcMain.handle(IPC_CHANNELS.SESSION_GET, handleGetSession);
  ipcMain.handle(IPC_CHANNELS.SESSION_START, handleStartSession);
  ipcMain.handle(IPC_CHANNELS.SESSION_FOLLOW_UP, handleFollowUpSession);
  ipcMain.handle(IPC_CHANNELS.SESSION_STOP, handleStopSession);
  ipcMain.handle(IPC_CHANNELS.SESSION_ARCHIVE, handleArchiveSession);
  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, handleDeleteSession);
  ipcMain.handle(IPC_CHANNELS.SESSION_RESOLVE_PERMISSION, handleResolveSessionPermission);
  ipcMain.handle(IPC_CHANNELS.SESSION_LIST_REPOSITORIES, handleListRepositories);
  ipcMain.handle(IPC_CHANNELS.SESSION_OPEN_WORKSPACE, handleOpenWorkspace);

  eventCleanup?.();
  eventCleanup = setupSessionEvents();
}

export function unregisterSessionHandlers(): void {
  SESSION_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
  eventCleanup?.();
  eventCleanup = undefined;
}
