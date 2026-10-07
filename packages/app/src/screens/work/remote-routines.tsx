import * as React from "react";
import type { WorkRoutine, WorkRoutineRun } from "@cortex/schema";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useNav, readHash } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Icon, IconBtn, Switch } from "../../kit/ui";
import { Top } from "./common";

export function RoutineConnection({ local }: { local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []);
  const { route, entryKey } = useNav();
  return !isPreview() && connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn ? <RemoteRoutines key={`${entryKey}:${route}`} /> : local;
}

function RemoteRoutines() {
  const t = useT(), { route, params, entryKey, go } = useNav();
  const owners = useQuery(() => api.workBot.list(), []);
  const epoch = params.get("epoch") ?? (owners.state === "ready" ? owners.data.epoch : "");
  const id = params.get("bot") ?? "", rid = params.get("id") ?? "";
  const editing = route === "automation-edit";
  const [error, setError] = React.useState(false), [busy, setBusy] = React.useState(false);
  const pending = React.useRef(false), mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);
  const owns = () => mounted.current && readHash().entryKey === entryKey && owners.state === "ready" && owners.data.epoch === epoch;
  const bots = owners.state === "ready" && owners.data.epoch === epoch ? owners.data.bots : [];
  const rows = useQuery(async () => {
    if (!epoch || owners.state !== "ready" || owners.data.epoch !== epoch) return [];
    const pages = await Promise.all(owners.data.bots.map(async bot => {
      const routines = await api.workBot.routines.list(bot.id, epoch);
      return Promise.all(routines.map(async routine => ({ bot, routine, runs: await api.workBot.routines.history(bot.id, routine.id, epoch) })));
    }));
    return pages.flat();
  }, [epoch, owners.state === "ready" ? owners.data : undefined]);
  const mutate = async (action: () => Promise<void>) => {
    if (pending.current || !owns()) return;
    pending.current = true; setBusy(true); setError(false);
    try { await action(); if (owns()) rows.reload(); }
    catch { if (owns()) setError(true); }
    finally { pending.current = false; if (owns()) setBusy(false); }
  };
  const back = () => go("automations", { epoch });
  const edit = (bot: string, routine?: string) => go("automation-edit", { epoch, bot, ...(routine ? { id: routine } : {}) });
  const ready = owners.state === "ready" && owners.data.epoch === epoch;
  if (editing) return <RoutineEditor key={`${epoch}:${id}:${rid}`} epoch={epoch} id={id} rid={rid} bots={bots} owns={owns} back={back} />;
  const data = ready && rows.state === "ready" ? rows.data : [];
  const history = data.flatMap(row => row.runs.map(run => ({ ...row, run }))).sort((a, b) => b.run.created_at.localeCompare(a.run.created_at));
  return <>
    <Top title={t("work.routines")}><button className="btn secondary" data-testid="remote-routines-refresh" onClick={() => { owners.reload(); rows.reload(); }}>{t("workBot.reconnect")}</button><button className="btn primary" data-testid="routine-create" disabled={!ready || !bots.length} onClick={() => edit(bots[0].id)}><Icon name="plus" size={16} />{t("work.routines.new")}</button></Top>
    <div className="page"><div className="travail-mid remote-routines" data-testid="remote-routines">
      {(error || owners.state === "error" || rows.state === "error") && <div className="banner err" role="alert" data-testid="remote-routines-error">{t("workRoutines.unconfirmed")}</div>}
      {owners.state === "error" || rows.state === "error" || owners.state === "ready" && owners.data.epoch !== epoch ? null : !ready || rows.state === "loading" ? <p role="status">{t("workBot.loading")}</p> : !data.length ? <p>{t("work.routines.emptyTitle")}</p> : <>
        {bots.map(bot => <React.Fragment key={bot.id}><div className="travail-botgroup">{bot.name}</div><div className="list">{data.filter(row => row.bot.id === bot.id).map(({ routine, runs }) => <div className="travail-rt" key={routine.id} data-testid="remote-routine-row" data-routine-id={routine.id} data-paused={routine.paused}>
          <Icon name={routine.trigger.kind === "cron" ? "clock-loop" : "bolt"} size={16} />
          <button className="travail-grow" data-testid="remote-routine-edit" onClick={() => edit(bot.id, routine.id)}><span className="ttl">{routine.name}</span><span className="travail-meta">{routine.trigger.kind === "cron" ? routine.schedule : `${routine.trigger.kind}: ${routine.trigger.event}`}</span><span className="travail-meta">{routine.utc_offset_minutes === undefined ? t("workRoutines.paris") : t("workRoutines.offsetValue", { minutes: routine.utc_offset_minutes })}{routine.timezone ? ` · ${routine.timezone}` : ""}</span></button>
          <span className="badge" data-testid="remote-routine-status">{t(routine.paused ? "work.paused" : "workRoutines.enabled")}</span>
          {runs[0] && <span className="badge" data-testid="remote-routine-latest">{t(`workRoutines.status.${runs[0].status}`)}</span>}
          <Switch checked={!routine.paused} disabled={busy} data-testid="remote-routine-toggle" onCheckedChange={on => void mutate(async () => { if (on) await api.workBot.routines.resume(bot.id, routine.id, epoch); else await api.workBot.routines.pause(bot.id, routine.id, epoch); })} aria-label={t("work.routines.enable", { name: routine.name })} />
          <IconBtn icon="trash" label={t("common.delete")} data-testid="remote-routine-delete" disabled={busy} onClick={() => void mutate(async () => { await api.workBot.routines.remove(bot.id, routine.id, epoch); })} />
        </div>)}</div></React.Fragment>)}
        <h2 className="h3">{t("workRoutines.history")}</h2><p className="travail-meta">{t("workRoutines.historyLimit")}</p>
        <div className="list">{history.map(({ bot, routine, run }) => <div className="li" key={run.id} data-testid="remote-routine-history" data-run-id={run.id} data-run-status={run.status}><div className="grow"><div className="ttl">{routine.name} · {bot.name}</div><div className="sub">{run.created_at}</div></div><span className="badge">{t(`workRoutines.status.${run.status}`)}</span>{run.error_code && <span className="sub">{t(run.error_code === "execution_unknown" ? "workRoutines.executionUnknown" : "workRoutines.failed")}</span>}</div>)}</div>
      </>}
    </div></div>
  </>;
}

function RoutineEditor({ epoch, id, rid, bots, owns, back }: { epoch: string; id: string; rid: string; bots: { id: string; name: string }[]; owns(): boolean; back(): void }) {
  const t = useT();
  const original = useQuery(() => rid && id && epoch ? api.workBot.routines.get(id, rid, epoch) : Promise.resolve(undefined), [id, rid, epoch]);
  const [bot, setBot] = React.useState(id || bots[0]?.id || "");
  const [name, setName] = React.useState(""), [prompt, setPrompt] = React.useState(""), [body, setBody] = React.useState("");
  const [schedule, setSchedule] = React.useState("0 9 * * 1-5"), [kind, setKind] = React.useState<"cron" | "slack" | "github">("cron"), [event, setEvent] = React.useState("");
  const [timezone, setTimezone] = React.useState(""), [offset, setOffset] = React.useState(""), [quiet, setQuiet] = React.useState(false);
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false), [delivery, setDelivery] = React.useState<string>(() => crypto.randomUUID());
  const [fired, setFired] = React.useState<number>(), [runs, setRuns] = React.useState<WorkRoutineRun[]>([]);
  const initialized = React.useRef(false), pending = React.useRef(false);
  React.useEffect(() => {
    if (original.state !== "ready" || !original.data || initialized.current) return;
    const row = original.data; initialized.current = true;
    setName(row.name); setPrompt(row.prompt); setBody(row.body); setSchedule(row.schedule); setKind(row.trigger.kind); setEvent(row.trigger.event ?? ""); setTimezone(row.timezone ?? ""); setOffset(row.utc_offset_minutes === undefined ? "" : String(row.utc_offset_minutes)); setQuiet(row.quiet_if_empty);
  }, [original]);
  const action = async (run: () => Promise<void>) => {
    if (pending.current || !owns()) return;
    pending.current = true; setBusy(true); setError(false);
    try { await run(); } catch { if (owns()) setError(true); }
    finally { pending.current = false; if (owns()) setBusy(false); }
  };
  const save = () => void action(async () => {
    const trigger = { ...(original.state === "ready" ? original.data?.trigger : {}), kind } as WorkRoutine["trigger"];
    delete trigger.timezone; delete trigger.utc_offset_minutes; delete trigger.event;
    if (kind !== "cron") trigger.event = event.trim();
    const routine = { name, prompt, body, schedule, trigger, quiet_if_empty: quiet, ...(timezone ? { timezone } : {}), ...(offset !== "" ? { utc_offset_minutes: Number(offset) } : {}) };
    if (rid) await api.workBot.routines.update(bot, rid, { epoch, routine }); else await api.workBot.routines.create(bot, { epoch, routine });
    if (owns()) back();
  });
  const valid = !!name.trim() && !!prompt.trim() && !!bot && (kind === "cron" || !!event.trim()) && (!rid || initialized.current);
  const readHistory = () => void action(async () => { const history = await api.workBot.routines.history(bot, rid, epoch); if (owns()) setRuns(history); });
  return <>
    <div className="content-top"><IconBtn icon="arrow-left" label={t("work.edit.back")} onClick={back} /><span className="title">{t(rid ? "work.edit.titleEdit" : "work.routines.new")}</span><div className="spacer" />{rid && <button className="btn secondary" disabled={busy} onClick={original.reload}>{t("workBot.reconnect")}</button>}<button className="btn secondary" onClick={back}>{t("common.cancel")}</button><button className="btn primary" data-testid="routine-save" disabled={busy || !valid} onClick={save}>{t(rid ? "common.save" : "work.edit.create")}</button></div>
    <div className="page"><div className="travail-mid travail-form remote-routines" data-testid="remote-routine-editor">
      <form onSubmit={e => { e.preventDefault(); if (valid) save(); }}><fieldset disabled={busy}>
        {(error || original.state === "error") && <div className="banner err" role="alert" data-testid="remote-routines-error">{t("workRoutines.unconfirmed")}</div>}
        <label className="field">{t("work.edit.name")}<input className="input" data-testid="remote-routine-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} required /></label>
        <label className="field">{t("work.edit.instructions")}<textarea className="input" data-testid="remote-routine-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={4000} required /></label>
        <label className="field">{t("work.edit.assigned")}<select className="input" data-testid="remote-routine-bot" value={bot} disabled={!!rid} onChange={e => setBot(e.target.value)}>{bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="field">{t("work.edit.trigger")}<select className="input" data-testid="remote-routine-kind" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>{["cron", "slack", "github"].map(k => <option key={k} value={k}>{t(`workRoutines.kind.${k}`)}</option>)}</select></label>
        {kind !== "cron" && <label className="field">{t("workRoutines.event")}<input className="input" data-testid="remote-routine-event" value={event} onChange={e => setEvent(e.target.value)} maxLength={80} required /></label>}
        <label className="field">{t("workRoutines.cron")}<input className="input mono" data-testid="remote-routine-cron" value={schedule} onChange={e => setSchedule(e.target.value)} required /></label>
        <label className="field">{t("workRoutines.offset")}<input className="input" data-testid="remote-routine-offset" type="number" min={-720} max={840} step={1} value={offset} onChange={e => setOffset(e.target.value)} /></label>
        <label className="field">{t("workRoutines.timezone")}<input className="input" data-testid="remote-routine-timezone" value={timezone} onChange={e => setTimezone(e.target.value)} maxLength={64} /></label>
        <label className="field">{t("workRoutines.body")}<textarea className="input" data-testid="remote-routine-body" value={body} onChange={e => setBody(e.target.value)} /></label>
        <label className="li"><span className="grow">{t("workRoutines.quiet")}</span><Switch data-testid="remote-routine-quiet" checked={quiet} onCheckedChange={setQuiet} aria-label={t("workRoutines.quiet")} /></label>
      </fieldset></form>
      <aside className="travail-side"><div className="travail-next-card"><h3 className="h3">{t("workRoutines.scheduling")}</h3><p>{t("workRoutines.offsetNote")}</p><p>{t("workRoutines.timezoneNote")}</p><p>{t("workRoutines.pauseNote")}</p></div>
        {rid && <div className="travail-next-card"><h3 className="h3">{t("workRoutines.history")}</h3><button className="btn secondary" data-testid="remote-routine-history-refresh" disabled={busy} onClick={readHistory}>{t("workBot.reconnect")}</button>{runs.map(run => <div key={run.id} data-testid="remote-routine-history" data-run-status={run.status}>{t(`workRoutines.status.${run.status}`)} · {run.created_at}</div>)}</div>}
        {rid && original.state === "ready" && original.data?.trigger.kind !== "cron" && <div className="travail-next-card"><h3 className="h3">{t("workRoutines.deliver")}</h3><p>{t("workRoutines.deliveryNote")}</p><label className="field">{t("workRoutines.deliveryID")}<input className="input mono" data-testid="remote-routine-delivery" value={delivery} onChange={e => setDelivery(e.target.value)} /></label><button className="btn secondary" data-testid="remote-routine-deliver" disabled={busy || !initialized.current} onClick={() => void action(async () => {
          // ponytail: saved trigger/prompt only; edited drafts require Save before delivery.
          const row = original.state === "ready" ? original.data : undefined;
          if (!row || row.trigger.kind === "cron" || !row.trigger.event) return;
          const result = await api.workBot.routines.event({ epoch, mascot_id: bot, kind: row.trigger.kind, event: row.trigger.event, delivery_id: delivery });
          if (owns()) { setFired(result.fired); original.reload(); }
        })}>{t("workRoutines.deliver")}</button><button className="btn secondary" disabled={busy} onClick={() => { setDelivery(crypto.randomUUID()); setFired(undefined); }}>{t("workRoutines.newDelivery")}</button>{fired !== undefined && <p role="status" data-testid="remote-routine-fired" data-fired={fired}>{t("workRoutines.fired", { count: fired })}</p>}</div>}
      </aside>
    </div></div>
  </>;
}
