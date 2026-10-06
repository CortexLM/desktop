import * as React from "react";
import type { WorkBotView, WorkBotSnapshot } from "@cortex/schema";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useNav, readHash } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Mascot, DEFAULT_MASCOT } from "../../mascot/Mascot";
import { BotCopy } from "./bot-copy";
import { BotApps } from "./bot-apps";
import { BotPending } from "./bot-pending";
import { BotMemory } from "./bot-memory";
import { Segmented } from "../../kit/ui";

export function WorkBotConnection({ local }: { local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []);
  return !isPreview() && connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn ? <RemoteWorkBot /> : local;
}

function RemoteWorkBot() {
  const { route, entryKey, params } = useNav();
  return <WorkBotOwner key={`${entryKey}:${route}:${params.get("id")}:${params.get("epoch")}`} />;
}

function WorkBotOwner() {
  const t = useT(), { route, params, entryKey, go } = useNav();
  const list = useQuery(() => api.workBot.list(), []);
  const epoch = params.get("epoch") ?? (list.state === "ready" ? list.data.epoch : "");
  const id = params.get("id") ?? "";
  const stamp = React.useMemo(() => ({ entryKey, epoch, id }), [entryKey, epoch, id]);
  const active = React.useRef(stamp), mounted = React.useRef(true);
  React.useLayoutEffect(() => { active.current = stamp; mounted.current = true; return () => { mounted.current = false; }; }, [stamp]);
  const owns = () => mounted.current && active.current === stamp && readHash().entryKey === entryKey && (readHash().params.get("id") ?? "") === id && (list.state !== "ready" || list.data.epoch === epoch);
  const snapshot = useQuery(async () => id && epoch ? api.workBot.snapshot(id, epoch) : undefined, [id, epoch], e => e.type === "workBot.changed" && e.properties.epoch === epoch && (!e.properties.botID || e.properties.botID === id));
  const data: WorkBotSnapshot | undefined = snapshot.state === "ready" && snapshot.data?.epoch === epoch && snapshot.data.bot.id === id && list.state === "ready" && list.data.epoch === epoch ? snapshot.data : undefined;
  const [config, setConfig] = React.useState({ name: "", description: "", label: "", look: "meadow" as WorkBotView["look"], shape: "dots" as WorkBotView["shape"], notifications: true, status: "idle" as "idle" | "awake" | "hibernating" });
  const [goal, setGoal] = React.useState(""), draft = React.useRef(""), [kind, setKind] = React.useState<"explore" | "general-purpose">("explore");
  const [parentText, setParentText] = React.useState("");
  const [lead, setLead] = React.useState<string | null>(null), [leadError, setLeadError] = React.useState(false);
  const [hierarchy, setHierarchy] = React.useState(false);
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false), [unconfirmed, setUnconfirmed] = React.useState(false);
  const admission = React.useRef(false), initialized = React.useRef(false);
  React.useEffect(() => {
    if (data && !initialized.current) { const b = data.bot; setConfig({ name: b.name, description: b.description, label: b.label, look: b.look, shape: b.shape, notifications: b.notifications, status: b.status === "awake" || b.status === "hibernating" ? b.status : "idle" }); setLead(b.lead_id); initialized.current = true; }
  }, [data]);
  const mutate = async (action: () => Promise<void>, cancel = false) => {
    if (admission.current || !owns()) return;
    admission.current = true; setBusy(true); setError(false);
    try { await action(); if (owns()) { snapshot.reload(); list.reload(); if (cancel) setUnconfirmed(false); } }
    catch { if (owns()) { setError(true); if (cancel) setUnconfirmed(true); } }
    finally { admission.current = false; if (owns()) setBusy(false); }
  };
  const roster = !id && route !== "bot-new";
  const configuring = route === "bot-new" || route === "bot-settings" || route === "bot-studio";
  const create = () => void mutate(async () => { const result = await api.workBot.create({ epoch, config: { ...config, ...(lead === null ? {} : { lead_id: lead }) } }); if (owns()) go("bot", { source: "work-bot-api", id: result.bot.id, epoch: result.epoch }); });
  const enqueue = () => void mutate(async () => { const sent = goal; await api.workBot.enqueue(id, { epoch, kind, goal: sent }); if (owns()) setGoal(v => v === sent ? "" : draft.current); });
  const navigate = (next: string) => go(next, { source: "work-bot-api", id, epoch });
  const bots = list.state === "ready" && list.data.epoch === epoch ? list.data.bots : [];
  const leadSelect = <label className="field">{t("workBot.lead")}<select className="input" data-testid="work-bot-lead" value={lead ?? ""} disabled={busy || !epoch || list.state !== "ready"} onChange={e => setLead(e.target.value || null)}><option value="">{t("workBot.root")}</option>{lead && !bots.some(bot => bot.id === lead) && <option value={lead}>{t("workBot.leadUnavailable")}</option>}{bots.filter(bot => bot.id !== id).map(bot => <option key={bot.id} value={bot.id}>{bot.name}</option>)}</select></label>;
  // ponytail: stored ownership metadata only; runtime dispatch needs its own admitted contract.
  const branch = (bot: WorkBotView): React.ReactNode => <li key={bot.id} className="work-bot-hierarchy-branch"><button className="travail-node" data-testid="work-bot-hierarchy-node" data-bot-id={bot.id} data-lead-id={bot.lead_id ?? ""} onClick={() => go("bot-settings", { source: "work-bot-api", id: bot.id, epoch })}><Mascot cfg={{ name: bot.name, ...DEFAULT_MASCOT }} state={bot.status === "awake" ? "working" : "idle"} size={40} /><span className="ttl">{bot.name}</span><span className="sub">{bot.label}</span>{bot.lead_id !== null && !bots.some(lead => lead.id === bot.lead_id) && <span className="sub">{t("workBot.leadUnavailable")}</span>}</button>{bots.some(child => child.lead_id === bot.id) && <ul>{bots.filter(child => child.lead_id === bot.id).map(branch)}</ul>}</li>;
  return <>
    <div className="content-top"><span className="title">{data?.bot.name || t(roster ? "workBot.roster" : configuring ? "workBot.configure" : "workBot.work")}</span><div className="spacer" />
      <button className="btn secondary" data-testid="work-bot-reconnect" onClick={() => { list.reload(); snapshot.reload(); }}>{t("workBot.reconnect")}</button>
      <button className="btn secondary" data-testid="work-bot-channels" onClick={() => go("bot-channels", { epoch })}>{t("workChannels.title")}</button>
      <button className="btn secondary" onClick={() => go("bot-new")}>{t("workBot.create")}</button>
      {id && <button className="btn secondary" onClick={() => navigate(configuring ? "bot" : "bot-settings")}>{t(configuring ? "workBot.channel" : "workBot.configure")}</button>}
    </div>
    <div className="page"><div className="travail-mid work-bot-api">
      {(error || list.state === "error" || snapshot.state === "error") && <div className="banner err" role="alert">{t("workBot.unavailable")}</div>}
      {unconfirmed && <div className="banner warn" role="status" data-testid="work-bot-cancel-unconfirmed">{t("workBot.unconfirmed")}</div>}
      {roster ? <><h1>{t("workBot.roster")}</h1><Segmented items={[t("bots.roster.team"), t("bots.roster.hierarchy")]} value={t(hierarchy ? "bots.roster.hierarchy" : "bots.roster.team")} onChange={value => setHierarchy(value === t("bots.roster.hierarchy"))} /><p data-testid="work-bot-owner-count">{list.state === "ready" ? t("workBot.count", { count: bots.length }) : t("workBot.loading")}</p>{hierarchy ? <><p>{t("workBot.hierarchyNote")}</p><ul className="work-bot-hierarchy" aria-label={t("bots.roster.hierarchyLabel")}>{bots.filter(bot => bot.lead_id === null || !bots.some(lead => lead.id === bot.lead_id)).map(branch)}</ul></> : <div className="travail-cgrid">{bots.map(bot => <article className="work-bot-roster-card" key={bot.id} data-bot-id={bot.id}><button className="work-bot-roster-select" data-testid="work-bot-select" onClick={() => go("bot", { source: "work-bot-api", id: bot.id, epoch })}><Mascot cfg={{ name: bot.name, ...DEFAULT_MASCOT }} state={bot.status === "awake" ? "working" : "idle"} size={44} /><span className="travail-grow"><b>{bot.name}</b><span className="sub" data-testid="work-bot-specialty">{bot.label}</span><span className="sub" data-testid="work-bot-stored-lead">{bot.lead_id === null ? t("workBot.root") : t("workBot.ledBy", { name: bots.find(lead => lead.id === bot.lead_id)?.name ?? t("workBot.leadUnavailable") })}</span><span role="status">{bot.status}</span></span></button><button className="btn secondary" data-testid="work-bot-specialty-configure" onClick={() => go("bot-settings", { source: "work-bot-api", id: bot.id, epoch })}>{t("workBot.configure")}</button></article>)}</div>}</>
        : configuring ? <form onSubmit={e => { e.preventDefault(); if (!busy && config.name.trim()) { if (id) void mutate(async () => { await api.workBot.update(id, { epoch, config }); }); else create(); } }}>
          <h1>{t("workBot.configure")}</h1>
          <label className="field">{t("workBot.name")}<input className="input" data-testid="work-bot-name" value={config.name} onChange={e => setConfig(v => ({ ...v, name: e.target.value }))} maxLength={40} /></label>
          <label className="field">{t("workBot.description")}<textarea className="input" data-testid="work-bot-description" value={config.description} onChange={e => setConfig(v => ({ ...v, description: e.target.value }))} maxLength={2000} /></label>
          <label className="field">{t("workBot.label")}<input className="input" value={config.label} onChange={e => setConfig(v => ({ ...v, label: e.target.value }))} maxLength={40} /></label>
          <label className="field">{t("workBot.look")}<select className="input" value={config.look} onChange={e => setConfig(v => ({ ...v, look: e.target.value as WorkBotView["look"] }))}>{["meadow", "teal", "terracotta", "amber", "plum", "slate"].map(look => <option key={look} value={look}>{t(`workBot.look.${look}`)}</option>)}</select></label>
          {!id && leadSelect}
          {id && <><label className="field">{t("workBot.state")}<select className="input" data-testid="work-bot-state" value={config.status} onChange={e => setConfig(v => ({ ...v, status: e.target.value as typeof v.status }))}><option value="idle">{t("workBot.idle")}</option><option value="awake">{t("workBot.awake")}</option><option value="hibernating">{t("workBot.hibernating")}</option></select></label><label><input type="checkbox" checked={config.notifications} onChange={e => setConfig(v => ({ ...v, notifications: e.target.checked }))} />{t("workBot.notifications")}</label></>}
          <button className="btn primary" data-testid="work-bot-save" disabled={busy || !epoch || !config.name.trim()}>{t(id ? "workBot.save" : "workBot.create")}</button>
          <p>{t("workBot.autonomy")}</p>
        </form> : data ? <>
          <div className="ctx-bar"><span className="badge" role="status">{data.bot.status}</span><button className="btn secondary" onClick={() => navigate("work-task")}>{t("workBot.work")}</button></div>
          <p>{t("workBot.autonomy")}</p>{!data.computerAvailable && <div className="banner warn" data-testid="work-bot-cloud-unavailable">{t("workBot.cloudUnavailable")}</div>}
          <form onSubmit={e => { e.preventDefault(); if (!busy && goal.trim()) enqueue(); }}><label className="field">{t("workBot.kind")}<select className="input" data-testid="work-bot-kind" value={kind} disabled={busy} onChange={e => setKind(e.target.value === "general-purpose" ? "general-purpose" : "explore")}><option value="explore">{t("workBot.kind.explore")}</option><option value="general-purpose">{t("workBot.kind.general-purpose")}</option></select></label><label className="field">{t("workBot.goal")}<textarea className="input" data-testid="work-bot-goal" value={goal} maxLength={4000} onChange={e => { draft.current = e.target.value; setGoal(e.target.value); }} /></label><button className="btn primary" data-testid="work-bot-enqueue" disabled={busy || !goal.trim()}>{t("workBot.enqueue")}</button></form>
          <h2>{t("workBot.jobs")}</h2>{data.jobs.map(job => <section className="travail-panel" key={job.id} data-testid="work-bot-job" data-job-id={job.id} data-status={job.status}><b>{job.goal}</b><p className="sub">{t(job.kind === "general-purpose" ? "workBot.kind.general-purpose" : "workBot.kind.explore")} · {new Date(job.created_at).toLocaleString()}</p><p role="status">{t(`workBot.status.${job.status}`)}</p>{job.error_code && <p data-testid="work-bot-job-error" data-error-code={job.error_code}>{t(job.error_code === "cancelled" ? "workBot.jobError.cancelled" : "workBot.jobError.generic")}</p>}{job.error_code === "execution_unknown" && <p>{t("workBot.uncertain")}</p>}{job.result !== undefined && <pre data-testid="work-bot-result">{JSON.stringify(job.result, null, 2)}</pre>}{["queued", "running"].includes(job.status) && <button className="btn secondary" disabled={busy} data-testid="work-bot-cancel" onClick={() => void mutate(async () => { await api.workBot.cancel(id, job.id, epoch); }, true)}>{t("workBot.cancel")}</button>}</section>)}
          <h2>{t("workBot.channel")}</h2><div data-testid="work-bot-parent">{data.messages.map(message => <article className={message.sender === "user" ? "msg-user" : "msg-bot"} key={message.id} data-message-id={message.id}><p>{message.text}</p>{message.kind === "notice" && <pre data-testid="work-bot-notice">{JSON.stringify(message.payload)}</pre>}</article>)}</div>
          <form onSubmit={e => { e.preventDefault(); if (!busy && parentText.trim()) void mutate(async () => { const sent = parentText; await api.workBot.parent(id, { epoch, text: sent }); if (owns()) setParentText(v => v === sent ? "" : v); }); }}><label className="field">{t("workBot.parentMessage")}<textarea className="input" data-testid="work-bot-parent-input" value={parentText} maxLength={20000} onChange={e => setParentText(e.target.value)} /></label><button className="btn primary" data-testid="work-bot-parent-send" disabled={busy || !parentText.trim()}>{t("workBot.parentSend")}</button></form>
        </> : <p role="status">{t("workBot.loading")}</p>}
      {configuring && id && data && <form data-testid="work-bot-hierarchy-settings" onSubmit={e => { e.preventDefault(); void mutate(async () => { setLeadError(false); try { await api.workBot.update(id, { epoch, config: { lead_id: lead } }); } catch (error) { if (owns()) setLeadError(true); throw error; } }); }}><h2>{t("bots.roster.hierarchy")}</h2><p>{t("workBot.hierarchyNote")}</p><p data-testid="work-bot-current-lead">{data.bot.lead_id === null ? t("workBot.root") : t("workBot.ledBy", { name: bots.find(bot => bot.id === data.bot.lead_id)?.name ?? t("workBot.leadUnavailable") })}</p>{leadSelect}{leadError && <div className="banner err" role="alert" data-testid="work-bot-lead-unconfirmed">{t("workBot.leadUnconfirmed")}</div>}<button className="btn primary" data-testid="work-bot-lead-save" disabled={busy || !epoch}>{t("workBot.saveLead")}</button><button type="button" className="btn secondary" data-testid="work-bot-detach" disabled={busy || data.bot.lead_id === null} onClick={() => setLead(null)}>{t("workBot.detach")}</button></form>}
      {epoch && list.state === "ready" && list.data.epoch === epoch && (roster || configuring && !!id && !!data) && <BotCopy key={`${epoch}:${id}`} epoch={epoch} id={id || undefined} bots={list.data.bots} owns={owns} />}
      {configuring && id && data && <BotApps key={`apps:${epoch}:${id}`} epoch={epoch} id={id} owns={owns} />}
      {configuring && id && data && <BotMemory key={`memory:${epoch}:${id}`} epoch={epoch} id={id} owns={owns} />}
      {epoch && list.state === "ready" && list.data.epoch === epoch && (roster || !!data) && <BotPending key={`pending:${epoch}:${id}`} epoch={epoch} id={id || undefined} owns={owns} />}
    </div></div>
  </>;
}
