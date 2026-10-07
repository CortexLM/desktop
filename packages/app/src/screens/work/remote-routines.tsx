import * as React from "react";
import type { WorkBotView, WorkRoutine, WorkRoutineRun } from "@cortex/schema";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useNav, readHash } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Icon, IconBtn, Switch } from "../../kit/ui";
import { Mascot } from "../../mascot/Mascot";
import { Top, Empty, Choice, lookMascot, parseCron, toCron, useCronLabel, useAgo } from "./common";

export function RoutineConnection({ local }: { local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []);
  const { route, entryKey } = useNav();
  return !isPreview() && connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn ? <RemoteRoutines key={`${entryKey}:${route}`} /> : local;
}

function RemoteRoutines() {
  const t = useT(), { route, params, entryKey, go } = useNav(), cron = useCronLabel(), ago = useAgo();
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
  const edit = (bot: string, routine?: string, event?: boolean) => go("automation-edit", { epoch, bot, ...(routine ? { id: routine } : {}), ...(event ? { trigger: "event" } : {}) });
  const ready = owners.state === "ready" && owners.data.epoch === epoch;
  if (editing) return <RoutineEditor key={`${epoch}:${id}:${rid}`} epoch={epoch} id={id} rid={rid} bots={bots} owns={owns} back={back} event={params.get("trigger") === "event"} />;
  const data = ready && rows.state === "ready" ? rows.data : [];
  const failed = error || owners.state === "error" || rows.state === "error";
  const loading = !failed && (!ready || rows.state === "loading");
  const history = data.flatMap(row => row.runs.map(run => ({ ...row, run }))).sort((a, b) => b.run.created_at.localeCompare(a.run.created_at)).slice(0, 12);
  const retry = () => { setError(false); owners.reload(); rows.reload(); };
  return <>
    <Top title={t("work.routines")}>{bots.length > 0 && <button className="btn primary" style={{ height: 28 }} data-testid="routine-create" disabled={!ready} onClick={() => edit(bots[0].id)}><Icon name="plus" size={16} />{t("work.routines.new")}</button>}</Top>
    {failed && !data.length ? <Empty state="blocked" title={t("work.error.loadTitle")} text={t("work.routines.loadError")}><button className="btn secondary" data-testid="remote-routines-retry" onClick={retry}>{t("common.retry")}</button></Empty>
      : loading ? <div className="page"><div className="travail-mid" role="status" aria-busy="true" aria-label={t("work.home.loading")}>{[0, 1, 2].map(i => <div key={i} className="travail-skelcard"><span className="skel line" style={{ width: `${70 - i * 12}%` }} /><span className="skel line" style={{ width: "35%" }} /></div>)}</div></div>
      : !bots.length ? <Empty state="idle" title={t("work.routines.emptyTitle")} text={t("work.routines.needBot")}><button className="btn primary" data-testid="routine-create-bot" onClick={() => go("bot-new")}><Icon name="plus" size={16} />{t("bots.new.title")}</button></Empty>
      : !data.length ? <Empty state="idle" title={t("work.routines.emptyTitle")} text={t("work.routines.emptyText")}><div className="travail-actions"><button className="btn primary" data-testid="routine-create-empty" onClick={() => edit(bots[0].id)}><Icon name="plus" size={16} />{t("work.routines.create")}</button><button className="btn secondary" onClick={() => edit(bots[0].id, undefined, true)}>{t("work.routines.fromEvent")}</button></div></Empty>
      : <div className="page"><div className="travail-mid remote-routines" data-testid="remote-routines">
        {error && <div className="banner err" role="alert" data-testid="remote-routines-error">{t("workRoutines.unconfirmed")}<button className="btn secondary" onClick={retry}>{t("common.retry")}</button></div>}
        {bots.filter(bot => data.some(row => row.bot.id === bot.id)).map(bot => <React.Fragment key={bot.id}><div className="travail-botgroup"><Mascot cfg={lookMascot(bot)} size={20} state="idle" />{bot.name}<span className="travail-count">{data.filter(row => row.bot.id === bot.id).length}</span></div><div className="list">{data.filter(row => row.bot.id === bot.id).map(({ routine, runs }) => <div className="travail-rt" key={routine.id} data-testid="remote-routine-row" data-routine-id={routine.id} data-paused={routine.paused} data-err={runs[0]?.status === "failed" || undefined}>
          <span className="li-ic"><Icon name={routine.trigger.kind === "cron" ? "clock-loop" : "bolt"} size={16} /></span>
          <button className="travail-grow" style={{ textAlign: "left" }} data-testid="remote-routine-edit" onClick={() => edit(bot.id, routine.id)}><span className="ttl">{routine.name}</span><span className="travail-meta">{routine.trigger.kind === "cron" ? cron(routine.schedule) : t("workRoutines.onEvent", { source: t(`workRoutines.kind.${routine.trigger.kind}`), event: routine.trigger.event ?? "" })}</span></button>
          {runs[0] && <span className={`badge ${runs[0].status === "failed" ? "err" : runs[0].status === "completed" ? "ok" : ""}`} data-testid="remote-routine-latest">{t(`workRoutines.status.${runs[0].status}`)}</span>}
          <span className="badge" data-testid="remote-routine-status">{t(routine.paused ? "work.paused" : "workRoutines.enabled")}</span>
          <Switch checked={!routine.paused} disabled={busy} data-testid="remote-routine-toggle" onCheckedChange={on => void mutate(async () => { if (on) await api.workBot.routines.resume(bot.id, routine.id, epoch); else await api.workBot.routines.pause(bot.id, routine.id, epoch); })} aria-label={t("work.routines.enable", { name: routine.name })} />
          <IconBtn icon="trash" label={t("common.delete")} data-testid="remote-routine-delete" disabled={busy} onClick={() => void mutate(async () => { await api.workBot.routines.remove(bot.id, routine.id, epoch); })} />
        </div>)}</div></React.Fragment>)}
        {history.length > 0 && <><h3 className="h3" style={{ marginTop: 8 }}>{t("work.routines.history")}</h3>
        <div className="list">{history.map(({ bot, routine, run }) => <div className="li" key={run.id} data-testid="remote-routine-history" data-run-id={run.id} data-run-status={run.status}><Mascot cfg={lookMascot(bot)} size={20} state="idle" /><div className="grow"><div className="ttl">{routine.name}</div><div className="sub">{bot.name} · {ago(run.created_at)}</div></div><span className={`badge ${run.status === "failed" ? "err" : run.status === "completed" ? "ok" : ""}`}>{t(`workRoutines.status.${run.status}`)}</span>{run.error_code && <span className="sub">{t(run.error_code === "execution_unknown" ? "workRoutines.executionUnknown" : "workRoutines.failed")}</span>}</div>)}</div></>}
      </div></div>}
  </>;
}

const FREQ = ["daily", "weekdays", "monday", "every30", "custom"] as const;

function RoutineEditor({ epoch, id, rid, bots, owns, back, event: startEvent }: { epoch: string; id: string; rid: string; bots: WorkBotView[]; owns(): boolean; back(): void; event: boolean }) {
  const t = useT(), cron = useCronLabel(), ago = useAgo();
  const original = useQuery(() => rid && id && epoch ? api.workBot.routines.get(id, rid, epoch) : Promise.resolve(undefined), [id, rid, epoch]);
  const history = useQuery(() => rid && id && epoch ? api.workBot.routines.history(id, rid, epoch) : Promise.resolve([] as WorkRoutineRun[]), [id, rid, epoch]);
  const [bot, setBot] = React.useState(id || bots[0]?.id || "");
  const [name, setName] = React.useState(""), [prompt, setPrompt] = React.useState(""), [body, setBody] = React.useState("");
  const [freq, setFreq] = React.useState<(typeof FREQ)[number]>("weekdays"), [time, setTime] = React.useState("09:00"), [custom, setCustom] = React.useState("");
  const [kind, setKind] = React.useState<"cron" | "slack" | "github">(startEvent ? "slack" : "cron"), [event, setEvent] = React.useState(""), [quiet, setQuiet] = React.useState(false);
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false), [fired, setFired] = React.useState<number>();
  const initialized = React.useRef(false), pending = React.useRef(false);
  React.useEffect(() => {
    if (original.state !== "ready" || !original.data || initialized.current) return;
    const row = original.data, parsed = parseCron(row.schedule); initialized.current = true;
    setName(row.name); setPrompt(row.prompt); setBody(row.body); setFreq(parsed.kind); setTime(parsed.time); setCustom(row.schedule); setKind(row.trigger.kind); setEvent(row.trigger.event ?? ""); setQuiet(row.quiet_if_empty);
  }, [original]);
  const action = async (run: () => Promise<void>) => {
    if (pending.current || !owns()) return;
    pending.current = true; setBusy(true); setError(false);
    try { await run(); } catch { if (owns()) setError(true); }
    finally { pending.current = false; if (owns()) setBusy(false); }
  };
  const schedule = toCron(freq, time, custom);
  const save = () => void action(async () => {
    const stored = original.state === "ready" ? original.data : undefined;
    const trigger = { ...stored?.trigger, kind } as WorkRoutine["trigger"];
    delete trigger.timezone; delete trigger.utc_offset_minutes; delete trigger.event;
    if (kind !== "cron") trigger.event = event.trim();
    // ponytail: the server keeps its Paris-time default; a stored timezone/offset from an older editor is preserved, never invented.
    const routine = { name, prompt, body, schedule: kind === "cron" ? schedule : stored?.schedule ?? schedule, trigger, quiet_if_empty: quiet, ...(stored?.timezone ? { timezone: stored.timezone } : {}), ...(stored?.utc_offset_minutes !== undefined ? { utc_offset_minutes: stored.utc_offset_minutes } : {}) };
    if (rid) await api.workBot.routines.update(bot, rid, { epoch, routine }); else await api.workBot.routines.create(bot, { epoch, routine });
    if (owns()) back();
  });
  const validEvent = /^[A-Za-z0-9_\-.:/]{1,80}$/.test(event.trim());
  const valid = !!name.trim() && !!prompt.trim() && !!bot && (kind === "cron" ? !!schedule : validEvent) && (!rid || initialized.current);
  const stored = original.state === "ready" ? original.data : undefined;
  const test = () => void action(async () => {
    if (!stored || stored.trigger.kind === "cron" || !stored.trigger.event) return;
    const result = await api.workBot.routines.event({ epoch, mascot_id: bot, kind: stored.trigger.kind, event: stored.trigger.event, delivery_id: crypto.randomUUID() });
    if (owns()) { setFired(result.fired); history.reload(); }
  });
  return <>
    <div className="content-top"><IconBtn icon="arrow-left" label={t("work.edit.back")} disabled={busy} onClick={back} /><span className="title">{t(rid ? "work.edit.titleEdit" : "work.routines.new")}</span><div className="spacer" /><button className="btn secondary" style={{ height: 28 }} disabled={busy} onClick={back}>{t("common.cancel")}</button><button className="btn primary" style={{ height: 28, marginLeft: 4 }} data-testid="routine-save" disabled={busy || !valid} onClick={save}>{t(rid ? "common.save" : "work.edit.create")}</button></div>
    <div className="page"><div className="travail-mid travail-form remote-routines" data-testid="remote-routine-editor">
      <form onSubmit={e => { e.preventDefault(); if (valid) save(); }}><fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        {(error || original.state === "error") && <div className="banner err" role="alert" data-testid="remote-routines-error">{t("workRoutines.unconfirmed")}</div>}
        <div className="field"><label htmlFor="rr-name">{t("work.edit.name")}</label><input id="rr-name" className="input" data-testid="remote-routine-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} required /></div>
        <Choice testId="remote-routine-kind" label={t("work.edit.trigger")} value={kind === "cron" ? "cron" : "event"} onChange={v => setKind(v === "cron" ? "cron" : kind === "cron" ? "slack" : kind)} options={[["cron", <><Icon name="clock-loop" size={16} />{t("work.edit.schedule")}</>], ["event", <><Icon name="bolt" size={16} />{t("work.edit.event")}</>]]} />
        {kind === "cron" ? <>
          <Choice testId="remote-routine-frequency" label={t("work.edit.frequency")} value={freq} onChange={setFreq} options={FREQ.map(f => [f, f === "custom" ? t("work.sched.customLabel") : t(`work.sched.${f}`)])} />
          {freq !== "every30" && freq !== "custom" && <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><label htmlFor="rr-time" style={{ fontWeight: 400, color: "var(--t2)" }}>{t("work.edit.at")}</label><input id="rr-time" type="time" className="input mono" data-testid="remote-routine-time" style={{ width: 110 }} value={time} onChange={e => setTime(e.target.value || "09:00")} /><span className="travail-meta">{t("workRoutines.parisTime")}</span></div>}
          {freq === "custom" && <div className="field"><label htmlFor="rr-cron">{t("workRoutines.customCron")}</label><input id="rr-cron" className="input mono" data-testid="remote-routine-cron" value={custom} placeholder="0 9 * * 1-5" onChange={e => setCustom(e.target.value)} /><span className="travail-meta">{t("workRoutines.customHint")}</span></div>}
        </> : <>
          <Choice testId="remote-routine-source" label={t("work.edit.when")} value={kind} onChange={setKind} options={(["slack", "github"] as const).map(k => [k, t(`workRoutines.kind.${k}`)])} />
          <div className="field"><label htmlFor="rr-event">{t("workRoutines.event")}</label><input id="rr-event" className="input" data-testid="remote-routine-event" value={event} placeholder={t(`workRoutines.eventExample.${kind}`)} onChange={e => setEvent(e.target.value)} maxLength={80} aria-invalid={!!event.trim() && !validEvent} /></div>
        </>}
        <div className="field"><label htmlFor="rr-prompt">{t("work.edit.instructions")}</label><textarea id="rr-prompt" className="input" style={{ height: 104 }} data-testid="remote-routine-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={4000} required /></div>
        <Choice testId="remote-routine-bot" label={t("work.edit.assigned")} value={bot} disabled={!!rid} onChange={setBot} options={bots.map(b => [b.id, <><Mascot cfg={lookMascot(b)} size={20} state={bot === b.id ? "listening" : "idle"} />{b.name}</>])} />
        <div className="field"><label htmlFor="rr-body">{t("workRoutines.body")}</label><textarea id="rr-body" className="input" data-testid="remote-routine-body" value={body} onChange={e => setBody(e.target.value)} /></div>
        <label className="li" style={{ padding: "4px 0", border: 0 }}><span className="grow">{t("workRoutines.quiet")}</span><Switch data-testid="remote-routine-quiet" checked={quiet} onCheckedChange={setQuiet} aria-label={t("workRoutines.quiet")} /></label>
      </fieldset></form>
      <aside className="travail-side">
        <div className="travail-next-card" data-testid="remote-routine-next"><h3 className="h3">{t("work.edit.nextRun")}</h3><div className="travail-big">{kind === "cron" ? (schedule ? cron(schedule) : "—") : t("work.edit.atNext", { event: event.trim() || t(`workRoutines.kind.${kind}`) })}</div>{kind === "cron" && <ul><li>{t("workRoutines.parisTime")}</li></ul>}</div>
        {rid && stored && stored.trigger.kind !== "cron" && <div className="travail-next-card travail-test"><h3 className="h3" style={{ margin: 0 }}>{t("work.edit.testTitle")}</h3><span className="travail-meta" style={{ whiteSpace: "normal" }}>{t("workRoutines.testText")}</span><button className="btn secondary" style={{ alignSelf: "flex-start", marginTop: 4 }} data-testid="remote-routine-deliver" disabled={busy || !initialized.current} onClick={test}><Icon name="play" size={16} />{t("work.edit.runTest")}</button>{fired !== undefined && <p role="status" data-testid="remote-routine-fired" data-fired={fired}>{t(fired ? "workRoutines.testStarted" : "workRoutines.testNotStarted")}</p>}</div>}
        {rid && history.state === "ready" && history.data.length > 0 && <div className="travail-next-card"><h3 className="h3">{t("workRoutines.history")}</h3><ul>{history.data.slice(0, 5).map(run => <li key={run.id} data-testid="remote-routine-history" data-run-status={run.status}>{t(`workRoutines.status.${run.status}`)} · {ago(run.created_at)}</li>)}</ul></div>}
      </aside>
    </div></div>
  </>;
}
