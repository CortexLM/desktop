import * as React from "react";
import type { Project, Session } from "@cortex/schema";
import { createPortal } from "react-dom";
import { IconBtn, Tip, Row, Section, Segmented, ProgressCard, ModeSwitcher, type Mode } from "../kit/ui";
import { Icon } from "../icons/Icon";
import { Mascot, DEFAULT_MASCOT, type MascotConfig } from "../mascot/Mascot";
import { SCREENS } from "../registry";
import { NavCtx, useNav, go, navigation, type readHash, type Route } from "./nav";
import { VariantPicker, type Theme, type ThemePref } from "../App";
import { useT } from "../i18n";
import { isPreview, useFixtures, usePreviewBot } from "../preview";
import { platform } from "../api";
import { useSessions, useBots, useProjects } from "../state/live";
import { useRemoteSessions } from "../state/remote-list";
import { NotFound } from "./not-found";
import { previewChatStart, startPreviewChat } from "../components/composer";

const THEME_KEY = "cortex.theme";
const sysDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
const resolve = (p: ThemePref): Theme => (p === "system" ? (sysDark() ? "dark" : "light") : p);

export function Shell({ hash, children }: { hash: ReturnType<typeof readHash>; children?: React.ReactNode }) {
  const t = useT();
  const { route, params, theme: initialTheme } = hash;
  const [pref, setPref] = React.useState<ThemePref>(() => {
    const value = initialTheme ?? localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  });
  const [theme, setThemeState] = React.useState<Theme>(() => resolve(pref));
  const [sidebar, setSidebar] = React.useState(true);
  const [focus, setFocus] = React.useState(false);
  const def = SCREENS.find((s) => s.id === route);
  const mode: Mode = def?.mode ?? "Cortex";

  const back = () => window.history.back();
  const forward = () => window.history.forward();

  const setTheme = (p: ThemePref) => {
    setPref(p); if (!isPreview()) localStorage.setItem(THEME_KEY, p);
    if (isPreview() || params.has("theme")) {
      const [route, query] = location.hash.split("?");
      const next = new URLSearchParams(query); next.set("theme", p);
      history.replaceState(history.state, "", `${route}?${next}`);
    }
    const v = resolve(p);
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return setThemeState(v);
    document.documentElement.dataset.vt = "theme";
    const transition = document.startViewTransition(() => setThemeState(v));
    void transition.ready.catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) throw error; });
    transition.finished.finally(() => delete document.documentElement.dataset.vt).catch(() => {});
  };
  React.useEffect(() => {
    if (initialTheme && initialTheme !== pref) { setPref(initialTheme); setThemeState(resolve(initialTheme)); }
  }, [initialTheme, pref]);
  React.useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  React.useEffect(() => { const f = (e: Event) => { const value = (e as CustomEvent).detail; if (value === "light" || value === "dark" || value === "system") setTheme(value); }; addEventListener("cortex-theme", f); return () => removeEventListener("cortex-theme", f); });
  React.useEffect(() => {
    if (pref !== "system") return;
    const m = matchMedia("(prefers-color-scheme: dark)"); const f = () => setThemeState(m.matches ? "dark" : "light");
    m.addEventListener("change", f); return () => m.removeEventListener("change", f);
  }, [pref]);

  const commands = (cmd: string) => {
    if (cmd === "focus") { document.querySelector<HTMLButtonElement>(".focus-btn")?.focus(); setFocus((f) => !f); }
    else if (cmd === "sidebar") { document.querySelector<HTMLButtonElement>(focus ? ".focus-btn" : ".nav-btns button")?.focus(); setSidebar((s) => !s); }
    else if (cmd === "new") go(mode === "Cortex" ? "home" : "code");
    else if (cmd === "back") back();
    else if (cmd === "forward") forward();
    else go(cmd);
  };
  React.useEffect(() => window.cortex?.onMenu?.((cmd) => { if (cmd === "focus" || cmd === "sidebar") commands(cmd); }));
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const el = e.target as HTMLElement;
      if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) && !["k", "n", "\\", "b"].includes(e.key)) return;
      const map: Record<string, string> = { "\\": "focus", b: "sidebar", n: "new", k: "command", ",": "settings", "[": "back", "]": "forward", "/": "shortcuts" };
      if (map[e.key]) { e.preventDefault(); commands(map[e.key]); }
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  const screen = def?.render() ?? <NotFound />;
  const mac = platform() === "darwin";
  const work = route === "work-home" || route === "home";

  return (
    <NavCtx.Provider value={{ go, route, mode, params, themePref: pref, entryKey: hash.entryKey }}>
      <div className="desk" data-host={window.cortex ? "desktop" : "web"} data-platform={platform()} style={{ ["--wall" as string]: `url(/img/${theme === "dark" ? "crepuscule" : "prairie"}.png)` }}>
        <div className="window" data-sidebar={sidebar ? "shown" : "hidden"} data-focus={focus || undefined}>
          <div className="titlebar">
            <div className="side">
              {!mac && <div className="lights hide-focus" aria-hidden><i /><i /><i /></div>}
              {mac && <div className="lights-space" aria-hidden />}
              <div className="nav-btns hide-focus" inert={focus}>
                <IconBtn icon="sidebar-left" label={sidebar ? t("shell.hideSidebar") : t("shell.showSidebar")} kbd="⌘B" onClick={() => setSidebar((s) => !s)} />
                <IconBtn icon="arrow-left" label={t("shell.back")} kbd="⌘[" onClick={back} disabled={!navigation.canGoBack} />
                <IconBtn icon="arrow-right" label={t("shell.forward")} kbd="⌘]" onClick={forward} disabled={!navigation.canGoForward} />
              </div>
            </div>
            <div className="hide-focus" inert={focus}>{work && <Segmented resetKey={hash.entryKey} items={[t("shell.tab.chat"), t("shell.tab.work")]} value={route === "work-home" ? t("shell.tab.work") : t("shell.tab.chat")} onChange={(x) => { go(x === t("shell.tab.work") ? "work-home" : "home"); return navigation.currentEntry.key; }} />}</div>
            <div className="side end">
              {!focus && isPreview() && def?.variants && <VariantPicker key={route} variants={def.variants} />}
              <IconBtn icon="share" label={t("shell.share")} className="hide-focus" inert={focus} onClick={() => go("share")} />
              <IconBtn icon="focus" label={focus ? t("shell.exitFocus") : t("shell.focus")} kbd="⌘\" className="focus-btn" onClick={() => setFocus((f) => !f)} />
            </div>
          </div>
          <div className="body">
            <Rail route={route} go={go} theme={pref} setTheme={setTheme} inert={focus} />
            <div className="frame">
              <aside className="sidebar" aria-label={t("shell.sidebar")} inert={focus || !sidebar}><div className="sb-inner">
                <div className="sb-head">
                  <ModeSwitcher key={focus || !sidebar ? "hidden" : "shown"} mode={mode} onMode={(m) => go(m === "Cortex" ? "home" : "code")} />
                  <div style={{ flex: 1 }} />
                  <div style={{ display: "flex" }}><IconBtn icon="bell" label={t("shell.notifications")} onClick={() => go("notifications")} /><IconBtn icon="search" label={t("shell.search")} kbd="⌘K" onClick={() => go("command")} /></div>
                </div>
                <div className="sb-scroll" key={mode} style={{ animation: "rise 320ms var(--ease-out) both" }}>
                  {mode === "Cortex" ? <CortexNav route={route} go={go} /> : <CodeNav route={route} go={go} />}
                </div>
                <GettingStarted route={route} go={go} />
              </div></aside>
              <main className="content" key={params.has("preview") || hash.shot || route === "home" || route === "code" ? hash.entryKey : undefined} style={{ viewTransitionName: "content" }}>{children ?? screen}</main>
            </div>
          </div>
        </div>
      </div>
    </NavCtx.Provider>
  );
}

function GettingStarted({ route, go }: { route: Route; go: (r: Route) => void }) {
  const t = useT();
  const done = isPreview() ? (route === "bot" ? 2 : 1) : Number(localStorage.getItem("cortex.onboarding.done") ?? 0);
  if (!isPreview() && done >= 5) return null;
  return <ProgressCard label={t("shell.gettingStarted")} done={done} total={5} onClick={() => go("onboarding")} />;
}

function Rail({ route, go, theme, setTheme, inert }: { route: Route; go: (r: Route) => void; theme: ThemePref; setTheme: (t: ThemePref) => void; inert: boolean }) {
  const t = useT();
  const items: [string, string, Route][] = [["home", t("shell.rail.home"), "home"], ["projects", t("shell.rail.library"), "library"], ["history", t("shell.rail.history"), "history"], ["agent", t("shell.rail.bots"), "bot-roster"], ["mentions", t("shell.rail.activity"), "activity"]];
  const homeActive = ["home", "chat", "code", "code-session"].includes(route);
  return (
    <nav className="rail" aria-label={t("shell.primaryNav")} inert={inert}>
      {items.map(([ic, l, r], i) => (
        <React.Fragment key={r}>
          <Tip label={l} side="right"><button className="rail-btn" aria-label={l} data-active={(r === "home" ? homeActive : route === r || (r === "bot-roster" && route.startsWith("bot"))) || undefined} onClick={() => go(r)}><Icon name={ic} size={18} /></button></Tip>
          {i === 0 && <div className="rail-sep" />}
        </React.Fragment>
      ))}
      <Tip label={t("shell.rail.more")} side="right"><button className="rail-btn" aria-label={t("shell.rail.more")} data-active={["space", "scheduled", "plugins", "components"].includes(route) || undefined} onClick={() => go("components")}><Icon name="more-dots" size={18} /></button></Tip>
      <div style={{ flex: 1 }} />
      <ThemeSwitch theme={theme} setTheme={setTheme} />
      <Tip label={t("shell.settings")} side="right" kbd="⌘,"><button className="rail-btn" aria-label={t("shell.settings")} data-active={route === "settings" || undefined} onClick={() => go("settings")}><Icon name="settings" size={18} /></button></Tip>
      <Avatar />
    </nav>
  );
}

function ThemeSwitch({ theme, setTheme }: { theme: ThemePref; setTheme: (theme: ThemePref) => void }) {
  const t = useT();
  const track = React.useRef<HTMLDivElement>(null);
  const burst = React.useRef<HTMLElement>(null);
  const options = [["moon", "dark", t("shell.themeDark")], ["system", "system", t("shell.themeSystem")], ["sun", "light", t("shell.themeLight")]] as const;
  const i = options.findIndex((option) => option[1] === theme);
  const ring = [options[(i + 2) % 3], options[(i + 1) % 3], options[i]];
  return <div className="theme-slot"><div className="theme" role="radiogroup" aria-label={t("shell.theme")}><div className="theme-track" ref={track}>
    {ring.map(([icon, value, label], pos) => <button key={value} role="radio" aria-checked={theme === value} aria-label={label} data-theme-value={value} data-on={theme === value || undefined} tabIndex={theme === value ? 0 : -1}
      onKeyDown={(e) => {
        const step = ["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : ["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 0;
        if (!step && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        const next = e.key === "Home" ? "dark" : e.key === "End" ? "light" : ring[(pos + step + ring.length) % ring.length][1];
        track.current?.getAnimations().forEach((a) => a.cancel());
        track.current?.querySelector<HTMLButtonElement>(`[data-theme-value="${next}"]`)?.focus();
        setTheme(next);
      }}
      onPointerDown={(e) => {
        const r = burst.current; if (!r || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const box = e.currentTarget.getBoundingClientRect();
        Object.assign(r.style, { top: `${box.top}px`, left: `${box.left}px` });
        r.getAnimations().forEach((a) => a.cancel());
        r.animate([{ scale: .75, opacity: 1, borderWidth: "2px" }, { opacity: 1, offset: .6 }, { scale: 1.6, opacity: 0, borderWidth: "1px" }], { duration: 380, easing: "linear" });
      }}
      onClick={(e) => {
        // Reduced-motion CSS also creates inherited-color transitions; those must never block activation.
        if (value === theme || e.detail > 1 || (e.detail > 0 && track.current?.getAnimations().some((a) => !(a instanceof CSSTransition)))) return;
        if (e.detail === 0) track.current?.getAnimations().forEach((a) => a.cancel());
        setTheme(value);
        if (e.detail > 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) track.current?.animate([{ translate: `0 ${(pos - 2) * 38}px` }, { translate: "0 0" }], { duration: 267, easing: "cubic-bezier(.22,1,.36,1)", composite: "add" });
      }}><Icon name={icon} size={18} /></button>)}
  </div></div>{createPortal(<i className="ring-burst" ref={burst} aria-hidden />, document.body)}</div>;
}

function Avatar() {
  const fx = useFixtures<{ user?: { initials: string } }>("shell");
  return <div className="avatar-dot" aria-hidden>{isPreview() ? fx.user?.initials : <Icon name="user" size={14} />}</div>;
}

type ShellFx = {
  bot: { name: string; doing: string };
  projects: { name: string; open?: boolean; meta?: string; status?: string; to: string; chats: { title: string; dim?: boolean; to: string; active?: boolean }[] }[];
  repos: { name: string; tasks: { title: string; status?: string; meta?: string; to: string }[] }[];
  envs: { name: string; icon: string; meta: string; status?: string }[];
};

function CortexNav({ route, go }: { route: Route; go: (r: Route, p?: Record<string, string>) => void }) {
  const t = useT();
  const { params } = useNav();
  const fx = useFixtures<ShellFx>("shell");
  const preview = isPreview();
  const previewBot = usePreviewBot();
  const bots = useBots();
  const sessions = useSessions("chat");
  const remote = useRemoteSessions();
  const projects = useProjects();
  const [open, setOpen] = React.useState(true);
  const start = previewChatStart();
  const firstBot = !preview && bots.state === "ready" ? bots.data[0] : undefined;
  const cfg: MascotConfig = previewBot?.cfg ?? (firstBot ? { name: firstBot.name, ...(firstBot.mascot as Omit<MascotConfig, "name">) } : { name: "", ...DEFAULT_MASCOT });
  return (<>
    <div className="sb-group">
      <Row label={t("shell.nav.newChat")} icon="compose" onClick={() => go("home")} active={route === "home"} />
      {preview || firstBot
        ? <Row label={cfg.name} lead={<Mascot cfg={cfg} state={previewBot ? previewBot.live.on ? previewBot.live.state : "asleep" : "idle"} size={16} />} meta={previewBot ? previewBot.live.on ? previewBot.live.doing : t("bots.paused") : undefined} active={["bot", "bot-new", "bot-studio"].includes(route)} onClick={() => go("bot", firstBot ? { id: firstBot.id } : undefined)} />
        : <Row label={t("shell.nav.createBot")} icon="plus" active={route === "bot-new"} onClick={() => go("bot-new")} />}
    </div>
    <div className="sb-group">
      <Section title={t("shell.nav.tools")} />
      <Row label={t("shell.nav.webSearch")} gel="recherche-web" active={route === "search-results"} onClick={() => go("search-results")} />
      <Row label={t("shell.nav.documents")} gel="documents" active={route.startsWith("file-") || route === "upload"} onClick={() => go(preview ? "file-pdf" : "upload")} />
      <Row label={t("shell.nav.images")} gel="images" active={route === "image-gen"} onClick={() => go("image-gen")} />
      <Row label={t("shell.nav.automations")} gel="automatisations" active={route.startsWith("automation")} onClick={() => go("automations")} />
    </div>
    {preview ? (
      <div className="sb-group">
        <Section title={t("shell.nav.projects")} action={<IconBtn icon="plus" label={t("shell.nav.newProject")} onClick={() => go("projects", { v: "create" })} />} />
        {fx.projects?.map((p, i) => i === 0 ? (
          <React.Fragment key={p.name}>
            <Row label={p.name} icon={open ? "folder-open" : "folder"} strong onClick={() => setOpen((o) => !o)} />
            <div className="fold" data-closed={!open || undefined} inert={!open}><div>
              {p.chats.map((c) => <Row key={c.title} label={c.title} child dim={c.active ? route !== c.to || !!start : c.dim} active={route === c.to && (c.active ? !start : c.to === "chat" && start?.text === c.title)} onClick={() => c.to === "chat" && !c.active ? startPreviewChat("chat", c.title, t("composer.model.fast")) : go(c.to)} actions={c.active ? <IconBtn icon="more-dots" label={t("shell.nav.options")} /> : undefined} />)}
            </div></div>
          </React.Fragment>
        ) : <Row key={p.name} label={p.name} icon="folder" strong meta={p.meta} status={p.status} active={route === p.to} onClick={() => go(p.to)} />)}
      </div>
    ) : (<>
      <div className="sb-group">
        <Section title={t("shell.nav.projects")} action={<IconBtn icon="plus" label={t("shell.nav.newProject")} onClick={() => go("projects", { v: "create" })} />} />
        {projects.state === "ready" && projects.data.map((p) => <ProjectRows key={p.id} project={p} sessions={sessions.state === "ready" ? sessions.data.filter((s) => !s.parentID && s.projectID === p.id) : []} />)}
        {projects.state === "loading" && <div className="sb-empty thinking" role="status">{t("system.variant.loading")}</div>}
        {projects.state === "error" && <Row label={t("common.retry")} icon="refresh" onClick={projects.reload} />}
        {sessions.state === "loading" && <div className="sb-empty thinking" role="status">{t("system.variant.loading")}</div>}
        {sessions.state === "error" && <div role="alert"><div className="sb-empty">{t("work.error.loadTitle")}</div><Row label={t("common.retry")} icon="refresh" onClick={sessions.reload} /></div>}
        {projects.state === "ready" && !projects.data.length && <Row label={t("system.projects.title")} icon="folder" onClick={() => go("projects")} />}
      </div>
      <div className="sb-group">
        <Section title={t("shell.nav.recents")} action={<IconBtn icon="plus" label={t("shell.nav.newChat")} onClick={() => go("home")} />} />
        {sessions.state === "ready" && sessions.data.filter((s) => !s.parentID && !s.projectID).slice(0, 12).map((s) => (
          <Row key={s.id} label={s.title || t("shell.nav.untitled")} child active={route === "chat" && params.get("source") !== "remote" && params.get("id") === s.id} onClick={() => go("chat", { id: s.id })} />
        ))}
        {sessions.state === "ready" && !sessions.data.length && <div className="sb-empty">{t("shell.nav.noChats")}</div>}
      </div>
      {remote.state !== "hidden" && <div className="sb-group">
        <Section title={t("chat.remote.recents")} />
        {remote.state === "loading" && <div className="sb-empty thinking" role="status">{t("system.variant.loading")}</div>}
        {remote.state === "error" && <div role="alert"><div className="sb-empty">{t("chat.remote.unavailable")}</div><Row label={t("common.retry")} icon="refresh" onClick={remote.reload} /></div>}
        {remote.state === "ready" && remote.data.slice(0, 12).map((s) => (
          <Row key={`${s.epoch}:${s.id}`} label={s.title || t("shell.nav.untitled")} child
            active={route === "chat" && params.get("source") === "remote" && params.get("epoch") === s.epoch && params.get("id") === s.id}
            onClick={() => go("chat", { source: "remote", epoch: s.epoch, id: s.id })} />
        ))}
        {remote.state === "ready" && !remote.data.length && <div className="sb-empty">{t("shell.nav.noChats")}</div>}
      </div>}
    </>)}
  </>);
}

function ProjectRows({ project, sessions }: { project: Project; sessions: Session[] }) {
  const t = useT();
  const { go, route, params } = useNav();
  const [open, setOpen] = React.useState(false);
  const panel = React.useId();
  return <>
    <button className="row" data-strong aria-expanded={open} aria-controls={panel} data-active={route === "project" && params.get("id") === project.id || undefined} onClick={() => setOpen((value) => !value)}>
      <Icon name={open ? "folder-open" : "folder"} className="ic" /><span className="label">{project.name}</span>
    </button>
    <div id={panel} className="fold" data-closed={!open || undefined} inert={!open}><div>
      {sessions.map((s) => <Row key={s.id} label={s.title || t("shell.nav.untitled")} child active={route === "chat" && params.get("source") !== "remote" && params.get("id") === s.id} onClick={() => go("chat", { id: s.id })} />)}
      <Row label={t("system.seeAll")} child onClick={() => go("project", { id: project.id })} />
    </div></div>
  </>;
}

function CodeNav({ route, go }: { route: Route; go: (r: Route, p?: Record<string, string>) => void }) {
  const t = useT();
  const fx = useFixtures<ShellFx>("shell");
  const preview = isPreview();
  const sessions = useSessions("code");
  return (<>
    <div className="sb-group">
      <Row label={t("shell.code.newTask")} icon="compose" active={route === "code"} onClick={() => go("code")} />
      <Row label={t("shell.code.reviews")} icon="pull-request" meta={preview ? "2" : undefined} active={route === "code-review"} onClick={() => go("code-review")} />
      <Row label={t("shell.code.allTasks")} icon="clock-loop" active={route === "code-tasks"} onClick={() => go("code-tasks")} />
    </div>
    {preview ? <>
      <div className="sb-group">
        <Section title={t("shell.code.repos")} action={<IconBtn icon="plus" label={t("shell.code.connectRepo")} onClick={() => go("code-settings")} />} />
        {fx.repos?.map((r) => (
          <React.Fragment key={r.name}>
            <Row label={r.name} icon="folder-code" strong onClick={() => go("code-tasks")} />
            {r.tasks.map((x, i) => <Row key={x.title} label={x.title} child dim={i > 0 || r.name !== fx.repos[0].name} meta={x.meta} status={x.status} active={route === x.to && !(x.to === "code-session" && previewChatStart())} onClick={() => go(x.to)} />)}
          </React.Fragment>
        ))}
      </div>
      <div className="sb-group">
        <Section title={t("shell.code.envs")} />
        {fx.envs?.map((e) => <Row key={e.name} label={e.name} icon={e.icon} meta={e.meta} status={e.status} active={route === "code-env" && !!e.status} onClick={() => go("code-env")} />)}
      </div>
    </> : (
      <div className="sb-group">
        <Section title={t("shell.code.sessions")} />
        {sessions.state === "ready" && sessions.data.slice(0, 12).map((s) => <Row key={s.id} label={s.title || t("shell.nav.untitled")} child active={route === "code-session"} onClick={() => go("code-session", { id: s.id })} />)}
        {sessions.state === "ready" && !sessions.data.length && <div className="sb-empty">{t("shell.code.noSessions")}</div>}
        <Section title={t("shell.code.envs")} />
        <Row label={t("shell.code.thisMac")} icon="terminal" meta={t("shell.code.ready")} status="green" active={route === "code-env"} onClick={() => go("code-env")} />
      </div>
    )}
  </>);
}
