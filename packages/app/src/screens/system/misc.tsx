// Shortcuts, offline, errors, update and about.
import * as React from "react";
import { Icon, IconBtn, Switch, useToast } from "../../kit/ui";
import { Mascot, type State } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { api, platform } from "../../api";
import type { UpdateState } from "@cortex/schema";
import { Top, Keys, Hl, useFx, useBotCfg, css, norm, NB } from "./common";

/* ---------- Keyboard shortcuts (shared with Settings → Shortcuts) ---------- */
export const SHORTCUTS: [string, [string, string[]][]][] = [
  ["general", [["palette", ["⌘", "K"]], ["search", ["⌘", "⇧", "F"]], ["settings", ["⌘", ","]], ["shortcuts", ["⌘", "/"]], ["focus", ["⌘", "\\"]], ["sidebar", ["⌘", "B"]]]],
  ["chat", [["newChat", ["⌘", "N"]], ["send", ["↵"]], ["newline", ["⇧", "↵"]], ["stop", ["esc"]], ["copyLast", ["⌘", "⇧", "C"]], ["voice", ["⌘", "⇧", "V"]]]],
  ["navigation", [["prev", ["⌘", "["]], ["next", ["⌘", "]"]], ["home", ["⌘", "1"]], ["library", ["⌘", "2"]], ["history", ["⌘", "3"]], ["bot", ["⌘", "4"]]]],
  ["files", [["upload", ["⌘", "U"]], ["newProject", ["⌘", "⇧", "N"]], ["rename", ["F2"]], ["delete", ["⌘", "del"]]]],
  ["bot", [["ask", ["⌘", "J"]], ["pause", ["⌘", "⇧", "P"]], ["approve", ["⌘", "↵"]]]],
  ["code", [["newTask", ["⌘", "N"]], ["terminal", ["⌃", "`"]], ["changes", ["⌘", "⇧", "D"]], ["acceptDiff", ["⌘", "⇧", "↵"]]]],
];
const keyCap = (t: (k: string) => string, k: string) => (k === "esc" || k === "del" ? t(`system.key.${k}`) : k);

export function ShortcutsScreen() {
  const t = useT();
  const [q, setQ] = React.useState("");
  const groups = SHORTCUTS.map(([g, xs]) => [g, xs.map(([l, k]) => [t(`system.sc.${l}`), k] as const).filter(([l]) => norm(l).includes(norm(q)))] as const).filter(([, xs]) => xs.length);
  return (<>
    <Top title={t("system.cmd.shortcuts")}><label className="pg-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("system.shortcuts.search")} aria-label={t("system.shortcuts.search")} /></label></Top>
    <div className="page"><div className="systeme-mid">
      {groups.length ? <div className="systeme-kgrid">{groups.map(([g, xs], i) => (
        <section key={g} className="systeme-rise" style={css(i)}><h3 className="h3">{t(`system.sc.group.${g}`)}</h3>
          <div className="list">{xs.map(([l, k]) => <div key={l} className="li"><span className="grow"><Hl text={l} q={q} /></span><Keys k={k.map((x) => keyCap(t, x))} /></div>)}</div></section>))}</div>
        : <div className="pg-empty">{t("system.shortcuts.none", { q: `${NB}${q}${NB}` })}</div>}
    </div></div>
  </>);
}

/* ---------- Offline ---------- */
export function OfflineScreen() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fx = useFx();
  const preview = isPreview();
  const [v, setV] = useVariant("offline");
  const [sec, setSec] = React.useState(12);
  const s = v === "reconnecting" ? "retry" : v === "restored" ? "ok" : "off";
  // Live: retrying probes the engine; it lands on restored or back on offline.
  const retry = () => {
    setV("reconnecting");
    if (!preview) api.health().then(() => navigator.onLine ? setV("restored") : setV("offline"), () => setV("offline"));
  };
  React.useEffect(() => {
    if (s !== "off") return;
    setSec(12);
    const tm = setInterval(() => setSec((x) => { if (x > 1) return x - 1; if (!preview) retry(); return 12; }), 1000);
    return () => clearInterval(tm);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!preview || s !== "retry") return;
    const tm = setTimeout(() => setV("restored"), 2400);
    return () => clearTimeout(tm);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const queue = preview ? fx.offline.queue : [];
  return (<>
    <Top title={preview ? fx.offline.title : t("system.offline.title")}>{preview && <span className="systeme-stale"><Icon name="clock-loop" size={12} />{s === "ok" ? t("system.offline.upToDate") : t("system.offline.lastSync", { time: fx.offline.lastSync })}</span>}</Top>
    <div className="systeme-offbar" data-s={s} role="status" aria-live="polite" key={s}>
      {s === "off" && <><Icon name="globe" /><span>{t("system.offline.title")}</span><span className="systeme-grow">{t("system.offline.offText", { sec, nb: NB })}</span><button className="btn secondary" onClick={retry}>{t("system.common.retry")}</button></>}
      {s === "retry" && <><span className="spin" style={{ color: "var(--blue)" }} /><span>{t("system.offline.reconnecting")}</span><span className="systeme-grow">{t("system.offline.retryText", { count: queue.length })}</span></>}
      {s === "ok" && <><Icon name="check-circle" /><span>{t("system.offline.restored")}</span><span className="systeme-grow">{t("system.offline.okText", { count: queue.length })}</span><IconBtn icon="close" label={t("system.hide")} onClick={() => toast.add({ title: t("system.offline.synced"), data: { icon: "check-circle" } })} /></>}
    </div>
    <div className="page"><div className="systeme-narrow">
      {preview && <div className={s === "ok" ? undefined : "systeme-read"}>
        <div className="msg-user" style={{ marginLeft: "auto", width: "fit-content" }}>{fx.offline.user}</div>
        <div className="msg-bot" style={{ marginTop: 16 }}><p>{fx.offline.bot}</p></div>
      </div>}
      {queue.length > 0 && <>
        <h3 className="h3" style={{ marginTop: 28 }}>{s === "ok" ? t("system.offline.sent", { n: queue.length }) : t("system.offline.pending", { n: queue.length })}</h3>
        <div className="list systeme-queue">{queue.map(([ic, ti, d], i) => (
          <div key={ti} className="li systeme-rise" style={css(i)}><span className="li-ic"><Icon name={ic} /></span><span className="grow"><div className="ttl">{ti}</div><div className="sub">{d}</div></span>
            {s === "off" ? <span className="badge wait"><Icon name="clock-loop" size={12} />{t("system.offline.waiting")}</span> : s === "retry" ? <span className="badge run"><span className="spin" />{t("system.offline.sending")}</span> : <span className="badge ok"><Icon name="check" size={12} />{t("system.offline.sentBadge")}</span>}</div>))}</div>
      </>}
      {s !== "ok" && <p style={{ color: "var(--t2)", marginTop: 12 }}>{t("system.offline.resumes")}</p>}
      {s === "ok" && <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => go(preview ? "chat" : "home")}>{t("system.offline.resume")}</button>}
    </div></div>
  </>);
}

/* ---------- Errors ---------- */
export function ErrorScreen() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fx = useFx();
  const bot = useBotCfg();
  const preview = isPreview();
  const e0 = fx.error ?? { ref: "", project: "", owner: "", idle: "", start: "", end: "", paused: 0, back: "" };
  const [v] = useVariant("500");
  const [busy, setBusy] = React.useState(false);
  const retry = () => {
    setBusy(true);
    const fail = () => { setBusy(false); toast.add({ title: t("system.error.stillDown"), description: t("system.error.stillDownDesc"), data: { icon: "alert-triangle" } }); };
    if (preview) setTimeout(fail, 1200); else api.health().then(() => { setBusy(false); go("home"); }, fail);
  };
  const E: Record<string, { st: State; title: string; body: string; code?: string; act: React.ReactNode; extra?: React.ReactNode }> = {
    "500": { st: "blocked", title: t("system.error.500.title"), body: t("system.error.500.body"), code: preview ? t("system.error.500.code", { ref: e0.ref }) : t("system.error.500.codeLive"),
      act: <><button className="btn primary" disabled={busy} onClick={retry}>{busy ? <><span className="spin" />{t("system.error.retrying")}</> : <><Icon name="refresh" />{t("system.common.retry")}</>}</button><button className="btn secondary" onClick={() => go("about")}>{t("system.error.status")}</button></> },
    maintenance: { st: "asleep", title: t("system.error.maintenance.title"), body: t("system.error.maintenance.body", { name: bot.name }), code: preview ? t("system.error.maintenance.code", { time: e0.back }) : undefined,
      extra: preview ? <div className="systeme-sched"><div><span>{t("system.error.start")}</span><b style={{ fontWeight: 500 }}>{e0.start}</b></div><div><span>{t("system.error.end")}</span><b style={{ fontWeight: 500 }}>{e0.end}</b></div><div><span>{t("system.error.paused")}</span><b style={{ fontWeight: 500 }}>{e0.paused}</b></div></div> : undefined,
      act: <><button className="btn primary" onClick={() => toast.add({ title: t("system.error.noted"), description: t("system.error.notedDesc"), data: { icon: "bell" } })}><Icon name="bell" />{t("system.error.notify")}</button><button className="btn secondary" onClick={() => go("offline")}>{t("system.error.readOffline")}</button></> },
    session: { st: "waiting", title: t("system.error.session.title"), body: t("system.error.session.body"), code: preview ? e0.idle : undefined,
      act: <button className="btn primary" onClick={() => go("login")}>{t("system.error.signInAgain")}</button> },
    "403": { st: "blocked", title: t("system.error.403.title"), body: preview ? t("system.error.403.body", { project: e0.project, owner: e0.owner }) : t("system.error.403.bodyLive"), code: t("system.error.403.code"),
      act: <>{preview && <button className="btn primary" onClick={() => toast.add({ title: t("system.error.requestSent"), description: t("system.error.requestSentDesc", { owner: e0.owner }), data: { icon: "mail" } })}>{t("system.error.requestAccess")}</button>}<button className="btn secondary" onClick={() => go("projects")}>{t("system.project.myProjects")}</button></> },
  };
  const e = E[v] ?? E["500"];
  return (<>
    <div className="content-top"><div className="spacer" /><IconBtn icon="close" label={t("system.common.close")} onClick={() => go("home")} /></div>
    <div className="empty" key={v} style={{ paddingBottom: 96 }}>
      <Mascot cfg={bot} state={e.st} size={104} interactive />
      <h2 style={{ fontSize: 20, lineHeight: "26px" }}>{e.title}</h2>
      <p>{e.body}</p>
      {e.extra}
      <div className="systeme-err-actions">{e.act}</div>
      {e.code && <div className="systeme-code">{e.code}</div>}
    </div>
  </>);
}

/* ---------- Update ---------- */
export function UpdateScreen() {
  const t = useT();
  const toast = useToast();
  const fx = useFx();
  const preview = isPreview();
  const [v, setV] = useVariant("available");
  const [p, setP] = React.useState(v === "downloading" ? 18 : v === "ready" ? 100 : 0);
  React.useEffect(() => { setP(v === "downloading" ? 18 : v === "ready" ? 100 : 0); }, [v]);
  React.useEffect(() => {
    if (v !== "downloading") return;
    const tm = setInterval(() => setP((x) => { if (x >= 100) { clearInterval(tm); setV("ready"); return 100; } return Math.min(100, x + 4); }), 220);
    return () => clearInterval(tm);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!preview) return <UpdateLive />;
  const u = fx.update;
  const mb = (u.size * p) / 100;
  return (<>
    <Top title={t("system.update.title")} />
    <div className="page"><div className="systeme-center" style={{ justifyContent: "flex-start", paddingTop: 24 }}><div className="systeme-upd">
      <div className="systeme-card">
        <div className="systeme-upd-head">
          <span className="systeme-logo" aria-hidden />
          <span className="systeme-grow"><b>{t("system.update.name", { v: u.version })}</b><span>{v === "ready" ? t("system.update.ready") : v === "downloading" ? t("system.update.downloading") : t("system.update.available", { current: u.current })}</span></span>
          {v === "available" && <button className="btn primary" onClick={() => setV("downloading")}><Icon name="download" />{t("system.update.download")}</button>}
          {v === "downloading" && <button className="btn secondary" onClick={() => setV("available")}>{t("system.common.cancel")}</button>}
          {v === "ready" && <button className="btn primary" onClick={() => toast.add({ title: t("system.update.restarting"), description: t("system.update.restartingDesc"), data: { icon: "refresh" } })}><Icon name="refresh" />{t("system.update.restart")}</button>}
        </div>
        {v !== "available" && <div style={{ marginTop: 16 }}>
          <div className="systeme-track" role="progressbar" aria-label={t("system.update.progressLabel", { v: u.version })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}>
            <div className="systeme-bar" data-complete={p >= 100 || undefined} style={{ ["--p" as string]: `${p}%` }} /></div>
          <div className="systeme-prog-meta"><span>{p >= 100 ? t("system.update.doneSize", { size: u.size }) : t("system.update.progress", { done: mb.toFixed(0), size: u.size, pct: Math.round(p), nb: NB })}</span><span>{p >= 100 ? t("system.update.restartWhenever") : t("system.update.left", { s: Math.max(1, Math.round((100 - p) / 18)) })}</span></div>
        </div>}
        {v === "ready" && <label className="systeme-row" style={{ padding: 0, marginTop: 12 }}><span className="systeme-grow" style={{ color: "var(--t2)" }}>{t("system.update.onQuit")}</span><Switch defaultChecked aria-label={t("system.update.onQuitLabel")} /></label>}
      </div>
      <div className="systeme-card">
        <h3 className="h3">{t("system.update.whatsNew", { v: u.version })}</h3>
        <ul className="systeme-notes">{u.notes.map(([b, l, x], i) => <li key={x} className="systeme-rise" style={css(i)}><span className={"badge " + b}>{t(`system.update.tag.${l}`)}</span><span>{x}</span></li>)}</ul>
      </div>
      <label className="systeme-row" style={{ padding: "0 4px" }}><span className="systeme-grow" style={{ color: "var(--t2)" }}>{t("system.update.auto")}</span><Switch defaultChecked aria-label={t("system.update.autoLabel")} /></label>
    </div></div></div>
  </>);
}

function UpdateLive() {
  const t = useT();
  const bridge = window.cortex?.update;
  const [s, setS] = React.useState<UpdateState | null>(null);
  React.useEffect(() => {
    if (!bridge) return;
    let live = true;
    const off = bridge.onState((x) => { if (live) setS(x); });
    void bridge.status().then((x) => { if (live) setS((cur) => cur ?? x); });
    return () => { live = false; off(); };
  }, [bridge]);
  const version = s?.current ?? window.cortex?.appVersion ?? "—";
  const busy = s?.state === "checking" || s?.state === "available" || s?.state === "downloading";
  const line = !s ? t("system.update.installed") : s.state === "checking" ? t("system.update.checking") : s.state === "up-to-date" ? t("system.update.upToDate")
    : s.state === "available" || s.state === "downloading" ? t("system.update.downloadingBackground") : s.state === "ready" ? t("system.update.readyVersion", { v: s.version || "—" })
    : s.state === "error" ? t(`system.update.error.${s.code}`) : t("system.update.installed");
  return (<>
    <Top title={t("system.update.title")} />
    <div className="page"><div className="systeme-center" style={{ justifyContent: "flex-start", paddingTop: 24 }}><div className="systeme-upd">
      <div className="systeme-card" data-testid="update-card" data-state={s?.state ?? "unknown"}>
        <div className="systeme-upd-head"><span className="systeme-logo" aria-hidden />
          <span className="systeme-grow"><b data-testid="update-version">{t("system.update.name", { v: version })}</b><span role={s?.state === "error" ? "alert" : "status"} data-testid="update-line">{line}</span></span>
          {bridge && s?.state === "ready" && <button className="btn primary" data-testid="update-install" onClick={() => void bridge.install()}><Icon name="refresh" />{t("system.update.restart")}</button>}
          {bridge && s?.state !== "ready" && <button className="btn secondary" data-testid="update-check" disabled={busy} onClick={() => void bridge.check().then(setS)}><Icon name="refresh" />{t("system.update.check")}</button>}
        </div>
        {busy && <div style={{ marginTop: 16 }}><div className="systeme-track" role="progressbar" aria-label={t("system.update.checking")} aria-busy><div className="systeme-bar systeme-bar-indeterminate" /></div></div>}
      </div>
    </div></div></div>
  </>);
}

/* ---------- About ---------- */
const LICENSES: [string, string][] = [["react", "mit"], ["baseui", "mit"], ["geist", "ofl"], ["vite", "mit"], ["illustrations", "studio"]];
// Public pages are hosted by the web app (Todo 7); the desktop opens them in the system browser (main allows https only).
// ponytail: production hosts; a self-hosted origin's public pages need a configured site origin.
const PUBLIC_WEB: [string, string, string][] = [
  ["code", "https://app.cortex.foundation/code", "code"], ["bot", "https://app.cortex.foundation/bot", "bot"],
  ["foundation", "https://cortex.foundation/foundation", "info"], ["research", "https://cortex.foundation/research", "file"],
  ["news", "https://cortex.foundation/news", "bell"], ["legal", "https://cortex.foundation/legal", "shield-check"], ["status", "https://cortex.foundation/status", "globe"],
];
export function AboutScreen() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fx = useFx();
  const bot = useBotCfg();
  const preview = isPreview();
  const info = preview ? t("system.about.versionLine", { v: fx.about.version, build: fx.about.build, os: fx.about.os })
    : t("system.about.versionLive", { v: window.cortex?.appVersion ?? "—", os: t(`system.os.${["darwin", "win32", "linux"].includes(platform()) ? platform() : "web"}`) });
  return (<>
    <Top title={t("system.about.title")} />
    <div className="page"><div className="systeme-narrow" style={{ maxWidth: 560 }}>
      <div className="systeme-about systeme-rise">
        <span className="systeme-logo" aria-hidden />
        <h1>{t("system.brand")}</h1>
        <div className="sub">{info}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn secondary" onClick={() => go("update")}><Icon name="refresh" />{t("system.about.checkUpdate")}</button>
          <IconBtn icon="copy" label={t("system.about.copyInfo")} onClick={() => { navigator.clipboard?.writeText(info).catch(() => {}); toast.add({ title: t("system.about.copied"), data: { icon: "copy" } }); }} />
        </div>
      </div>
      <h3 className="h3">{t("system.about.help")}</h3>
      <div className="list">
        {([["info", "center"], ["command", "shortcuts", "shortcuts"], ["globe", "status"], ["mail", "support"]] as const).map(([ic, k, to]) => (
          <button key={k} className="li" style={{ width: "100%", textAlign: "left" }} onClick={() => to && go(to)}><span className="li-ic"><Icon name={ic} /></span><span className="grow"><div className="ttl">{t(`system.about.${k}.title`)}</div><div className="sub">{t(`system.about.${k}.desc`)}</div></span><Icon name="chevron-right" size={16} /></button>))}
      </div>
      <h3 className="h3">{t("extras.web.title")}</h3>
      <div className="list">
        {PUBLIC_WEB.map(([k, url, ic]) => (
          <button key={k} className="li" data-testid={`public-web-${k}`} style={{ width: "100%", textAlign: "left" }} onClick={() => window.cortex?.openExternal?.(url)}><span className="li-ic"><Icon name={ic} /></span><span className="grow"><div className="ttl">{t(`extras.web.${k}`)}</div><div className="sub">{t(`extras.web.${k}Desc`)}</div></span><span className="sub">{t("extras.web.opens")}</span></button>))}
      </div>
      <h3 className="h3">{t("system.about.report")}</h3>
      <div className="list">
        <div className="li"><span className="li-ic"><Icon name="bug" /></span><span className="grow"><div className="ttl">{t("system.about.bug")}</div><div className="sub">{t("system.about.bugDesc")}</div></span><button className="btn secondary" onClick={() => toast.add({ title: t("system.about.sent"), description: preview ? t("system.about.sentDesc", { ref: fx.about.ref }) : undefined, data: { icon: "check-circle" } })}>{t("system.about.reportBtn")}</button></div>
        <div className="li"><span className="li-ic"><Mascot cfg={bot} size={20} /></span><span className="grow"><div className="ttl">{t("system.about.idea")}</div><div className="sub">{t("system.about.ideaDesc", { name: bot.name })}</div></span><button className="btn secondary">{t("system.about.write")}</button></div>
      </div>
      <h3 className="h3">{t("system.about.licenses")}</h3>
      <div className="list">{LICENSES.map(([n, l]) => <div key={n} className="li" style={{ padding: "0 14px", height: 40 }}><span className="grow">{t(`system.about.lib.${n}`)}</span><span className="mono" style={{ color: "var(--t2)" }}>{t(`system.about.lic.${l}`)}</span></div>)}</div>
      <p style={{ color: "var(--t2)", fontSize: 11, textAlign: "center", marginTop: 20 }}>{t("system.about.footer")}</p>
    </div></div>
  </>);
}
