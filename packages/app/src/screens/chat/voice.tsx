// Voice mode (design "voice"). Preview only: the engine has no speech capability yet.
import * as React from "react";
import { Icon, IconBtn, Tip, useToast } from "../../kit/ui";
import { Mascot, type State } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Unavailable, css, useBotCfg, useFx, useTicker } from "./shared";

type VSt = "connecting" | "listening" | "talking" | "muted" | "interrupted" | "ended";
const VMASCOT: Record<VSt, State> = { connecting: "waiting", listening: "listening", talking: "talking", muted: "waiting", interrupted: "listening", ended: "done" };

export const VOICE_VARIANTS: [string, string, string][] = [["connecting", "connexion"], ["listening", "ecoute"], ["talking", "parle"], ["muted", "muet"], ["interrupted", "interrompu"], ["ended", "fin"]]
  .map(([id, d]) => [id, `chat.variant.voice.${id}`, d]);

export function Voice() {
  const [v] = useVariant("connecting");
  if (!isPreview()) return <Unavailable feature="voice" />;
  return <VoiceIn key={v} init={v as VSt} />;
}

function VoiceIn({ init }: { init: VSt }) {
  const t = useT();
  const fx = useFx().voice;
  const bot = useBotCfg();
  const toast = useToast();
  const { go } = useNav();
  const [st, setSt] = React.useState<VSt>(init);
  const [cam, setCam] = React.useState(false);
  const [sec] = useTicker(9999, 1000, 84, st !== "connecting" && st !== "ended");
  const line: string = st === "talking" ? fx.bot : fx.user;
  const words = line.split(" ");
  const [w, setW] = React.useState(init === "muted" ? words.length : 2);
  React.useEffect(() => { if (st === "connecting") { const x = setTimeout(() => setSt("listening"), 2400); return () => clearTimeout(x); } }, [st]);
  React.useEffect(() => {
    if (st !== "listening" && st !== "talking") return;
    if (w >= words.length) { const x = setTimeout(() => { setW(0); setSt(st === "listening" ? "talking" : "listening"); }, 1400); return () => clearTimeout(x); }
    const x = setTimeout(() => setW((n) => n + 1), st === "talking" ? 170 : 240);
    return () => clearTimeout(x);
  }, [st, w, words.length]);
  const time = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  const muted = st === "muted";
  const level = st === "talking" ? "hi" : st === "listening" || st === "interrupted" ? "mid" : "flat";

  if (st === "ended") return (<>
    <div className="content-top"><span className="title">{t("chat.screen.voice")}</span><div className="spacer" /><IconBtn icon="close" label={t("common.close")} onClick={() => go("chat-states")} /></div>
    <div className="chat-voice">
      <Mascot cfg={bot} state="done" size={96} interactive />
      <div className="chat-vsum card">
        <div className="chat-vsum-h"><b>{t("chat.voice.ended")}</b><span className="chat-meta">{fx.when}</span></div>
        <div className="h3">{t("chat.voice.summary")}</div>
        <ul className="chat-ul">{fx.summary.map((s: string) => <li key={s}>{s}</li>)}</ul>
        <div className="chat-vsum-f"><button className="btn secondary" onClick={() => toast.add({ title: t("chat.voice.transcriptOpened"), description: fx.transcriptDesc, data: { icon: "file" } })}><Icon name="file" size={16} />{t("chat.voice.transcript")}</button><div className="spacer" /><button className="btn primary" onClick={() => setSt("connecting")}><Icon name="voice-wave" size={16} />{t("chat.voice.resume")}</button></div>
      </div>
    </div>
  </>);

  return (<>
    <div className="content-top"><span className="title">{t("chat.screen.voice")}</span>
      <span className="chat-live" data-on={st !== "connecting" || undefined}>{st === "connecting" ? <><span className="spin" />{t("chat.voice.connecting")}</> : <><i />{t("chat.voice.live", { time })}</>}</span>
      <div className="spacer" /><IconBtn icon="settings" label={t("chat.voice.settings")} />
    </div>
    <div className="chat-voice" data-st={st}>
      <button className="chat-vmascot" aria-label={muted ? t("chat.voice.unmute") : st === "talking" ? t("chat.voice.interrupt") : bot.name} onClick={() => setSt(muted ? "listening" : st === "talking" ? "interrupted" : st)}>
        <Mascot cfg={bot} state={VMASCOT[st]} size={168} />
      </button>
      <div className="chat-wave" data-level={muted ? "flat" : level} aria-hidden>{Array.from({ length: 36 }, (_, i) => <i key={i} style={css({ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${620 + ((i * 53) % 380)}ms` })} />)}</div>
      <div className="chat-subs" aria-live="polite">
        {st === "connecting" && <span className="thinking">{t("chat.voice.connectingTo", { name: bot.name })}</span>}
        {(st === "listening" || st === "talking") && <><span className="chat-who">{st === "listening" ? t("chat.voice.you") : bot.name}</span><p>{words.slice(0, w).join(" ")}<span className="chat-caret" /></p></>}
        {st === "muted" && <><span className="chat-who">{t("chat.voice.micOff")}</span><p className="chat-dim">{t("chat.voice.mutedBody", { name: bot.name })}</p></>}
        {st === "interrupted" && <><span className="chat-who">{t("chat.voice.interrupted", { name: bot.name })}</span><p className="chat-cut">{fx.bot.split(" ").slice(0, 9).join(" ")}…</p><p>{fx.interrupt}<span className="chat-caret" /></p></>}
      </div>
      <div className="chat-vctl">
        <Tip label={muted ? t("chat.voice.unmute") : t("chat.voice.mute")} side="top"><button className="chat-vbtn" aria-pressed={muted} data-on={muted || undefined} aria-label={muted ? t("chat.voice.unmute") : t("chat.voice.mute")} onClick={() => setSt(muted ? "listening" : "muted")}><Icon name={muted ? "mic-off" : "mic"} size={20} /></button></Tip>
        <Tip label={cam ? t("chat.voice.camOff") : t("chat.voice.camOn")} side="top"><button className="chat-vbtn" aria-pressed={cam} data-on={cam || undefined} aria-label={cam ? t("chat.voice.camOff") : t("chat.voice.camOn")} onClick={() => setCam((c) => !c)}><Icon name="camera" size={20} /></button></Tip>
        <Tip label={t("chat.voice.end")} side="top"><button className="chat-vbtn end" aria-label={t("chat.voice.end")} onClick={() => setSt("ended")}><Icon name="close" size={20} /></button></Tip>
      </div>
    </div>
  </>);
}
