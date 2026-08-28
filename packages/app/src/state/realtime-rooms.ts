/**
 * Optional realtime rooms: conversation:, code_session:, mascot:.
 *
 * The signed-in user already has an implicit owner room. A miss is a
 * connection-local `not_found` — never an inbox row. SSE is owner-room only,
 * so join/leave are no-ops there.
 */

import { createEffect, onCleanup } from 'solid-js';

import { roomName, type RealtimeRoomKind } from '@cortex-ide/cortex-api';

import { liveSession } from './realtime-session.ts';

export function subscribeRoom(
  realtime: { join: (room: string) => void; leave: (room: string) => void },
  kind: RealtimeRoomKind,
  id: string,
): () => void {
  const name = roomName({ kind, id });
  realtime.join(name);
  return () => realtime.leave(name);
}

/** Join while this reactive id is on screen. Leaves on change or unmount. */
export function watchLiveRoom(kind: RealtimeRoomKind, id: () => string | undefined): void {
  createEffect(() => {
    const current = id();
    const live = liveSession();
    if (!current || !live) return;
    let leave: (() => void) | undefined;
    try {
      leave = subscribeRoom(live.realtime, kind, current);
    } catch {
      return;
    }
    onCleanup(() => {
      try {
        leave?.();
      } catch {
        // Socket already down.
      }
    });
  });
}
