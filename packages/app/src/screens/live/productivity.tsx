import * as React from "react";
import { Field } from "@base-ui/react/field";
import { api } from "../../api";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { Icon, IconBtn, Switch } from "../../kit/ui";
import { TabBar, useCronLabel } from "../work/common";
import { Owned, Loaded, useOp, call, useContract, ContractError, s, when, type Row } from "./shared";

type File = Row & { id: string; filename: string; created_at: string; byte_size: number };
export function Space() {
  const t = useT();
  return <Owned title={t("live.space.title")}>{epoch => <SpaceHome epoch={epoch} />}</Owned>;
}
function SpaceHome({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav(), c = useContract();
  const q = useOp<{ items: File[] }>(epoch, "app.library");
  const [title, setTitle] = React.useState(""), [text, setText] = React.useState(""), [touched, setTouched] = React.useState(false);
  const invalid = touched && !text.trim();
  return <section className="space" data-testid="space">
    <p className="space-lead">{t("live.space.lead")}</p>
    <form className="space-form" data-testid="space-new" noValidate onSubmit={e => { e.preventDefault(); setTouched(true); if (!text.trim()) return; void c.run(async () => { const f = await call<File>(epoch, "app.note.create", {}, { title: title.trim() || undefined, text }); go("space-page", { id: f.id }); }); }}>
      <Field.Root className="space-field">
        <Field.Label className="space-label">{t("live.space.pageTitle")}<span className="space-opt">{t("live.space.optional")}</span></Field.Label>
        <Field.Control className="input" data-testid="space-title" maxLength={200} placeholder={t("live.space.titlePlaceholder")} value={title} onChange={e => setTitle(e.target.value)} />
      </Field.Root>
      <Field.Root className="space-field" invalid={invalid}>
        <Field.Label className="space-label">{t("live.space.text")}</Field.Label>
        <Field.Control render={<textarea className="input space-text" data-testid="space-text" rows={6} />} placeholder={t("live.space.textPlaceholder")} value={text} onChange={e => setText((e.target as unknown as HTMLTextAreaElement).value)} onBlur={() => setTouched(true)} />
        {invalid && <p className="space-error" role="alert" data-testid="space-text-error">{t("live.space.textRequired")}</p>}
      </Field.Root>
      <ContractError code={c.error} />
      <div className="space-actions">
        <button className="btn primary" data-testid="space-create" aria-busy={c.busy} disabled={c.busy || !text.trim()}>{c.busy ? t("live.space.creating") : t("live.space.create")}</button>
      </div>
    </form>
    <h2 className="space-h2">{t("live.space.pages")}</h2>
    <Loaded q={q}>{d => d?.items.length
      ? <div className="list" data-testid="space-list">{d.items.map(f => <button key={f.id} className="li space-row" data-testid="space-row" onClick={() => go("space-page", { id: f.id })}><span className="li-ic"><Icon name="file" /></span><span className="grow"><span className="ttl">{f.filename}</span></span><span className="code-meta">{when(f.created_at)}</span><Icon name="chevron-right" /></button>)}</div>
      : <div className="space-empty" data-testid="live-empty"><span className="li-ic"><Icon name="file" /></span><h3>{t("live.space.emptyTitle")}</h3><p>{t("live.space.emptyText")}</p></div>}</Loaded>
  </section>;
}

export function SpacePage() {
  const t = useT(), { params } = useNav(), id = params.get("id") ?? "";
  return <Owned title={t("live.spacePage.title")}>{epoch => id ? <Page epoch={epoch} id={id} /> : <SpaceHome epoch={epoch} />}</Owned>;
}
function Page({ epoch, id }: { epoch: string; id: string }) {
  const t = useT(), { go } = useNav(), c = useContract();
  const meta = useOp<File>(epoch, "app.file", { file: id });
  const body = useOp<string>(epoch, "app.file.content", { file: id });
  const [name, setName] = React.useState<string>();
  return <section data-testid="space-page" data-file-id={id}>
    <Loaded q={meta}>{f => f && <form className="ctx-bar" onSubmit={e => { e.preventDefault(); if (name?.trim()) void c.run(() => call(epoch, "app.file.rename", { file: id }, { filename: name.trim() }), meta.reload); }}>
      <input className="input grow" data-testid="space-page-name" aria-label={t("live.space.pageTitle")} value={name ?? f.filename} onChange={e => setName(e.target.value)} />
      <button className="btn secondary" data-testid="space-page-rename" disabled={c.busy || !name?.trim() || name === f.filename}>{t("live.save")}</button>
      <button className="btn secondary" type="button" data-testid="space-page-remove" disabled={c.busy} onClick={() => { if (confirm(t("live.confirmRemove"))) void c.run(() => call(epoch, "app.file.remove", { file: id }), () => go("space")); }}>{t("live.remove")}</button>
    </form>}</Loaded>
    <Loaded q={body}>{text => <article className="card" data-testid="space-page-body" style={{ whiteSpace: "pre-wrap" }}>{text}</article>}</Loaded>
    <ContractError code={c.error} />
  </section>;
}

type Task = Row & { id: string; title: string; prompt: string; schedule: string; paused: boolean; conversation_id: string; run_count: number };
export function Scheduled() {
  const t = useT(), { go } = useNav();
  return <Owned title={t("live.scheduled.title")} actions={<button className="btn primary" style={{ height: 28 }} data-testid="scheduled-new" onClick={() => go("scheduled-edit")}><Icon name="plus" size={16} />{t("live.scheduled.new")}</button>}>{epoch => <TaskList epoch={epoch} />}</Owned>;
}
const WORKSPACE: [string, string, string][] = [["space", "live.space.title", "projects"], ["scheduled", "live.scheduled.tab", "clock-loop"], ["plugins", "live.plugins.tab", "link"], ["skills", "live.skills.title", "file-code"]];
function TaskList({ epoch }: { epoch: string }) {
  const t = useT(), { go, route } = useNav(), c = useContract(), q = useOp<{ items: Task[] }>(epoch, "app.scheduled"), cron = useCronLabel();
  const [filter, setFilter] = React.useState("all");
  const items = q.state === "ready" ? q.data?.items ?? [] : [];
  const shown = items.filter(x => filter === "all" || (filter === "active" ? !x.paused : filter === "paused" ? x.paused : s(x.last_status) === "failed"));
  return <section data-testid="scheduled" className="scheduled">
    <nav className="scheduled-nav" aria-label={t("live.scheduled.workspace")}>{WORKSPACE.map(([r, k, icon]) => <button key={r} type="button" className="chip" aria-current={route === r ? "page" : undefined} data-pressed={route === r || undefined} onClick={() => go(r)}><Icon name={icon} size={16} />{t(k)}</button>)}</nav>
    <header className="scheduled-head"><h1>{t("live.scheduled.heading")}</h1><p>{t("live.scheduled.description")}</p></header>
    <TabBar label={t("live.scheduled.filter")} value={filter} onChange={setFilter} items={[["all", t("live.scheduled.filter.all")], ["active", t("live.scheduled.filter.active")], ["paused", t("live.scheduled.filter.paused")], ["failed", t("live.scheduled.filter.failed")]]} />
    <Loaded q={q}>{() => !items.length ? <div className="empty" data-testid="scheduled-empty"><span className="li-ic"><Icon name="clock-loop" size={16} /></span><h2>{t("live.scheduled.emptyTitle")}</h2><p>{t("live.scheduled.emptyText")}</p><button className="btn secondary" data-testid="scheduled-empty-create" onClick={() => go("scheduled-edit")}>{t("live.scheduled.emptyAction")}</button></div>
      : !shown.length ? <p className="travail-meta" data-testid="scheduled-filter-empty">{t("live.scheduled.filterEmpty")}</p>
      : <div className="list">{shown.map(x => <div key={x.id} className="li" data-testid="scheduled-row" data-paused={String(x.paused)}><span className="li-ic"><Icon name="clock-loop" size={16} /></span><span className="grow"><div className="ttl">{x.title}</div><div className="sub">{cron(x.schedule)}</div></span>{s(x.last_status) === "failed" && <span className="badge err">{t("live.scheduled.failed")}</span>}<span className="badge">{x.paused ? t("live.paused") : t("live.enabled")}</span>
      <Switch checked={!x.paused} disabled={c.busy} data-testid="scheduled-toggle" aria-label={t(x.paused ? "live.resume" : "live.pause")} onCheckedChange={() => void c.run(() => call(epoch, "app.scheduled.update", { scheduled: x.id }, { paused: !x.paused }), q.reload)} />
      <IconBtn icon="edit" label={t("live.edit")} onClick={() => go("scheduled-edit", { id: x.id })} />
      <IconBtn icon="history" label={t("live.history")} onClick={() => go("scheduled-history", { id: x.id })} /></div>)}</div>}</Loaded>
    <ContractError code={c.error} />
  </section>;
}

export function ScheduledEdit() {
  const t = useT(), { params } = useNav(), id = params.get("id") ?? "";
  return <Owned title={t(id ? "live.scheduledEdit.edit" : "live.scheduledEdit.new")}>{epoch => <TaskEditor epoch={epoch} id={id} />}</Owned>;
}
function TaskEditor({ epoch, id }: { epoch: string; id: string }) {
  const t = useT(), { go } = useNav(), c = useContract();
  const task = useOp<Task>(epoch, "app.scheduled.get", { scheduled: id }, !id);
  const convs = useOp<{ items: { id: string; title?: string }[] }>(epoch, "app.conversations", {}, !!id);
  const [form, setForm] = React.useState({ title: "", prompt: "", schedule: "0 9 * * 1", conversation_id: "" });
  React.useEffect(() => { if (task.state === "ready" && task.data) setForm({ title: task.data.title, prompt: task.data.prompt, schedule: task.data.schedule, conversation_id: task.data.conversation_id }); }, [task.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const save = () => void c.run(async () => {
    const saved = id ? await call<Task>(epoch, "app.scheduled.update", { scheduled: id }, { title: form.title, prompt: form.prompt, schedule: form.schedule }) : await call<Task>(epoch, "app.scheduled.create", {}, form);
    go("scheduled-history", { id: saved.id });
  });
  return <form className="list" data-testid="scheduled-edit" onSubmit={e => { e.preventDefault(); save(); }}>
    <label className="field">{t("live.name")}<input className="input" data-testid="scheduled-title" required maxLength={200} value={form.title} onChange={set("title")} /></label>
    <label className="field">{t("live.prompt")}<textarea className="input" data-testid="scheduled-prompt" required value={form.prompt} onChange={set("prompt")} /></label>
    <label className="field">{t("live.scheduledEdit.cron")}<input className="input" data-testid="scheduled-cron" required value={form.schedule} onChange={set("schedule")} /></label>
    {!id && <Loaded q={convs}>{d => d && <label className="field">{t("live.scheduledEdit.conversation")}<select className="input" data-testid="scheduled-conversation" required value={form.conversation_id} onChange={set("conversation_id")}><option value="">{t("live.toolApproval.choose")}</option>{d.items.map(x => <option key={x.id} value={x.id}>{x.title || x.id}</option>)}</select></label>}</Loaded>}
    <div className="ctx-bar"><button className="btn primary" data-testid="scheduled-save" disabled={c.busy || !form.title.trim() || !form.prompt.trim() || (!id && !form.conversation_id)}>{t("live.save")}</button>
      {id && <button className="btn secondary" type="button" data-testid="scheduled-remove" disabled={c.busy} onClick={() => { if (confirm(t("live.confirmRemove"))) void c.run(() => call(epoch, "app.scheduled.remove", { scheduled: id }), () => go("scheduled")); }}>{t("live.remove")}</button>}</div>
    <ContractError code={c.error} />
  </form>;
}

export function ScheduledHistory() {
  const t = useT(), { params } = useNav(), id = params.get("id") ?? "";
  return <Owned title={t("live.scheduledHistory.title")}>{epoch => id ? <History epoch={epoch} id={id} /> : <TaskList epoch={epoch} />}</Owned>;
}
function History({ epoch, id }: { epoch: string; id: string }) {
  const t = useT(), c = useContract(), task = useOp<Task>(epoch, "app.scheduled.get", { scheduled: id });
  const [outcome, setOutcome] = React.useState<{ status: string; error_code: string | null }>();
  const conv = task.state === "ready" && task.data ? task.data.conversation_id : "";
  const msgs = useOp<{ items: (Row & { id: string; role: string; content?: string; created_at?: string })[] }>(epoch, "app.conversation.messages", { conversation: conv }, !conv);
  return <section data-testid="scheduled-history">
    <Loaded q={task}>{x => x && <><h1>{x.title}</h1><p role="status" data-testid="scheduled-summary" data-runs={x.run_count}>{t("live.scheduledHistory.summary", { count: x.run_count, status: s(x.last_status) || "—", at: when(x.last_run_at) || "—" })}</p>
      {!!x.last_error_code && <p className="banner err" role="alert">{t("live.scheduledHistory.failed", { code: s(x.last_error_code) })}</p>}
      <button className="btn primary" data-testid="scheduled-run" disabled={c.busy} onClick={() => void c.run(async () => setOutcome(await call(epoch, "app.scheduled.run", { scheduled: id }, {})), () => { task.reload(); msgs.reload(); })}>{t("live.runNow")}</button>
      {outcome && <p role="status" data-testid="scheduled-outcome" data-status={outcome.status}>{t("live.scheduledHistory.outcome", { status: outcome.status, code: outcome.error_code ?? "—" })}</p>}</>}</Loaded>
    <ContractError code={c.error} />
    {conv && <Loaded q={msgs} empty={d => !d?.items.length}>{d => <div className="list">{d!.items.filter(m => m.role === "assistant").map(m => <div key={m.id} className="li" data-testid="scheduled-result"><span className="grow" style={{ whiteSpace: "pre-wrap" }}>{s(m.content)}</span><span className="code-meta">{when(m.created_at)}</span></div>)}</div>}</Loaded>}
  </section>;
}

export function Plugins() {
  const t = useT();
  return <Owned title={t("live.plugins.title")}>{epoch => <PluginList epoch={epoch} />}</Owned>;
}
function PluginList({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav(), [q, setQ] = React.useState("");
  const catalog = useQuery(() => api.workBot.appCatalog({ epoch, q }), [epoch, q]);
  const conns = useQuery(() => api.workBot.appConnections(epoch), [epoch]);
  const installed = conns.state === "ready" ? conns.data.items : [];
  return <section data-testid="plugins">
    <h2>{t("live.plugins.installed")}</h2>
    {conns.state === "ready" && !installed.length && <p className="code-hint" data-testid="plugins-none">{t("live.plugins.none")}</p>}
    <div className="list">{installed.map(x => <button key={x.id} className="li" data-testid="plugin-installed" onClick={() => go("plugin-detail", { slug: x.slug })}><Icon name="link" /><span className="grow">{x.slug}</span><span className="code-meta">{t(`workBot.apps.status.${x.status}`)}</span><Icon name="chevron-right" /></button>)}</div>
    <h2>{t("live.plugins.catalog")}</h2>
    <input className="input" type="search" data-testid="plugins-search" aria-label={t("live.search")} placeholder={t("live.search")} value={q} onChange={e => setQ(e.target.value)} />
    <Loaded q={catalog}>{d => <><p className="code-hint" data-testid="plugins-source">{t(`workBot.apps.source.${d.source}`)}</p>
      {!d.items.length && <p className="code-hint" data-testid="live-empty">{t("live.empty")}</p>}
      <div className="list">{d.items.map(a => <button key={a.slug} className="li" data-testid="plugin-row" onClick={() => go("plugin-detail", { slug: a.slug })}><span className="grow"><b>{a.name}</b> · {a.description}</span><span className="code-meta">{t("workBot.apps.tools", { count: a.tool_count })}</span><Icon name="chevron-right" /></button>)}</div></>}</Loaded>
  </section>;
}

export function PluginDetail() {
  const t = useT(), { params } = useNav(), slug = params.get("slug") ?? "";
  return <Owned title={t("live.pluginDetail.title")}>{epoch => slug ? <Plugin epoch={epoch} slug={slug} /> : <PluginList epoch={epoch} />}</Owned>;
}
function Plugin({ epoch, slug }: { epoch: string; slug: string }) {
  const t = useT(), c = useContract();
  const catalog = useQuery(() => api.workBot.appCatalog({ epoch, q: slug }), [epoch, slug]);
  const conns = useQuery(() => api.workBot.appConnections(epoch), [epoch]);
  const entry = catalog.state === "ready" ? catalog.data.items.find(a => a.slug === slug) : undefined;
  const conn = conns.state === "ready" ? conns.data.items.find(x => x.slug === slug) : undefined;
  const [chat, setChat] = React.useState(true), [bot, setBot] = React.useState(true);
  React.useEffect(() => { if (conn) { setChat(conn.surfaces.chat); setBot(conn.surfaces.bot); } }, [conn]);
  const body = { epoch, surfaces: { chat, bot }, approval_mode: conn?.approval_mode ?? "changes" as const };
  return <section data-testid="plugin-detail" data-slug={slug}>
    <h1>{entry?.name ?? slug}</h1>{entry && <p>{entry.description}</p>}
    <p role="status" data-testid="plugin-status" data-status={conn?.status ?? "none"}>{conn ? t(`workBot.apps.status.${conn.status}`) : t("live.plugins.notInstalled")}</p>
    <label><input type="checkbox" data-testid="plugin-chat" checked={chat} onChange={e => setChat(e.target.checked)} />{t("workBot.apps.chat")}</label>
    <label><input type="checkbox" data-testid="plugin-bot" checked={bot} onChange={e => setBot(e.target.checked)} />{t("workBot.apps.bot")}</label>
    <div className="ctx-bar">
      <button className="btn primary" data-testid="plugin-connect" disabled={c.busy || (!chat && !bot)} onClick={() => void c.run(() => conn ? api.workBot.appConsent(slug, body) : api.workBot.appConnect(slug, body), conns.reload)}>{t(conn ? "workBot.apps.apply" : "workBot.apps.connect")}</button>
      {conn?.status === "pending" && <button className="btn secondary" data-testid="plugin-authorize" disabled={c.busy} onClick={() => void c.run(() => api.workBot.appAuthorize(slug, epoch))}>{t("workBot.apps.authorize")}</button>}
      {conn && <button className="btn secondary" data-testid="plugin-revoke" disabled={c.busy} onClick={() => void c.run(() => api.workBot.appRevoke(slug, epoch), conns.reload)}>{t("workBot.apps.revoke")}</button>}
    </div>
    <ContractError code={c.error} />
  </section>;
}

type Skill = { slug: string; name: string; description: string; body: string; enabled: boolean; owner: string; scan_verdict: string; scan_findings: string[] };
export function Skills() {
  const t = useT();
  return <Owned title={t("live.skills.title")}>{epoch => <SkillList epoch={epoch} />}</Owned>;
}
function SkillList({ epoch }: { epoch: string }) {
  const t = useT(), c = useContract(), q = useOp<{ items: Skill[] }>(epoch, "app.skills");
  const [source, setSource] = React.useState("");
  const enable = (k: Skill, on: boolean) => void c.run(() => call(epoch, "app.skill.enable", { skill: k.slug }, on ? { enabled: true, acknowledged: k.scan_verdict, findings: k.scan_findings } : { enabled: false }), q.reload);
  return <section data-testid="skills">
    <Loaded q={q} empty={d => !d?.items.length}>{d => <div className="list">{d!.items.map(k => <div key={k.slug} className="li" data-testid="skill-row" data-slug={k.slug} data-enabled={String(k.enabled)} data-verdict={k.scan_verdict}><Icon name="sparkle-free" /><span className="grow"><b>{k.name}</b> · {k.description}{k.scan_findings.length > 0 && <><br /><span className="code-meta">{t("live.skills.findings", { list: k.scan_findings.join(", ") })}</span></>}</span><span className="chip">{t("live.skills.verdict", { verdict: k.scan_verdict })}</span>
      {k.owner === "user" && <><button className="btn secondary" data-testid="skill-toggle" disabled={c.busy} onClick={() => { if (k.enabled || k.scan_verdict === "clean" || confirm(t("live.skills.acknowledge", { verdict: k.scan_verdict }))) enable(k, !k.enabled); }}>{t(k.enabled ? "live.skills.disable" : "live.skills.enable")}</button>
        <button className="btn secondary" data-testid="skill-remove" disabled={c.busy} onClick={() => { if (confirm(t("live.confirmRemove"))) void c.run(() => call(epoch, "app.skill.remove", { skill: k.slug }), q.reload); }}>{t("live.remove")}</button></>}</div>)}</div>}</Loaded>
    <form className="list" data-testid="skill-new" onSubmit={e => { e.preventDefault(); void c.run(async () => { await call(epoch, "app.skill.create", {}, { source }); setSource(""); }, q.reload); }}>
      <h2>{t("live.skills.new")}</h2>
      <label className="field">{t("live.skills.source")}<textarea className="input" data-testid="skill-source" required rows={8} value={source} placeholder={t("live.skills.sourceHint")} onChange={e => setSource(e.target.value)} /></label>
      <button className="btn primary" data-testid="skill-save" disabled={c.busy || !source.trim()}>{t("live.skills.scan")}</button>
    </form>
    <ContractError code={c.error} />
  </section>;
}

export function McpAdd() {
  const t = useT();
  return <Owned title={t("live.mcp.title")}>{epoch => <Mcp epoch={epoch} />}</Owned>;
}
function Mcp({ epoch }: { epoch: string }) {
  const t = useT(), c = useContract();
  const q = useOp<{ mcp_servers: { id: string; name: string; url: string; tools: string[]; auth_state?: string }[] }>(epoch, "app.integrations");
  const [name, setName] = React.useState(""), [url, setUrl] = React.useState(""), [token, setToken] = React.useState("");
  return <section data-testid="mcp-add">
    <form className="list" onSubmit={e => { e.preventDefault(); void c.run(async () => { await call(epoch, "app.mcp.add", {}, { name: name.trim(), url: url.trim(), ...(token.trim() ? { auth_token: token.trim() } : {}) }); setName(""); setUrl(""); setToken(""); }, q.reload); }}>
      <p className="code-hint">{t("live.mcp.urlOnly")}</p>
      <label className="field">{t("live.name")}<input className="input" data-testid="mcp-name" required maxLength={64} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="field">{t("live.mcp.url")}<input className="input" data-testid="mcp-url" type="url" required value={url} placeholder={t("live.mcp.urlHint")} onChange={e => setUrl(e.target.value)} /></label>
      <label className="field">{t("live.mcp.token")}<input className="input" data-testid="mcp-token" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>
      <button className="btn primary" data-testid="mcp-save" disabled={c.busy || !name.trim() || !url.trim()}>{t("live.mcp.add")}</button>
      <ContractError code={c.error} />
    </form>
    <h2>{t("live.mcp.servers")}</h2>
    <Loaded q={q} empty={d => !d?.mcp_servers.length}>{d => <div className="list">{d!.mcp_servers.map(m => <div key={m.id} className="li" data-testid="mcp-row"><Icon name="link" /><span className="grow"><b>{m.name}</b> · {m.url}</span><span className="code-meta">{t("workBot.apps.tools", { count: m.tools.length })}</span><button className="btn secondary" data-testid="mcp-remove" disabled={c.busy} onClick={() => void c.run(() => call(epoch, "app.mcp.remove", { mcp: m.id }), q.reload)}>{t("live.remove")}</button></div>)}</div>}</Loaded>
  </section>;
}
