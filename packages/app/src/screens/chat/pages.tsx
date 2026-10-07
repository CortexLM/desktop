// History and Library (designs "history", "library").
import * as React from "react";
import type { Session } from "@cortex/schema";
import { Icon, IconBtn, Pop, MItem, MSep, useToast } from "../../kit/ui";
import { api } from "../../api";
import { useSessions, useProjects } from "../../state/live";
import { useRemoteSessions } from "../../state/remote-list";
import { useNav } from "../../shell/nav";
import { useT, useI18n } from "../../i18n";
import { isPreview } from "../../preview";
import { Mascot } from "../../mascot/Mascot";
import { useBotCfg, useFx } from "./shared";

const css = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function Search({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const t = useT();
  return (
    <label className="pg-search">
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} />
      {value && <button type="button" aria-label={t("chat.clear")} onClick={() => onChange("")}><Icon name="close" size={12} /></button>}
    </label>
  );
}

/* ---------- Library ---------- */
type Kind = "projects" | "files" | "images" | "links";
type Item = { kind: Kind; title: string; desc: string; img: string; mono: string; who: string; when: string; id?: string; icon?: string; color?: string };
const FILTERS = ["all", "projects", "files", "images", "links"] as const;
const KIND_ICON: Record<Kind, string> = { projects: "folder", files: "file", images: "image", links: "link" };

export function Library() {
  const t = useT();
  const fx = useFx();
  const bot = useBotCfg();
  const { go } = useNav();
  const preview = isPreview();
  const projects = useProjects();
  const [f, setF] = React.useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = React.useState("");
  const items: Item[] = preview ? fx.library : projects.state === "ready" ? projects.data.map((p) => ({ kind: "projects", title: p.name, desc: p.instructions, img: "", mono: "", who: "", when: "", id: p.id, icon: p.icon, color: p.color })) : [];
  const list = items.filter((it) => (f === "all" || it.kind === f) && norm(it.title + " " + it.desc).includes(norm(q)));
  return (<>
    <div className="content-top">
      <span className="title">{t("chat.screen.library")}</span><div className="spacer" />
      <Search value={q} onChange={setQ} label={t("chat.library.search")} />
      <IconBtn icon="plus" label={t("chat.library.newProject")} onClick={() => go("projects", { v: "create" })} />
    </div>
    <div className="page">
      <div className="chips" role="group" aria-label={t("chat.library.filter")}>
        {FILTERS.map((c) => <button key={c} className="chip" aria-pressed={f === c} data-pressed={f === c || undefined} onClick={() => setF(c)}>{t(`chat.library.kind.${c}`)}</button>)}
      </div>
      {!preview && projects.state === "loading" ? <div className="pg-empty thinking" role="status">{t("system.variant.loading")}</div>
        : !preview && projects.state === "error" ? <div className="pg-empty" role="alert"><p>{t("work.error.loadText")}</p><button className="btn secondary" onClick={projects.reload}>{t("common.retry")}</button></div>
        : list.length ? (
        <div className="grid" key={f}>
          {list.map((it, i) => (
            <button key={it.id ?? it.title} className="card" style={css(i)} onClick={it.kind === "projects" ? () => go("project", it.id ? { id: it.id } : undefined) : undefined}>
              <div className="banner" style={it.img ? { backgroundImage: `url(/img/${it.img}.png)` } : undefined}><span className="tile" style={it.color ? { background: it.color } : undefined}>{it.icon ? <Icon name={it.icon} /> : it.mono}</span></div>
              <div className="body2">
                <h3>{it.title}</h3><p>{it.desc}</p>
                <div className="by"><Icon name={KIND_ICON[it.kind]} size={12} />{preview ? t("chat.library.by", { who: it.who, when: it.when }) : t("chat.library.kind.projects")}</div>
              </div>
            </button>
          ))}
        </div>
      ) : q || f !== "all" ? <div className="pg-empty">{q ? t("chat.library.noMatch", { q }) : t("chat.library.empty")}</div>
        : <div className="empty chat-empty" data-testid="library-empty">
          <Mascot cfg={bot} state="idle" size={72} track interactive />
          <h2>{t("chat.library.emptyTitle")}</h2><p>{t("chat.library.emptyBody")}</p>
          <div className="chat-row"><button className="btn secondary" onClick={() => go("upload")}><Icon name="paperclip" size={16} />{t("chat.library.import")}</button>
            <button className="btn primary" data-testid="library-new-project" onClick={() => go("projects", { v: "create" })}><Icon name="plus" size={16} />{t("chat.library.newProject")}</button></div>
        </div>}
    </div>
  </>);
}

/* ---------- History ---------- */
type H = { id: string; title: string; sub: string; when: string; group: string; task?: "ok" | "run" | "err"; pin?: boolean; order: number };
const PINS = "cortex.history.pins";

function dayGroup(ts: number, t: (k: string) => string) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  return days <= 0 ? t("chat.history.today") : days === 1 ? t("chat.history.yesterday") : days < 7 ? t("chat.history.week") : t("chat.history.older");
}

function useHistoryRows(): { rows: H[]; state: "loading" | "ready" | "error"; reload: () => void } {
  const t = useT();
  const { locale } = useI18n();
  const fx = useFx();
  const { params } = useNav();
  const projectID = params.get("project");
  const q = useSessions("chat");
  if (isPreview()) return { rows: (fx.history as Omit<H, "order">[]).map((h, order) => ({ ...h, order })), state: "ready", reload: () => {} };
  if (q.state !== "ready") return { rows: [], state: q.state, reload: q.reload };
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const rows = q.data.filter((s) => !s.parentID && (!projectID || s.projectID === projectID)).sort((a: Session, b: Session) => b.time.updated - a.time.updated).map((s, order): H => {
    const g = dayGroup(s.time.updated, t);
    const when = g === t("chat.history.today") || g === t("chat.history.yesterday") ? time.format(s.time.updated) : g === t("chat.history.week") ? day.format(s.time.updated) : date.format(s.time.updated);
    return { id: s.id, title: s.title || t("chat.untitled"), sub: s.model.modelID, when, group: g, order };
  });
  return { rows, state: "ready", reload: q.reload };
}

export function History() {
  const t = useT();
  const { go, params } = useNav();
  const toast = useToast();
  const preview = isPreview();
  const src = useHistoryRows();
  const remote = useRemoteSessions(!params.has("project"));
  const [local, setLocal] = React.useState<Record<string, Partial<H>>>({});
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [pins, setPins] = React.useState<Set<string>>(() => new Set(preview ? [] : JSON.parse(localStorage.getItem(PINS) ?? "[]")));
  const [q, setQ] = React.useState("");
  const [edit, setEdit] = React.useState<string | null>(null);
  const items = src.rows.filter((x) => !hidden.has(x.id)).map((x) => ({ ...x, ...local[x.id], pin: pins.has(x.id) || local[x.id]?.pin }));
  const set = (id: string, p: Partial<H>) => setLocal((m) => ({ ...m, [id]: { ...m[id], ...p } }));
  const togglePin = (x: H) => {
    const n = new Set(pins); if (n.has(x.id)) n.delete(x.id); else n.add(x.id);
    setPins(n); set(x.id, { pin: !x.pin });
    if (!preview) localStorage.setItem(PINS, JSON.stringify([...n]));
  };
  const rename = (x: H, v: string) => {
    set(x.id, { title: v });
    if (!preview) api.sessions.update(x.id, { title: v }).catch(() => { set(x.id, { title: x.title }); toast.add({ title: t("chat.err.generic.title"), data: { icon: "alert-triangle" } }); });
  };
  const remove = (x: H) => {
    setHidden((h) => new Set(h).add(x.id));
    let undone = false;
    // Undo puts back only this row, at its original place; the delete is sent once the toast closes.
    const restore = () => { undone = true; setHidden((h) => { const n = new Set(h); n.delete(x.id); return n; }); };
    toast.add({ title: t("chat.history.deleted"), description: x.title, data: { undo: true, icon: "trash", onUndo: restore },
      onClose: () => { if (!undone && !preview) api.sessions.delete(x.id).catch(() => { restore(); toast.add({ title: t("chat.err.generic.title"), data: { icon: "alert-triangle" } }); }); } });
  };
  const open = (x: H) => (preview ? go("chat") : go("chat", { id: x.id }));
  const shown = items.filter((x) => norm(x.title + " " + x.sub).includes(norm(q)));
  const order = [t("chat.history.pinned"), t("chat.history.today"), t("chat.history.yesterday"), t("chat.history.week"), t("chat.history.older")];
  const groups = order
    .map((g, k) => [g, shown.filter((x) => (k === 0 ? x.pin : !x.pin && x.group === g)).sort((a, b) => a.order - b.order)] as const)
    .filter(([, xs]) => xs.length);
  const badge = { ok: t("chat.history.badge.ok"), run: t("chat.history.badge.run"), err: t("chat.history.badge.err") };
  let n = 0;
  return (<>
    <div className="content-top">
      <span className="title">{t("chat.screen.history")}</span><div className="spacer" />
      <Search value={q} onChange={setQ} label={t("chat.history.search")} />
      <IconBtn icon="compose" label={t("chat.newChat")} kbd="⌘N" onClick={() => go("home", params.get("project") ? { project: params.get("project")! } : undefined)} />
    </div>
    <div className="page"><div className="pg-narrow">
      {groups.map(([g, xs]) => (
        <section key={g}>
          <h3 className="h3">{g}</h3>
          <div className="list">
            {xs.map((x) => (
              <div key={x.id} className="li pg-hrow" style={css(n++)} role="button" tabIndex={0}
                onClick={() => edit !== x.id && open(x)} onKeyDown={(e) => e.key === "Enter" && edit !== x.id && open(x)}>
                <span className="li-ic"><Icon name={x.task ? "bolt" : "compose"} /></span>
                <span className="grow">
                  {edit === x.id
                    ? <input className="input pg-rename" autoFocus defaultValue={x.title} aria-label={t("chat.history.newName")} onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEdit(null); }}
                        onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== x.title) rename(x, v); setEdit(null); }} />
                    : <div className="ttl">{x.pin && <Icon name="pin" size={12} />}{x.title}</div>}
                  <div className="sub">{x.sub}</div>
                </span>
                {x.task && <span className={"badge " + x.task}>{badge[x.task]}</span>}
                <span className="sub pg-when">{x.when}</span>
                <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Pop align="end" width={180} trigger={<IconBtn icon="more-dots" label={t("chat.history.more")} className="pg-more" />}>
                    <MItem icon="edit" onClick={() => setEdit(x.id)}>{t("chat.menu.rename")}</MItem>
                    <MItem icon="pin" onClick={() => togglePin(x)}>{x.pin ? t("chat.menu.unpin") : t("chat.menu.pin")}</MItem>
                    <MSep />
                    <MItem icon="trash" danger onClick={() => remove(x)}>{t("chat.menu.delete")}</MItem>
                  </Pop>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
      {!groups.length && !(src.state === "ready" && !q && remote.state === "ready" && remote.data.length > 0) && <div className="pg-empty">
        {src.state === "loading" ? <span className="thinking">{t("chat.history.loading")}</span>
          : src.state === "error" ? <>{t("chat.history.error")} <button className="chat-link" onClick={src.reload}>{t("common.retry")}</button></>
          : q ? t("chat.history.noMatch", { q }) : t("chat.history.empty")}
      </div>}
      {!preview && remote.state !== "hidden" && <section>
        <h3 className="h3">{t("chat.remote.recents")}</h3>
        {remote.state === "loading" && <div className="pg-empty thinking" role="status">{t("chat.history.loading")}</div>}
        {remote.state === "error" && <div className="pg-empty" role="alert">
          {t("chat.remote.unavailable")} <button className="chat-link" onClick={remote.reload}>{t("common.retry")}</button>
        </div>}
        {remote.state === "ready" && <>
          <div className="list">
            {remote.data.filter((s) => norm(s.title + " " + s.modelSlug).includes(norm(q))).map((s) => (
              <div key={`${s.epoch}:${s.id}`} className="li pg-hrow" style={css(n++)} role="button" tabIndex={0}
                onClick={() => go("chat", { source: "remote", epoch: s.epoch, id: s.id })}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  go("chat", { source: "remote", epoch: s.epoch, id: s.id });
                }}>
                <span className="li-ic"><Icon name="compose" /></span>
                <span className="grow"><div className="ttl">{s.title || t("chat.untitled")}</div><div className="sub">{s.modelSlug}</div></span>
              </div>
            ))}
          </div>
          {!remote.data.some((s) => norm(s.title + " " + s.modelSlug).includes(norm(q))) && <div className="pg-empty">
            {q ? t("chat.history.noMatch", { q }) : t("chat.history.empty")}
          </div>}
        </>}
      </section>}
    </div></div>
  </>);
}
