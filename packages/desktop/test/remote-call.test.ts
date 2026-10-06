// Main-side Bot call host against a local HTTP API: capability gating, bearer kept in main, consent body.
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCallHost } from "../src/remote-call";

const caps = (available: boolean) => ({ stt: available, tts: available, live: false, bot_call: available
  ? { available: true, transport: "cortex-live-v1", stt: "utterance", tts: "pcm_stream", interim_transcripts: false, barge_in: true }
  : { available: false, transport: "cortex-live-v1", stt: "unavailable", tts: "unavailable", interim_transcripts: false, barge_in: false } });

let server: http.Server, origin = "", available = true;
const seen: { method?: string; url?: string; authorization?: string; body: string }[] = [];
beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, authorization: req.headers.authorization, body });
      res.setHeader("content-type", "application/json");
      if (req.url === "/v1/audio/capabilities") return res.end(JSON.stringify(caps(available)));
      if (req.url === "/v1/live/sessions") { res.statusCode = 503; return res.end(JSON.stringify({ code: "service_unavailable" })); }
      res.statusCode = 404; res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("createCallHost", () => {
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
});
