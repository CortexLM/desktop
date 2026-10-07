import { describe, expect, it } from "vitest";
import type { CallBridge, CallSnapshot } from "../../api";
import { createCallOwner, type CallMic } from "./call-owner";

function harness() {
  const log: string[] = [];
  let snapshot: ((s: CallSnapshot) => void) | undefined;
  const bridge: CallBridge = {
    available: async () => "offer",
    start: (botId, on) => { log.push(`start:${botId}`); snapshot = on.snapshot; return { started: Promise.resolve(), stop: () => log.push("detach") }; },
    capture: () => undefined, played: () => undefined,
    mute: (m) => log.push(`mute:${m}`), interrupt: () => log.push("interrupt"), end: () => log.push("end"),
  };
  let grant!: () => void, deny!: () => void, lost!: () => void;
  const mics: { stops: number }[] = [];
  const owner = createCallOwner(() => bridge, () => {
    const m = { stops: 0 };
    mics.push(m);
    return {
      start: (onLost) => new Promise<void>((ok, no) => { lost = onLost; grant = ok; deny = () => no(new Error("denied")); }),
      play: () => undefined, flush: () => undefined, stop: () => { m.stops++; },
    } satisfies CallMic;
  });
  const live = (s: Partial<CallSnapshot>) => snapshot!({ phase: "listening", muted: false, heard: [], partial: "", streaming: true, ...s });
  return { owner, log, mics, grant: () => grant(), deny: () => deny(), lose: () => lost(), live };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("window call owner", () => {
  it("D4: ending while the microphone prompt is open never starts a call", async () => {
    const h = harness();
    const started = h.owner.start("bot-a", "Ada");
    h.owner.end();
    h.grant();
    await started;
    expect(h.log.filter((l) => l.startsWith("start"))).toEqual([]);
    expect(h.mics[0]!.stops).toBe(1);
    expect(h.owner.get().call?.snap).toMatchObject({ phase: "ended", end: "ended" });
    expect(h.owner.active()).toBe(false);
  });

  it("D4: a refused microphone starts nothing and names the Bot", async () => {
    const h = harness();
    const started = h.owner.start("bot-a", "Ada");
    h.deny();
    await started;
    expect(h.log).toEqual([]);
    expect(h.owner.get()).toEqual({ call: null, micDenied: "bot-a" });
  });

  it("D1: a microphone lost mid-call ends it once in main and releases the microphone once", async () => {
    const h = harness();
    const started = h.owner.start("bot-a", "Ada");
    h.grant();
    await started;
    h.live({});
    h.lose();
    h.lose();
    expect(h.log.filter((l) => l === "end")).toHaveLength(1);
    expect(h.mics[0]!.stops).toBe(1);
    expect(h.owner.get()).toMatchObject({ call: { snap: { phase: "error", end: "mic_lost" } }, micDenied: "bot-a" });
    expect(h.owner.active()).toBe(false);
  });

  it("one call per window; a server end releases once and shows the final snapshot", async () => {
    const h = harness();
    const started = h.owner.start("bot-a", "Ada");
    h.grant();
    await started;
    await h.owner.start("bot-b", "Bea");
    expect(h.log.filter((l) => l.startsWith("start"))).toEqual(["start:bot-a"]);
    h.live({ partial: "hel" });
    expect(h.owner.get().call).toMatchObject({ botId: "bot-a", snap: { partial: "hel" } });
    h.live({ phase: "ended", end: "ended", partial: "" });
    h.owner.end();
    await settle();
    expect(h.mics[0]!.stops).toBe(1);
    expect(h.log.filter((l) => l === "end")).toEqual([]);
    expect(h.owner.get().call?.snap.phase).toBe("ended");
  });
});
