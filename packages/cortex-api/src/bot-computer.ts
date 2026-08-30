/**
 * Dedicated computer per mascot: lifecycle, screenshot, input, VNC, record,
 * videos, box shell, and filesystem. Staging + Bot box routes.
 */

import type { CortexApiClient } from './client.ts';
import { unknownSchema } from './schemas.ts';
import { mascotPath, withQuery } from './bot-paths.ts';
import {
  computerRowSchema,
  cursorSchema,
  filePreviewSchema,
  fsListSchema,
  mascotVideoListSchema,
  screenshotSchema,
  shellResultSchema,
  type ApiComputer,
  type ApiCursor,
  type ApiFilePreview,
  type ApiFsEntry,
  type ApiMascotVideo,
  type ApiScreenshot,
  type ApiShellResult,
} from './bot-schemas.ts';
import { vncTicketSchema, type VncTicket } from './pending-schemas.ts';

export type LifecycleAction = 'resume' | 'hibernate' | 'stop' | 'snapshot' | 'recreate';

export type ComputerRuntime = 'this_pc' | 'ssh' | 'cloud';

export type ComputerControlAction = 'take' | 'release';

export type ComputerInputAction =
  | 'move'
  | 'click'
  | 'double_click'
  | 'wait'
  | 'drag'
  | 'scroll'
  | 'key'
  | 'type';

export interface ComputerInput {
  action: ComputerInputAction;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  text?: string;
  key?: string;
  button?: string;
  dx?: number;
  dy?: number;
  seconds?: number;
}

export function getComputer(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiComputer> {
  return client.request(mascotPath(id, '/computer'), computerRowSchema, { signal });
}

export function postLifecycle(
  client: CortexApiClient,
  id: string,
  action: LifecycleAction,
  options?: { runtime?: ComputerRuntime; signal?: AbortSignal },
): Promise<ApiComputer> {
  return client.request(mascotPath(id, '/computer/lifecycle'), computerRowSchema, {
    method: 'POST',
    body: options?.runtime ? { action, runtime: options.runtime } : { action },
    signal: options?.signal,
  });
}

export function getScreenshot(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiScreenshot> {
  return client.request(mascotPath(id, '/computer/screenshot'), screenshotSchema, { signal });
}

export async function postComputerInput(
  client: CortexApiClient,
  id: string,
  body: ComputerInput,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(mascotPath(id, '/computer/input'), unknownSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export function getCursor(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCursor> {
  return client.request(mascotPath(id, '/computer/cursor'), cursorSchema, { signal });
}

export async function createVncTicket(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<VncTicket> {
  const raw = await client.request(mascotPath(id, '/computer/vnc-ticket'), vncTicketSchema, {
    method: 'POST',
    body: {},
    signal,
  });
  const ticket: VncTicket = { ticket_hash: raw.ticket_hash };
  if (raw.stream_url) ticket.stream_url = raw.stream_url;
  if (raw.embed_url) ticket.embed_url = raw.embed_url;
  return ticket;
}

/**
 * Take or release the dedicated box. A live 404 is `backend_too_old`.
 */
export function postComputerControl(
  client: CortexApiClient,
  id: string,
  action: ComputerControlAction,
  signal?: AbortSignal,
): Promise<ApiComputer> {
  return client.request(mascotPath(id, '/computer/control'), computerRowSchema, {
    method: 'POST',
    body: { action },
    signal,
  });
}

export async function postRecord(
  client: CortexApiClient,
  id: string,
  body: { action: 'start' | 'stop' },
  signal?: AbortSignal,
): Promise<void> {
  await client.request(mascotPath(id, '/computer/record'), unknownSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export async function listMascotVideos(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiMascotVideo[]> {
  const list = await client.request(mascotPath(id, '/videos'), mascotVideoListSchema, { signal });
  return list.items;
}

export function postShell(
  client: CortexApiClient,
  id: string,
  command: string,
  signal?: AbortSignal,
): Promise<ApiShellResult> {
  return client.request(mascotPath(id, '/computer/shell'), shellResultSchema, {
    method: 'POST',
    body: { command },
    signal,
  });
}

export async function listComputerFs(
  client: CortexApiClient,
  id: string,
  path = '/',
  signal?: AbortSignal,
): Promise<ApiFsEntry[]> {
  const url = withQuery(mascotPath(id, '/computer/fs'), { path });
  const list = await client.request(url, fsListSchema, { signal });
  return list.items;
}

export function readComputerFile(
  client: CortexApiClient,
  id: string,
  path: string,
  signal?: AbortSignal,
): Promise<ApiFilePreview> {
  return client.request(withQuery(mascotPath(id, '/computer/file'), { path }), filePreviewSchema, {
    signal,
  });
}
