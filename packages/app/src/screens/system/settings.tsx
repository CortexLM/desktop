// Settings: design sections plus Providers and Connection (built from the same primitives).
import * as React from "react";
import { LOCALES, type Locale } from "@cortex/i18n";
import type { ModelInfo, ProviderConfig, ConnectionProbe } from "@cortex/schema";
import { Icon, Gel, Switch, Pop, MItem, useToast } from "../../kit/ui";
import { useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT, useI18n } from "../../i18n";
import { isPreview } from "../../preview";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useFx, useBotCfg, norm, setTheme, currentThemePref, NB } from "./common";
import type { ModelFx, ProviderFx } from "./fixtures";

type Pref = "system" | "light" | "dark";
// [section id, gel icon]
const SECTIONS: [string, string][] = [
  ["general", "general"], ["appearance", "apparence"], ["bot", "bot"], ["notifications", "notifications"],
  ["privacy", "confidentialite"], ["shortcuts", "raccourcis"], ["account", "compte"], ["providers", "modeles"], ["connection", "extensions"],
];
const TOGGLES: Record<string, [string, boolean][]> = {
  general: [["launch", true], ["enter", true], ["suggestions", false]],
  bot: [["background", true], ["askFirst", true], ["digest", false]],
  notifications: [["taskDone", true], ["decisions", true], ["sound", false], ["weekly", false]],
  privacy: [["improve", false], ["memory", true], ["temporary", false]],
  appearance: [["reduceMotion", false], ["compact", false]],
};
const SETTINGS_KEYS: [string, string[]][] = [["search", ["⌘", "K"]], ["newChat", ["⌘", "N"]], ["sidebar", ["⌘", "B"]], ["focus", ["⌘", "\\"]], ["settings", ["⌘", ","]]];

/** Local UI preference persisted per device (never in preview). */
function usePref(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const k = `cortex.pref.${key}`;
  const [v, set] = React.useState(() => (isPreview() ? def : (localStorage.getItem(k) ?? String(def)) === "true"));
  return [v, (x) => { set(x); if (!isPreview()) localStorage.setItem(k, String(x)); }];
}

function Toggle({ sec, id, def }: { sec: string; id: string; def: boolean }) {
  const t = useT();
  const bot = useBotCfg();
  const [v, set] = usePref(`${sec}.${id}`, def);
  const title = t(`system.settings.t.${sec}.${id}`, { name: bot.name });
  return <label className="li"><span className="grow"><div className="ttl">{title}</div><div className="sub">{t(`system.settings.t.${sec}.${id}Desc`, { name: bot.name })}</div></span><Switch checked={v} onCheckedChange={set} aria-label={title} /></label>;
}

export function SettingsScreen() {
  const t = useT();
  const { params } = useNav();
  const [v, setV] = useVariant("general");
  const sec = SECTIONS.some(([s]) => s === v) ? v : SECTIONS.some(([s]) => s === params.get("section")) ? params.get("section")! : "general";
  return (<>
    <div className="content-top"><span className="title">{t("system.settings.title")}</span></div>
    <div className="page"><div className="pg-set">
      <nav className="pg-nav" aria-label={t("system.settings.sections")}>
        {SECTIONS.map(([s, g]) => (
          <button key={s} className="pg-nav-i" data-testid={`settings-nav-${s}`} aria-current={sec === s || undefined} onClick={() => setV(s)}><Gel name={g} size={16} />{t(`system.settings.sec.${s}`)}</button>
        ))}
      </nav>
      <div className="pg-panel" key={sec}>
        <div className="page-title">{t(`system.settings.sec.${sec}`)}</div>
        {sec === "appearance" && <Appearance />}
        {sec === "providers" && <Providers />}
        {sec === "connection" && <Connection />}
        {sec === "shortcuts" && <div className="list">
          {SETTINGS_KEYS.map(([l, k]) => (
            <div key={l} className="li"><span className="grow ttl">{t(`system.sc.${l}`)}</span><span className="pg-keys">{k.map((x) => <kbd key={x} className="mono">{x}</kbd>)}</span></div>
          ))}
        </div>}
        {sec === "account" && <Account />}
        {TOGGLES[sec] && sec !== "appearance" && <div className="list">{TOGGLES[sec].map(([id, d]) => <Toggle key={id} sec={sec} id={id} def={d} />)}</div>}
      </div>
    </div></div>
  </>);
}

function Appearance() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const [pref, setPref] = React.useState<Pref>(currentThemePref);
  const native = (l: Locale) => { const n = new Intl.DisplayNames([l], { type: "language" }).of(l) ?? l; return n.charAt(0).toLocaleUpperCase(l) + n.slice(1); };
  return (<>
    <h3 className="h3">{t("system.theme.label")}</h3>
    <div className="pg-themes" role="radiogroup" aria-label={t("system.theme.label")}>
      {(["system", "light", "dark"] as const).map((x) => (
        <button key={x} role="radio" aria-checked={pref === x} className="pg-theme" data-on={pref === x || undefined} onClick={() => { setPref(x); setTheme(x); }}>
          <span className="pg-prev" data-v={x}><i /><b /></span>
          <span className="pg-theme-l"><span className="radio" />{t(`system.theme.${x}`)}</span>
        </button>
      ))}
    </div>
    <h3 className="h3">{t("system.settings.display")}</h3>
    <div className="list">
      <div className="li"><span className="grow"><div className="ttl">{t("system.settings.language")}</div><div className="sub">{t("system.settings.languageDesc")}</div></span>
        <Pop align="end" width={180} trigger={<button className="btn secondary">{native(locale)}<Icon name="chevron-up-down" size={16} /></button>}>
          {LOCALES.map((l) => <MItem key={l} icon={l === locale ? "check" : undefined} onClick={() => setLocale(l)}><span lang={l}>{native(l)}</span></MItem>)}
        </Pop>
      </div>
      {TOGGLES.appearance.map(([id, d]) => <Toggle key={id} sec="appearance" id={id} def={d} />)}
    </div>
  </>);
}

function Account() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fx = useFx();
  const conn = useQuery(() => api.connection.get(), []);
  if (!isPreview()) {
    const signedIn = conn.state === "ready" && conn.data.signedIn;
    return (<>
      <div className="list">
        <div className="li"><span className="avatar-dot pg-av"><Icon name="user" size={14} /></span><span className="grow"><div className="ttl">{signedIn ? t("system.settings.signedIn") : t("system.settings.noAccount")}</div><div className="sub">{signedIn ? t("system.settings.signedInDesc") : t("system.settings.noAccountDesc")}</div></span>
          {!signedIn && <button className="btn secondary" onClick={() => go("login")}>{t("system.login.title")}</button>}</div>
      </div>
      <h3 className="h3">{t("system.settings.session")}</h3>
      <div className="list">
        <div className="li"><span className="grow"><div className="ttl">{t("system.settings.export")}</div><div className="sub">{t("system.settings.exportLocal")}</div></span>
          <button className="btn secondary" onClick={() => go("memory")}>{t("system.settings.exportBtn")}</button></div>
      </div>
    </>);
  }
  return (<>
    <div className="list">
      <div className="li"><span className="avatar-dot pg-av">{fx.user.initials}</span><span className="grow"><div className="ttl">{fx.user.name}</div><div className="sub">{fx.user.email}</div></span><button className="btn secondary">{t("system.edit")}</button></div>
      <div className="li"><span className="grow"><div className="ttl">{t("system.settings.subscription")}</div><div className="sub">{t("system.settings.subscriptionDesc")}</div></span><span className="badge ok">{t("system.settings.active")}</span></div>
    </div>
    <h3 className="h3">{t("system.settings.session")}</h3>
    <div className="list">
      <div className="li"><span className="grow"><div className="ttl">{t("system.settings.export")}</div><div className="sub">{t("system.settings.exportDesc")}</div></span>
        <button className="btn secondary" onClick={() => toast.add({ title: t("system.settings.exportStarted"), description: t("system.settings.exportStartedDesc"), data: { icon: "download" } })}>{t("system.settings.exportBtn")}</button></div>
      <div className="li"><span className="grow"><div className="ttl">{t("system.settings.signOut")}</div><div className="sub">{t("system.settings.signOutDesc")}</div></span><button className="btn secondary pg-danger">{t("system.settings.signOut")}</button></div>
    </div>
  </>);
}

/* ---------- Providers ---------- */
type Prov = { id: string; name: string; supported: boolean; modelCount: number };
type Model = { id: string; name: string; providerID: string; reasoning: boolean; image: boolean; tools: boolean; context: number; input: number; output: number };
const fromInfo = (m: ModelInfo): Model => ({ id: m.id, name: m.name, providerID: m.providerID, reasoning: m.capabilities.reasoning, image: m.capabilities.imageInput, tools: m.capabilities.tools, context: m.capabilities.contextWindow, input: m.capabilities.cost.input, output: m.capabilities.cost.output });
const fromFx = (p: string) => (m: ModelFx): Model => ({ ...m, providerID: p });

function ModelRow({ m, onClick }: { m: Model; onClick?: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const ctx = new Intl.NumberFormat("en", { notation: "compact" }).format(m.context);
  const usd = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 2 : 0 }).format(n);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="li" data-testid="model-row" data-model-id={m.id} onClick={onClick} style={onClick ? { width: "100%", textAlign: "left" } : undefined}>
      <span className="grow"><div className="ttl">{m.name}</div><div className="sub">{m.context ? t("system.providers.context", { n: ctx }) : m.id}{(m.input || m.output) ? ` · ${t("system.providers.cost", { in: usd(m.input), out: usd(m.output) })}` : ""}</div></span>
      {m.reasoning && <span className="badge run" data-cap="reasoning">{t("system.providers.cap.reasoning")}</span>}
      {m.image && <span className="badge ok" data-cap="image">{t("system.providers.cap.image")}</span>}
      {m.tools && <span className="badge wait" data-cap="tools">{t("system.providers.cap.tools")}</span>}
    </Tag>
  );
}

function Providers() {
  const t = useT();
  const toast = useToast();
  const fx = useFx();
  const preview = isPreview();
  const catalog = useQuery<Prov[]>(() => (preview ? Promise.resolve(fx.providers) : api.catalog.providers()), []);
  const configs = useQuery<ProviderConfig[]>(() => (preview ? Promise.resolve(fx.providers.filter((p) => p.hasKey).map((p: ProviderFx) => ({ providerID: p.id, enabled: !!p.enabled, hasKey: true, keyHint: p.keyHint }))) : api.providers.list()), []);
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState<string | null>(preview ? fx.providers?.[0]?.id ?? null : null);
  const found = useQuery<Model[]>(() => (q.trim().length < 2 ? Promise.resolve([]) : preview ? Promise.resolve(fx.models.filter((m) => norm(m.name).includes(norm(q))).map(fromFx(fx.providers[0].id))) : api.catalog.search(q.trim(), 20).then((x) => x.map(fromInfo))), [q]);
  const [retrying, setRetrying] = React.useState(false);
  const retry = () => { setRetrying(true); api.catalog.refresh().catch(() => {}).finally(() => { setRetrying(false); catalog.reload(); }); };

  if (catalog.state === "loading") return <div className="list">{[0, 1, 2].map((i) => <div key={i} className="li"><span className="grow" style={{ display: "grid", gap: 6 }}><span className="skel title" /><span className="skel line" style={{ width: "60%" }} /></span></div>)}</div>;
  if (catalog.state === "error") return (
    <div className="list"><div className="li" role="alert"><span className="li-ic"><Icon name="alert-triangle" /></span><span className="grow"><div className="ttl">{t("system.providers.errorTitle")}</div><div className="sub">{t("system.providers.errorDesc")}</div></span>
      <button className="btn secondary" disabled={retrying} onClick={retry}>{retrying ? <span className="spin" /> : <Icon name="refresh" />}{t("system.common.retry")}</button></div></div>
  );
  const cfg = (id: string) => (configs.state === "ready" ? configs.data.find((c) => c.providerID === id) : undefined);
  const list = catalog.data.filter((p) => norm(p.name + " " + p.id).includes(norm(q.trim()))).sort((a, b) => Number(!!cfg(b.id)?.hasKey) - Number(!!cfg(a.id)?.hasKey) || Number(b.supported) - Number(a.supported) || a.name.localeCompare(b.name));
  const current = catalog.data.find((p) => p.id === sel);
  return (<>
    <label className="pg-search" style={{ width: "100%", margin: "0 0 12px" }}>
      <Icon name="search" size={16} />
      <input data-testid="provider-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("system.providers.search")} aria-label={t("system.providers.search")} />
      {q && <button type="button" aria-label={t("system.clear")} onClick={() => setQ("")}><Icon name="close" size={12} /></button>}
    </label>
    {list.length ? (
      <div className="list" style={{ maxHeight: 296, overflow: "auto" }}>
        {list.map((p) => { const c = cfg(p.id); return (
          <button key={p.id} className="li" data-testid="provider-row" data-provider-id={p.id} aria-current={sel === p.id || undefined} onClick={() => setSel(p.id)}
            style={{ width: "100%", textAlign: "left", opacity: p.supported ? 1 : 0.5, background: sel === p.id ? "var(--sel-row)" : undefined }}>
            <span className="grow"><div className="ttl">{p.name}</div><div className="sub">{t("system.providers.models", { count: p.modelCount })}{p.supported ? "" : ` · ${t("system.providers.unsupported")}`}</div></span>
            {c?.hasKey && <span className={"badge " + (c.enabled ? "ok" : "wait")}>{c.enabled ? t("system.providers.on") : t("system.providers.off")}</span>}
          </button>); })}
      </div>
    ) : <div className="pg-empty">{t("system.providers.none", { q: `${NB}${q}${NB}` })}</div>}
    {found.state === "ready" && found.data.length > 0 && <>
      <h3 className="h3" style={{ marginTop: 24 }}>{t("system.providers.matchingModels")}</h3>
      <div className="list">{found.data.map((m) => <ModelRow key={m.providerID + m.id} m={m} onClick={() => setSel(m.providerID)} />)}</div>
    </>}
    {current && <ProviderDetail key={current.id} p={current} cfg={cfg(current.id)} onChange={() => configs.reload()} toast={toast} />}
  </>);
}

function ProviderDetail({ p, cfg, onChange, toast }: { p: Prov; cfg?: ProviderConfig; onChange: () => void; toast: ReturnType<typeof useToast> }) {
  const t = useT();
  const fx = useFx();
  const preview = isPreview();
  const models = useQuery<Model[]>(() => (preview ? Promise.resolve(fx.models.map(fromFx(p.id))) : api.catalog.models(p.id).then((x) => x.map(fromInfo))), [p.id]);
  const [key, setKey] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const run = (f: () => Promise<unknown>, ok: string) => {
    if (preview) return;
    setBusy(true);
    f().then(() => { toast.add({ title: ok, data: { icon: "check-circle" } }); setKey(""); onChange(); }, () => toast.add({ title: t("system.providers.saveFailed"), data: { icon: "alert-triangle" } })).finally(() => setBusy(false));
  };
  return (<>
    <h3 className="h3" style={{ marginTop: 24 }}>{p.name}</h3>
    <div className="list">
      <form className="li" onSubmit={(e) => { e.preventDefault(); if (key.trim()) run(() => api.providers.setKey(p.id, key.trim()), t("system.providers.keySaved")); }}>
        <span className="grow"><div className="ttl">{t("system.providers.key")}</div><div className="sub">{cfg?.hasKey ? t("system.providers.keySet", { hint: cfg.keyHint ?? "••••" }) : t("system.providers.keyNone")}</div></span>
        <input data-testid="provider-key-input" className="input" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder={t("system.providers.keyPh")} aria-label={t("system.providers.keyLabel", { name: p.name })} style={{ width: 200 }} disabled={!p.supported} />
        <button data-testid="provider-key-save" className="btn secondary" disabled={!key.trim() || busy || !p.supported}>{t("system.common.save")}</button>
      </form>
      {cfg?.hasKey && <div className="li"><span className="grow"><div className="ttl">{t("system.providers.enable")}</div><div className="sub">{t("system.providers.enableDesc")}</div></span>
        <Switch checked={cfg.enabled} onCheckedChange={(x) => run(() => api.providers.update(p.id, { enabled: x }), x ? t("system.providers.enabled") : t("system.providers.disabled"))} aria-label={t("system.providers.enable")} /></div>}
      {cfg?.hasKey && <div className="li"><span className="grow"><div className="ttl">{t("system.providers.remove")}</div><div className="sub">{t("system.providers.removeDesc")}</div></span>
        <button className="btn secondary pg-danger" disabled={busy} onClick={() => run(() => api.providers.removeKey(p.id), t("system.providers.removed"))}>{t("system.remove")}</button></div>}
    </div>
    <h3 className="h3" style={{ marginTop: 24 }}>{t("system.providers.modelsTitle")}</h3>
    {models.state === "ready" ? (models.data.length ? <div className="list">{models.data.map((m) => <ModelRow key={m.id} m={m} />)}</div> : <div className="pg-empty">{t("system.providers.noModels")}</div>)
      : models.state === "error" ? <div className="pg-empty">{t("system.providers.errorDesc")}</div> : <div className="list"><div className="li"><span className="skel line" style={{ width: "50%" }} /></div></div>}
  </>);
}

/* ---------- Connection ---------- */
type Mode = "local" | "cloud" | "selfhost";
type Check = "idle" | "checking" | "invalid" | ConnectionProbe["status"];

function Connection() {
  const t = useT();
  const { go } = useNav();
  const preview = isPreview();
  const conn = useQuery(() => (preview ? Promise.resolve({ mode: "local" as Mode, signedIn: false, url: undefined }) : api.connection.get()), []);
  const [mode, setMode] = React.useState<Mode>("local");
  const [url, setUrl] = React.useState("");
  const [check, setCheck] = React.useState<Check>("idle");
  React.useEffect(() => { if (conn.state === "ready") { setMode(conn.data.mode); setUrl(conn.data.url ?? ""); } }, [conn.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (m: Mode) => {
    setMode(m); setCheck("idle");
    if (!preview && m !== "selfhost") api.connection.set({ mode: m, signedIn: conn.state === "ready" && conn.data.signedIn }).catch(() => {});
  };
  const valid = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:"; } catch { return false; } };
  const probe = async () => {
    if (!valid(url.trim())) { setCheck("invalid"); return; }
    if (preview) return;
    setCheck("checking");
    try { await api.connection.set({ mode: "selfhost", url: url.trim(), signedIn: false }); setCheck((await api.connection.probe()).status); }
    catch { setCheck("unreachable"); }
  };
  const BADGE: Record<Exclude<Check, "idle">, string> = { checking: "run", reachable: "ok", unreachable: "err", incompatible: "wait", invalid: "err", not_applicable: "wait" };
  const row = (m: Mode, extra?: React.ReactNode) => (
    <div className="li systeme-radio-row" role="radio" tabIndex={0} aria-checked={mode === m} data-testid={`connection-mode-${m}`} onClick={() => choose(m)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); choose(m); } }}>
      <span className="radio" /><span className="grow"><div className="ttl">{t(`system.conn.${m}`)}</div><div className="sub">{t(`system.conn.${m}Desc`)}</div></span>{extra}
    </div>
  );
  return (<>
    <div className="list" role="radiogroup" aria-label={t("system.settings.sec.connection")}>
      {row("local")}
      {row("cloud", mode === "cloud" && !(conn.state === "ready" && conn.data.signedIn) ? <button className="btn secondary" onClick={(e) => { e.stopPropagation(); go("login"); }}>{t("system.login.title")}</button> : undefined)}
      {row("selfhost")}
    </div>
    {mode === "selfhost" && <>
      <h3 className="h3" style={{ marginTop: 24 }}>{t("system.conn.server")}</h3>
      <form className="list" noValidate onSubmit={(e) => { e.preventDefault(); void probe(); }}>
        <div className="li">
          <input data-testid="selfhost-url" className="input" type="url" inputMode="url" spellCheck={false} value={url} onChange={(e) => { setUrl(e.target.value); setCheck("idle"); }} placeholder={t("system.conn.urlPh")} aria-label={t("system.conn.url")} aria-invalid={check === "invalid" || undefined} style={{ flex: 1, minWidth: 0 }} />
          {check !== "idle" && <span className={"badge " + BADGE[check]} role="status">{check === "checking" && <span className="spin" />}{t(`system.conn.status.${check}`)}</span>}
          <button data-testid="selfhost-check" className="btn secondary" disabled={!url.trim() || check === "checking"}>{t("system.conn.check")}</button>
        </div>
      </form>
    </>}
  </>);
}
