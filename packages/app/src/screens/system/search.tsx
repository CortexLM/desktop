// Global search and the ⌘K command palette.
import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Icon, useToast } from "../../kit/ui";
import { useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { useSessions, useBots } from "../../state/live";
import { Top, BotEmpty, Keys, Hl, useListNav, useFx, useBotCfg, useAgo, css, norm, setTheme, NB } from "./common";
import type { Hit } from "./fixtures";

const KINDS = ["all", "chats", "projects", "files", "bots", "settings"] as const;

export function SearchScreen() {
  const t = useT();
  const { go } = useNav();
  const fx = useFx();
  const preview = isPreview();
  const ago = useAgo();
  const sessions = useSessions();
  const bots = useBots();
  const [v] = useVariant("results");
  const [q, setQ] = React.useState(() => (preview ? fx.search.q[v] ?? "" : ""));
  const [kind, setKind] = React.useState<(typeof KINDS)[number]>("all");
  const loading = preview ? v === "loading" : sessions.state === "loading" || bots.state === "loading";
  const sourceError = !preview && (sessions.state === "error" || bots.state === "error");
  type SearchHit = Hit & { id?: string };
  const pool: SearchHit[] = preview ? fx.search.hits
    : [
      ...(sessions.state === "ready" ? sessions.data.map((s) => ({ kind: "chats" as const, icon: s.kind === "code" ? "code" : s.kind === "bot" ? "bot" : "compose", title: s.title || t("system.untitled"), sub: t(`system.search.kind.${s.kind}`), meta: ago(s.time.updated), to: s.kind === "code" ? "code-session" : "chat", id: s.id })) : []),
      ...(bots.state === "ready" ? bots.data.map((b) => ({ kind: "bots" as const, icon: "bot", title: b.name, sub: b.persona, meta: t("system.search.k.bots"), to: "bot", id: b.id })) : []),
    ];
  const open = (h: SearchHit) => go(h.to, h.id ? { id: h.id } : undefined);
  const found = pool.filter((h) => (kind === "all" || h.kind === kind) && q.trim() && norm(h.title + " " + h.sub).includes(norm(q.trim())));
  const recentQ = preview ? fx.search.recent : [];
  const opened = preview ? fx.search.hits.filter((h) => fx.search.opened.includes(h.title)) : pool.filter((h) => h.kind === "chats").slice(0, 3);
  const recent = !q.trim();
  const groups = KINDS.slice(1).map((k) => [k, found.filter((h) => h.kind === k)] as const).filter(([, xs]) => xs.length);
  const orderedFound = groups.flatMap(([, xs]) => xs);
  const flat = recent ? recentQ : orderedFound;
  const nav = useListNav(loading || sourceError ? 0 : flat.length, (i) => (recent ? setQ(recentQ[i][0]) : open(orderedFound[i])));
  let n = 0;
  return (<>
    <Top title={t("system.search.title")} />
    <div className="page"><div className="systeme-narrow">
      <label className="systeme-search">
        <Icon name="search" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={nav.onKeyDown} placeholder={t("system.search.placeholder")} aria-label={t("system.search.label")} role="combobox" aria-expanded aria-controls="systeme-res" aria-activedescendant={!loading && !sourceError && flat.length ? `systeme-hit-${nav.active}` : undefined} />
        {q && <button type="button" className="systeme-clear" aria-label={t("system.clear")} onClick={() => setQ("")}><Icon name="close" size={12} /></button>}
      </label>
      <div className="systeme-filters" role="group" aria-label={t("system.search.filter")}>
        {KINDS.map((k) => <button key={k} className="chip" aria-pressed={kind === k} data-pressed={kind === k || undefined} onClick={() => setKind(k)}>{t(`system.search.k.${k}`)}</button>)}
      </div>
      <div id="systeme-res" role="listbox" aria-label={t("system.search.results")} className="systeme-res">
        {loading ? <section><h3 className="h3"><span className="thinking">{preview ? t("system.search.searching", { total: fx.search.total }) : t("system.search.searchingLive")}</span></h3>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="systeme-skel-hit"><span className="skel" style={{ width: 32, height: 32, borderRadius: 10 }} /><span style={{ flex: 1, display: "grid", gap: 6 }}><span className="skel title" style={{ width: `${50 - i * 5}%` }} /><span className="skel line" style={{ width: `${80 - i * 7}%` }} /></span></div>)}
        </section>
        : sourceError ? <BotEmpty state="blocked" title={t("work.error.loadTitle")} text={t("work.error.loadText")}>
          <button className="btn secondary" onClick={() => { sessions.reload(); bots.reload(); }}>{t("common.retry")}</button>
        </BotEmpty>
        : recent ? <section className="systeme-recent">
          {recentQ.length > 0 && <h3 className="h3">{t("system.search.recentSearches")}</h3>}
          {recentQ.map(([r, w], i) => <button key={r} id={`systeme-hit-${i}`} data-nav-i={i} role="option" aria-selected={nav.active === i} className="systeme-row systeme-rise" style={css(i)} data-active={nav.active === i || undefined} onMouseMove={() => nav.setActive(i)} onClick={() => setQ(r)}>
            <Icon name="history" /><span className="systeme-grow">{r}</span><span className="systeme-meta">{w}</span></button>)}
          {opened.length > 0 && <h3 className="h3" style={{ marginTop: recentQ.length ? 20 : 0 }}>{t("system.search.recentlyOpened")}</h3>}
          {opened.map((h, i) => (
            <button key={h.title + i} className="systeme-hit" style={css(i + 4)} onClick={() => open(h)}>
              <span className="systeme-ic" style={h.img ? { background: `center/cover url(/img/${h.img}.png)` } : undefined}>{!h.img && <Icon name={h.icon} />}</span>
              <span className="systeme-grow"><span className="systeme-t">{h.title}</span><span className="systeme-s">{t(`system.search.k.${h.kind}`)}</span></span><span className="systeme-meta">{h.meta}</span>
            </button>))}
          {!preview && !opened.length && <div className="pg-empty">{t("system.search.nothingYet")}</div>}
        </section>
        : groups.length ? groups.map(([k, xs]) => (
          <section key={k} role="group" aria-label={t(`system.search.k.${k}`)}>
            <h3 className="h3">{t(`system.search.k.${k}`)}<span className="systeme-count">{xs.length}</span></h3>
            {xs.map((h) => { const i = n++; return (
              <button key={h.title + i} id={`systeme-hit-${i}`} data-nav-i={i} role="option" aria-selected={nav.active === i} className="systeme-hit" style={css(i)} data-active={nav.active === i || undefined} onMouseMove={() => nav.setActive(i)} onClick={() => open(h)}>
                <span className="systeme-ic" style={h.img ? { background: `center/cover url(/img/${h.img}.png)` } : undefined}>{!h.img && <Icon name={h.icon} />}</span>
                <span className="systeme-grow"><span className="systeme-t"><Hl text={h.title} q={q} /></span><span className="systeme-s"><Hl text={h.sub} q={q} /></span></span>
                <span className="systeme-meta">{h.meta}</span><kbd className="systeme-kbd systeme-enter">↵</kbd>
              </button>); })}
          </section>))
        : <BotEmpty state="thinking" title={t("system.search.noResults", { q: `${NB}${q}${NB}` })} text={kind === "all" ? t("system.search.noResultsHintAll") : t("system.search.noResultsHint")}>
            <div style={{ display: "flex", gap: 8 }}>{kind !== "all" && <button className="btn secondary" onClick={() => setKind("all")}>{t("system.search.everywhere")}</button>}<button className="btn secondary" onClick={() => go("deep-research")}><Icon name="globe" />{t("system.search.web")}</button></div>
          </BotEmpty>}
      </div>
      {!loading && !sourceError && flat.length > 0 && <div className="systeme-searchfoot"><div className="systeme-hint"><span><Keys k={["↑", "↓"]} />{t("system.key.navigate")}</span><span><Keys k={["↵"]} />{t("system.key.open")}</span><span><Keys k={["⌘", "K"]} />{t("system.key.palette")}</span></div></div>}
    </div></div>
  </>);
}

/* ---------- ⌘K palette ---------- */
type Cmd = { id: string; label: string; icon: string; sec: string; kbd?: string; to?: string; params?: Record<string, string>; sub?: "theme" | "model"; meta?: string };

function useCommands(): Cmd[] {
  const t = useT();
  const fx = useFx();
  const preview = isPreview();
  const bot = useBotCfg();
  const bots = useBots();
  const sessions = useSessions();
  const hasBot = preview || (bots.state === "ready" && bots.data.length > 0);
  const botId = !preview && bots.state === "ready" ? bots.data[0]?.id : undefined;
  const A = t("system.cmd.sec.actions"), G = t("system.cmd.sec.goto"), B = t("system.cmd.sec.bots"), R = t("system.cmd.sec.recent");
  const list: Cmd[] = [
    { id: "new", label: t("system.cmd.newChat"), icon: "compose", sec: A, kbd: "⌘N", to: "home" },
    { id: "proj", label: t("system.cmd.newProject"), icon: "folder", sec: A, to: "projects" },
    { id: "theme", label: t("system.cmd.theme"), icon: "sun", sec: A, sub: "theme" },
    { id: "model", label: t("system.cmd.model"), icon: "sparkle-free", sec: A, sub: "model" },
    { id: "upload", label: t("system.cmd.upload"), icon: "paperclip", sec: A, kbd: "⌘U", to: "upload" },
    { id: "g-lib", label: t("system.cmd.library"), icon: "projects", sec: G, to: "library" },
    { id: "g-hist", label: t("system.cmd.history"), icon: "history", sec: G, to: "history" },
    { id: "g-mem", label: t("system.cmd.memory"), icon: "key", sec: G, to: "memory" },
    { id: "g-set", label: t("system.cmd.settings"), icon: "settings", sec: G, kbd: "⌘,", to: "settings" },
    { id: "g-keys", label: t("system.cmd.shortcuts"), icon: "command", sec: G, kbd: "⌘/", to: "shortcuts" },
  ];
  if (hasBot) list.push(
    { id: "b-ask", label: t("system.cmd.askBot", { name: bot.name }), icon: "bot", sec: B, to: "bot", params: botId ? { id: botId } : undefined, meta: preview ? fx.bot.doing : undefined },
    { id: "b-studio", label: t("system.cmd.editBot", { name: bot.name }), icon: "edit", sec: B, to: "bot-studio", params: botId ? { id: botId } : undefined });
  else list.push({ id: "b-new", label: t("system.cmd.createBot"), icon: "bot", sec: B, to: "bot-new" });
  if (preview) fx.cmd.recents.forEach((r, i) => list.push({ id: `r-${i}`, label: r.label, icon: r.icon, sec: R, to: r.to, meta: r.meta }));
  else if (sessions.state === "ready") sessions.data.slice(0, 5).forEach((s) => list.push({ id: `r-${s.id}`, label: s.title || t("system.untitled"), icon: s.kind === "code" ? "code" : "compose", sec: R, to: s.kind === "code" ? "code-session" : "chat", params: { id: s.id }, meta: t(`system.search.kind.${s.kind}`) }));
  return list;
}

export function CommandPalette({ open, onOpenChange, initialQ = "", initialSub = null }: { open: boolean; onOpenChange: (o: boolean) => void; initialQ?: string; initialSub?: "theme" | "model" | null }) {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const cmds = useCommands();
  const [q, setQ] = React.useState(initialQ);
  const [sub, setSub] = React.useState<"theme" | "model" | null>(initialSub);
  const input = React.useRef<HTMLInputElement>(null);
  const subs = {
    theme: { title: t("system.cmd.themeTitle"), items: [{ id: "t-system", label: t("system.theme.system"), icon: "system", sec: "" }, { id: "t-light", label: t("system.theme.light"), icon: "sun", sec: "" }, { id: "t-dark", label: t("system.theme.dark"), icon: "moon", sec: "" }] as Cmd[] },
    model: { title: t("system.cmd.modelTitle"), items: [{ id: "m-1", label: t("composer.model.fast"), icon: "bolt", sec: "", meta: t("composer.model.fastHint") }, { id: "m-2", label: t("composer.model.thinking"), icon: "sparkle-free", sec: "", meta: t("composer.model.thinkingHint") }, { id: "m-3", label: t("composer.model.pro"), icon: "cpu", sec: "", meta: t("composer.model.proHint") }] as Cmd[] },
  };
  const pool = sub ? subs[sub].items : cmds;
  const list = pool.filter((c) => norm(c.label + " " + (c.meta ?? "")).includes(norm(q.trim())));
  const pick = (c: Cmd) => {
    if (c.sub) { setSub(c.sub); setQ(""); input.current?.focus(); return; }
    if (c.to) { onOpenChange(false); go(c.to, c.params); return; }
    onOpenChange(false);
    if (c.id.startsWith("t-")) setTheme(c.id.slice(2) as "system" | "light" | "dark");
    toast.add({ title: t("system.cmd.done", { group: sub ? subs[sub].title : t("system.cmd.action"), label: c.label }), data: { icon: "check-circle" } });
  };
  const nav = useListNav(list.length, (i) => pick(list[i]));
  const back = () => { setSub(null); setQ(""); };
  const onKey = (e: React.KeyboardEvent) => {
    if (sub && ((e.key === "Backspace" && !q) || (e.key === "ArrowLeft" && !q))) { e.preventDefault(); back(); return; }
    if (e.key === "ArrowRight" && list[nav.active]?.sub) { e.preventDefault(); pick(list[nav.active]); return; }
    nav.onKeyDown(e);
  };
  let last = "";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="systeme-backdrop" />
        <Dialog.Popup className="systeme-cmd" initialFocus={input} aria-label={t("system.cmd.title")}>
          <Dialog.Title className="systeme-sr">{t("system.cmd.title")}</Dialog.Title>
          <div className="systeme-cmd-in">
            {sub ? <button className="systeme-crumb" onClick={back} aria-label={t("system.cmd.backToCommands")}><Icon name="arrow-left" size={12} />{subs[sub].title}</button> : <Icon name="search" />}
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={sub ? t(`system.cmd.choose.${sub}`) : t("system.cmd.placeholder")} aria-label={t("system.cmd.input")}
              role="combobox" aria-expanded aria-controls="systeme-cmd-list" aria-activedescendant={list.length ? `systeme-cmd-${nav.active}` : undefined} />
            <kbd className="systeme-kbd">{t("system.key.esc")}</kbd>
          </div>
          {list.length ? (
            <div className="systeme-cmd-list" id="systeme-cmd-list" role="listbox" key={sub ?? "root"}>
              {list.map((c, i) => {
                const head = c.sec !== last && !sub ? (last = c.sec) : null;
                return (<React.Fragment key={c.id}>
                  {head && <div className="systeme-cmd-sec" role="presentation">{head}</div>}
                  <button id={`systeme-cmd-${i}`} data-nav-i={i} role="option" aria-selected={nav.active === i} tabIndex={-1} className="systeme-cmd-item systeme-rise" style={css(i)} data-active={nav.active === i || undefined}
                    onMouseMove={() => nav.setActive(i)} onClick={() => pick(c)}>
                    <Icon name={c.icon} /><span className="systeme-grow"><Hl text={c.label} q={q} /></span>
                    {c.meta && <span className="systeme-meta">{c.meta}</span>}
                    {c.kbd && <kbd className="systeme-kbd">{c.kbd}</kbd>}
                    {c.sub && <Icon name="chevron-right" size={16} />}
                  </button>
                </React.Fragment>);
              })}
            </div>
          ) : (
            <div className="systeme-cmd-empty"><Icon name="search" size={20} /><b>{t("system.cmd.none", { q: `${NB}${q}${NB}` })}</b><span>{t("system.cmd.noneHint")}</span>
              <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => { onOpenChange(false); go("search"); }}>{t("system.search.everywhereAll")}</button></div>
          )}
          <div className="systeme-cmd-foot">
            <span><Keys k={["↑", "↓"]} />{t("system.key.navigate")}</span><span><Keys k={["↵"]} />{list[nav.active]?.sub ? t("system.key.open") : t("system.key.confirm")}</span>
            {sub ? <span><Keys k={["←"]} />{t("system.key.back")}</span> : <span><Keys k={["→"]} />{t("system.key.submenu")}</span>}
            <span className="systeme-sp" /><span>{t("system.brand")}</span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CommandScreen() {
  const t = useT();
  const fx = useFx();
  const [v] = useVariant("open");
  const [open, setOpen] = React.useState(true);
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); } };
    addEventListener("keydown", k, true); return () => removeEventListener("keydown", k, true);
  }, []);
  return (<>
    <Top title={t("system.cmd.title")} />
    <div className="systeme-dim">
      <Icon name="command" size={24} />
      <span>{t("system.cmd.anywhere")} <Keys k={["⌘", "K"]} /></span>
      <button className="btn secondary" onClick={() => setOpen(true)}>{t("system.cmd.openPalette")}</button>
    </div>
    <CommandPalette key={v} open={open} onOpenChange={setOpen} initialQ={isPreview() ? fx.cmd.q[v] ?? "" : ""} initialSub={v === "submenu" ? "theme" : null} />
  </>);
}
