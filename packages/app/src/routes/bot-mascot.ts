import { createEffect, createMemo } from 'solid-js';
import { useParams } from '@solidjs/router';

import { hydrateMascot, mascotById } from '../state/bots.ts';
import { watchLiveRoom } from '../state/realtime-rooms.ts';

export function useBotMascot() {
  const params = useParams<{ mascotId: string }>();
  watchLiveRoom('mascot', () => params.mascotId);
  createEffect(() => {
    const id = params.mascotId;
    if (id) void hydrateMascot(id);
  });
  return createMemo(() => mascotById(params.mascotId));
}
