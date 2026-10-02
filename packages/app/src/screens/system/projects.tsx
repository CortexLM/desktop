// Projects grid, project detail and memory.
import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Icon, IconBtn, Switch, Pop, MItem, MSep, Tip, useToast } from "../../kit/ui";
import { Mascot } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { api } from "../../api";
import { useBots, useQuery } from "../../state/live";
import { Top, BotEmpty, useFx, useBotCfg, useAgo, css, norm, NB } from "./common";

// Project tile palette (design swatches; the colour is the project's identity, not a UI colour).
const PROJ_COLORS: [string, string][] = [["violet", "#8448FF"], ["blue", "#1E7BFF"], ["teal", "#12B8A0"], ["orange", "#FF6A13"], ["pink", "#EE3A97"], ["slate", "#5F6B7E"]];
const PROJ_ICONS = ["folder", "rocket", "calendar", "image", "mail", "globe", "code", "bolt"];

const Avs = ({ m, max = 3 }: { m: string[]; max?: number }) => {
  const t = useT();
  return <span className="systeme-avs" aria-label={t("system.members", { count: m.length })}>{m.slice(0, max).map((x) => <span key={x} className="systeme-mono-av">{x}</span>)}{m.length > max && <span className="systeme-mono-av">+{m.length - max}</span>}</span>;
};

function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const fx = useFx();
  const toast = useToast();
  const preview = isPreview();
  const [name, setName] = React.useState(preview ? fx.newProject.name : "");
  const [icon, setIcon] = React.useState("calendar");
  const [color, setColor] = React.useState(PROJ_COLORS[0][1]);
  const [instr, setInstr] = React.useState(preview ? fx.newProject.instructions : "");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="backdrop" />
        <Dialog.Popup className="dialog systeme-dialog">
          <Dialog.Title>{t("system.projects.new")}</Dialog.Title>
          <Dialog.Description>{t("system.projects.newDesc")}</Dialog.Description>
          <div className="systeme-preview"><span className="systeme-tile" style={{ background: color }}><Icon name={icon} /></span><span><b style={{ fontWeight: 500 }}>{name || t("system.untitled")}</b><div className="sub" style={{ color: "var(--t2)" }}>{t("system.projects.emptyCounts")}</div></span></div>
          <form onSubmit={(e) => {
            e.preventDefault(); if (!name.trim()) return; onOpenChange(false);
            // ponytail: projects have no engine route yet; live creation reports it honestly instead of faking a row.
            toast.add(preview ? { title: t("system.projects.created"), description: name, data: { icon: "folder" } } : { title: t("system.unavailable"), description: t("system.projects.unavailable"), data: { icon: "alert-triangle" } });
          }}>
            <div className="field"><label htmlFor="systeme-pn">{t("system.projects.name")}</label><input id="systeme-pn" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={48} required /></div>
            <div className="field"><label id="systeme-pi">{t("system.projects.icon")}</label>
              <div className="systeme-icons" role="radiogroup" aria-labelledby="systeme-pi">{PROJ_ICONS.map((x) => <button type="button" key={x} role="radio" aria-checked={icon === x} aria-label={t(`system.icon.${x}`)} className="systeme-icopt" onClick={() => setIcon(x)}><Icon name={x} /></button>)}</div></div>
            <div className="field"><label id="systeme-pc">{t("system.projects.color")}</label>
              <div className="systeme-colors" role="radiogroup" aria-labelledby="systeme-pc">{PROJ_COLORS.map(([l, c]) => <Tip key={c} label={t(`system.color.${l}`)}><button type="button" role="radio" aria-checked={color === c} aria-label={t(`system.color.${l}`)} className="systeme-color" style={{ background: c }} onClick={() => setColor(c)} /></Tip>)}</div></div>
            <div className="field"><label htmlFor="systeme-pins">{t("system.projects.instructions")}</label><textarea id="systeme-pins" className="input" value={instr} onChange={(e) => setInstr(e.target.value)} /><span className="sub" style={{ color: "var(--t2)", fontSize: 11 }}>{t("system.projects.instructionsHint")}</span></div>
            <div className="systeme-actions"><Dialog.Close className="btn secondary" type="button">{t("system.common.cancel")}</Dialog.Close><button className="btn primary" disabled={!name.trim()}>{t("system.projects.create")}</button></div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ProjectsScreen() {
  const t = useT();
  const { go } = useNav();
  const fx = useFx();
  const [v] = useVariant("grid");
  const [open, setOpen] = React.useState(v === "create");
  React.useEffect(() => setOpen(v === "create"), [v]);
  // Live: projects have no engine backing yet, so the honest state is the empty one.
  const list = isPreview() && v !== "empty" ? fx.projects : [];
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

/* ---------- Project ---------- */
export function ProjectScreen() {
  const t = useT();
  const { go } = useNav();
  if (!isPreview()) return (<>
    <Top title={t("system.projects.title")} />
    <BotEmpty title={t("system.project.missingTitle")} text={t("system.projects.emptyText")}><button className="btn secondary" onClick={() => go("projects")}>{t("system.project.myProjects")}</button></BotEmpty>
  </>);
  return <ProjectPreview />;
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
  const live = useQuery(() => (bot ? api.bots.memory.list(bot.id) : Promise.resolve([])), [bot?.id]);
  const fromFx = (): Mem[] => fx.memory.items.map((m) => ({ id: String(m.id), theme: m.theme, text: m.text, src: m.src }));
  const [items, setItems] = React.useState<Mem[]>(preview && v !== "empty" ? fromFx() : []);
  const [on, setOn] = React.useState(v !== "off");
  const [q, setQ] = React.useState("");
  const [edit, setEdit] = React.useState<string | null>(null);
  React.useEffect(() => { if (!preview) return; setOn(v !== "off"); setItems(v === "empty" ? [] : fromFx()); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!preview && live.state === "ready" && bot) setItems(live.data.map((m) => ({ id: m.id, theme: bot.name, text: m.content, src: t("system.memory.learned", { when: ago(m.time) }) })));
  }, [live.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.filter((m) => norm(m.text).includes(norm(q)));
  const themes = [...new Set(shown.map((m) => m.theme))];
  const forget = (m: Mem) => {
    setItems((xs) => xs.filter((x) => x.id !== m.id));
    if (!preview && bot) { api.bots.memory.delete(bot.id, m.id).catch(() => { setItems((xs) => [...xs, m]); toast.add({ title: t("system.memory.forgetFailed"), data: { icon: "alert-triangle" } }); }); toast.add({ title: t("system.memory.forgotten"), description: m.text, data: { icon: "trash" } }); return; }
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
      <Pop align="end" width={220} trigger={<IconBtn icon="more-dots" label={t("system.moreActions")} />}><MItem icon="settings">{t("system.memory.privacy")}</MItem><MSep /><MItem icon="trash" danger onClick={() => (preview || !bot ? setItems([]) : items.forEach(forget))}>{t("system.memory.forgetAll")}</MItem></Pop>
    </Top>
    <div className="page"><div className="systeme-narrow">
      <div className="systeme-memoff">
        <span className="li-ic"><Icon name="key" /></span>
        <span className="systeme-grow"><b>{on ? t("system.memory.onTitle") : t("system.memory.offTitle")}</b><span>{on ? t("system.memory.onText") : t("system.memory.offText")}</span></span>
        <Switch checked={on} onCheckedChange={(x) => { setOn(x); if (preview) setV(x ? "list" : "off"); }} aria-label={t("system.memory.toggle")} />
      </div>
      {!on && <div className="banner warn" style={{ margin: "0 0 16px" }}><Icon name="pause" /><span>{t("system.memory.paused")}</span><span className="grow">{t("system.memory.pausedText", { count: items.length })}</span></div>}
      {!preview && live.state === "loading" && bot ? null : items.length === 0 ? (
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
                  <span className="systeme-mem-act">{preview && <IconBtn icon="edit" label={t("system.edit")} onClick={() => setEdit(m.id)} />}<IconBtn icon="trash" label={t("system.memory.forget")} onClick={() => forget(m)} /></span>
                </div>))}</div>
            </section>))}
          {!shown.length && <div className="pg-empty">{t("system.memory.noMatch", { q: `${NB}${q}${NB}` })}</div>}
        </div>
      )}
    </div></div>
  </>);
}
