// The window's one Bot call (Task16). It outlives the screen that started it: leaving the Bot keeps
// it running, minimized in the shell (`BotCallDock`), until hang-up, a server end, sign-out, a lost
// microphone or window death. Main owns the ticket and socket; this owns the microphone and releases
// it exactly once per call. DOM-free so node tests can drive it with fake audio and a fake bridge.
import type { CallBridge, CallSnapshot } from "../../api";

export interface CallMic {
  /** Opens the microphone; rejects when refused. `lost` fires if the track ends on its own. */
  start(lost: () => void): Promise<void>;
  play(pcm: Uint8Array, sequence: number, generation: number): void;
  flush(): void;
  stop(): void;
}
export interface CallView {
  readonly call: { readonly botId: string; readonly name: string; readonly snap: CallSnapshot } | null;
  /** The Bot whose call could not get the microphone (refused at start, or lost mid-call). */
  readonly micDenied: string | null;
}

type Live = { botId: string; name: string; mic: CallMic; detach?: () => void; released: boolean };
const isOver = (s: CallSnapshot) => s.phase === "ended" || s.phase === "error";

export function createCallOwner(bridge: () => CallBridge | undefined, mic: () => CallMic) {
  let live: Live | null = null;
  let view: CallView = { call: null, micDenied: null };
  const listeners = new Set<() => void>();
  const emit = (next: CallView) => { view = next; for (const fn of listeners) fn(); };
  const release = (l: Live) => {
    if (live === l) live = null;
    if (l.released) return;
    l.released = true;
    l.mic.stop();
    l.detach?.();
  };

  return {
    subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
    get: (): CallView => view,
    active: (): boolean => live !== null,

    async start(botId: string, name: string): Promise<void> {
      const b = bridge();
      if (!b || live) return;
      const mine: Live = { botId, name, mic: mic(), released: false };
      live = mine;
      emit({ call: { botId, name, snap: { phase: "connecting", muted: false, heard: [], partial: "", streaming: false } }, micDenied: null });
      const lost = () => {
        if (mine.released) return;
        release(mine);
        // Main ends the call server-side (DELETE) when the renderer hangs up.
        b.end();
        emit({ call: { botId, name, snap: { ...view.call!.snap, phase: "error", end: "mic_lost", partial: "" } }, micDenied: botId });
      };
      try {
        await mine.mic.start(lost);
      } catch {
        release(mine);
        emit({ call: null, micDenied: botId });
        return;
      }
      // Ended, signed out or window torn down while the permission prompt was open.
      if (live !== mine || mine.released) { release(mine); return; }
      const handle = b.start(botId, {
        snapshot: (s) => {
          if (mine.released && !isOver(s)) return;
          if (isOver(s)) release(mine);
          if (live === mine || live === null) emit({ call: { botId, name, snap: s }, micDenied: null });
        },
        play: (pcm, sequence, generation) => { if (!mine.released) mine.mic.play(pcm, sequence, generation); },
        flush: () => mine.mic.flush(),
      });
      mine.detach = handle.stop;
      if (mine.released) handle.stop();
      await handle.started.catch(() => {
        if (mine.released) return;
        release(mine);
        emit({ call: { botId, name, snap: { phase: "error", muted: false, heard: [], partial: "", streaming: false, end: "failed" } }, micDenied: null });
      });
    },

    mute(muted: boolean): void { if (live) bridge()?.mute(muted); },
    interrupt(): void { if (!live) return; live.mic.flush(); bridge()?.interrupt(); },
    end(): void {
      const l = live;
      if (!l) return;
      release(l);
      bridge()?.end();
      // Main may never have started (prompt still open), so no final snapshot would arrive.
      const snap = view.call?.botId === l.botId ? view.call.snap : undefined;
      if (snap && !isOver(snap)) emit({ call: { botId: l.botId, name: l.name, snap: { ...snap, phase: "ended", end: "ended", partial: "" } }, micDenied: null });
    },
  };
}
export type CallOwner = ReturnType<typeof createCallOwner>;
