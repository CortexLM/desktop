// Main-side Bot call host (Task16). One call per window. The renderer sends capture PCM and
// playback receipts over IPC and receives snapshots and playback PCM; tickets and the bearer
// stay here. Logout or account switch aborts the identity lifetime, which ends the call.
import { CortexError } from "@cortex/core";
import { CallSession, botCallAvailable, liveMediaUrl, type CallSnapshot, type CallTransport } from "@cortex/api-types";
import { timerEnv } from "./call-session";

export type CallAuth = (origin: string) => Promise<{ token: string; signal: AbortSignal }>;
export type CallEvents = {
  snapshot(s: CallSnapshot): void;
  play(pcm: Uint8Array, sequence: number, generation: number): void;
  flush(): void;
};

/** The owning `webContents` events `start` watches; an EventEmitter in tests. */
export interface CallOwnerEvents {
  once(event: "destroyed" | "render-process-gone", fn: () => void): unknown;
  on(event: "did-start-navigation", fn: (d: { isSameDocument?: boolean; isMainFrame?: boolean }) => void): unknown;
  removeListener(event: "destroyed" | "render-process-gone" | "did-start-navigation", fn: (d: { isSameDocument?: boolean; isMainFrame?: boolean }) => void): unknown;
}
const BOT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function createCallHost(auth: CallAuth, fetchImpl: typeof fetch = fetch) {
  let current: { session: CallSession; release(): void } | undefined;
  let last: CallSession | undefined;
  const request = async (origin: string, path: string, init: RequestInit) => {
    const { token, signal } = await auth(origin);
    const response = await fetchImpl(`${origin}${path}`, {
      ...init, redirect: "error", credentials: "omit", signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json().catch(() => null) };
  };
  // End first so the renderer receives the final snapshot, then detach.
  const end = () => { const c = current; current = undefined; const done = c?.session.end(); c?.release(); void done; };
  return {
    /** The `bot_call` block only; Chat Live's `live` is never consulted. */
    async available(origin: string): Promise<"offer" | "unavailable" | "hidden"> {
      // Guests and signed-out windows never see the call.
      try { await auth(origin); } catch { return "hidden"; }
      try { return botCallAvailable((await request(origin, "/v1/audio/capabilities", { method: "GET" })).body) ? "offer" : "unavailable"; }
      catch { return "unavailable"; }
    },
    /**
     * `owner` is the window that started the call: its death (crash, close) or loading another
     * document ends the call; in-page routing (`isSameDocument`) keeps it, minimized.
     */
    async start(origin: string, botId: string, on: CallEvents, owner?: CallOwnerEvents): Promise<void> {
      if (!BOT.test(botId)) throw new CortexError("invalid_request", "Invalid Bot");
      end();
      const { signal } = await auth(origin);
      const transport: CallTransport = {
        post: (path, body) => request(origin, path, { method: "POST", body: JSON.stringify(body) }).catch(() => ({ status: 0, body: null })),
        del: async (path) => { await request(origin, path, { method: "DELETE" }); },
        open(wsPath, events) {
          // Node's WebSocket sends no Origin header; the ticket is the credential.
          const ws = new WebSocket(liveMediaUrl(origin, { ws_path: wsPath }));
          ws.binaryType = "arraybuffer";
          ws.onmessage = (e) => events.message(e.data as ArrayBuffer | string);
          ws.onclose = (e) => events.close(e.code);
          return {
            send: (d) => { if (ws.readyState === WebSocket.OPEN) ws.send(d); },
            close: () => { if (ws.readyState <= WebSocket.OPEN) ws.close(1000, "client"); },
          };
        },
      };
      const session = last = new CallSession(transport, botId, timerEnv);
      session.sink = { play: on.play, flush: on.flush };
      const unsubscribe = session.subscribe(on.snapshot);
      // Logout or account change: the server ends the session's calls (4001); release locally only.
      const revoked = () => { if (current?.session === session) current = undefined; session.revoke(); };
      signal.addEventListener("abort", revoked, { once: true });
      const gone = () => { if (current?.session === session) end(); };
      const navigated = (d?: { isSameDocument?: boolean; isMainFrame?: boolean }) => { if (d?.isMainFrame !== false && d?.isSameDocument !== true) gone(); };
      owner?.once("destroyed", gone);
      owner?.once("render-process-gone", gone);
      owner?.on("did-start-navigation", navigated);
      current = { session, release: () => {
        signal.removeEventListener("abort", revoked); unsubscribe();
        owner?.removeListener("destroyed", gone); owner?.removeListener("render-process-gone", gone); owner?.removeListener("did-start-navigation", navigated);
      } };
      // A server or mic-driven end frees the window for the next call and drops the watches.
      session.subscribe((s) => {
        if ((s.phase === "ended" || s.phase === "error") && current?.session === session) { const c = current; current = undefined; c.release(); }
      });
      await session.start();
    },
    capture(pcm: Uint8Array) { current?.session.capture(pcm); },
    played(sequence: number, generation: number) { current?.session.played(sequence, generation); },
    mute(muted: boolean) { current?.session.setMuted(muted); },
    interrupt() { current?.session.interrupt(); },
    end,
    /** Last call's counters (test hook; registered only in unpackaged builds). */
    stats: () => last && { ...last.stats, end: last.snapshot.end },
  };
}
