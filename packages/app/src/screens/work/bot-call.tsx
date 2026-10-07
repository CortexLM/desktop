// Bot call panel (Task16; cortex-ui `.chat-voice` call design). Electron main owns the ticket,
// socket and bearer; this side runs Web Audio only: echo-cancelled capture to 16 kHz PCM16 20 ms
// frames, and playback reported as `played` once heard so the server's credit cap bounds the queue.
// Gated on the `bot_call` capability. Streaming recognition shows the words as provisional text while
// the caller speaks; replies are spoken. The call belongs to the window (`calls`), so leaving the
// Bot keeps it running, minimized in the shell (`BotCallDock`).
import * as React from "react";
import { Icon, Tip } from "../../kit/ui";
import { Mascot, type MascotConfig } from "../../mascot/Mascot";
import { useT } from "../../i18n";
import type { CallSnapshot } from "../../api";
import { useNav } from "../../shell/nav";
import { createCallOwner, type CallMic } from "./call-owner";
import { CALL_SAMPLE_RATE, resampleTo16k, takeCallFrames } from "@cortex/api-types";
import "../chat/chat.css";

class CallAudio implements CallMic {
  #ctx?: AudioContext; #stream?: MediaStream; #node?: AudioWorkletNode;
  #pending: number[] = []; #carry = { pos: 0 }; #playAt = 0; #stopped = false;
  #queued = new Set<AudioBufferSourceNode>();
  async start(lost: () => void) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    if (this.#stopped) { for (const t of stream.getTracks()) t.stop(); return; }
    this.#stream = stream;
    // Permission revoked, device unplugged or taken by the OS.
    for (const t of stream.getTracks()) t.addEventListener("ended", () => { if (!this.#stopped) lost(); }, { once: true });
    const ctx = this.#ctx = new AudioContext();
    // A static module: the renderer CSP (script-src 'self') refuses blob: worklets.
    await ctx.audioWorklet.addModule(new URL("call-tap.js", location.href).href);
    if (this.#ctx !== ctx) return;
    this.#node = new AudioWorkletNode(ctx, "cortex-call-tap");
    ctx.createMediaStreamSource(this.#stream).connect(this.#node);
    this.#node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      for (const s of resampleTo16k(e.data, ctx.sampleRate, this.#carry)) this.#pending.push(s);
      for (const out of takeCallFrames(this.#pending)) if (!this.#stopped) bridge()?.capture(out);
    };
  }
  play(pcm: Uint8Array, sequence: number, generation: number) {
    const ctx = this.#ctx;
    if (!ctx) return;
    const v = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength), samples = new Float32Array(pcm.byteLength / 2);
    for (let i = 0; i < samples.length; i++) samples[i] = v.getInt16(i * 2, true) / 32768;
    const buf = ctx.createBuffer(1, samples.length, CALL_SAMPLE_RATE);
    buf.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    this.#playAt = Math.max(this.#playAt, ctx.currentTime);
    src.start(this.#playAt); this.#playAt += buf.duration;
    this.#queued.add(src);
    // A flushed source is gone from the set: no credit for audio nobody heard.
    src.onended = () => { if (this.#queued.delete(src)) bridge()?.played(sequence, generation); };
  }
  flush() {
    const all = [...this.#queued];
    this.#queued.clear();
    for (const s of all) { try { s.stop(); } catch { /* not started */ } }
    this.#playAt = 0;
  }
  stop() {
    this.#stopped = true;
    this.flush();
    this.#node?.port.close(); this.#node?.disconnect(); this.#node = undefined;
    for (const t of this.#stream?.getTracks() ?? []) t.stop();
    this.#stream = undefined;
    void this.#ctx?.close().catch(() => undefined); this.#ctx = undefined;
  }
}

const bridge = () => window.cortex?.call;
/** The window's one call; see ./call-owner.ts. */
export const calls = createCallOwner(bridge, () => new CallAudio());
const useCalls = () => React.useSyncExternalStore(calls.subscribe, calls.get);

type Gate = "hidden" | "offer" | "unavailable";
type LivePhase = Exclude<CallSnapshot["phase"], "ended" | "error">;
const isActive = (s: CallSnapshot | undefined): s is CallSnapshot & { phase: LivePhase } => !!s && s.phase !== "ended" && s.phase !== "error";
const MASCOT_STATE = { connecting: "waiting", listening: "listening", hearing: "listening", thinking: "thinking", speaking: "talking", reconnecting: "waiting", ended: "done", error: "waiting" } as const;

export function BotCall({ botId, name, cfg }: { botId: string; name: string; cfg: MascotConfig }) {
  const t = useT(), b = bridge(), view = useCalls();
  const [gate, setGate] = React.useState<Gate>("hidden");
  React.useEffect(() => {
    let on = true;
    setGate("hidden");
    void b?.available().then((g) => { if (on) setGate(g); }, () => { if (on) setGate("hidden"); });
    return () => { on = false; };
  }, [b, botId]);

  if (!b || gate === "hidden") return null;
  const snap = view.call?.botId === botId ? view.call.snap : undefined;
  const elsewhere = !!view.call && view.call.botId !== botId && isActive(view.call.snap);
  const micDenied = view.micDenied === botId;
  const phase = snap?.phase, active = isActive(snap), muted = !!snap?.muted, partial = snap?.partial ?? "";
  const status = !isActive(snap)
    ? snap?.end === "auth_revoked" ? t("workBot.call.endedSignedOut") : snap?.end === "mic_lost" || micDenied ? t("workBot.call.micDenied")
      : snap?.end === "busy" || elsewhere ? t("workBot.call.busy")
        : snap?.end === "unavailable" || gate === "unavailable" ? t("workBot.call.unavailable") : phase === "error" ? t("workBot.call.failed")
          : phase === "ended" ? t("workBot.call.ended") : t("workBot.call.offer")
    : muted ? t("chat.voice.mutedBody", { name }) : t(`workBot.call.phase.${snap.phase}`, { name });
  const level = muted ? "flat" : phase === "speaking" ? "hi" : phase === "hearing" ? "mid" : "flat";
  return <section className="card work-bot-call" data-testid="bot-call" data-phase={phase ?? (micDenied ? "mic-denied" : gate)} aria-label={t("workBot.call.title", { name })}>
    <div className="chat-voice" data-st={muted ? "muted" : phase ?? "idle"}>
      <Mascot cfg={cfg} state={active ? MASCOT_STATE[phase!] : "idle"} size={active ? 120 : 72} />
      {active && <div className="chat-wave" data-level={level} aria-hidden>{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${620 + ((i * 53) % 380)}ms` }} />)}</div>}
      <div className="chat-subs" aria-live="polite">
        {active && !snap.streaming && <span className="chat-who">{t("workBot.call.perUtterance")}</span>}
        <p role="status" data-testid="bot-call-status" className={active ? undefined : "chat-dim"}>{status}</p>
        {active && partial !== ""
          ? <p className="chat-dim chat-partial" data-testid="bot-call-partial" aria-live="off"><span className="chat-who">{t("chat.voice.you")} · </span>{partial}</p>
          : active && snap.heard.length > 0 && <p className="chat-dim" data-testid="bot-call-heard"><span className="chat-who">{t("chat.voice.you")} · </span>{snap.heard[snap.heard.length - 1]}</p>}
      </div>
      <div className="chat-vctl">
        {active ? <>
          <Tip label={muted ? t("chat.voice.unmute") : t("chat.voice.mute")} side="top"><button className="chat-vbtn" aria-pressed={muted} data-on={muted || undefined} aria-label={muted ? t("chat.voice.unmute") : t("chat.voice.mute")} onClick={() => calls.mute(!muted)}><Icon name={muted ? "mic-off" : "mic"} size={20} /></button></Tip>
          <Tip label={t("chat.voice.interrupt")} side="top"><button className="chat-vbtn" disabled={phase !== "speaking"} aria-label={t("chat.voice.interrupt")} onClick={() => calls.interrupt()}><Icon name="voice-wave" size={20} /></button></Tip>
          <Tip label={t("chat.voice.end")} side="top"><button className="chat-vbtn end" aria-label={t("chat.voice.end")} onClick={() => calls.end()}><Icon name="close" size={20} /></button></Tip>
        </> : gate === "offer" && !elsewhere && <button className="btn primary" data-testid="bot-call-start" onClick={() => void calls.start(botId, name)}><Icon name="voice-wave" size={16} />{snap ? t("workBot.call.callAgain") : t("workBot.call.call")}</button>}
      </div>
      {active && <p className="chat-meta">{t(snap.streaming ? "workBot.call.honestyStreaming" : "workBot.call.honesty")}</p>}
    </div>
  </section>;
}

/** The call minimized (cortex-ui `MiniVoice`), on every screen except the calling Bot's own. */
export function BotCallDock() {
  const t = useT(), view = useCalls(), { route, params, go } = useNav();
  const call = view.call, snap = call?.snap;
  if (!call || !isActive(snap) || (route === "bot" && params.get("id") === call.botId)) return null;
  const muted = snap.muted, pending = snap.phase === "connecting" || snap.phase === "reconnecting";
  return <section className="voice-mini work-call-dock" data-testid="bot-call-dock" data-phase={muted ? "muet" : snap.phase} aria-label={t("workBot.call.minimized", { name: call.name })}>
    <button className="voice-mini-expand" aria-label={t("workBot.call.expand", { name: call.name })} onClick={() => go("bot", { source: "work-bot-api", id: call.botId })}>
      <span className="voice-mini-wave" aria-hidden>{[8, 16, 24, 14, 8].map((h, i) => <i key={i} style={{ height: h }} />)}</span>
      <span className="voice-mini-copy"><strong role="status">{muted ? t("chat.voice.mutedBody", { name: call.name }) : t(`workBot.call.phase.${snap.phase}`, { name: call.name })}</strong><span>{t("workBot.call.title", { name: call.name })}</span></span>
      <Icon name="expand" size={16} />
    </button>
    <button className="voice-mini-button" aria-pressed={muted} disabled={pending} aria-label={muted ? t("chat.voice.unmute") : t("chat.voice.mute")} onClick={() => calls.mute(!muted)}><Icon name={muted ? "mic-off" : "mic"} size={20} /></button>
    <button className="voice-mini-button voice-mini-end" aria-label={t("chat.voice.end")} onClick={() => calls.end()}><Icon name="close" size={20} /></button>
  </section>;
}
