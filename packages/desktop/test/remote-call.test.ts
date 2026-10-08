// Main-side Bot call host against a local HTTP API: capability gating, bearer kept in main, consent body.
import { EventEmitter } from "node:events";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCallHost } from "../src/remote-call";

// `live` is a boolean (api-types 0.3.5); trunk answers `live: true` when calls are configured, and 0.3.4 rejected that body.
const caps = (available: boolean) => ({ stt: available, tts: available, live: available, bot_call: available
  ? { available: true, transport: "cortex-live-v1", stt: "utterance", tts: "pcm_stream", interim_transcripts: false, barge_in: true }
  : { available: false, transport: "cortex-live-v1", stt: "unavailable", tts: "unavailable", interim_transcripts: false, barge_in: false } });

const CALL = "00000000-0000-4000-8000-0000000000cc";
let server: http.Server, origin = "", available = true, sessions: "refuse" | "grant" = "refuse";
const seen: { method?: string; url?: string; authorization?: string; body: string }[] = [];
const held: import("node:stream").Duplex[] = [];
beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, authorization: req.headers.authorization, body });
      res.setHeader("content-type", "application/json");
      if (req.url === "/v1/audio/capabilities") return res.end(JSON.stringify(caps(available)));
      if (req.url === "/v1/live/sessions" && sessions === "refuse") { res.statusCode = 503; return res.end(JSON.stringify({ code: "service_unavailable" })); }
      if (req.url === "/v1/live/sessions") { res.statusCode = 201; return res.end(JSON.stringify({ id: CALL, epoch: "1", ws_path: `/v1/live/sessions/${CALL}/media?ticket=ab12`, lease_expires_at: new Date(Date.now() + 30_000).toISOString() })); }
      if (req.method === "DELETE") return res.end(JSON.stringify({ id: CALL, state: "ended" }));
      res.statusCode = 404; res.end("{}");
    });
  });
  // Media upgrades are held unanswered: the socket stays connecting, so no drop races the assertions.
  server.on("upgrade", (_req, socket) => held.push(socket));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => { for (const s of held) s.destroy(); return new Promise<void>((r) => server.close(() => r())); });

describe("createCallHost", () => {
  it("end cancels a start held in authentication before a server session exists", async () => {
    let release: () => void = () => { throw new Error("gate missing"); };
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const life = new AbortController();
    const host = createCallHost(async () => { await gate; return { token: "t", signal: life.signal }; });
    const before = seen.length;
    const start = host.start(origin, "00000000-0000-4000-8000-000000000001", { snapshot: () => undefined, play: () => undefined, flush: () => undefined });
    const cancelled = expect(start).rejects.toThrow("cancelled");
    host.end();
    release();
    await cancelled;
    expect(seen.slice(before)).toHaveLength(0);
  });

  it("supersedes an awaiting start before creating a second server session", async () => {
    sessions = "grant";
    const life = new AbortController();
    let releaseAuth: () => void = () => { throw new Error("auth gate not initialized"); };
    const firstAuth = new Promise<void>((resolve) => { releaseAuth = resolve; });
    let authCalls = 0;
    const host = createCallHost(async () => {
      if (++authCalls === 1) await firstAuth;
      return { token: "t", signal: life.signal };
    });
    const on = { snapshot: () => undefined, play: () => undefined, flush: () => undefined };
    const before = seen.length;
    const first = host.start(origin, "00000000-0000-4000-8000-000000000001", on);
    const superseded = expect(first).rejects.toThrow();
    await host.start(origin, "00000000-0000-4000-8000-000000000001", on);
    releaseAuth();
    await superseded;
    expect(seen.slice(before).filter((r) => r.method === "POST" && r.url === "/v1/live/sessions")).toHaveLength(1);
    host.end();
    sessions = "refuse";
  });

  it("offers only on bot_call, hides for signed-out windows, and keeps the bearer in main", async () => {
    const life = new AbortController();
    const host = createCallHost(async () => ({ token: "main-only-bearer", signal: life.signal }));
    expect(await host.available(origin)).toBe("offer");
    available = false;
    expect(await host.available(origin)).toBe("unavailable");
    available = true;
    expect(seen.at(-1)).toMatchObject({ url: "/v1/audio/capabilities", authorization: "Bearer main-only-bearer" });
    const signedOut = createCallHost(async () => { throw new Error("Remote sign-in is required"); });
    expect(await signedOut.available(origin)).toBe("hidden");
  });

  it("posts explicit consent for the Bot and reports a refused deployment honestly", async () => {
    const life = new AbortController();
    const host = createCallHost(async () => ({ token: "t", signal: life.signal }));
    const snaps: unknown[] = [];
    await host.start(origin, "00000000-0000-4000-8000-000000000001", { snapshot: (s) => snaps.push(s), play: () => undefined, flush: () => undefined });
    expect(JSON.parse(seen.at(-1)!.body)).toEqual({ surface: "bot", consent: "allow", bot_id: "00000000-0000-4000-8000-000000000001" });
    expect(snaps.at(-1)).toMatchObject({ phase: "error", end: "unavailable" });
    await expect(host.start(origin, "../escape", { snapshot: () => undefined, play: () => undefined, flush: () => undefined })).rejects.toThrow();
  });

  // D2: the window that owns the call dies or loads another document; in-page routing keeps it.
  for (const [event, arg, ends] of [["destroyed", undefined, true], ["render-process-gone", { reason: "crashed" }, true], ["did-start-navigation", { isSameDocument: false, isMainFrame: true }, true], ["did-start-navigation", { isSameDocument: true, isMainFrame: true }, false]] as const) {
    it(`${event}${arg && "isSameDocument" in arg ? ` (same document: ${arg.isSameDocument})` : ""} ${ends ? "ends the call with one DELETE" : "keeps the call"}`, async () => {
      sessions = "grant";
      const life = new AbortController();
      const host = createCallHost(async () => ({ token: "t", signal: life.signal }));
      const owner = new EventEmitter();
      const snaps: { phase: string }[] = [];
      const before = seen.length;
      await host.start(origin, "00000000-0000-4000-8000-000000000001", { snapshot: (s) => snaps.push(s), play: () => undefined, flush: () => undefined }, owner);
      owner.emit(event, arg);
      const deletes = () => seen.slice(before).filter((r) => r.method === "DELETE");
      if (ends) {
        await vi.waitFor(() => expect(deletes()).toHaveLength(1));
        expect(snaps.at(-1)).toMatchObject({ phase: "ended" });
        expect(owner.listenerCount("destroyed") + owner.listenerCount("render-process-gone") + owner.listenerCount("did-start-navigation")).toBe(0);
        owner.emit("destroyed");
        expect(deletes()).toHaveLength(1);
      } else {
        expect(snaps.at(-1)?.phase).not.toBe("ended");
        host.end();
        await vi.waitFor(() => expect(deletes()).toHaveLength(1));
      }
      sessions = "refuse";
    });
  }
});
