// Bot onboarding (create a Bot), the Bot page (conversation, routines, memory) and the appearance studio.
import * as React from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { MessageWithParts } from "@cortex/schema";
import { Icon, IconBtn, Switch, Segmented, Tip, useToast } from "../../kit/ui";
import { Composer } from "../../components/composer";
import { Mascot, STATES, COLORS, SHAPE_LIST, DEFAULT_MASCOT, type MascotConfig, type State, type Eyes, type Mouth } from "../../mascot/Mascot";
import { ACCESSORIES, SLOT_LABEL, type Slot } from "../../mascot/parts";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { isPreview, useFixtures, usePreviewBot } from "../../preview";
import { api } from "../../api";
import { useBots, useMessages, usePermissions, useQuery } from "../../state/live";
import { toolName } from "../../state/tool-label";
import { toConfig, toMascot, defaultModel } from "./mascot-io";
import { useStatuses, stateOf, type BotsFx } from "../work/common";
import type { BotFx } from "./fixtures";

export const SYMBOLS = ["sparkle-free", "bolt", "code", "mail", "calendar", "globe", "shield-check", "rocket", "bug", "image", "terminal", "key"];
const EYES: Eyes[] = ["commas", "dots", "ovals", "pixels"];
const MOUTHS: Mouth[] = ["none", "smile", "o"];
const SLOTS: Slot[] = ["glasses", "hat", "extra"];
const TABS = ["shape", "face", "accessories", "symbol"];
const TONES = ["direct", "warm", "analytical"];
const ACCESS: [string, string][] = [["mail", "mail"], ["cal", "calendar"], ["docs", "file"], ["web", "globe"]];
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Resolves the Bot a screen works on: `?id=` or the first Bot (live), the fixture Nova (preview). */
function useTargetBot() {
  const { params } = useNav();
  const bots = useBots();
  const id = params.get("id");
  const list = bots.state === "ready" ? bots.data : [];
  return { bot: id ? list.find((b) => b.id === id) : list[0], state: bots.state, reload: bots.reload, all: list };
}

/* ====================================================================== */
/* Create your Bot                                                        */
/* ====================================================================== */
export function BotOnboarding() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const preview = isPreview();
  const previewBot = usePreviewBot();
  const [step, setStep] = React.useState(0);
  const [look, setLook] = React.useState<MascotConfig>(() => previewBot?.cfg ?? { name: "", ...DEFAULT_MASCOT });
  const name = look.name, setName = (n: string) => setLook({ ...look, name: n });
  // The mascot state follows what the user is doing in the onboarding.
  const [typing, setTyping] = React.useState(false);
  const mState: State = step === 4 ? "waiting" : typing ? "listening" : step === 3 ? "thinking" : "idle";
  const [tone, setTone] = React.useState("direct");
  const [access, setAccess] = React.useState<Record<string, boolean>>({ mail: true, cal: true, docs: false, web: true });
  const steps = [t("bots.new.step.name"), t("bots.new.step.look"), t("bots.new.step.tone"), t("bots.new.step.access"), t("bots.new.step.activate")];
  const shown = name || t("bots.new.yourBot");
  // Live: only web access maps to an engine tool; the other rows have no backing yet.
  const accessRows = preview ? ACCESS : ACCESS.filter(([k]) => k === "web");
  const [created, setCreated] = React.useState<Record<string, string> | null>(null);
  React.useEffect(() => {
    if (!created) return;
    const timer = setTimeout(() => go("bot", created), 1500);
    return () => clearTimeout(timer);
  }, [created, go]);
  const create = async (): Promise<boolean> => {
    if (preview) {
      if (!previewBot) return false;
      previewBot.save({ ...look, name: name.trim() });
      setCreated({}); return true;
    }
    try {
      const model = await defaultModel();
      if (!model) { toast.add({ title: t("bots.new.noProvider"), description: t("bots.new.noProviderDesc"), data: { icon: "alert-triangle" } }); return false; }
      const b = await api.bots.create({ name: name.trim(), persona: t(`bots.tone.${tone}.persona`), mascot: toMascot(look), model, tools: access.web ? {} : { deny: ["webfetch"] } });
      setCreated({ id: b.id });
      return true;
    } catch { toast.add({ title: t("bots.error.create"), data: { icon: "alert-triangle" } }); return false; }
  };
  return (
    <>
      <div className="content-top"><div className="spacer" /><IconBtn icon="close" label={t("common.close")} onClick={() => go("home")} /></div>
      <div className="onb">
        <div className="steps" aria-label={t("bots.new.stepOf", { n: step + 1, total: steps.length })}>{steps.map((s, i) => <i key={s} className="step" data-current={i === step || undefined} data-done={i < step || undefined} />)}</div>
        <div className="onb-card" key={step}>
          {step === 0 && <>
            <Mascot cfg={look} state={mState} size={120} track interactive />
            <h1>{t("bots.new.title")}</h1>
            <p>{t("bots.new.intro")}</p>
            <div className="field" style={{ width: "100%" }}><label htmlFor="bn">{t("bots.new.nameLabel")}</label><input id="bn" className="input" data-testid="bot-name-input" value={name} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} onChange={(e) => setName(e.target.value)} maxLength={20} /></div>
          </>}
          {step === 1 && <>
            <Mascot cfg={look} state="idle" size={120} track interactive />
            <h1>{t("bots.new.lookTitle", { name: shown })}</h1>
            <p>{t("bots.new.lookText")}</p>
            <div className="onb-pick">{SHAPE_LIST.map((s) => <button key={s} className="sw" aria-label={t(`bots.shape.${s}`)} aria-pressed={look.shape === s} data-on={look.shape === s || undefined} onClick={() => setLook({ ...look, shape: s })}><Mascot cfg={{ ...look, shape: s, glasses: undefined, hat: undefined, extra: undefined, symbol: undefined }} size={36} /></button>)}</div>
            <div className="colors" style={{ justifyContent: "center", marginTop: 6 }}>{COLORS.map(([n, c]) => <Tip key={c} label={t(`bots.color.${n}`)}><button className="color" aria-label={t(`bots.color.${n}`)} aria-pressed={look.color === c} data-on={look.color === c || undefined} style={{ background: c }} onClick={() => setLook({ ...look, color: c })} /></Tip>)}</div>
          </>}
          {step === 2 && <>
            <h1>{t("bots.new.toneTitle", { name: shown })}</h1>
            <p>{t("bots.new.toneText")}</p>
            <div className="opts">
              {TONES.map((x) => (
                <button key={x} className="opt" data-on={tone === x || undefined} onClick={() => setTone(x)}><span><b>{t(`bots.tone.${x}`)}</b><span>{t(`bots.tone.${x}.hint`)}</span></span><span className="radio" /></button>
              ))}
            </div>
          </>}
          {step === 3 && <>
            <h1>{t("bots.new.accessTitle")}</h1>
            <p>{t("bots.new.accessText", { name: shown })}</p>
            <div className="list" style={{ width: "100%" }}>
              {accessRows.map(([k, ic]) => (
                <label key={k} className="li"><Icon name={ic} /><span className="grow"><div className="ttl">{t(`bots.access.${k}`)}</div><div className="sub">{t(`bots.access.${k}.hint`)}</div></span>
                  <Switch checked={access[k]} onCheckedChange={(v) => setAccess((a) => ({ ...a, [k]: v }))} aria-label={t(`bots.access.${k}`)} /></label>
              ))}
            </div>
          </>}
          {step === 4 && <>
            <Mascot cfg={look} state={mState} size={120} interactive />
            <h1>{t("bots.new.readyTitle", { name: shown })}</h1>
            <p>{t("bots.new.readyText")}</p>
            <SlideToActivate onDone={create} />
          </>}
        </div>
        <div className="onb-foot">
          {step > 0 ? <button className="btn secondary" onClick={() => setStep(step - 1)}>{t("bots.back")}</button> : <span />}
          {step < 4 && <button className="btn primary" data-testid={step === 0 ? "bot-name-next" : undefined} disabled={!name.trim()} onClick={() => setStep(step + 1)}>{t("bots.continue")}<Icon name="arrow-right" /></button>}
        </div>
      </div>
    </>
  );
}

// The knob follows the pointer 1:1, validates at ≥ 96 % of the track, springs back otherwise. Enter/Space activate too.
function SlideToActivate({ onDone }: { onDone: () => Promise<boolean> | boolean }) {
  const t = useT();
  const track = React.useRef<HTMLDivElement>(null);
  const [x, setX] = React.useState(0);
  const [drag, setDrag] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const max = () => track.current!.clientWidth - 48;
  const finish = async () => { setX(max()); setDone(true); if (!(await onDone())) { setDone(false); setX(0); } };
  const start = (e: React.PointerEvent) => {
    if (done) return;
    const x0 = e.clientX - x; setDrag(true); (e.target as Element).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setX(Math.max(0, Math.min(max(), ev.clientX - x0)));
    const up = (ev: PointerEvent) => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); setDrag(false);
      const v = Math.max(0, Math.min(max(), ev.clientX - x0));
      if (v >= max() * 0.96) void finish(); else setX(0);
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  const key = (e: React.KeyboardEvent) => { if (!done && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); void finish(); } };
  return (
    <div ref={track} className="slide" data-done={done || undefined}>
      <span className="slide-label" style={{ opacity: done ? 1 : 1 - x / 200 }}>{done ? t("bots.new.activated") : t("bots.new.slide")}</span>
      <div role="button" tabIndex={0} aria-label={t("bots.new.activate")} data-testid="bot-create-submit" className="slide-knob" onPointerDown={start} onKeyDown={key}
        style={{ translate: `${x}px 0`, transition: drag ? "none" : "translate 520ms cubic-bezier(0.22, 1, 0.36, 1)" }}>
        <Icon name={done ? "check" : "arrow-right"} />
      </div>
    </div>
  );
}

/* ====================================================================== */
/* Your Bot                                                               */
/* ====================================================================== */
export function BotPage() {
  const { params } = useNav();
  return isPreview() ? <BotPagePreview /> : <BotPageLive key={params.get("id")} />;
}

function BotPagePreview() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fxb = useFixtures<BotsFx & { page: BotFx }>("bots");
  const fx = fxb.page;
  const previewBot = usePreviewBot()!;
  const { cfg: bot, live, setLive } = previewBot;
  const on = live.on, busy = live.state;
  const setOn = (on: boolean) => setLive({ on });
  const setBusy = (state: State, doing?: string) => setLive({ state, ...(doing === undefined ? {} : { doing }) });
  const [sel, setSel] = React.useState<string | null>(null);
  const team = (fx?.team ?? []).map((n) => (fxb.team ?? []).find((b) => b.cfg.name === n)!).filter(Boolean);
  const picked = team.find((x) => x.cfg.name === sel);
  const [r, setR] = React.useState<Record<string, boolean>>(Object.fromEntries((fx.routines ?? []).map(([k, , , o]) => [k, o])));
  return (<>
    <div className="content-top">
      <span className="title">{bot.name}</span>
      <button className="bot-pill" data-on={on || undefined} onClick={() => setOn(!on)}><i />{on ? t("bots.active") : t("bots.paused")}</button>
      <div className="spacer" /><button className="btn secondary" style={{ height: 28 }} onClick={() => go("bot-studio")}><Icon name="edit" size={16} />{t("bots.customize")}</button><IconBtn icon="settings" label={t("bots.settingsLabel")} onClick={() => go("bot-settings")} />
    </div>
    <div className="page">
      <div className="bot-hero">
        <Tip label={on ? fx.heroTip : t("bots.paused")}><button className="hero-mascot" onClick={() => go("bot-studio")} aria-label={t("bots.customizeName", { name: bot.name })}><Mascot cfg={bot} state={on ? busy : "asleep"} size={72} track /></button></Tip>
        <div><div className="page-title" style={{ margin: 0 }}>{fx.hello}</div><div style={{ color: "var(--t2)", fontSize: 13 }}>{fx.summary}</div></div>
      </div>
      <h3 className="h3">{t("bots.page.team")}</h3>
      <div className="roster">
        <Tip label={t("bots.customizeName", { name: bot.name })}><button className="roster-item" data-on={!sel || undefined} onClick={() => (sel ? setSel(null) : go("bot-studio"))}><Mascot cfg={bot} state={on ? busy : "asleep"} size={44} /><span>{bot.name}</span><span className="sub">{t("bots.page.main")}</span></button></Tip>
        {team.map((x) => (
          <Tip key={x.cfg.name} label={x.doing}><button className="roster-item" aria-pressed={sel === x.cfg.name} data-on={sel === x.cfg.name || undefined} onClick={() => setSel(x.cfg.name)}><Mascot cfg={x.cfg} state={x.state} size={44} /><span>{x.cfg.name}</span><span className="sub">{x.role}</span></button></Tip>
        ))}
        <button className="roster-item" onClick={() => go("bot-new")}><span className="roster-add"><Icon name="plus" /></span><span>{t("bots.page.new")}</span><span className="sub">{t("bots.page.bot")}</span></button>
      </div>
      {picked && <div className="banner info" key={picked.cfg.name} style={{ margin: "-8px 0 20px", animation: "rise 280ms var(--ease-out) both" }}>
        <Mascot cfg={picked.cfg} state={picked.state} size={22} /><span>{picked.cfg.name} · {picked.role}</span><span className="grow">{picked.doing}</span>
        <button className="btn secondary" style={{ height: 28 }} onClick={() => go("bot-roster")}>{t("bots.open")}</button><IconBtn icon="close" label={t("common.close")} onClick={() => setSel(null)} />
      </div>}
      <div className="bot-cols">
        <section>
          <h3 className="h3">{t("bots.page.activity")}</h3>
          <div className="list">{fx.feed.map(([ic, x, d, w], i) => (
            <div key={x} className="li" style={{ animation: "rise 420ms var(--ease-out) both", animationDelay: `${i * 50}ms` }}>
              <span className="li-ic"><Icon name={ic} /></span><span className="grow"><div className="ttl">{x}</div><div className="sub">{d}</div></span><span className="sub">{w}</span>
            </div>))}
          </div>
          <h3 className="h3">{t("bots.page.toApprove")}</h3>
          <div className="list">
            <div className="li"><span className="li-ic"><Icon name="mail" /></span><span className="grow"><div className="ttl">{fx.approve.t}</div><div className="sub">{fx.approve.d}</div></span>
              <button className="btn secondary" onClick={() => toast.add({ title: t("bots.page.toastDraft") })}>{t("bots.page.review")}</button><button className="btn primary" onClick={() => { setBusy("done"); setTimeout(() => setBusy("working"), 2200); toast.add({ title: t("bots.page.toastSent"), description: fx.approve.to, data: { undo: true, icon: "mail" } }); }}>{t("bots.page.send")}</button></div>
          </div>
        </section>
        <section>
          <h3 className="h3">{t("bots.page.routines")}</h3>
          <div className="list">
            {fx.routines.map(([k, x, d]) => (
              <label key={k} className="li"><span className="li-ic"><Icon name="clock-loop" /></span><span className="grow"><div className="ttl">{x}</div><div className="sub">{d}</div></span><Switch checked={r[k]} onCheckedChange={(v) => setR({ ...r, [k]: v })} aria-label={x} /></label>
            ))}
          </div>
          <h3 className="h3">{t("bots.page.memory")}</h3>
          <div className="list">
            {fx.memory.map((m) => (
              <div key={m} className="li"><span className="grow sub" style={{ color: "var(--t1)" }}>{m}</span><IconBtn icon="trash" label={t("bots.forget")} onClick={() => toast.add({ title: t("bots.toastForgotten"), data: { undo: true, icon: "trash" } })} /></div>
            ))}
          </div>
        </section>
      </div>
    </div>
    <div className="dock"><Composer placeholder={t("bots.page.ask", { name: bot.name })} onSend={(x) => { toast.add({ title: t("bots.page.toastAsked", { name: bot.name }), description: x, data: { icon: "check" } }); setBusy("listening", t("bots.preview.reading")); setTimeout(() => setBusy("thinking", t("bots.preview.planning")), 900); setTimeout(() => setBusy("working", x.length > 28 ? x.slice(0, 26) + "…" : x), 2600); }} /></div>
  </>);
}

const textOf = (m: MessageWithParts) => m.parts.map((p) => (p.type === "text" && !p.synthetic ? p.text : "")).join("").trim();

function BotPageLive() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const { bot, state: loadState, all } = useTargetBot();
  const sessions = useQuery(() => (bot ? api.bots.sessions(bot.id) : Promise.resolve([])), [bot?.id], (e) => e.type.startsWith("session."));
  const memory = useQuery(() => (bot ? api.bots.memory.list(bot.id) : Promise.resolve([])), [bot?.id]);
  const routines = useQuery(() => (bot ? api.tasks.list({ botID: bot.id }) : Promise.resolve([])), [bot?.id], (e) => e.type === "task.run");
  const perms = usePermissions();
  const statuses = useStatuses();
  const list = sessions.state === "ready" ? [...sessions.data].filter((s) => !s.parentID).sort((a, b) => b.time.updated - a.time.updated) : [];
  const [sid, setSid] = React.useState<string | undefined>();
  const current = sid ?? list[0]?.id;
  const { msgs, status } = useMessages(current);
  const myPerms = perms.state === "ready" ? perms.data.filter((p) => list.some((s) => s.id === p.sessionID)) : [];
  const live = stateOf(current ? statuses[current] ?? status : undefined, myPerms.length > 0);
  if (loadState === "loading") return null;
  if (!bot) return (<>
    <div className="content-top"><span className="title">{t("bots.new.yourBot")}</span></div>
    <div className="empty travail-empty"><Mascot cfg={{ name: "", ...DEFAULT_MASCOT }} state="idle" size={88} track interactive /><h2>{t("bots.page.noneTitle")}</h2><p>{t("bots.page.noneText")}</p><button className="btn primary" onClick={() => go("bot-new")}><Icon name="plus" size={16} />{t("bots.new.title")}</button></div>
  </>);
  const cfg = toConfig(bot);
  const send = async (x: string) => {
    try {
      const id = current ?? (await api.bots.createSession(bot.id, { title: x.slice(0, 80) })).id;
      if (!current) setSid(id);
      await api.sessions.prompt(id, { parts: [{ type: "text", text: x }] });
      return true;
    } catch { toast.add({ title: t("work.error.send"), data: { icon: "alert-triangle" } }); return false; }
  };
  const forget = (id: string) => api.bots.memory.delete(bot.id, id).then(() => { memory.reload(); toast.add({ title: t("bots.toastForgotten"), data: { icon: "trash" } }); }, () => {});
  const hint = STATES.find((s) => s.id === live)!.hint;
  const shown = msgs.filter((m) => textOf(m)).slice(-12);
  return (<>
    <div className="content-top">
      <span className="title">{bot.name}</span>
      <div className="spacer" /><button className="btn secondary" style={{ height: 28 }} onClick={() => go("bot-studio", { id: bot.id })}><Icon name="edit" size={16} />{t("bots.customize")}</button><IconBtn icon="settings" label={t("bots.settingsLabel")} onClick={() => go("bot-settings", { id: bot.id })} />
    </div>
    <div className="page">
      <div className="bot-hero">
        <Tip label={t(hint)}><button className="hero-mascot" onClick={() => go("bot-studio", { id: bot.id })} aria-label={t("bots.customizeName", { name: bot.name })}><Mascot cfg={cfg} state={live} size={72} track /></button></Tip>
        <div><div className="page-title" style={{ margin: 0 }}>{bot.name}</div><div style={{ color: "var(--t2)", fontSize: 13 }}>{t(hint)}</div></div>
      </div>
      {all.length > 1 && <>
        <h3 className="h3">{t("bots.page.team")}</h3>
        <div className="roster">
          {all.map((b) => <button key={b.id} className="roster-item" data-on={b.id === bot.id || undefined} onClick={() => go("bot", { id: b.id })}><Mascot cfg={toConfig(b)} state="idle" size={44} /><span>{b.name}</span></button>)}
          <button className="roster-item" onClick={() => go("bot-new")}><span className="roster-add"><Icon name="plus" /></span><span>{t("bots.page.new")}</span><span className="sub">{t("bots.page.bot")}</span></button>
        </div>
      </>}
      <div className="bot-cols">
        <section>
          <h3 className="h3">{t("bots.page.activity")}</h3>
          {shown.length ? <div className="thread-inner" style={{ gap: 12, marginBottom: 24 }} aria-live="polite">
            {shown.map((m) => m.info.role === "user" ? <div key={m.info.id} className="msg-user">{textOf(m)}</div>
              : <div key={m.info.id} className="msg-bot-row"><Mascot cfg={cfg} state="idle" size={24} /><div className="msg-bot">{textOf(m)}</div></div>)}
          </div> : <div className="list"><div className="li"><span className="grow sub">{t("bots.page.noActivity", { name: bot.name })}</span></div></div>}
          {myPerms.length > 0 && <>
            <h3 className="h3">{t("bots.page.toApprove")}</h3>
            <div className="list">{myPerms.map((p) => (
              <div key={p.id} className="li"><span className="li-ic"><Icon name="shield-check" /></span><span className="grow"><div className="ttl">{toolName(t, p.tool)}</div><div className="sub">{p.input}</div></span>
                <button className="btn secondary" data-testid="approval-deny" onClick={() => api.permissions.reply(p.id, "reject").then(perms.reload, () => {})}>{t("work.appr.deny")}</button>
                <button className="btn primary" data-testid="approval-allow" onClick={() => api.permissions.reply(p.id, "once").then(perms.reload, () => {})}>{t("work.appr.approve")}</button></div>))}
            </div>
          </>}
        </section>
        <section>
          <h3 className="h3">{t("bots.page.routines")}</h3>
          <div className="list">
            {routines.state === "ready" && routines.data.length ? routines.data.map((x) => (
              <label key={x.id} className="li"><span className="li-ic"><Icon name="clock-loop" /></span><span className="grow"><div className="ttl">{x.title}</div><div className="sub">{x.prompt}</div></span><Switch checked={x.enabled} onCheckedChange={(v) => api.tasks.update(x.id, { enabled: v }).then(routines.reload, () => {})} aria-label={x.title} /></label>
            )) : <button className="li travail-li" onClick={() => go("automation-edit")}><span className="li-ic"><Icon name="plus" /></span><span className="grow sub">{t("work.routines.create")}</span></button>}
          </div>
          <h3 className="h3">{t("bots.page.memory")}</h3>
          <div className="list">
            {memory.state === "ready" && memory.data.length ? memory.data.map((m) => (
              <div key={m.id} className="li"><span className="grow sub" style={{ color: "var(--t1)" }}>{m.content}</span><IconBtn icon="trash" label={t("bots.forget")} onClick={() => forget(m.id)} /></div>
            )) : <div className="li"><span className="grow sub">{t("bots.set.memEmptyText", { name: bot.name })}</span></div>}
          </div>
        </section>
      </div>
    </div>
    <div className="dock" data-testid="bot-composer-input"><Composer placeholder={t("bots.page.ask", { name: bot.name })} onSend={send} /></div>
  </>);
}

/* ====================================================================== */
/* Bot appearance studio                                                  */
/* ====================================================================== */
export function BotStudio() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const preview = isPreview();
  const previewBot = usePreviewBot();
  const { bot: live, reload } = useTargetBot();
  const base: MascotConfig = previewBot?.cfg ?? (live && !preview ? toConfig(live) : { name: "", ...DEFAULT_MASCOT });
  const [saved, setSaved] = React.useState<MascotConfig>(base);
  const [cfg, setCfg] = React.useState<MascotConfig>(previewBot?.draft ?? base);
  React.useEffect(() => { if (live && !preview) { const c = toConfig(live); setSaved(c); setCfg(c); } }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [past, setPast] = React.useState<MascotConfig[]>([]);
  const [tab, setTab] = React.useState("shape");
  const [state, setState] = React.useState<State>("idle");
  const [demo, setDemo] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const saving = React.useRef(false);
  const set = (p: Partial<MascotConfig>) => { setPast((h) => [...h.slice(-30), cfg]); setCfg({ ...cfg, ...p }); };
  const undo = () => { const h = [...past]; const prev = h.pop(); if (prev) { setPast(h); setCfg(prev); } };
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const valid = !!cfg.name.trim();
  const setDraft = previewBot?.setDraft;
  React.useEffect(() => { setDraft?.(dirty ? cfg : null); }, [cfg, dirty, setDraft]);
  // Leaving with unsaved changes asks first.
  const [leaving, setLeaving] = React.useState(false);
  const back = () => go("bot", live && !preview ? { id: live.id } : undefined);
  const doSave = async (): Promise<boolean> => {
    if (saving.current || !valid) return false;
    const n = { ...cfg, name: cfg.name.trim() };
    saving.current = true; setBusy(true);
    try {
      if (preview) {
        if (!previewBot) return false;
        previewBot.save(n);
      } else {
        if (!live) { toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } }); return false; }
        await api.bots.update(live.id, { name: n.name, mascot: toMascot(n) }); reload();
      }
      setSaved(n); setCfg(n); toast.add({ title: t("bots.studio.toastSaved"), description: t("bots.studio.toastSavedDesc", { name: n.name }), data: { icon: "check" } });
      return true;
    } catch {
      toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } });
      return false;
    } finally { saving.current = false; setBusy(false); }
  };

  // Demo: runs through a task's lifecycle (received → thinking → working → waiting → done).
  React.useEffect(() => {
    if (!demo) return;
    const seq: [State, number][] = [["listening", 1400], ["thinking", 2000], ["working", 2600], ["waiting", 1800], ["working", 1600], ["done", 1800], ["idle", 1200]];
    let i = 0, id: number;
    const step = () => { const [s, d] = seq[i % seq.length]; setState(s); i++; id = window.setTimeout(step, d); };
    step(); return () => clearTimeout(id);
  }, [demo]);
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return; // native ⌘Z in fields
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") { e.preventDefault(); if (!saving.current) undo(); }
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  const random = () => set({
    shape: pick(SHAPE_LIST), color: pick(COLORS)[1], eyes: pick(EYES), mouth: Math.random() < .6 ? "none" : pick(MOUTHS),
    glasses: Math.random() < .4 ? pick(ACCESSORIES.filter((a) => a.slot === "glasses"))?.id : undefined,
    hat: Math.random() < .5 ? pick(ACCESSORIES.filter((a) => a.slot === "hat"))?.id : undefined,
    extra: Math.random() < .3 ? pick(ACCESSORIES.filter((a) => a.slot === "extra"))?.id : undefined,
    symbol: Math.random() < .3 ? pick(SYMBOLS) : undefined,
  });
  const cur = STATES.find((s) => s.id === state)!;
  const tabLabel = (x: string) => t(`bots.studio.tab.${x}`);

  return (<>
    <div className="content-top">
      <IconBtn icon="arrow-left" label={t("bots.studio.back")} disabled={busy} onClick={() => (dirty ? setLeaving(true) : back())} />
      <span className="title">{t("bots.studio.title", { name: cfg.name })}</span>
      <div className="spacer" />
      <IconBtn icon="refresh" label={t("bots.studio.undo")} kbd="⌘Z" disabled={!past.length || busy} onClick={undo} />
      <button className="btn secondary" style={{ height: 28 }} disabled={busy} onClick={random}><Icon name="sparkle-free" size={16} />{t("bots.studio.random")}</button>
      <button className="btn primary" style={{ height: 28 }} data-testid="bot-studio-save" disabled={!dirty || !valid || busy} onClick={doSave}>{t("common.save")}</button>
      <AlertDialog.Root open={leaving} onOpenChange={(open) => { if (!saving.current) setLeaving(open); }}>
        <AlertDialog.Portal><AlertDialog.Backdrop className="backdrop" /><AlertDialog.Popup className="dialog" aria-busy={busy || undefined}>
          <AlertDialog.Title render={<h2 />}>{t("bots.studio.leaveTitle")}</AlertDialog.Title>
          <AlertDialog.Description render={<p />}>{t("bots.studio.leaveText", { name: cfg.name || t("bots.new.yourBot") })}</AlertDialog.Description>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <AlertDialog.Close className="btn secondary" disabled={busy}>{t("common.cancel")}</AlertDialog.Close>
            <button className="btn secondary" disabled={busy} onClick={() => { setCfg(saved); setDraft?.(null); setLeaving(false); back(); }}>{t("bots.studio.leaveDiscard")}</button>
            <button className="btn primary" disabled={!valid || busy} onClick={async () => { if (await doSave()) { setLeaving(false); back(); } }}>{t("common.save")}</button>
          </div>
        </AlertDialog.Popup></AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
    <div className="studio">
      <section className="stage">
        <div className="stage-canvas" data-demo={demo || undefined}>
          <Mascot cfg={cfg} state={state} size={220} track interactive />
          <div className="stage-caption" key={state}><b>{t(cur.label)}</b><span>{t(cur.hint)}</span></div>
        </div>
        <div className="stage-sizes" aria-label={t("bots.studio.sizes")}>
          {[64, 32, 20].map((s) => <div key={s} className="size-cell"><Mascot cfg={cfg} state={state} size={s} /><span>{s}</span></div>)}
          <div className="size-cell row-demo"><Mascot cfg={cfg} state={state} size={18} /><span className="label">{cfg.name}</span></div>
        </div>
        <div className="states" role="radiogroup" aria-label={t("bots.studio.states")}>
          {STATES.map((s) => (
            <Tip key={s.id} label={t(s.hint)}><button role="radio" aria-checked={state === s.id} className="state-chip" data-on={state === s.id || undefined} onClick={() => { setDemo(false); setState(s.id); }}>
              <Mascot cfg={cfg} state={s.id} size={22} />{t(s.label)}
            </button></Tip>
          ))}
          <button className="state-chip" data-on={demo || undefined} onClick={() => setDemo(!demo)}><Icon name={demo ? "pause" : "play"} size={16} />{demo ? t("bots.studio.stop") : t("bots.studio.cycle")}</button>
        </div>
      </section>
      <section className="editor" inert={busy}>
        <div className="field"><label htmlFor="bname">{t("bots.studio.name")}</label><input id="bname" className="input" aria-invalid={!valid} disabled={busy} value={cfg.name} maxLength={20} onChange={(e) => setCfg({ ...cfg, name: e.target.value })} /></div>
        <Segmented items={TABS.map(tabLabel)} value={tabLabel(tab)} onChange={(x) => setTab(TABS.find((y) => tabLabel(y) === x) ?? "shape")} />
        <div className="ed-panel" key={tab}>
          {tab === "shape" && <>
            <div className="ed-label">{t("bots.studio.silhouette")}</div>
            <div className="swatches big">{SHAPE_LIST.map((s) => (
              <button key={s} className="sw" aria-label={t(`bots.shape.${s}`)} aria-pressed={cfg.shape === s} data-on={cfg.shape === s || undefined} onClick={() => set({ shape: s })}>
                <Mascot cfg={{ ...cfg, shape: s, glasses: undefined, hat: undefined, extra: undefined, symbol: undefined }} size={44} /><span>{t(`bots.shape.${s}`)}</span>
              </button>))}
            </div>
            <div className="ed-label">{t("bots.studio.color")}</div>
            <div className="colors">{COLORS.map(([n, c]) => (
              <Tip key={c} label={t(`bots.color.${n}`)}><button className="color" aria-label={t(`bots.color.${n}`)} aria-pressed={cfg.color === c} data-on={cfg.color === c || undefined} style={{ background: c }} onClick={() => set({ color: c })} /></Tip>))}
              <label className="color custom" aria-label={t("bots.studio.customColor")}><Icon name="plus" size={16} /><input type="color" value={cfg.color} onChange={(e) => set({ color: e.target.value.toUpperCase() })} /></label>
            </div>
          </>}
          {tab === "face" && <>
            <div className="ed-label">{t("bots.studio.eyes")}</div>
            <div className="swatches">{EYES.map((e) => (
              <button key={e} className="sw" aria-pressed={cfg.eyes === e} data-on={cfg.eyes === e || undefined} onClick={() => set({ eyes: e })}><Mascot cfg={{ ...cfg, eyes: e, glasses: undefined, hat: undefined }} size={44} /><span>{t(`bots.eyes.${e}`)}</span></button>))}
            </div>
            <div className="ed-label">{t("bots.studio.mouth")}</div>
            <div className="swatches">{MOUTHS.map((m) => (
              <button key={m} className="sw" aria-pressed={cfg.mouth === m} data-on={cfg.mouth === m || undefined} onClick={() => set({ mouth: m })}><Mascot cfg={{ ...cfg, mouth: m, glasses: undefined, hat: undefined }} size={44} /><span>{t(`bots.mouth.${m}`)}</span></button>))}
            </div>
          </>}
          {tab === "accessories" && SLOTS.map((slot) => (
            <React.Fragment key={slot}>
              <div className="ed-label">{t(SLOT_LABEL[slot])}</div>
              <div className="swatches">
                <button className="sw" aria-pressed={!cfg[slot]} data-on={!cfg[slot] || undefined} onClick={() => set({ [slot]: undefined })}><span className="sw-none"><Icon name="close" /></span><span>{t("bots.studio.none")}</span></button>
                {ACCESSORIES.filter((a) => a.slot === slot).map((a) => (
                  <button key={a.id} className="sw" aria-pressed={cfg[slot] === a.id} data-on={cfg[slot] === a.id || undefined} onClick={() => set({ [slot]: a.id })}>
                    <Mascot cfg={{ ...cfg, glasses: undefined, hat: undefined, extra: undefined, symbol: undefined, [slot]: a.id }} size={44} /><span>{t(a.label)}</span>
                  </button>))}
              </div>
            </React.Fragment>))}
          {tab === "symbol" && <>
            <div className="ed-label">{t("bots.studio.symbolLabel")} <span className="sub">{t("bots.studio.symbolHint")}</span></div>
            <div className="symbols">
              <button className="sym" aria-label={t("bots.studio.noSymbol")} aria-pressed={!cfg.symbol} data-on={!cfg.symbol || undefined} onClick={() => set({ symbol: undefined })}><Icon name="close" /></button>
              {SYMBOLS.map((s) => <button key={s} className="sym" aria-label={t(`bots.symbol.${s}`)} aria-pressed={cfg.symbol === s} data-on={cfg.symbol === s || undefined} onClick={() => set({ symbol: s })}><Icon name={s} size={18} /></button>)}
            </div>
          </>}
        </div>
      </section>
    </div>
  </>);
}
