/**
 * Realtime rooms from CortexLM/backend PR 36 (`docs/product-realtime.md`).
 *
 * The signed-in user has an implicit owner room. Optional rooms are
 * `conversation:`, `code_session:`, and `mascot:`. A miss is `not_found`.
 *
 * `hello`, `heartbeat`, `subscribed`, and `error` are connection-local: they
 * must not be treated as product events and must not be forwarded as inbox
 * rows (a second tab has its own socket).
 */

export const REALTIME_EVENTS_PATH = '/v1/realtime/events';

export const CONNECTION_LOCAL_TYPES = ['hello', 'heartbeat', 'subscribed', 'error'] as const;

export type ConnectionLocalType = (typeof CONNECTION_LOCAL_TYPES)[number];

export type RealtimeRoomKind = 'conversation' | 'code_session' | 'mascot';

export interface RealtimeRoom {
  kind: RealtimeRoomKind;
  id: string;
}

export function isConnectionLocalType(type: string): type is ConnectionLocalType {
  return (CONNECTION_LOCAL_TYPES as readonly string[]).includes(type);
}

export function roomName(room: RealtimeRoom): string {
  return `${room.kind}:${room.id}`;
}

export function parseRoom(name: string): RealtimeRoom | undefined {
  const split = name.indexOf(':');
  if (split <= 0) return undefined;
  const kind = name.slice(0, split);
  const id = name.slice(split + 1);
  if (!id) return undefined;
  if (kind === 'conversation' || kind === 'code_session' || kind === 'mascot') {
    return { kind, id };
  }
  return undefined;
}
