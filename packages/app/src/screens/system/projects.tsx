// Projects grid, project detail and memory.
import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Tabs } from "@base-ui/react/tabs";
import type { Project } from "@cortex/schema";
import { Icon, IconBtn, Switch, Pop, MItem, MSep, Tip, useToast } from "../../kit/ui";
import { Mascot } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { api } from "../../api";
import { useBots, useProjects, useQuery, useSessions } from "../../state/live";
import { Top, BotEmpty, useFx, useBotCfg, useAgo, css, norm, NB } from "./common";

// Project tile palette (design swatches; the colour is the project's identity, not a UI colour).
const PROJ_COLORS: [string, Project["color"]][] = [["violet", "#8448FF"], ["blue", "#1E7BFF"], ["teal", "#12B8A0"], ["orange", "#FF6A13"], ["pink", "#EE3A97"], ["slate", "#5F6B7E"]];
const PROJ_ICONS = ["folder", "rocket", "calendar", "image", "mail", "globe", "code", "bolt"] as const;

const Avs = ({ m, max = 3 }: { m: string[]; max?: number }) => {
  const t = useT();
  return <span className="systeme-avs" aria-label={t("system.members", { count: m.length })}>{m.slice(0, max).map((x) => <span key={x} className="systeme-mono-av">{x}</span>)}{m.length > max && <span className="systeme-mono-av">+{m.length - max}</span>}</span>;
};

function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const { go } = useNav();
  const fx = useFx();
  const toast = useToast();
  const preview = isPreview();
  const [name, setName] = React.useState(preview ? fx.newProject.name : "");
  const [icon, setIcon] = React.useState<Project["icon"]>("calendar");
  const [color, setColor] = React.useState(PROJ_COLORS[0][1]);
  const [instr, setInstr] = React.useState(preview ? fx.newProject.instructions : "");
  const [busy, setBusy] = React.useState(false);
  const pending = React.useRef(false), mounted = React.useRef(false);
  const draft = React.useRef({ name, icon, color, instructions: instr });
  draft.current = { name, icon, color, instructions: instr };
  React.useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const create = async () => {
    if (!name.trim() || pending.current || !mounted.current) return;
    if (preview) { onOpenChange(false); toast.add({ title: t("system.projects.created"), description: name, data: { icon: "folder" } }); return; }
    const captured = JSON.stringify(draft.current);
    pending.current = true; setBusy(true);
    try {
      const p = await api.projects.create({ ...draft.current, name: name.trim() });
      if (!mounted.current) return;
      toast.add({ title: t("system.projects.created"), description: p.name, data: { icon: "folder" } });
      if (JSON.stringify(draft.current) === captured) { onOpenChange(false); go("project", { id: p.id }); }
    } catch { if (mounted.current) toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } }); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return (
    <Dialog.Root open={open} onOpenChange={(next, event) => { if (pending.current) event.cancel(); else onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="backdrop" />
        <Dialog.Popup className="dialog systeme-dialog">
          <Dialog.Title>{t("system.projects.new")}</Dialog.Title>
          <Dialog.Description>{t("system.projects.newDesc")}</Dialog.Description>
          <div className="systeme-preview"><span className="systeme-tile" style={{ background: color }}><Icon name={icon} /></span><span><b style={{ fontWeight: 500 }}>{name || t("system.untitled")}</b><div className="sub" style={{ color: "var(--t2)" }}>{t("system.projects.emptyCounts")}</div></span></div>
          <form aria-busy={busy} onSubmit={(e) => { e.preventDefault(); void create(); }}>
            <div className="field"><label htmlFor="systeme-pn">{t("system.projects.name")}</label><input id="systeme-pn" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={48} required /></div>
            <div className="field"><label id="systeme-pi">{t("system.projects.icon")}</label>
              <RadioGroup value={icon} onValueChange={setIcon} className="systeme-icons" aria-labelledby="systeme-pi">{PROJ_ICONS.map((x) => <Radio.Root nativeButton render={<button />} value={x} key={x} tabIndex={icon === x ? 0 : -1} aria-label={t(`system.icon.${x}`)} className="systeme-icopt"><Icon name={x} /></Radio.Root>)}</RadioGroup></div>
            <div className="field"><label id="systeme-pc">{t("system.projects.color")}</label>
              <RadioGroup value={color} onValueChange={setColor} className="systeme-colors" aria-labelledby="systeme-pc">{PROJ_COLORS.map(([l, c]) => <Tip key={c} label={t(`system.color.${l}`)}><Radio.Root nativeButton render={<button />} value={c} tabIndex={color === c ? 0 : -1} aria-label={t(`system.color.${l}`)} className="systeme-color" style={{ background: c }} /></Tip>)}</RadioGroup></div>
            <div className="field"><label htmlFor="systeme-pins">{t("system.projects.instructions")}</label><textarea id="systeme-pins" className="input" value={instr} onChange={(e) => setInstr(e.target.value)} maxLength={4000} /><span className="sub" style={{ color: "var(--t2)", fontSize: 11 }}>{t("system.projects.instructionsHint")}</span></div>
            <div className="systeme-actions"><Dialog.Close className="btn secondary" type="button" disabled={busy}>{t("system.common.cancel")}</Dialog.Close><button className="btn primary" disabled={!name.trim() || busy}>{t("system.projects.create")}</button></div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ProjectsScreen() {
  return isPreview() ? <ProjectsPreview /> : <ProjectsLive />;
}

function ProjectsPreview() {
  const t = useT();
  const { go } = useNav();
  const fx = useFx();
  const [v] = useVariant("grid");
  const [open, setOpen] = React.useState(v === "create");
  React.useEffect(() => setOpen(v === "create"), [v]);
  const list = v !== "empty" ? fx.projects : [];
  return (<>
    <Top title={t("system.projects.title")}><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" />{t("system.projects.new")}</button></Top>
    {list.length ? (
      <div className="page"><div className="systeme-pgrid">
        {list.map((p, i) => (
          <button key={p.name} className="systeme-pcard" style={css(i)} onClick={() => go("project")}>
            <div className="systeme-cover" style={{ backgroundImage: `url(/img/${p.img}.png)` }}><span className="systeme-tile" style={{ background: p.color }}><Icon name={p.icon} /></span></div>
            <div className="systeme-pbody"><h3>{p.name}</h3><p>{p.desc}</p>
              <div className="systeme-pfoot"><span><Icon name="compose" size={12} />{t("system.chats", { count: p.chats })}</span><span><Icon name="file" size={12} />{t("system.files", { count: p.files })}</span><Avs m={p.members} /></div>
            </div>
          </button>
        ))}
        <button className="systeme-pnew" style={css(list.length)} onClick={() => setOpen(true)}><Icon name="plus" size={20} />{t("system.projects.new")}</button>
      </div></div>
    ) : (
      <BotEmpty title={t("system.projects.emptyTitle")} text={t("system.projects.emptyText")}>
        <button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" />{t("system.projects.createOne")}</button>
      </BotEmpty>
    )}
    <NewProjectDialog key={String(open)} open={open} onOpenChange={setOpen} />
  </>);
}

function ProjectReadError({ reload }: { reload: () => void }) {
  const t = useT();
  return <BotEmpty state="blocked" title={t("work.error.loadTitle")} text={t("work.error.loadText")}><button className="btn secondary" onClick={reload}>{t("common.retry")}</button></BotEmpty>;
}

function ProjectsLive() {
  const t = useT();
  const { go } = useNav();
  const projects = useProjects(), sessions = useSessions("chat");
  const [v, setV] = useVariant("grid");
  const [open, setOpen] = React.useState(v === "create");
  React.useEffect(() => setOpen(v === "create"), [v]);
  const close = (next: boolean) => { setOpen(next); if (!next && v === "create") setV("grid"); };
  const chats = sessions.state === "ready" ? sessions.data.filter((s) => !s.parentID) : [];
  return (<>
    <Top title={t("system.projects.title")}><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" />{t("system.projects.new")}</button></Top>
    {projects.state === "error" || sessions.state === "error" ? <ProjectReadError reload={() => { projects.reload(); sessions.reload(); }} />
      : projects.state === "loading" || sessions.state === "loading" ? <div className="thinking" role="status">{t("system.variant.loading")}</div>
      : projects.data.length === 0 ? <BotEmpty title={t("system.projects.emptyTitle")} text={t("system.projects.emptyText")}><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" />{t("system.projects.createOne")}</button></BotEmpty>
      : <div className="page"><div className="systeme-pgrid">
        {projects.data.map((p, i) => <button key={p.id} className="systeme-pcard" style={css(i)} onClick={() => go("project", { id: p.id })}>
          <div className="systeme-cover"><span className="systeme-tile" style={{ background: p.color }}><Icon name={p.icon} /></span></div>
          <div className="systeme-pbody"><h3>{p.name}</h3><div className="systeme-pfoot"><span><Icon name="compose" size={12} />{t("system.chats", { count: chats.filter((s) => s.projectID === p.id).length })}</span></div></div>
        </button>)}
        <button className="systeme-pnew" style={css(projects.data.length)} onClick={() => setOpen(true)}><Icon name="plus" size={20} />{t("system.projects.new")}</button>
      </div></div>}
    <NewProjectDialog key={String(open)} open={open} onOpenChange={close} />
  </>);
}

/* ---------- Project ---------- */
export function ProjectScreen() {
  const { params } = useNav();
  return isPreview() ? <ProjectPreview /> : <ProjectLive key={params.get("id") ?? ""} id={params.get("id") ?? ""} />;
}

function ProjectLive({ id }: { id: string }) {
  const t = useT();
  const { go } = useNav();
  const toast = useToast(), ago = useAgo();
  const savedVersion = React.useRef(0);
  const project = useQuery(async () => {
    const version = savedVersion.current;
    return { value: await (id ? api.projects.get(id) : Promise.reject({ code: "not_found" })), version };
  }, [id], (e) => (e.type === "project.changed" || e.type === "project.deleted") && e.properties.projectID === id);
  const sessions = useSessions("chat");
  const [v, setV] = useVariant("overview"), [draft, setDraft] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState<Project | null>(null), [busy, setBusy] = React.useState(false);
  const mounted = React.useRef(false), pending = React.useRef(false), currentDraft = React.useRef(draft);
  currentDraft.current = draft;
  React.useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = async () => {
    if (draft === null || pending.current || !mounted.current) return;
    const captured = draft; pending.current = true; setBusy(true);
    try {
      const saved = await api.projects.update(id, { instructions: captured });
      if (!mounted.current) return;
      savedVersion.current++; setAccepted(saved); project.reload();
      if (currentDraft.current === captured) setDraft(null);
      toast.add({ title: t("system.project.saved"), data: { icon: "check-circle" } });
    } catch { if (mounted.current) toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } }); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const remove = async () => {
    if (pending.current || !mounted.current) return;
    pending.current = true; setBusy(true);
    try { await api.projects.delete(id); if (mounted.current) go("projects"); }
    catch (error) {
      const busy = error instanceof Error && "code" in error && error.code === "session_busy";
      if (mounted.current) toast.add({ title: busy ? t("chat.err.session_busy.title") : t("chat.err.generic.title"), description: busy ? t("chat.err.session_busy.body") : undefined, data: { icon: "alert-triangle" } });
    }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  if (!id || project.state === "error" && project.code === "not_found") return (<>
    <Top title={t("system.projects.title")} />
    <BotEmpty title={t("system.project.missingTitle")} text={t("system.projects.emptyText")}><button className="btn secondary" onClick={() => go("projects")}>{t("system.project.myProjects")}</button></BotEmpty>
  </>);
  if (project.state !== "ready") return <><Top title={t("system.projects.title")} />{project.state === "error" ? <ProjectReadError reload={project.reload} /> : <div className="thinking" role="status">{t("system.variant.loading")}</div>}</>;
  // Acknowledged writes cover earlier reads; the next fresh read wins even with equal timestamps.
  const p = accepted && project.data.version < savedVersion.current ? accepted : project.data.value;
  const chats = sessions.state === "ready" ? sessions.data.filter((s) => !s.parentID && s.projectID === id) : [];
  const tabs = ["overview", "files", "instructions", "sharing"], tab = tabs.includes(v) ? v : "overview";
  const edit = () => { if (draft === null) setDraft(p.instructions); setV("instructions"); };
  const unavailable = () => toast.add({ title: t("system.unavailable"), data: { icon: "alert-triangle" } });
  return (<>
    <Top title={t("system.projects.title")}><IconBtn icon="share" label={t("system.project.share")} onClick={() => setV("sharing")} /><Pop align="end" width={200} trigger={<IconBtn icon="more-dots" label={t("system.moreActions")} disabled={busy} />}><MItem icon="edit" onClick={unavailable}>{t("system.rename")}</MItem><MItem icon="archive" onClick={unavailable}>{t("system.archive")}</MItem><MSep /><MItem icon="trash" danger onClick={() => void remove()}>{t("system.project.delete")}</MItem></Pop></Top>
    <div className="page"><Tabs.Root className="systeme-mid" value={tab} onValueChange={(value) => { if (typeof value === "string") setV(value); }}>
      <div className="systeme-phead"><span className="systeme-tile" style={{ background: p.color }}><Icon name={p.icon} size={20} /></span>
        <div className="systeme-grow"><h1>{p.name}</h1>{sessions.state === "ready" && <div className="sub">{t("system.chats", { count: chats.length })}</div>}</div>
        <button className="btn primary" onClick={() => go("home", { project: id })}><Icon name="compose" />{t("system.cmd.newChat")}</button>
      </div>
      <Tabs.List className="systeme-tabs" aria-label={t("system.project.sections")}>{tabs.map((value) => <Tabs.Tab key={value} value={value} className="systeme-tab">{t(`system.project.tab.${value}`)}</Tabs.Tab>)}</Tabs.List>
      <Tabs.Panel value="overview" className="systeme-rise"><div className="systeme-pcols"><div>
        <div className="systeme-sec"><div className="systeme-sec-head"><h3 className="h3">{t("system.project.chats")}</h3><button className="systeme-sel" onClick={() => go("history", { project: id })}>{t("system.seeAll")}<Icon name="chevron-right" size={12} /></button></div>
          {sessions.state === "error" ? <ProjectReadError reload={sessions.reload} /> : sessions.state === "loading" ? <div className="thinking" role="status">{t("system.variant.loading")}</div> : chats.length === 0 ? <div className="pg-empty">{t("shell.nav.noChats")}</div>
            : <div className="list">{chats.slice(0, 4).map((s, i) => <button key={s.id} className="li systeme-rise" style={{ ...css(i), textAlign: "left", width: "100%" }} onClick={() => go("chat", { id: s.id })}><span className="li-ic"><Icon name="compose" /></span><span className="grow ttl">{s.title || t("shell.nav.untitled")}</span><span className="sub">{ago(s.time.updated)}</span></button>)}</div>}
        </div>
        <div className="systeme-sec"><h3 className="h3">{t("system.project.recentFiles")}</h3><div className="pg-empty">{t("system.unavailable")}</div></div>
      </div><div className="systeme-card"><div className="systeme-sec-head"><h3 className="h3">{t("system.projects.instructions")}</h3><IconBtn icon="edit" label={t("system.project.editInstructions")} onClick={edit} /></div><p className="systeme-instr" style={{ display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12, lineHeight: "18px", color: "var(--t2)" }}>{p.instructions}</p></div></div></Tabs.Panel>
      <Tabs.Panel value="instructions" className="systeme-rise"><div className="systeme-narrow" style={{ margin: 0 }}>
        <p style={{ color: "var(--t2)", margin: "0 0 12px" }}>{t("system.projects.instructionsHint")}</p>
        {draft !== null ? <>
          <textarea className="input systeme-instr-edit" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={t("system.project.instructionsLabel")} autoFocus maxLength={4000} />
          <div className="systeme-actions" style={{ justifyContent: "space-between" }}><span className="sub" style={{ color: "var(--t2)" }}>{t("system.project.chars", { n: draft.length, max: (4000).toLocaleString(t("system.numberLocale")) })}</span>
            <span style={{ display: "flex", gap: 8 }}><button className="btn secondary" disabled={busy} onClick={() => setDraft(null)}>{t("system.common.cancel")}</button><button className="btn primary" disabled={busy} onClick={() => void save()}>{t("system.common.save")}</button></span></div>
        </> : <div className="systeme-card"><div className="systeme-sec-head"><h3 className="h3">{t("system.project.instructionsLabel")}</h3><button className="btn secondary" onClick={edit}><Icon name="edit" />{t("system.edit")}</button></div><p className="systeme-instr">{p.instructions}</p></div>}
      </div></Tabs.Panel>
      {["files", "sharing"].map((value) => <Tabs.Panel key={value} value={value} className="systeme-rise"><div className="pg-empty">{t("system.unavailable")}</div></Tabs.Panel>)}
    </Tabs.Root></div>
  </>);
}

function ProjectPreview() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const bot = useBotCfg();
  const fx = useFx();
  const [v, setV] = useVariant("overview");
  const p = fx.project;
  const [instr, setInstr] = React.useState(p.instructions);
  const [edit, setEdit] = React.useState(false);
  const [roles, setRoles] = React.useState(p.people.map((m) => m[3]));
  const tabs = ["overview", "files", "instructions", "sharing"];
  const tab = tabs.includes(v) ? v : "overview";
  const files = (n?: number) => (
    <div className="list">{p.fileList.slice(0, n).map(([f, s, w, to], i) => (
      <div key={f} className="li systeme-rise" style={css(i)}><span className="li-ic"><Icon name={to === "file-image" ? "image" : "file"} /></span>
        <span className="grow"><div className="ttl">{f}</div><div className="sub">{s} · {w}</div></span>
        <IconBtn icon="download" label={t("system.project.download", { name: f })} onClick={() => toast.add({ title: t("system.project.downloading"), description: f, data: { icon: "download" } })} />
        <button className="btn secondary" onClick={() => go(to)}>{t("system.open")}</button></div>))}</div>
  );
  const botCard = (
    <div className="systeme-card"><h3 className="h3">{t("system.project.assignedBot")}</h3>
      <div className="systeme-bot"><Mascot cfg={bot} state="working" size={40} /><span className="systeme-grow"><b>{bot.name}</b><span>{p.botDoing}</span></span>
        <Pop align="end" width={200} trigger={<IconBtn icon="more-dots" label={t("system.project.botOptions")} />}><MItem icon="bot" onClick={() => go("bot")}>{t("system.project.openBot", { name: bot.name })}</MItem><MItem icon="pause">{t("system.project.pause")}</MItem><MSep /><MItem icon="close" danger>{t("system.project.removeBot")}</MItem></Pop></div>
    </div>
  );
  return (<>
    <Top title={t("system.projects.title")}><IconBtn icon="share" label={t("system.project.share")} onClick={() => setV("sharing")} /><Pop align="end" width={200} trigger={<IconBtn icon="more-dots" label={t("system.moreActions")} />}><MItem icon="edit">{t("system.rename")}</MItem><MItem icon="archive">{t("system.archive")}</MItem><MSep /><MItem icon="trash" danger>{t("system.project.delete")}</MItem></Pop></Top>
    <div className="page"><div className="systeme-mid">
      <div className="systeme-phead">
        <span className="systeme-tile" style={{ background: p.color }}><Icon name={p.icon} size={20} /></span>
        <div className="systeme-grow"><h1>{p.name}</h1><div className="sub">{p.desc} · {t("system.chats", { count: p.chats })} · {t("system.files", { count: p.files })}</div></div>
        <Avs m={p.members} />
        <button className="btn primary" onClick={() => go("home")}><Icon name="compose" />{t("system.cmd.newChat")}</button>
      </div>
      <div className="systeme-tabs" role="tablist" aria-label={t("system.project.sections")}>
        {tabs.map((id) => <button key={id} role="tab" aria-selected={tab === id} className="systeme-tab" onClick={() => setV(id)}>{t(`system.project.tab.${id}`)}</button>)}
      </div>
      <div key={tab} role="tabpanel" className="systeme-rise">
        {tab === "overview" && <div className="systeme-pcols">
          <div>
            <div className="systeme-sec"><div className="systeme-sec-head"><h3 className="h3">{t("system.project.chats")}</h3><button className="systeme-sel" onClick={() => go("history")}>{t("system.seeAll")}<Icon name="chevron-right" size={12} /></button></div>
              <div className="list">{p.chatList.map(([c, w], i) => <button key={c} className="li systeme-rise" style={{ ...css(i), textAlign: "left", width: "100%" }} onClick={() => go("chat")}><span className="li-ic"><Icon name="compose" /></span><span className="grow ttl">{c}</span><span className="sub">{w}</span></button>)}</div></div>
            <div className="systeme-sec"><div className="systeme-sec-head"><h3 className="h3">{t("system.project.recentFiles")}</h3><button className="systeme-sel" onClick={() => setV("files")}>{t("system.files", { count: p.files })}<Icon name="chevron-right" size={12} /></button></div>{files(3)}</div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div className="systeme-card"><div className="systeme-sec-head"><h3 className="h3">{t("system.projects.instructions")}</h3><IconBtn icon="edit" label={t("system.project.editInstructions")} onClick={() => { setV("instructions"); setEdit(true); }} /></div>
              <p className="systeme-instr" style={{ display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12, lineHeight: "18px", color: "var(--t2)" }}>{instr}</p></div>
            {botCard}
            <div className="systeme-card"><h3 className="h3">{t("system.project.members")}</h3>
              {p.people.map(([a, n, , r]) => <div key={a} className="systeme-row" style={{ padding: 0 }}><span className="systeme-mono-av">{a}</span><span className="systeme-grow">{n}</span><span className="systeme-meta">{t(`system.role.${r}`)}</span></div>)}</div>
          </div>
        </div>}
        {tab === "files" && <>
          <div className="systeme-drop"><Icon name="paperclip" />{t("system.project.drop")} <button className="systeme-textbtn" onClick={() => go("upload")}>{t("system.project.browse")}</button></div>
          {files()}
        </>}
        {tab === "instructions" && <div className="systeme-narrow" style={{ margin: 0 }}>
          <p style={{ color: "var(--t2)", margin: "0 0 12px" }}>{t("system.project.instructionsLead")}</p>
          {edit ? <>
            <textarea className="input systeme-instr-edit" value={instr} onChange={(e) => setInstr(e.target.value)} aria-label={t("system.project.instructionsLabel")} autoFocus maxLength={4000} />
            <div className="systeme-actions" style={{ justifyContent: "space-between" }}><span className="sub" style={{ color: "var(--t2)" }}>{t("system.project.chars", { n: instr.length, max: (4000).toLocaleString(t("system.numberLocale")) })}</span>
              <span style={{ display: "flex", gap: 8 }}><button className="btn secondary" onClick={() => { setInstr(p.instructions); setEdit(false); }}>{t("system.common.cancel")}</button><button className="btn primary" onClick={() => { setEdit(false); toast.add({ title: t("system.project.saved"), data: { icon: "check-circle" } }); }}>{t("system.common.save")}</button></span></div>
          </> : <div className="systeme-card"><div className="systeme-sec-head"><h3 className="h3">{t("system.project.instructionsLabel")}</h3><button className="btn secondary" onClick={() => setEdit(true)}><Icon name="edit" />{t("system.edit")}</button></div><p className="systeme-instr">{instr}</p></div>}
        </div>}
        {tab === "sharing" && <div className="systeme-pcols">
          <div>
            <h3 className="h3">{t("system.project.invite")}</h3>
            <form className="systeme-inline" style={{ marginBottom: 20 }} onSubmit={(e) => { e.preventDefault(); toast.add({ title: t("system.project.invited"), description: p.invite, data: { icon: "mail" } }); }}>
              <input className="input" type="email" defaultValue={p.invite} aria-label={t("system.project.inviteLabel")} /><button className="btn primary">{t("system.project.inviteBtn")}</button></form>
            <h3 className="h3">{t("system.project.membersCount", { n: p.people.length })}</h3>
            <div className="list">{p.people.map(([a, n, m], i) => (
              <div key={a} className="li"><span className="systeme-mono-av" style={{ width: 32, height: 32, borderRadius: 16 }}>{a}</span><span className="grow"><div className="ttl">{n}</div><div className="sub">{m}</div></span>
                {i === 0 ? <span className="sub" style={{ color: "var(--t2)" }}>{t("system.role.owner")}</span> :
                  <Pop align="end" width={180} trigger={<button className="systeme-sel">{t(`system.role.${roles[i]}`)}<Icon name="chevron-up-down" size={12} /></button>}>
                    {(["editor", "viewer"] as const).map((r) => <MItem key={r} icon={roles[i] === r ? "check" : undefined} onClick={() => setRoles((rs) => rs.map((x, j) => (j === i ? r : x)))}>{t(`system.role.${r}`)}</MItem>)}<MSep /><MItem icon="close" danger>{t("system.remove")}</MItem></Pop>}
              </div>))}</div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div className="systeme-card"><h3 className="h3">{t("system.project.link")}</h3>
              <div className="systeme-link"><Icon name="link" size={16} /><span className="mono">{p.link}</span><IconBtn icon="copy" label={t("system.project.copyLink")} onClick={() => toast.add({ title: t("system.project.linkCopied"), data: { icon: "copy" } })} /></div>
              <label className="systeme-row" style={{ padding: 0, marginTop: 10 }}><span className="systeme-grow">{t("system.project.orgAccess", { org: fx.user.org })}</span><Switch defaultChecked aria-label={t("system.project.orgAccessLabel", { org: fx.user.org })} /></label>
              <p className="sub" style={{ color: "var(--t2)", margin: "4px 0 0" }}>{t("system.project.orgAccessHint")}</p></div>
            {botCard}
          </div>
        </div>}
      </div>
    </div></div>
  </>);
}

/* ---------- Memory ---------- */
type Mem = { id: string; theme: string; text: string; src: string };

export function MemoryScreen() {
  const t = useT();
  const toast = useToast();
  const fx = useFx();
  const ago = useAgo();
  const preview = isPreview();
  const [v, setV] = useVariant("list");
  const bots = useBots();
  const bot = !preview && bots.state === "ready" ? bots.data[0] : undefined;
  const live = useQuery(() => (bot ? api.bots.memory.list(bot.id).then((entries) => ({ botID: bot.id, entries })) : Promise.resolve(null)), [bot?.id]);
  const fromFx = (): Mem[] => fx.memory.items.map((m) => ({ id: String(m.id), theme: m.theme, text: m.text, src: m.src }));
  const [items, setItems] = React.useState<Mem[]>(preview && v !== "empty" ? fromFx() : []);
  const [on, setOn] = React.useState(v !== "off");
  const [q, setQ] = React.useState("");
  const [edit, setEdit] = React.useState<string | null>(null);
  const deleting = React.useRef(new Set<string>());
  const [pending, setPending] = React.useState<string[]>([]);
  React.useLayoutEffect(() => {
    deleting.current = new Set(); setPending([]);
    return () => { deleting.current = new Set(); };
  }, [bot?.id, preview]);
  React.useEffect(() => { if (!preview) return; setOn(v !== "off"); setItems(v === "empty" ? [] : fromFx()); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const memories = live.state === "ready" && live.data?.botID === bot?.id ? live.data?.entries : undefined;
  React.useEffect(() => {
    if (!preview && memories && bot) setItems(memories.map((m) => ({ id: m.id, theme: bot.name, text: m.content, src: t("system.memory.learned", { when: ago(m.time) }) })));
  }, [memories, bot?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.filter((m) => norm(m.text).includes(norm(q)));
  const themes = [...new Set(shown.map((m) => m.theme))];
  const forget = (m: Mem) => {
    if (!preview) {
      if (!bot || deleting.current.has(m.id)) return;
      const request = deleting.current; request.add(m.id); setPending([...request]);
      api.bots.memory.delete(bot.id, m.id).then(() => {
        if (deleting.current !== request) return;
        setItems((xs) => xs.filter((x) => x.id !== m.id));
        toast.add({ title: t("system.memory.forgotten"), description: m.text, data: { icon: "trash" } });
      }, () => {
        if (deleting.current === request) toast.add({ title: t("system.memory.forgetFailed"), data: { icon: "alert-triangle" } });
      }).finally(() => { if (deleting.current === request) { request.delete(m.id); setPending([...request]); } });
      return;
    }
    setItems((xs) => xs.filter((x) => x.id !== m.id));
    toast.add({ title: t("system.memory.forgotten"), description: m.text, data: { icon: "trash", undo: true, onUndo: () => setItems((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m])) } });
  };
  let n = 0;
  return (<>
    <Top title={t("system.memory.title")}>
      {items.length > 0 && <label className="pg-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("system.memory.search")} aria-label={t("system.memory.search")} /></label>}
      <IconBtn icon="download" label={t("system.memory.export")} onClick={() => {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        if (!preview) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fx.memory?.exportFile ?? "memory.json"; a.click(); }
        toast.add({ title: t("system.memory.exported"), description: t("system.memory.exportedDesc", { count: items.length }), data: { icon: "download" } });
      }} />
      <Pop align="end" width={220} trigger={<IconBtn icon="more-dots" label={t("system.moreActions")} />}><MItem icon="settings">{t("system.memory.privacy")}</MItem><MSep /><MItem icon="trash" danger onClick={() => (preview ? setItems([]) : items.forEach(forget))}>{t("system.memory.forgetAll")}</MItem></Pop>
    </Top>
    <div className="page"><div className="systeme-narrow">
      <div className="systeme-memoff">
        <span className="li-ic"><Icon name="key" /></span>
        <span className="systeme-grow"><b>{on ? t("system.memory.onTitle") : t("system.memory.offTitle")}</b><span>{on ? t("system.memory.onText") : t("system.memory.offText")}</span></span>
        <Switch checked={on} onCheckedChange={(x) => { setOn(x); if (preview) setV(x ? "list" : "off"); }} aria-label={t("system.memory.toggle")} />
      </div>
      {!on && <div className="banner warn" style={{ margin: "0 0 16px" }}><Icon name="pause" /><span>{t("system.memory.paused")}</span><span className="grow">{t("system.memory.pausedText", { count: items.length })}</span></div>}
      {!preview && (bots.state === "error" || live.state === "error") ? <BotEmpty state="blocked" title={t("work.error.loadTitle")} text={t("work.error.loadText")}><button className="btn secondary" onClick={bots.state === "error" ? bots.reload : live.reload}>{t("common.retry")}</button></BotEmpty>
      : !preview && (bots.state === "loading" || bot && !memories) ? null : items.length === 0 ? (
        <BotEmpty state={on ? "idle" : "asleep"} title={t("system.memory.emptyTitle")} text={t("system.memory.emptyText", { q1: `«${NB}`, q2: `${NB}»` })} />
      ) : (
        <div className={on ? undefined : "systeme-faded"}>
          {themes.map((th) => (
            <section key={th} className="systeme-sec">
              <h3 className="h3">{th} · {shown.filter((m) => m.theme === th).length}</h3>
              <div className="list">{shown.filter((m) => m.theme === th).map((m) => (
                <div key={m.id} className="systeme-mem" style={css(n++)}>
                  <span className="systeme-grow">
                    {edit === m.id ? <textarea className="input" autoFocus defaultValue={m.text} aria-label={t("system.memory.editLabel")}
                      onKeyDown={(e) => { if (e.key === "Escape") setEdit(null); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
                      onBlur={(e) => { const x = e.currentTarget.value.trim(); if (x) setItems((xs) => xs.map((y) => (y.id === m.id ? { ...y, text: x } : y))); setEdit(null); }} />
                      : m.text}
                    <div className="sub">{m.src}</div>
                  </span>
                  <span className="systeme-mem-act">{preview && <IconBtn icon="edit" label={t("system.edit")} onClick={() => setEdit(m.id)} />}<IconBtn icon="trash" label={t("system.memory.forget")} disabled={!preview && pending.includes(m.id)} onClick={() => forget(m)} /></span>
                </div>))}</div>
            </section>))}
          {!shown.length && <div className="pg-empty">{t("system.memory.noMatch", { q: `${NB}${q}${NB}` })}</div>}
        </div>
      )}
    </div></div>
  </>);
}
