// Routines: Bot tasks that run on a schedule (engine ScheduledTask with a botID), and the routine editor.
import * as React from "react";
import type { Schedule, ScheduledTask, Bot } from "@cortex/schema";
import { Icon, IconBtn, Switch, Segmented, Pop, MItem, MSep, Tip, useToast } from "../../kit/ui";
import { useVariant } from "../../registry";
import { useT, useI18n } from "../../i18n";
import { useNav } from "../../shell/nav";
import { isPreview, useFixtures } from "../../preview";
import { api } from "../../api";
import { useBots, useQuery } from "../../state/live";
import { css, useGo, useMainBot, useDate, Top, Empty, Mono, BotFace, type BotsFx } from "./common";
import type { WorkFx } from "./fixtures";

type Run = "ok" | "err" | "skip";
type Row = { id: string; t: string; bot: string; trig: string; ev?: boolean; next: string; nextSub: string; runs: Run[]; on: boolean; task?: ScheduledTask };

const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
/** Maps the editor's frequency to the engine Schedule. */
function toSchedule(kind: string, time: string): Schedule {
  const [h, m] = time.split(":").map(Number);
  if (kind === "daily") return { type: "daily", time };
  if (kind === "monday") return { type: "weekly", day: 1, time };
  if (kind === "weekdays") return { type: "cron", expr: `${m} ${h} * * 1-5` };
  return { type: "cron", expr: "*/30 * * * *" };
}
function fromSchedule(s: Schedule): [string, string] {
  if (s.type === "daily") return ["daily", s.time];
  if (s.type === "weekly") return ["monday", s.time];
  if (s.type === "cron" && s.expr === "*/30 * * * *") return ["every30", "08:00"];
  const m = s.type === "cron" ? s.expr.match(/^(\d+) (\d+) \* \* 1-5$/) : null;
  return m ? ["weekdays", hhmm(+m[2] * 60 + +m[1])] : ["daily", "08:00"];
}

function useTrigger() {
  const t = useT();
  const { locale } = useI18n();
  return (s: Schedule) => {
    if (s.type === "daily") return t("work.sched.dailyAt", { time: s.time });
    if (s.type === "weekly") return t("work.sched.weeklyAt", { day: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2026, 0, 4 + s.day)), time: s.time });
    if (s.type === "once") return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(s.at);
    const [k, time] = fromSchedule(s);
    return k === "every30" ? t("work.sched.every30") : k === "weekdays" ? t("work.sched.weekdaysAt", { time }) : s.expr;
  };
}

/* ====================================================================== */
/* 3. Routines                                                            */
/* ====================================================================== */
export function Automations() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const preview = isPreview();
  const fx = useFixtures<WorkFx>("work");
  const main = useMainBot();
  const date = useDate();
  const trig = useTrigger();
  const [v] = useVariant("list");
  const bots = useBots();
  const tasks = useQuery(() => api.tasks.list(), [], (e) => e.type === "task.run");
  const liveBots: Bot[] = bots.state === "ready" ? bots.data : [];
  const [rs, setRs] = React.useState<Row[]>(fx.routines ?? []);
  const [retry, setRetry] = React.useState(false);
  const fail = preview && v === "failed" && !retry;
  const liveRows: Row[] = tasks.state === "ready" ? tasks.data.filter((x) => x.botID).map((x) => ({
    id: x.id, t: x.title, bot: liveBots.find((b) => b.id === x.botID)?.name ?? "", trig: trig(x.schedule), task: x, on: x.enabled,
    next: x.nextRun ? date.short(x.nextRun) : "—", nextSub: x.nextRun ? date.time(x.nextRun) : "—",
    runs: x.runs.slice(-8).map((r) => (r.status === "error" ? "err" : r.status === "success" ? "ok" : "skip")),
  })) : [];
  const rows = preview ? rs.map((r) => (r.id === fx.failRoutine && fail ? { ...r, runs: [...r.runs.slice(0, 7), "err" as Run], nextSub: fx.failNextSub } : r)) : liveRows;
  const name = (n: string) => (n === fx.main?.name ? main?.cfg.name ?? n : n);
  const groups = [...new Set(rows.map((r) => r.bot))];
  type H = [string, string, string, Run, string];
  const hist: H[] = preview ? (fail ? [fx.failHist as H, ...(fx.history as H[]).filter((h) => h[1] !== fx.failHist[1])] : fx.history as H[])
    : liveRows.flatMap((r) => r.task!.runs.map((x) => [date.short(x.time.start), r.t, r.bot, x.status === "error" ? "err" : "ok", x.time.end ? t("chat.secs", { secs: Math.round((x.time.end - x.time.start) / 1000) }) : "—", x.time.start] as const))
      .sort((a, b) => b[5] - a[5]).slice(0, 12).map((x) => x.slice(0, 5) as H);
  const empty = preview ? v === "empty" : tasks.state === "ready" && !liveRows.length;
  const toggle = (r: Row, on: boolean) => {
    if (preview) return setRs((xs) => xs.map((x) => (x.id === r.id ? { ...x, on } : x)));
    api.tasks.update(r.id, { enabled: on }).then(tasks.reload, () => toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } }));
  };
  const runNow = (r: Row) => {
    toast.add({ title: t("work.routines.toastRun"), description: r.t, data: { icon: "play" } });
    if (!preview) api.tasks.run(r.id).then(tasks.reload, () => toast.add({ title: t("work.error.run"), data: { icon: "alert-triangle" } }));
  };
  const remove = (r: Row) => (preview ? setRs((xs) => xs.filter((x) => x.id !== r.id)) : api.tasks.delete(r.id).then(tasks.reload, () => {}));
  const edit = (r: Row) => go("automation-edit", r.ev ? "event" : "", preview ? {} : { id: r.id });
  return (<>
    <Top title={t("work.routines")}><button className="btn primary" style={{ height: 28 }} data-testid="routine-create" onClick={() => go("automation-edit")}><Icon name="plus" size={16} />{t("work.routines.new")}</button></Top>
    {empty ? (
      <Empty state="idle" title={t("work.routines.emptyTitle")} text={t("work.routines.emptyText")}>
        <div className="travail-actions"><button className="btn primary" onClick={() => go("automation-edit")}><Icon name="plus" size={16} />{t("work.routines.create")}</button>{preview && <button className="btn secondary" onClick={() => go("automation-edit", "event")}>{t("work.routines.fromEvent")}</button>}</div>
      </Empty>
    ) : tasks.state === "error" && !preview ? (
      <Empty state="blocked" title={t("work.error.loadTitle")} text={t("work.error.loadText")}><button className="btn secondary" onClick={tasks.reload}>{t("common.retry")}</button></Empty>
    ) : (
      <div className="page"><div className="travail-mid">
        {fail && <div className="banner err travail-banner"><Icon name="alert-triangle" size={16} /><span>{fx.failBanner.title}</span><span className="grow">{fx.failBanner.text}</span>
          <button className="btn secondary" onClick={() => go("connectors", "error")}>{t("work.reconnect")}</button><button className="btn primary" onClick={() => { setRetry(true); toast.add({ title: t("work.routines.toastRetried"), description: fx.failHist[1], data: { icon: "refresh" } }); }}><Icon name="refresh" size={16} />{t("common.retry")}</button></div>}
        {groups.map((g) => (
          <React.Fragment key={g}>
            <div className="travail-botgroup"><BotFace name={g} size={20} bots={liveBots} />{name(g)}<span className="travail-count">{rows.filter((r) => r.bot === g).length}</span></div>
            <div className="list">
              {rows.filter((r) => r.bot === g).map((r, i) => { const err = r.runs.at(-1) === "err"; return (
                <div key={r.id} className="travail-rt travail-rise" style={css(i)} data-err={err || undefined}>
                  <span className="li-ic"><Icon name={r.ev ? "bolt" : "clock-loop"} size={16} /></span>
                  <button className="travail-grow" style={{ textAlign: "left" }} onClick={() => edit(r)}><span className="ttl">{r.t}</span><span className="travail-meta">{r.trig}</span></button>
                  <Tip label={t("work.routines.lastRuns", { count: r.runs.length })}><span className="travail-runs" aria-label={t("work.routines.runsLabel", { ok: r.runs.filter((x) => x === "ok").length, err: r.runs.filter((x) => x === "err").length })}>{r.runs.map((x, j) => <i key={j} data-s={x} />)}</span></Tip>
                  <span className="travail-next">{err ? <span className="badge err" style={{ alignSelf: "flex-end" }}>{t("work.failed")}</span> : <b>{r.on ? r.next : t("work.paused")}</b>}<span className="travail-meta">{r.on ? r.nextSub : "—"}</span></span>
                  <Switch checked={r.on} onCheckedChange={(on) => toggle(r, on)} aria-label={t("work.routines.enable", { name: r.t })} />
                  <Pop align="end" trigger={<button className="ibtn" aria-label={t("work.routines.optionsOf", { name: r.t })}><Icon name="more-dots" size={16} /></button>}>
                    <MItem icon="play" onClick={() => runNow(r)}>{t("work.routines.runNow")}</MItem><MItem icon="edit" onClick={() => edit(r)}>{t("work.edit")}</MItem>{preview && <MItem icon="copy">{t("work.duplicate")}</MItem>}<MSep />
                    <MItem icon="trash" danger onClick={() => remove(r)}>{t("common.delete")}</MItem>
                  </Pop>
                </div>); })}
            </div>
          </React.Fragment>))}
        {hist.length > 0 && <>
          <h3 className="h3" style={{ marginTop: 8 }}>{t("work.routines.history")}</h3>
          <div className="list">
            <table className="travail-hist"><thead><tr><th>{t("work.routines.when")}</th><th>{t("work.routines.routine")}</th><th>{t("work.routines.bot")}</th><th>{t("work.routines.status")}</th><th>{t("work.routines.duration")}</th></tr></thead>
              <tbody>{hist.map(([w, x, b, s, d], i) => <tr key={w + x + i}><td className="mono">{w}</td><td>{x}</td><td><span className="travail-urg"><BotFace name={b} size={18} bots={liveBots} />{name(b)}</span></td>
                <td>{s === "ok" ? <span className="badge ok">{t("work.routines.succeeded")}</span> : <span className="badge err">{t("work.failed")}</span>}</td><td className="mono">{d}</td></tr>)}</tbody></table>
          </div>
        </>}
      </div></div>
    )}
  </>);
}

/* ====================================================================== */
/* 4. New routine                                                         */
/* ====================================================================== */
const SCHED = ["daily", "weekdays", "monday", "every30"];
const EVENTS: [string, string][] = [["ticket", "TK"], ["mail", "ME"], ["pr", "PR"]];
function nextRuns(kind: string, time: string, locale: string, today: string): string[] {
  const [h, m] = time.split(":").map(Number);
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(d) + " " + time;
  const out: string[] = [], d = new Date();
  if (kind === "every30") { const x = new Date(); x.setMinutes(x.getMinutes() < 30 ? 30 : 60, 0, 0); for (let i = 0; i < 3; i++) { out.push(new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(x)); x.setMinutes(x.getMinutes() + 30); } return out.map((y, i) => (i ? y : today + " " + y)); }
  d.setHours(h, m, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1);
  while (out.length < 3) { const wd = d.getDay(); if (kind === "daily" || (kind === "weekdays" && wd > 0 && wd < 6) || (kind === "monday" && wd === 1)) out.push(fmt(new Date(d))); d.setDate(d.getDate() + 1); }
  return out;
}

export function AutomationEdit() {
  const t = useT();
  const { locale } = useI18n();
  const go = useGo();
  const toast = useToast();
  const { params } = useNav();
  const preview = isPreview();
  const fx = useFixtures<WorkFx>("work");
  const fxb = useFixtures<BotsFx>("bots");
  const main = useMainBot();
  const bots = useBots();
  const liveBots: Bot[] = bots.state === "ready" ? bots.data : [];
  const editID = preview ? "" : params.get("id") ?? "";
  const [v, setV] = useVariant("schedule");
  const evMode = (x: string) => (["event", "test", "passed"].includes(x) ? "event" : "schedule");
  const [mode, setMode] = React.useState(evMode(v));
  const [sched, setSched] = React.useState("monday");
  const [time, setTime] = React.useState("08:00");
  const [ev, setEv] = React.useState("ticket");
  const [who, setWho] = React.useState(preview ? fxb.main?.name ?? "" : "");
  const [name, setName] = React.useState(preview ? fx.edit.name : "");
  const [instr, setInstr] = React.useState(preview ? fx.edit.instr : "");
  const [ask, setAsk] = React.useState(true);
  const [test, setTest] = React.useState(v === "test" ? 2 : v === "passed" ? 4 : -1);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setMode(evMode(v)); setTest(v === "test" ? 2 : v === "passed" ? 4 : -1);
    if (preview && evMode(v) === "event") { setEv("ticket"); setWho(fx.edit.eventBot); setName(fx.edit.eventName); setInstr(fx.edit.eventInstr); }
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (test < 0 || test >= 4 || v === "test") return; const id = setTimeout(() => setTest((x) => x + 1), 900); return () => clearTimeout(id); }, [test, v]);
  // Live: load the routine being edited, default the Bot to the main one.
  React.useEffect(() => {
    if (preview) return;
    if (editID) api.tasks.get(editID).then((x) => { setName(x.title); setInstr(x.prompt); const [k, tm] = fromSchedule(x.schedule); setSched(k); setTime(tm); setWho(x.botID ?? ""); }, () => {});
  }, [editID]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (!preview && !who && liveBots[0]) setWho(liveBots[0].id); }, [liveBots.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const runs = mode === "schedule" ? nextRuns(sched, time, locale, t("work.edit.today")) : [];
  const runTest = () => { setTest(0); if (v === "test") setV("passed"); };
  const pct = test < 0 ? 0 : (test / 4) * 100;
  const pick: [string, string][] = preview ? [[fxb.main.name, main?.cfg.name ?? ""], ...fx.edit.bots.map((b) => [b, b] as [string, string])] : liveBots.map((b) => [b.id, b.name]);
  const schedLabel = (k: string) => t(`work.sched.${k}`);
  const evLabel = (k: string) => t(`work.edit.ev.${k}`);
  const save = async () => {
    const desc = `${name} · ${mode === "schedule" ? schedLabel(sched).toLowerCase() : evLabel(ev).toLowerCase()}`;
    if (preview) { toast.add({ title: t("work.edit.toastCreated"), description: desc, data: { icon: "clock-loop" } }); go("automations"); return; }
    const bot = liveBots.find((b) => b.id === who);
    if (!bot) { go("bot-new"); return; }
    setBusy(true);
    const body = { title: name.trim(), prompt: instr.trim(), schedule: toSchedule(sched, time), model: bot.model, botID: bot.id };
    try {
      if (editID) await api.tasks.update(editID, body); else await api.tasks.create(body);
      toast.add({ title: editID ? t("work.edit.toastSaved") : t("work.edit.toastCreated"), description: desc, data: { icon: "clock-loop" } });
      go("automations");
    } catch { toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } }); } finally { setBusy(false); }
  };
  return (<>
    <div className="content-top"><IconBtn icon="arrow-left" label={t("work.edit.back")} onClick={() => go("automations")} /><span className="title">{editID ? t("work.edit.titleEdit") : t("work.routines.new")}</span><div className="spacer" />
      <button className="btn secondary" style={{ height: 28 }} onClick={() => go("automations")}>{t("common.cancel")}</button>
      <button className="btn primary" style={{ height: 28, marginLeft: 4 }} data-testid="routine-save" disabled={!name.trim() || !instr.trim() || busy || (!preview && !who)} onClick={save}>{editID ? t("common.save") : t("work.edit.create")}</button></div>
    <div className="page"><div className="travail-mid travail-form">
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="field"><label htmlFor="travail-rn">{t("work.edit.name")}</label><input id="travail-rn" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></div>
        {preview && <div className="field"><span style={{ fontWeight: 500 }}>{t("work.edit.trigger")}</span><div style={{ display: "flex" }}><Segmented items={[t("work.edit.schedule"), t("work.edit.event")]} value={mode === "schedule" ? t("work.edit.schedule") : t("work.edit.event")} onChange={(m) => { const x = m === t("work.edit.schedule") ? "schedule" : "event"; setMode(x); setV(x); }} /></div></div>}
        {mode === "schedule" ? <div className="field travail-rise">
          <span style={{ fontWeight: 500 }} id="travail-fq">{t("work.edit.frequency")}</span>
          <div className="travail-opts" role="radiogroup" aria-labelledby="travail-fq">{SCHED.map((id) => <button key={id} type="button" role="radio" aria-checked={sched === id} className="travail-opt" onClick={() => setSched(id)}><Icon name="clock-loop" size={16} />{schedLabel(id)}</button>)}</div>
          {sched !== "every30" && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}><label htmlFor="travail-rt" style={{ fontWeight: 400, color: "var(--t2)" }}>{t("work.edit.at")}</label><input id="travail-rt" type="time" className="input mono" style={{ width: 110 }} value={time} onChange={(e) => setTime(e.target.value || "08:00")} /><span className="travail-meta">{preview ? fx.edit.tz : Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>}
        </div> : <div className="field travail-rise">
          <span style={{ fontWeight: 500 }} id="travail-evl">{t("work.edit.when")}</span>
          <div className="travail-opts" role="radiogroup" aria-labelledby="travail-evl">{EVENTS.map(([id, m]) => <button key={id} type="button" role="radio" aria-checked={ev === id} className="travail-opt" onClick={() => setEv(id)}><Mono t={m} size="sm" />{evLabel(id)}</button>)}</div>
          <span className="travail-meta" style={{ marginTop: 2 }}>{t("work.edit.source", { source: fx.edit.sources[ev] })}</span>
        </div>}
        <div className="field"><label htmlFor="travail-ri">{t("work.edit.instructions")}</label><textarea id="travail-ri" className="input" style={{ height: 104 }} value={instr} onChange={(e) => setInstr(e.target.value)} /></div>
        <div className="field"><span style={{ fontWeight: 500 }} id="travail-rb">{t("work.edit.assigned")}</span>
          <div className="travail-botpick" role="radiogroup" aria-labelledby="travail-rb">{pick.map(([id, l]) => <button key={id} type="button" role="radio" aria-checked={who === id} className="travail-opt" onClick={() => setWho(id)}><BotFace name={id} size={20} state={who === id ? "listening" : "idle"} bots={liveBots} />{l}</button>)}</div>
          {!preview && bots.state === "ready" && !liveBots.length && <span className="travail-meta">{t("work.edit.noBot")} <button type="button" className="travail-press" style={{ textDecoration: "underline" }} onClick={() => go("bot-new")}>{t("bots.new.title")}</button></span>}</div>
        {preview && <label className="li" style={{ padding: "4px 0", border: 0 }}><span className="grow"><div className="ttl" style={{ fontSize: 12 }}>{t("work.edit.askFirst")}</div><div className="sub">{t("work.edit.askFirstSub")}</div></span><Switch checked={ask} onCheckedChange={setAsk} aria-label={t("work.edit.askFirstShort")} /></label>}
      </form>
      <aside className="travail-side">
        <div className="travail-next-card">
          <h3 className="h3">{t("work.edit.nextRun")}</h3>
          {mode === "schedule" ? <><div className="travail-big">{runs[0].charAt(0).toUpperCase() + runs[0].slice(1)}</div><ul aria-label={t("work.edit.followingRuns")}>{runs.slice(1).map((r) => <li key={r}>{t("work.edit.then", { when: r })}</li>)}</ul></>
            : <><div className="travail-big">{t("work.edit.atNext", { event: evLabel(ev).toLowerCase() })}</div><ul><li>{fx.edit.eventRate}</li></ul></>}
        </div>
        {preview && <div className="travail-next-card travail-test" aria-live="polite">
          <h3 className="h3" style={{ margin: 0 }}>{t("work.edit.testTitle")}</h3>
          {test < 0 ? <><span className="travail-meta" style={{ whiteSpace: "normal" }}>{t("work.edit.testText")}</span><button className="btn secondary" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={runTest}><Icon name="play" size={16} />{t("work.edit.runTest")}</button></>
            : <>
              <div className="travail-prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("work.edit.testProgress")}><div className="travail-prog-i" data-done={test >= 4 || undefined} style={{ width: `${pct}%` }} /></div>
              {fx.edit.testSteps.map((s, i) => <div key={s} className="travail-step" data-s={i < test ? "ok" : i === test ? "run" : ""}>{i < test ? <Icon name="check" size={16} /> : i === test ? <span className="spin" style={{ margin: "0 4px" }} /> : <Icon name="clock-loop" size={16} />}<span className={i === test ? "thinking" : ""}>{s}</span></div>)}
              {test >= 4 && <div className="travail-test-out"><b style={{ fontWeight: 500 }}>{fx.edit.testOkTitle}</b> {fx.edit.testOkText}<div className="travail-actions" style={{ marginTop: 8 }}><button className="btn secondary" style={{ height: 28 }} onClick={runTest}>{t("work.edit.rerun")}</button><button className="btn secondary" style={{ height: 28 }} onClick={() => go("work-task", "done")}>{t("work.edit.seeDetail")}</button></div></div>}
            </>}
        </div>}
      </aside>
    </div></div>
  </>);
}
