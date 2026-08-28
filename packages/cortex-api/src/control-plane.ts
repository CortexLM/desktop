/**
 * Control-plane writes from CortexLM/backend PR 36.
 *
 * Pairing returns a code shown once. Heartbeat carries a device token, never
 * SSH or provider keys. VNC tickets are a hash, never a password. A live 404
 * stays `not_found`.
 */

import type { CortexApiClient } from './client.ts';
import { unknownSchema } from './schemas.ts';
import {
  hostPairingSchema,
  mascotRowSchema,
  mascotVideoListSchema,
  vncTicketSchema,
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
  body: { name: string; shape?: string; color?: string },
  signal?: AbortSignal,
): Promise<ApiMascot> {
  return client.request('/v1/mascots', mascotRowSchema, { method: 'POST', body, signal });
}

export async function deleteMascot(
  client: CortexApiClient,
  mascotId: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`/v1/mascots/${encodeURIComponent(mascotId)}`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}

export async function createVncTicket(
  client: CortexApiClient,
  mascotId: string,
  signal?: AbortSignal,
): Promise<VncTicket> {
  const raw = await client.request(
    `/v1/mascots/${encodeURIComponent(mascotId)}/computer/vnc-ticket`,
    vncTicketSchema,
    { method: 'POST', body: {}, signal },
  );
  return { ticket_hash: raw.ticket_hash };
}

export async function listMascotVideos(
  client: CortexApiClient,
  mascotId: string,
  signal?: AbortSignal,
): Promise<ApiMascotVideo[]> {
  const list = await client.request(
    `/v1/mascots/${encodeURIComponent(mascotId)}/videos`,
    mascotVideoListSchema,
    { signal },
  );
  return list.items;
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
