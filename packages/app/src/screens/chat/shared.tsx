// Building blocks shared by the chat screens (ported from the design's lot-chat).
import * as React from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { Popover } from "@base-ui/react/popover";
import { Icon, IconBtn, Tip, Pop, MItem, MSep, useToast } from "../../kit/ui";
import { Composer } from "../../components/composer";
import { Mascot, DEFAULT_MASCOT, type MascotConfig, type State } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview, useFixtures } from "../../preview";
import "./chat.css";

export const NB = "\u202f";
export const css = (o: Record<string, string | number>) => o as React.CSSProperties;

export type Src = { m: string; c: string; site: string; t: string; d: string; date: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChatFx = Record<string, any> & { bot: string; sources: Src[] };
export const useFx = () => useFixtures<ChatFx>("chat");

/** Mascot shown beside answers: the preview teammate, or a neutral Cortex mark in live mode. */
export function useBotCfg(): MascotConfig {
  const fx = useFx();
  const t = useT();
  return { ...DEFAULT_MASCOT, name: isPreview() ? fx.bot : t("chat.assistant") };
}

export function useCopy() {
  const toast = useToast();
  const t = useT();
  return (text: string, title = t("common.copied")) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    toast.add({ title, data: { icon: "check" } });
  };
}

/** Text that types itself: `n` visible characters, advancing while `on`. */
export function useStream(text: string, { from = 0, run = true, step = 3, tick = 30 } = {}) {
  const [n, setN] = React.useState(from);
  const [on, setOn] = React.useState(run);
  React.useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setN((x) => Math.min(text.length, x + step)), tick);
    return () => clearInterval(id);
  }, [on, text, step, tick]);
  React.useEffect(() => { if (n >= text.length) setOn(false); }, [n, text.length]);
  return { shown: text.slice(0, n), on, done: n >= text.length, stop: () => setOn(false), start: () => setOn(true) };
}

/** Counter that climbs to `max`. */
export function useTicker(max: number, ms: number, from = 0, run = true) {
  const [n, setN] = React.useState(from);
  React.useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setN((x) => (x >= max ? x : x + 1)), ms);
    return () => clearInterval(id);
  }, [max, ms, run]);
  return [n, setN] as const;
}

export const Paras = ({ text, caret, testId }: { text: string; caret?: boolean; testId?: string }) => {
  const ps = text.split("\n");
  return <>{ps.map((p, i) => <p key={i} data-testid={testId}>{p}{caret && i === ps.length - 1 && <span className="chat-caret" aria-hidden />}</p>)}</>;
};

export const Fav = ({ s, size = 18 }: { s: Src; size?: number }) => <span className="chat-fav" data-c={s.c} style={{ width: size, height: size }} aria-hidden>{size < 24 ? s.m[0] : s.m}</span>;

/** Citation pill [n]: source preview on hover, click selects it in the panel. */
export function Cite({ n, onPick, tail }: { n: number; onPick?: (n: number) => void; tail?: string }) {
  const t = useT();
  const s = useFx().sources[n - 1];
  return (<span className="chat-cw">{"\u00a0"}
    <Popover.Root>
      <Popover.Trigger openOnHover delay={150} className="chat-cite" aria-label={t("chat.cite.label", { n, site: s.site })} onClick={() => onPick?.(n)}>{n}</Popover.Trigger>
      <Popover.Portal><Popover.Positioner side="top" sideOffset={6}><Popover.Popup className="popup chat-cite-pop">
        <div className="chat-cite-site"><Fav s={s} size={16} />{s.site}<span>· {s.date}</span></div>
        <div className="chat-cite-t">{s.t}</div><div className="chat-cite-d">{s.d}</div>
      </Popover.Popup></Popover.Positioner></Popover.Portal>
    </Popover.Root>{tail}</span>
  );
}

export function BotRow({ st = "idle", children, cfg }: { st?: State; children: React.ReactNode; cfg?: MascotConfig }) {
  const bot = useBotCfg();
  return <div className="msg-bot-row"><Mascot cfg={cfg ?? bot} state={st} size={22} /><div className="msg-bot chat-grow">{children}</div></div>;
}

export function Actions({ text = "", extra, regen }: { text?: string; extra?: React.ReactNode; regen?: () => void }) {
  const t = useT();
  const copy = useCopy();
  const { go } = useNav();
  const [up, setUp] = React.useState<"up" | "down" | "">("");
  return (
    <div className="msg-actions">
      <IconBtn icon="copy" label={t("chat.act.copy")} onClick={() => copy(text, t("chat.toast.answerCopied"))} />
      <IconBtn icon="thumb-up" label={t("chat.act.good")} aria-pressed={up === "up"} data-on={up === "up" || undefined} onClick={() => setUp(up === "up" ? "" : "up")} />
      <IconBtn icon="thumb-down" label={t("chat.act.bad")} aria-pressed={up === "down"} data-on={up === "down" || undefined} onClick={() => setUp(up === "down" ? "" : "down")} />
      {extra ?? <IconBtn icon="refresh" label={t("chat.act.regen")} onClick={regen} />}
      {isPreview() && <IconBtn icon="share" label={t("chat.act.share")} onClick={() => go("share")} />}
    </div>
  );
}

/** Attached file (in a message or in the composer). */
export function Att({ name, meta, img, pct, err, onRemove }: { name: string; meta: string; img?: string; pct?: number; err?: boolean; onRemove?: () => void }) {
  const t = useT();
  const L = 2 * Math.PI * 9;
  return (
    <div className="chat-att" data-err={err || undefined}>
      {img ? <span className="chat-att-img" style={{ backgroundImage: `url(${img})` }} />
        : <span className="chat-att-ic">{pct !== undefined
          ? <svg width="22" height="22" viewBox="0 0 22 22" role="progressbar" aria-valuenow={pct} aria-label={t("chat.att.uploading")}><circle cx="11" cy="11" r="9" fill="none" stroke="var(--subtle)" strokeWidth="2" /><circle cx="11" cy="11" r="9" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeDasharray={`${(L * pct) / 100} ${L}`} transform="rotate(-90 11 11)" className="chat-ring" /></svg>
          : <Icon name={err ? "alert-triangle" : "file"} />}</span>}
      <span className="chat-att-txt"><span className="ttl">{name}</span><span className="sub">{meta}</span></span>
      {onRemove && <IconBtn icon="close" label={t("chat.att.remove", { name })} size={16} className="chat-att-x" onClick={onRemove} />}
    </div>
  );
}

/** Extended composer: attachments, sending state, Stop while streaming. */
export function Box({ mode = "idle", onStop, onSend, attach, placeholder, model }: { mode?: "idle" | "busy" | "sending"; onStop?: () => void; onSend?: (t: string) => void; attach?: React.ReactNode; placeholder?: string; model?: string }) {
  const t = useT();
  const [text, setText] = React.useState("");
  const off = mode === "sending";
  const ph = placeholder ?? t("chat.reply");
  return (
    <div className="chat-box" data-off={off || undefined}>
      {attach && <div className="chat-attach">{attach}</div>}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); if (text.trim() && mode === "idle") { onSend?.(text.trim()); setText(""); } }}>
        <IconBtn type="button" icon="paperclip" label={t("composer.addFiles")} className="round" disabled={off} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={ph} aria-label={ph} disabled={off} />
        <span className="chat-model">{model ?? t("composer.model.thinking")}</span>
        {mode === "busy" ? <StopBtn onStop={onStop} />
          : mode === "sending" ? <button type="button" className="send" disabled aria-label={t("chat.sendingAria")}><span className="spin chat-spin" /></button>
          : <button type="submit" className="send" aria-label={t("composer.send")} disabled={!text.trim()} data-dim={!text.trim() || undefined}><Icon name="arrow-up" /></button>}
      </form>
    </div>
  );
}

export function StopBtn({ onStop }: { onStop?: () => void }) {
  const t = useT();
  return <Tip label={t("chat.stop")} kbd={t("chat.kbd.esc")}><button type="button" className="send chat-stop" aria-label={t("chat.stop")} data-testid="stop" onClick={onStop}><Icon name="stop" size={16} /></button></Tip>;
}

/** Collapsible "thought for Ns" block. */
export function Reasoning({ live, secs, steps, defaultOpen, name }: { live?: boolean; secs: number; steps: string[]; defaultOpen?: boolean; name?: string }) {
  const t = useT();
  const bot = useBotCfg();
  return (
    <Collapsible.Root className="chat-reason" defaultOpen={defaultOpen} data-testid="reasoning-block">
      <Collapsible.Trigger className="chat-reason-t">
        {live ? <span className="thinking">{t("chat.thinkingName", { name: name ?? bot.name })}</span> : <span>{t("chat.thoughtFor", { secs })}</span>}
        {live && <span className="chat-meta">{t("chat.secs", { secs })}</span>}
        <Icon name="chevron-right" size={12} className="chat-chev" />
      </Collapsible.Trigger>
      <Collapsible.Panel className="chat-reason-p">
        <ol>{steps.map((s, i) => <li key={i} style={css({ "--i": i })} data-last={(live && i === steps.length - 1) || undefined}>{s}</li>)}</ol>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

type Extra = { u: string; b?: string };
/** Preview conversation frame: header, thread, dock, optional banner and side panel. */
export function ChatFrame({ children, dock, banner, side, float, threadRef, onScroll, onNew, onSources, title }: {
  children: React.ReactNode; dock?: React.ReactNode; banner?: React.ReactNode; side?: React.ReactNode; float?: React.ReactNode;
  threadRef?: React.Ref<HTMLDivElement>; onScroll?: () => void; onNew: () => void; onSources?: () => void; title?: string;
}) {
  const t = useT();
  const fx = useFx();
  const { go } = useNav();
  const toast = useToast();
  const [extra, setExtra] = React.useState<Extra[]>([]);
  const name = title ?? fx.states.title;
  const send = (text: string) => {
    setExtra((x) => [...x, { u: text }]);
    setTimeout(() => setExtra((x) => x.map((m, i) => (i === x.length - 1 ? { ...m, b: fx.states.ack } : m))), 1300);
  };
  return (<>
    <div className="content-top">
      <span className="title">{name}</span>
      <Pop trigger={<button className="ibtn" aria-label={t("chat.options")}><Icon name="chevron-down" size={12} /></button>}>
        <MItem icon="edit">{t("chat.menu.rename")}</MItem><MItem icon="pin">{t("chat.menu.pin")}</MItem><MItem icon="folder">{t("chat.menu.move")}</MItem><MSep />
        <MItem icon="trash" danger onClick={() => toast.add({ title: t("chat.toast.deleted"), description: name, data: { undo: true, icon: "trash" } })}>{t("chat.menu.delete")}</MItem>
      </Pop>
      <div className="spacer" />
      {onSources && <IconBtn icon="globe" label={t("chat.sources")} onClick={onSources} />}
      <IconBtn icon="share" label={t("chat.act.share")} onClick={() => go("share")} />
      <IconBtn icon="compose" label={t("chat.newChat")} kbd="⌘N" onClick={onNew} />
    </div>
    <div className="chat-cols">
      <div className="chat-main">
        {banner}
        <div className="chat-tw">
          <div className="thread" ref={threadRef} onScroll={onScroll}><div className="thread-inner">
            {children}
            {extra.map((m, i) => <React.Fragment key={i}><div className="msg-user">{m.u}</div>
              {m.b ? <BotRow st="talking"><p>{m.b}</p><Actions text={m.b} /></BotRow> : <BotRow st="thinking"><span className="thinking">{t("chat.thinking")}</span></BotRow>}</React.Fragment>)}
          </div></div>
          {float}
        </div>
        <div className="dock">{dock ?? <Composer placeholder={t("chat.reply")} onSend={send} />}<span className="hint">{t("chat.hint")}</span></div>
      </div>
      {side}
    </div>
  </>);
}

/** Honest live state for chat features the engine does not provide yet. */
export function Unavailable({ feature }: { feature: string }) {
  const t = useT();
  const { go } = useNav();
  return (<>
    <div className="content-top"><span className="title">{t(`chat.screen.${feature}`)}</span></div>
    <div className="empty">
      <h2>{t("chat.unavailable.title")}</h2>
      <p>{t("chat.unavailable.body")}</p>
      <button className="btn secondary" onClick={() => go("home")}>{t("chat.unavailable.cta")}</button>
    </div>
  </>);
}
