import { createEffect, onCleanup } from 'solid-js';

import {
  attachComputer,
  loadFs,
  refreshScreenshot,
} from '../state/bot-computer-live.ts';
import { mascotById } from '../state/bots.ts';
import { attachDesktopStream, probeDesktopTransport } from '../state/vnc-ticket.ts';

/** Bind screenshot + stream to the route mascot id, clearing on change before refresh. */
export function bindComputerLive(
  routeId: () => string | undefined,
  options?: { files?: boolean },
): void {
  createEffect(() => {
    const id = routeId();
    attachComputer(id);
    attachDesktopStream(id);
    if (!id) return;
    const current = mascotById(id);
    if (!current || current.computer.status !== 'running') return;
    void refreshScreenshot(id);
    void probeDesktopTransport(id);
    if (options?.files) void loadFs(id);
    const timer = setInterval(() => void refreshScreenshot(id), 800);
    onCleanup(() => clearInterval(timer));
  });
}
