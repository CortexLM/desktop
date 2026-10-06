// Bot call panel (Task16; cortex-ui `.chat-voice` call design). Electron main owns the ticket,
// socket and bearer; this side runs Web Audio only: echo-cancelled capture to 16 kHz PCM16 20 ms
// frames, and playback reported as `played` once heard so the server's credit cap bounds the queue.
// Gated on the `bot_call` capability; recognition is per utterance, replies are spoken, not captioned.
import * as React from "react";
import { Icon, Tip } from "../../kit/ui";
import { Mascot, type MascotConfig } from "../../mascot/Mascot";
import { useT } from "../../i18n";
import type { CallBridge, CallSnapshot } from "../../api";
import "../chat/chat.css";

const RATE = 16_000, FRAME = 320;

/** Float32 at any rate -> 16 kHz samples (linear interpolation); `carry` keeps phase across chunks. */
export function resampleTo16k(input: Float32Array, rate: number, carry: { pos: number }): Int16Array {
  const step = rate / RATE, out: number[] = [];
  let pos = carry.pos;
  while (pos < input.length - 1) {
    const i = Math.floor(pos), f = pos - i;
    out.push(Math.max(-32768, Math.min(32767, Math.round((input[i]! * (1 - f) + input[i + 1]! * f) * 32767))));
    pos += step;
  }
  carry.pos = pos - input.length;
  return Int16Array.from(out);
}

class CallAudio {
  #ctx?: AudioContext; #stream?: MediaStream; #node?: AudioWorkletNode;
  #pending: number[] = []; #carry = { pos: 0 }; #playAt = 0;
  #queued = new Set<AudioBufferSourceNode>();
  constructor(private bridge: CallBridge) {}
  async start() {
    this.#stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    const ctx = this.#ctx = new AudioContext();
    // A static module: the renderer CSP (script-src 'self') refuses blob: worklets.
    await ctx.audioWorklet.addModule(new URL("call-tap.js", location.href).href);
    if (this.#ctx !== ctx) return;
    this.#node = new AudioWorkletNode(ctx, "cortex-call-tap");
    ctx.createMediaStreamSource(this.#stream).connect(this.#node);
    this.#node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      for (const s of resampleTo16k(e.data, ctx.sampleRate, this.#carry)) this.#pending.push(s);
      while (this.#pending.length >= FRAME) {
        const out = new Uint8Array(FRAME * 2), v = new DataView(out.buffer);
        this.#pending.splice(0, FRAME).forEach((s, i) => v.setInt16(i * 2, s, true));
        this.bridge.capture(out);
      }
    };
  }
  play(pcm: Uint8Array, sequence: number, generation: number) {
    const ctx = this.#ctx;
    if (!ctx) return;
    const v = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength), samples = new Float32Array(pcm.byteLength / 2);
    for (let i = 0; i < samples.length; i++) samples[i] = v.getInt16(i * 2, true) / 32768;
    const buf = ctx.createBuffer(1, samples.length, RATE);
    buf.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    this.#playAt = Math.max(this.#playAt, ctx.currentTime);
    src.start(this.#playAt); this.#playAt += buf.duration;
    this.#queued.add(src);
    // A flushed source is gone from the set: no credit for audio nobody heard.
    src.onended = () => { if (this.#queued.delete(src)) this.bridge.played(sequence, generation); };
  }
  flush() {
    const all = [...this.#queued];
    this.#queued.clear();
    for (const s of all) { try { s.stop(); } catch { /* not started */ } }
    this.#playAt = 0;
  }
  stop() {
    this.flush();
    this.#node?.port.close(); this.#node?.disconnect(); this.#node = undefined;
    for (const t of this.#stream?.getTracks() ?? []) t.stop();
    this.#stream = undefined;
    void this.#ctx?.close().catch(() => undefined); this.#ctx = undefined;
  }
}

type Gate = "hidden" | "offer" | "unavailable";
const MASCOT_STATE = { connecting: "waiting", listening: "listening", hearing: "listening", thinking: "thinking", speaking: "talking", reconnecting: "waiting", ended: "done", error: "waiting" } as const;

export function BotCall({ botId, name, cfg }: { botId: string; name: string; cfg: MascotConfig }) {
  const t = useT(), bridge = window.cortex?.call;
  const [gate, setGate] = React.useState<Gate>("hidden");
  const [snap, setSnap] = React.useState<CallSnapshot | null>(null);
  const [micDenied, setMicDenied] = React.useState(false);
  const live = React.useRef<{ audio: CallAudio; stop(): void } | null>(null);
  const teardown = React.useCallback(() => {
    const c = live.current;
    live.current = null;
    if (!c) return;
    bridge?.end(); c.audio.stop(); c.stop();
  }, [bridge]);
  React.useEffect(() => {
    let on = true;
    setGate("hidden");
    void bridge?.available().then((g) => { if (on) setGate(g); }, () => { if (on) setGate("hidden"); });
    return () => { on = false; };
  }, [bridge, botId]);
  // Leaving the Bot (navigation, other Bot, unmount) ends the call.
  React.useEffect(() => teardown, [teardown, botId]);

  if (!bridge || gate === "hidden") return null;
  const call = async () => {
    if (live.current) return;
    setMicDenied(false);
    const audio = new CallAudio(bridge);
    try { await audio.start(); } catch { audio.stop(); setMicDenied(true); return; }
    const handle = bridge.start(botId, {
      snapshot: (s) => { setSnap(s); if (s.phase === "ended" || s.phase === "error") { audio.stop(); if (live.current?.audio === audio) { live.current.stop(); live.current = null; } } },
      play: (pcm, sequence, generation) => audio.play(pcm, sequence, generation),
      flush: () => audio.flush(),
    });
    live.current = { audio, stop: handle.stop };
    await handle.started.catch(() => { setSnap({ phase: "error", muted: false, heard: [], end: "failed" }); teardown(); });
  };

  const phase = snap?.phase, active = !!phase && phase !== "ended" && phase !== "error", muted = !!snap?.muted;
  const status = !active
    ? snap?.end === "auth_revoked" ? t("workBot.call.endedSignedOut") : snap?.end === "busy" ? t("workBot.call.busy")
      : snap?.end === "unavailable" || gate === "unavailable" ? t("workBot.call.unavailable") : phase === "error" ? t("workBot.call.failed")
        : micDenied ? t("workBot.call.micDenied") : phase === "ended" ? t("workBot.call.ended") : t("workBot.call.offer")
    : muted ? t("chat.voice.mutedBody", { name }) : t(`workBot.call.phase.${phase}`, { name });
  const level = muted ? "flat" : phase === "speaking" ? "hi" : phase === "hearing" ? "mid" : "flat";
  return <section className="card work-bot-call" data-testid="bot-call" data-phase={phase ?? (micDenied ? "mic-denied" : gate)} aria-label={t("workBot.call.title", { name })}>
    <div className="chat-voice" data-st={muted ? "muted" : phase ?? "idle"}>
      <Mascot cfg={cfg} state={active ? MASCOT_STATE[phase] : "idle"} size={active ? 120 : 72} />
      {active && <div className="chat-wave" data-level={level} aria-hidden>{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${620 + ((i * 53) % 380)}ms` }} />)}</div>}
      <div className="chat-subs" aria-live="polite">
        {active && <span className="chat-who">{t("workBot.call.perUtterance")}</span>}
        <p role="status" data-testid="bot-call-status" className={active ? undefined : "chat-dim"}>{status}</p>
        {active && snap.heard.length > 0 && <p className="chat-dim"><span className="chat-who">{t("chat.voice.you")} · </span>{snap.heard[snap.heard.length - 1]}</p>}
      </div>
      <div className="chat-vctl">
        {active ? <>
          <Tip label={muted ? t("chat.voice.unmute") : t("chat.voice.mute")} side="top"><button className="chat-vbtn" aria-pressed={muted} data-on={muted || undefined} aria-label={muted ? t("chat.voice.unmute") : t("chat.voice.mute")} onClick={() => bridge.mute(!muted)}><Icon name={muted ? "mic-off" : "mic"} size={20} /></button></Tip>
          <Tip label={t("chat.voice.interrupt")} side="top"><button className="chat-vbtn" disabled={phase !== "speaking"} aria-label={t("chat.voice.interrupt")} onClick={() => { live.current?.audio.flush(); bridge.interrupt(); }}><Icon name="voice-wave" size={20} /></button></Tip>
          <Tip label={t("chat.voice.end")} side="top"><button className="chat-vbtn end" aria-label={t("chat.voice.end")} onClick={teardown}><Icon name="close" size={20} /></button></Tip>
        </> : gate === "offer" && <button className="btn primary" data-testid="bot-call-start" onClick={() => void call()}><Icon name="voice-wave" size={16} />{snap ? t("workBot.call.callAgain") : t("workBot.call.call")}</button>}
      </div>
      {active && <p className="chat-meta">{t("workBot.call.honesty")}</p>}
    </div>
  </section>;
}
