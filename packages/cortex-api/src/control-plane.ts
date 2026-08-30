/**
 * Control-plane writes from CortexLM/backend PR 36.
 *
 * Pairing returns a code shown once. Heartbeat carries a device token, never
 * SSH or provider keys. VNC tickets are a hash, never a password. A live 404
 * stays `not_found`.
 */

import type { CortexApiClient } from './client.ts';
import { unknownSchema } from './schemas.ts';
import { createMascot as createMascotHttp, deleteMascot as deleteMascotHttp } from './bot-mascots.ts';
import { createVncTicket as createVncTicketHttp, listMascotVideos as listVideosHttp } from './bot-computer.ts';
import {
  hostPairingSchema,
  type ApiMascot,
  type ApiMascotVideo,
  type HostPairing,
  type VncTicket,
} from './pending-schemas.ts';

export async function postScheduledResult(
  client: CortexApiClient,
  conversationId: string,
  body: { task_id: string; message?: string },
  signal?: AbortSignal,
): Promise<void> {
  const path = `/v1/conversations/${encodeURIComponent(conversationId)}/scheduled-results`;
  await client.request(path, unknownSchema, { method: 'POST', body, signal });
}

export async function pairCodeHost(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<HostPairing> {
  const raw = await client.request('/v1/code/hosts/pair', hostPairingSchema, {
    method: 'POST',
    body: {},
    signal,
  });
  const pairing: HostPairing = { pairing_code: raw.pairing_code };
  if (raw.expires_in !== undefined) pairing.expires_in = raw.expires_in;
  if (raw.host_id) pairing.host_id = raw.host_id;
  return pairing;
}

export async function heartbeatCodeHost(
  client: CortexApiClient,
  body: { device_token: string; host_id?: string },
  signal?: AbortSignal,
): Promise<void> {
  await client.request('/v1/code/hosts/heartbeat', unknownSchema, { method: 'POST', body, signal });
}

export function createMascot(
  client: CortexApiClient,
  body: {
    name: string;
    look?: string;
    face?: string;
    shape?: string;
    color?: string;
    computer_kind?: 'local' | 'ssh' | 'cloud';
  },
  signal?: AbortSignal,
): Promise<ApiMascot> {
  return createMascotHttp(client, body, signal);
}

export function deleteMascot(
  client: CortexApiClient,
  mascotId: string,
  signal?: AbortSignal,
): Promise<void> {
  return deleteMascotHttp(client, mascotId, signal);
}

export function createVncTicket(
  client: CortexApiClient,
  mascotId: string,
  signal?: AbortSignal,
): Promise<VncTicket> {
  return createVncTicketHttp(client, mascotId, signal);
}

export function listMascotVideos(
  client: CortexApiClient,
  mascotId: string,
  signal?: AbortSignal,
): Promise<ApiMascotVideo[]> {
  return listVideosHttp(client, mascotId, signal);
}

export async function markNotificationRead(
  client: CortexApiClient,
  notificationId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`/v1/notifications/${encodeURIComponent(notificationId)}/read`, unknownSchema, {
    method: 'POST',
    body: {},
    signal,
  });
}
