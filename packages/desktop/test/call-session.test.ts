// Main-side call protocol: streaming partials (G1) and lease-bounded resume with backoff (D3).
import { describe, expect, it, vi } from "vitest";
import { botCallAvailable, CallSession, encodeLiveFrame, decodeLiveFrame, type CallEnv, type CallSocketEvents, type CallTransport } from "@cortex/api-types";
import { timerEnv } from "../src/call-session";

const ID = "00000000-0000-4000-8000-0000000000aa";
const ticket = (epoch: string, leaseMs?: number) => ({ id: ID, epoch, ws_path: `/v1/live/sessions/${ID}/media?ticket=t${epoch}`, ...(leaseMs ? { lease_expires_at: new Date(1_000_000 + leaseMs).toISOString() } : {}) });
const pcm = () => new Uint8Array(640);

function fake(posts: { status: number; body: unknown }[]) {
  const sent: (string | Uint8Array)[] = [], deleted: string[] = [], bodies: unknown[] = [];
  let events: CallSocketEvents | undefined;
  const transport: CallTransport = {
    post: async (_p, body) => { bodies.push(body); return posts.shift() ?? { status: 0, body: null }; },
    del: async (p) => { deleted.push(p); },
    open: (_w, on) => { events = on; return { send: (d) => sent.push(d), close: () => undefined }; },
  };
  return { transport, sent, deleted, bodies, events: () => events! };
}

function clock() {
  let now = 1_000_000;
  const sleepers: { at: number; wake(): void }[] = [];
  const env: CallEnv = { now: () => now, online: () => true, sleep: (ms) => new Promise((wake) => sleepers.push({ at: now + ms, wake })), waitOnline: (ms) => new Promise((wake) => sleepers.push({ at: now + ms, wake })) };
  return {
    env, pending: () => sleepers.length,
    async advance(ms: number) {
      now += ms;
      for (const s of sleepers.splice(0).filter((x) => x.at <= now || (sleepers.push(x), false))) s.wake();
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

describe("capabilities (G0)", () => {
  it("admits streaming and utterance bot_call blocks and refuses streaming without interim transcripts", () => {
    const block = (o: object) => ({ stt: true, tts: true, live: false, bot_call: { available: true, transport: "cortex-live-v1", stt: "streaming", tts: "pcm_stream", interim_transcripts: true, barge_in: true, ...o } });
    expect(botCallAvailable(block({}))).toBe(true);
    expect(botCallAvailable(block({ stt: "utterance", interim_transcripts: false }))).toBe(true);
    expect(botCallAvailable(block({ interim_transcripts: false }))).toBe(false);
  });
});

describe("partial transcripts (G1)", () => {
  it("replaces on each partial, clears at the transcript, and ignores partials after end", async () => {
    const f = fake([{ status: 201, body: { ...ticket("1"), capabilities: { stt: "streaming" } } }]);
    const s = new CallSession(f.transport, "bot", timerEnv);
    await s.start();
    expect(s.snapshot.streaming).toBe(true);
    const say = (e: object) => f.events().message(JSON.stringify(e));
    say({ type: "ready", generation: 1 });
    const seen: string[] = [];
    s.subscribe((x) => { if (x.partial !== seen.at(-1)) seen.push(x.partial); });
    say({ type: "partial_transcript", text: "he" });
    say({ type: "partial_transcript", text: "hello" });
    say({ type: "transcript", text: "hello there" });
    expect(seen).toEqual(["", "he", "hello", ""]);
    expect(s.snapshot.heard.at(-1)).toBe("hello there");
    const events = f.events();
    await s.end();
    const after = s.snapshot;
    events.message(JSON.stringify({ type: "partial_transcript", text: "late" }));
    expect(s.snapshot).toBe(after);
  });
});

describe("malformed frames (M2)", () => {
  const open = async () => {
    const f = fake([{ status: 201, body: ticket("1") }]);
    const s = new CallSession(f.transport, "bot", timerEnv);
    await s.start();
    f.events().message(JSON.stringify({ type: "ready", generation: 1 }));
    return { f, s };
  };
  const good = () => encodeLiveFrame({ direction: 1, epoch: 1n, sequence: 0, generation: 1, audio: pcm() });
  it.each([
    ["truncated", () => good().slice(0, 31).buffer, "frame length"],
    ["oversized", () => new Uint8Array(673).fill(0x43).buffer, "frame length"],
    ["wrong type", () => new Uint8Array(672) as unknown as ArrayBuffer, "frame type"],
  ] as const)("ends a call that receives a %s frame as failed, counted, without throwing", async (_n, data, reason) => {
    const { f, s } = await open();
    expect(() => f.events().message(data())).not.toThrow();
    expect(s.stats.protocolErrors).toBe(1);
    expect(s.snapshot).toMatchObject({ phase: "error", end: "failed", protocol_error: reason });
    expect(JSON.parse(f.sent.at(-1) as string)).toEqual({ op: "end", epoch: "1" });
  });
});

describe("network loss (D3)", () => {
  it("backs off, resumes on the next epoch with sequence 0, and leaves no partial", async () => {
    const c = clock();
    const f = fake([{ status: 201, body: ticket("1", 30_000) }, { status: 0, body: null }, { status: 200, body: ticket("2", 60_000) }]);
    const s = new CallSession(f.transport, "bot", c.env);
    await s.start();
    f.events().message(JSON.stringify({ type: "ready", generation: 1 }));
    f.events().message(JSON.stringify({ type: "partial_transcript", text: "half" }));
    f.events().close(1006);
    await vi.waitFor(() => expect(c.pending()).toBe(1));
    expect(s.snapshot).toMatchObject({ phase: "reconnecting", partial: "" });
    expect(s.stats.resumeAttempts).toBe(1);
    await c.advance(500);
    await vi.waitFor(() => expect(s.stats.resumed).toBe(1));
    f.events().message(JSON.stringify({ type: "ready", generation: 4 }));
    s.capture(pcm());
    const frame = decodeLiveFrame(f.sent.at(-1) as Uint8Array);
    expect([frame.epoch, frame.sequence]).toEqual([2n, 0]);
    const played: number[] = [];
    s.sink = { play: (_a, _q, g) => played.push(g), flush: () => undefined };
    f.events().message(encodeLiveFrame({ direction: 1, epoch: 2n, sequence: 0, generation: 4, audio: pcm() }).buffer as ArrayBuffer);
    expect(played).toEqual([4]);
  });

  it("ends failed and deletes once when the lease runs out", async () => {
    const c = clock();
    const f = fake([{ status: 201, body: ticket("1", 3_000) }]);
    const s = new CallSession(f.transport, "bot", c.env);
    await s.start();
    f.events().message(JSON.stringify({ type: "ready", generation: 1 }));
    f.events().close(1006);
    for (let i = 0; i < 10 && !s.closed; i++) { await vi.waitFor(() => expect(c.pending() > 0 || s.closed).toBe(true)); await c.advance(1_000); }
    expect(s.snapshot).toMatchObject({ phase: "error", end: "failed" });
    await vi.waitFor(() => expect(f.deleted).toEqual([`/v1/live/sessions/${ID}`]));
  });
});
