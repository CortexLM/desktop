// Work home (board of tasks handed to Bots) and a running task (transcript + the Bot's computer).
import * as React from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import type { Session, ToolPart, MessageWithParts } from "@cortex/schema";
import { Icon, IconBtn, Segmented, Pop, MItem, MSep, Tip, useToast } from "../../kit/ui";
import { Composer } from "../../components/composer";
import { Mascot, DEFAULT_MASCOT, type State } from "../../mascot/Mascot";
import { useVariant } from "../../registry";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { isPreview, useFixtures, usePreviewBot } from "../../preview";
import { api } from "../../api";
import { useSessions, useBots, usePermissions, useMessages, useQuery } from "../../state/live";
import { toolTitle } from "../../state/tool-label";
import { css, NB, useGo, useMainBot, useStatuses, useDate, Top, Empty, BotFace, type BotsFx } from "./common";
import type { WorkFx } from "./fixtures";

type Col = "todo" | "doing" | "review" | "done";
const COLS: [Col, string][] = [["todo", ""], ["doing", "run"], ["review", "wait"], ["done", "ok"]];
type Task = { id: string; t: string; bot: string; col: Col; meta: string; prog?: number };
const taskOutcome = (messages: MessageWithParts[]) => {
  const last = messages.at(-1)?.info;
  if (last?.role !== "assistant") return "todo";
  if (last.error) return last.error.code === "aborted" ? "paused" : "failed";
  return last.time.completed === undefined ? "todo" : "done";
};

/* ====================================================================== */
/* 1. Work home                                                           */
/* ====================================================================== */
export function WorkHome() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const preview = isPreview();
  const fx = useFixtures<WorkFx>("work");
  const main = useMainBot();
  const name0 = main?.cfg.name ?? "";
  const [v, setV] = useVariant("board");
  const date = useDate();
  // Live: Bot sessions are the tasks.
  const sessions = useSessions("bot");
  const bots = useBots();
  const perms = usePermissions();
  const status = useStatuses();
  const liveSessions = sessions.state === "ready" ? sessions.data : undefined;
  // ponytail: one history read per root Bot session; use a bulk summary when the API provides one.
  const outcomes = useQuery(async () => ({
    sessions: liveSessions, status,
    values: Object.fromEntries(await Promise.all((preview ? [] : liveSessions ?? []).filter((s) => !s.parentID).map(async (s) =>
      [s.id, await api.sessions.messages(s.id).then(taskOutcome, () => "todo" as const)] as const))),
  }), [preview, liveSessions, status]);
  // A changed session/status snapshot invalidates completion while its history is being read.
  const results = outcomes.state === "ready" && outcomes.data.sessions === liveSessions && outcomes.data.status === status ? outcomes.data.values : {};
  const liveBots = bots.state === "ready" ? bots.data : [];
  const asking = new Set(perms.state === "ready" ? perms.data.map((p) => p.sessionID) : []);
  const liveTasks: Task[] = sessions.state === "ready" ? sessions.data.filter((s) => !s.parentID).map((s) => ({
    id: s.id, t: s.title, bot: liveBots.find((b) => b.id === s.botID)?.name ?? name0,
    col: asking.has(s.id) ? "review" : status[s.id] === "busy" || status[s.id] === "retry" ? "doing" : status[s.id] !== "error" && results[s.id] === "done" ? "done" : "todo", meta: date.short(s.time.updated),
  })) : [];
  const [tasks, setTasks] = React.useState<Task[]>(() => (v === "empty" ? [] : fx.tasks ?? []));
  React.useEffect(() => { if (preview) setTasks(v === "empty" ? [] : fx.tasks ?? []); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = preview ? tasks : liveTasks;
  const loading = preview ? v === "loading" : sessions.state === "loading";
  const empty = preview ? v === "empty" && !tasks.length : sessions.state === "ready" && !liveTasks.length;
  const [who, setWho] = React.useState("");
  const [drag, setDrag] = React.useState<{ id: string; dx: number; dy: number; over: Col | null } | null>(null);
  const name = (x: Task) => (x.bot === fx.main?.name ? name0 : x.bot);
  const shown = all.filter((x) => !who || name(x) === who);
  const colLabel = (c: Col) => t(`work.col.${c}`);
  const move = (id: string, col: Col) => setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, col, meta: col === "done" ? t("work.justNow") : x.meta } : x)));
  const open = (x: Task) => go("work-task", "", preview ? {} : { id: x.id });
  const add = async (text: string) => {
    if (preview) {
      setTasks((ts) => [{ id: String(Date.now()), t: text, bot: fx.main.name, col: "todo", meta: t("work.justNow") }, ...ts]);
      toast.add({ title: t("work.home.toastHanded", { name: name0 }), description: text, data: { icon: "bot" } });
      if (v === "empty") setV("board");
      return true;
    }
    if (!main?.bot) { toast.add({ title: t("work.error.send"), data: { icon: "alert-triangle" } }); return false; }
    try {
      const s = await api.bots.createSession(main.bot.id, { title: text.slice(0, 80) });
      await api.sessions.prompt(s.id, { parts: [{ type: "text", text }] });
      toast.add({ title: t("work.home.toastHanded", { name: name0 }), description: text, data: { icon: "bot" } });
      go("work-task", "", { id: s.id });
      return true;
    } catch { toast.add({ title: t("work.error.send"), data: { icon: "alert-triangle" } }); return false; }
  };

  // Pointer drag (preview board): the card follows the finger, the hovered column lights up, a tap without movement opens the task.
  const start = (e: React.PointerEvent, x: Task) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    if (!preview) { open(x); return; }
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const colAt = (px: number, py: number) => (document.elementFromPoint(px, py)?.closest("[data-col]") as HTMLElement | null)?.dataset.col as Col | undefined;
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      setDrag({ id: x.id, dx: ev.clientX - x0, dy: ev.clientY - y0, over: colAt(ev.clientX, ev.clientY) ?? null });
    };
    const up = (ev: PointerEvent) => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", up);
      if (!moved) { open(x); return; }
      const c = colAt(ev.clientX, ev.clientY);
      setDrag(null);
      if (c && c !== x.col) { move(x.id, c); toast.add({ title: t("work.home.toastMoved", { col: colLabel(c) }), description: x.t, data: { icon: "check" } }); }
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  };

  const chips = preview ? [name0, ...(fx.filterBots ?? [])] : liveBots.map((b) => b.name);
  const filters = (
    <div className="travail-filters" role="group" aria-label={t("work.home.filterByBot")}>
      {["", ...chips].map((n) => (
        <button key={n || "all"} className="chip" aria-pressed={who === n} data-pressed={who === n || undefined} onClick={() => setWho(n)}>
          {n && <BotFace name={n === name0 ? fx.main?.name ?? n : n} size={18} state="idle" bots={liveBots} />}{n || t("work.all")}
        </button>))}
      <span className="travail-grow" />
      <Segmented items={[t("work.home.board"), t("work.home.list")]} value={v === "list" ? t("work.home.list") : t("work.home.board")} onChange={(x) => setV(x === t("work.home.list") ? "list" : "board")} />
    </div>
  );
  const toReview = preview ? 3 : asking.size;

  return (<>
    <Top title={t("work.home.title")}>
      <IconBtn icon="history" label={t("work.activity")} onClick={() => go("activity")} />
      <IconBtn icon="clock-loop" label={t("work.routines")} onClick={() => go("automations")} />
      <Tip label={t("work.toApprove")}><button className="btn secondary" style={{ height: 28 }} onClick={() => go("approvals")}><span className="travail-dot" data-s="wait" />{t("work.home.toApproveCount", { count: toReview })}</button></Tip>
    </Top>
    {!preview && bots.state === "ready" && !liveBots.length ? (
      <Empty state="idle" title={t("bots.page.noneTitle")} text={t("bots.page.noneText")}><button className="btn primary" data-testid="bot-create-start" onClick={() => go("bot-new")}><Icon name="plus" size={16} />{t("bots.new.title")}</button></Empty>
    ) : (
      <div className={empty ? "empty travail-empty" : "page"}>
        {empty && <><Mascot cfg={main?.cfg ?? { name: "", ...DEFAULT_MASCOT }} state="listening" size={88} track interactive /><h2>{t("work.home.emptyTitle", { name: name0 })}</h2><p>{t("work.home.emptyText", { name: name0 })}</p></>}
        {/* Session creation can replace the empty state before prompt admission; keep the draft mounted. */}
        <div className={empty ? undefined : "travail-compose"} style={empty ? { width: 560, maxWidth: "100%" } : undefined}><Composer placeholder={t("work.home.composer")} onSend={add} /></div>
        {empty ? <div className="suggestions" style={{ maxWidth: 560 }}>
          {[t("work.home.sugg1"), t("work.home.sugg2"), t("work.home.sugg3")].map((s, i) => (
            <button key={s} className="suggestion" style={css(i)} onClick={() => add(s)}><Icon name="bot" size={16} />{s}</button>))}
        </div> : <>
        {filters}
        {loading ? (
          <div className="travail-board" aria-busy="true" aria-label={t("work.home.loading")}>
            {COLS.map(([c], ci) => <div key={c} className="travail-col"><div className="travail-col-head">{colLabel(c)}</div>
              {[0, 1, 2].slice(0, 3 - (ci % 2)).map((i) => <div key={i} className="travail-skelcard"><span className="skel line" style={{ width: `${86 - i * 14}%` }} /><span className="skel line" style={{ width: "50%" }} /><span className="skel line" style={{ width: "30%" }} /></div>)}
            </div>)}
          </div>
        ) : v === "list" ? (
          COLS.map(([c, s]) => { const xs = shown.filter((x) => x.col === c); return !xs.length ? null : (
            <section key={c} className="travail-sec">
              <h3 className="h3"><span className="travail-urg"><span className="travail-dot" data-s={s} />{colLabel(c)}<span className="travail-count">{xs.length}</span></span></h3>
              <div className="list travail-tlist">{xs.map((x, i) => (
                <button key={x.id} className="li travail-li travail-rise" style={css(i)} onClick={() => open(x)}>
                  <BotFace name={x.bot} size={28} bots={liveBots} />
                  <span className="grow"><div className="ttl travail-ell">{x.t}</div><div className="sub">{name(x)} · {x.meta}</div></span>
                  {x.prog != null && <span className="travail-meta">{x.prog}{NB}%</span>}
                  <Icon name="chevron-right" size={16} />
                </button>))}
              </div>
            </section>); })
        ) : (
          <div className="travail-board">
            {COLS.map(([c, s]) => { const xs = shown.filter((x) => x.col === c); return (
              <section key={c} className="travail-col" data-col={c} data-over={(drag && drag.over === c) || undefined} aria-label={colLabel(c)}>
                <div className="travail-col-head"><span className="travail-dot" data-s={s} />{colLabel(c)}<span className="travail-meta">{xs.length}</span></div>
                {xs.map((x, i) => (
                  <div key={x.id} className="travail-kcard" style={{ ...css(i), translate: drag?.id === x.id ? `${drag.dx}px ${drag.dy}px` : undefined }} data-drag={drag?.id === x.id || undefined}
                    role="button" tabIndex={0} aria-label={t("work.home.cardLabel", { task: x.t, bot: name(x), col: colLabel(c) })} onPointerDown={(e) => start(e, x)} onKeyDown={(e) => { if (e.key === "Enter") open(x); }}>
                    <span className="travail-kcard-t" style={{ paddingRight: 18 }}>{x.t}</span>
                    {x.prog != null && <span className="travail-bar" aria-hidden><i style={{ width: `${x.prog}%` }} /></span>}
                    <span className="travail-kcard-f"><BotFace name={x.bot} size={18} bots={liveBots} /><span className="travail-grow">{name(x)} · {x.meta}</span></span>
                    <Pop align="end" trigger={<button className="ibtn travail-kmenu" aria-label={t("work.task.options")}><Icon name="more-dots" size={16} /></button>}>
                      <MItem icon="arrow-right" onClick={() => open(x)}>{t("work.open")}</MItem><MSep />
                      {preview && COLS.filter((y) => y[0] !== c).map(([cc]) => <MItem key={cc} icon="chevron-right" onClick={() => move(x.id, cc)}>{t("work.home.moveTo", { col: colLabel(cc) })}</MItem>)}
                      {preview && <MSep />}
                      <MItem icon="trash" danger onClick={() => (preview ? setTasks((ts) => ts.filter((y) => y.id !== x.id)) : void api.sessions.abort(x.id).catch(() => {}))}>{t("work.home.cancelTask")}</MItem>
                    </Pop>
                  </div>))}
                {!xs.length && <div className="travail-col-empty">{t("work.home.dropHere")}</div>}
              </section>); })}
          </div>
        )}
        </>}
      </div>
    )}
  </>);
}

/* ====================================================================== */
/* 2. Running task: transcript + the Bot's computer (status · preview · take over) */
/* ====================================================================== */
const hourWall = (h: number) => (h < 7 || h >= 21 ? "crepuscule" : h < 11 ? "aube" : h < 18 ? "lagon" : "montagne");
const PATH: [number, number, number][] = [[30, 46, 0], [62, 46, 0], [30, 58, 1], [62, 58, 1], [30, 70, 2], [86, 30, -1]];

// Preview-only illustration: a browser window on a CRM, a cursor that moves and clicks, wallpaper by time of day.
function BotComputer({ paused, user }: { paused?: boolean; user?: boolean }) {
  const t = useT();
  const fx = useFixtures<WorkFx>("work");
  const ref = React.useRef<HTMLDivElement>(null);
  const [step, setStep] = React.useState(0);
  const [click, setClick] = React.useState(false);
  const [size, setSize] = React.useState([0, 0]);
  const now = new Date(), hh = now.getHours();
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize([el.clientWidth, el.clientHeight])); ro.observe(el); return () => ro.disconnect();
  }, []);
  React.useEffect(() => {
    if (paused || user) return;
    const id = setInterval(() => { setStep((s) => (s + 1) % PATH.length); setClick(false); setTimeout(() => setClick(true), 950); }, 1700);
    return () => clearInterval(id);
  }, [paused, user]);
  const [px, py, row] = PATH[step];
  const [hl, setHl] = React.useState<number | null>(null);
  const active = user ? hl : click ? row : -1;
  const pc = fx.computer;
  return (
    <div ref={ref} className="travail-pc" data-paused={paused || undefined} style={{ ["--wall2" as string]: `url(/img/${hourWall(hh)}.png)` }} role="img" aria-label={paused ? t("work.pc.labelPaused") : t("work.pc.label")}>
      <div className="travail-pc-menubar" aria-hidden>{pc.menu.map((m) => <span key={m}>{m}</span>)}<span>{String(hh).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}</span></div>
      <div className="travail-win">
        <div className="travail-win-bar"><div className="lights"><i /><i /><i /></div><span className="travail-url"><Icon name="shield-check" size={16} /><span>{pc.url}</span></span></div>
        <div className="travail-crm">
          <div className="travail-crm-side" aria-hidden>{pc.nav.map((x, i) => <span key={x} data-on={i === pc.navActive || undefined}>{x}</span>)}</div>
          <div className="travail-crm-main">
            <span className="h">{pc.heading}</span>
            {pc.rows.map(([a, b, c], i) => (
              <div key={a} className="travail-crm-row" data-hl={active === i || undefined} onPointerEnter={user ? () => setHl(i) : undefined}><b>{a}</b><span>{b}</span><span className="mono">{c}</span></div>))}
          </div>
        </div>
      </div>
      {!user && size[0] > 0 && <svg className="travail-cursor" data-click={click || undefined} viewBox="0 0 18 18" aria-hidden style={{ translate: `${(px / 100) * size[0]}px ${(py / 100) * size[1]}px`, transitionDuration: paused ? "0ms" : undefined }}>
        <path d="M2 1.5v13l3.6-3.3 2.4 5.3 2.4-1.1-2.4-5.2H13z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" /></svg>}
      <span className="travail-pc-badge"><i />{user ? t("work.pc.yourControl") : paused ? t("work.pc.paused") : t("work.pc.live")}</span>
    </div>
  );
}

function Ev({ icon, children, when }: { icon: string; children: React.ReactNode; when: string }) {
  return <div className="travail-ev" role="note"><span className="travail-evic"><Icon name={icon} size={16} /></span><span>{children}</span><span className="travail-evline" /><span className="travail-meta">{when}</span></div>;
}
type StepS = "ok" | "run" | "wait" | "err";
function Steps({ steps, defaultOpen }: { steps: [string, StepS, string][]; defaultOpen: boolean }) {
  const t = useT();
  const done = steps.filter((s) => s[1] === "ok").length;
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <div className="travail-steps">
        <Collapsible.Trigger className="travail-steps-t"><Icon name="check-circle" size={16} />{t("work.task.stepsDone", { done, total: steps.length })}<Icon name="chevron-down" size={16} className="travail-chev" /></Collapsible.Trigger>
        <Collapsible.Panel className="travail-steps-p"><div className="travail-steps-l">
          {steps.map(([x, s, d], i) => <div key={i} className="travail-step" data-s={s}>{s === "ok" ? <Icon name="check" size={16} /> : s === "run" ? <span className="spin" style={{ margin: "0 4px" }} /> : s === "err" ? <Icon name="x-circle" size={16} style={{ color: "var(--red)" }} /> : <Icon name="clock-loop" size={16} />}<span className={s === "run" ? "thinking" : ""}>{x}</span><span className="mono">{d}</span></div>)}
        </div></Collapsible.Panel>
      </div>
    </Collapsible.Root>
  );
}

const BADGE: Record<string, string> = { done: "ok", failed: "err", blocked: "err", approval: "wait", paused: "", takeover: "wait" };

export function WorkTask() {
  const { params } = useNav();
  const id = params.get("id") ?? "";
  return isPreview() ? <WorkTaskPreview /> : <WorkTaskLive key={id} id={id} />;
}

function WorkTaskPreview() {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const fx = useFixtures<WorkFx>("work");
  const name = useFixtures<BotsFx>("bots").main?.name ?? "";
  const bot = useMainBot()!.cfg;
  const { live, setLive } = usePreviewBot()!;
  const background = React.useRef({ state: live.state, doing: live.doing });
  const [v, setV] = useVariant("running");
  const [mail, setMail] = React.useState<"ready" | "sent" | "cancelled">("ready");
  const [take, setTake] = React.useState(v === "takeover");
  const [pane, setPane] = React.useState(v === "computer" || v === "takeover");
  const [retry, setRetry] = React.useState(false);
  const [cred, setCred] = React.useState({ id: fx.task.cred.login, pw: "" });
  const thread = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    setTake(v === "takeover"); setPane(v === "computer" || v === "takeover"); setMail(["blocked", "done", "failed"].includes(v) ? "sent" : "ready"); setRetry(false);
    // States that add a widget at the end of the transcript bring it into view.
    if (["blocked", "done", "failed", "approval"].includes(v)) requestAnimationFrame(() => { const el = thread.current; if (el) el.scrollTop = v === "approval" ? 260 : el.scrollHeight; });
  }, [v]);
  React.useEffect(() => { if (!take) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setTake(false); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [take]);
  const paused = v === "paused";
  const state = ({ running: "working", computer: "working", takeover: "waiting", approval: "waiting", blocked: "blocked", done: "done", failed: "blocked", paused: "asleep" } as Record<string, State>)[v] ?? "working";
  const doing = t(`work.task.doing.${v}`);
  React.useEffect(() => {
    if (!live.on) return;
    const prior = background.current;
    setLive({ state, doing });
    // Restore activity only: an explicit Bot pause must survive task navigation.
    return () => setLive(prior);
  }, [state, doing, live.on, setLive]);
  const running = ["running", "computer", "takeover", "approval"].includes(v);
  const T = fx.task;
  const steps: [string, StepS, string][] = [
    [T.steps[0], "ok", "0:04"], [T.steps[1], "ok", "0:11"], [T.steps[2], "ok", "0:26"],
    [T.steps[3], v === "done" ? "ok" : v === "failed" || v === "blocked" ? "err" : "ok", "1:02"],
    [T.steps[4], v === "done" ? "ok" : running ? "run" : "wait", v === "done" ? "2:40" : "—"],
    [T.steps[5], v === "done" ? "ok" : "wait", v === "done" ? "2:52" : "—"],
  ];
  const done = steps.filter((s) => s[1] === "ok").length;

  const mailWidget = (
    <div className="travail-widget" data-hl={(v === "approval" && mail === "ready") || undefined} data-done={mail !== "ready" || undefined}>
      <div className="travail-widget-h"><span className="travail-grow"><Icon name="mail" size={16} />{T.mail.header}</span>
        {mail === "ready" ? <span className="badge wait">{t("work.task.mailReady")}</span> : mail === "sent" ? <span className="badge ok"><Icon name="check" size={16} />{t("work.task.mailSent")}</span> : <span className="badge">{t("work.task.mailCancelled")}</span>}</div>
      <div className="travail-widget-b">
        <div className="travail-mailmeta"><span>{t("work.task.to")}</span><b>{T.mail.to}</b><span>{t("work.task.subject")}</span><b>{T.mail.subject}</b></div>
        {T.mail.body.map((p, i) => <p key={i}>{p.split("\n").map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{l}</React.Fragment>)}</p>)}
      </div>
      <div className="travail-widget-f">
        {mail === "ready" ? <>
          <button className="btn primary" onClick={() => { setMail("sent"); toast.add({ title: t("work.task.toastSent"), description: T.mail.toastTo, data: { icon: "mail", undo: true, onUndo: () => setMail("ready") } }); }}><Icon name="arrow-up" size={16} />{t("work.send")}</button>
          <button className="btn secondary" onClick={() => setMail("cancelled")}>{t("common.cancel")}</button>
          <span className="travail-grow" /><IconBtn icon="edit" label={t("work.task.editDraft")} />
        </> : <><span className="travail-grow">{mail === "sent" ? t("work.task.sentBy", { time: T.mail.sentAt, name }) : t("work.task.cancelledNote")}</span><button className="btn secondary" onClick={() => setMail("ready")}>{mail === "sent" ? t("work.view") : t("work.task.restore")}</button></>}
      </div>
    </div>
  );
  const badge = BADGE[v] ?? "run";

  return (<>
    <div className="content-top">
      <IconBtn icon="arrow-left" label={t("work.task.back")} onClick={() => go("work-home")} />
      <span className="title travail-ell" style={{ maxWidth: 360 }}>{T.title}</span>
      <span className={"badge " + badge} style={{ marginLeft: 6 }}>
        {running && v !== "approval" && v !== "takeover" && <span className="spin" />}{t(`work.task.status.${BADGE[v] !== undefined ? v : "running"}`)}</span>
      <div className="spacer" />
      {(running || paused) && <IconBtn icon={paused ? "play" : "pause"} label={paused ? t("work.task.resume") : t("work.task.pause")} onClick={() => setV(paused ? "running" : "paused")} />}
      <IconBtn icon="cpu" label={pane ? t("work.task.hideComputer") : t("work.task.showComputer")} aria-pressed={pane} onClick={() => setPane((p) => !p)} />
      <Pop align="end" trigger={<button className="ibtn" aria-label={t("work.task.options")}><Icon name="more-dots" size={16} /></button>}>
        <MItem icon="clock-loop" onClick={() => go("automation-edit")}>{t("work.task.toRoutine")}</MItem><MItem icon="share">{t("work.task.share")}</MItem><MSep />
        <MItem icon="stop" danger onClick={() => toast.add({ title: t("work.task.toastStopped"), data: { icon: "stop" } })}>{t("work.task.stop")}</MItem>
      </Pop>
    </div>
    <div className="travail-task" data-pane={pane || undefined}>
      <div className="travail-tl">
        {v === "failed" && <div className="banner err travail-banner" style={{ margin: "0 28px 8px" }}><Icon name="alert-triangle" size={16} /><span>{T.fail.title}</span><span className="grow">{T.fail.text}</span>
          <button className="btn secondary" onClick={() => { setRetry(true); setTimeout(() => setV("running"), 1400); }} disabled={retry}>{retry ? <><span className="spin" />{t("work.retrying")}</> : <><Icon name="refresh" size={16} />{t("common.retry")}</>}</button></div>}
        {paused && <div className="banner warn travail-banner" style={{ margin: "0 28px 8px" }}><Icon name="pause" size={16} /><span>{t("work.task.pausedTitle")}</span><span className="grow">{t("work.task.pausedText", { name, step: 5 })}</span><button className="btn secondary" onClick={() => setV("running")}><Icon name="play" size={16} />{t("work.task.resume")}</button></div>}
        <div className="thread" ref={thread}><div className="thread-inner" style={{ gap: 16 }}>
          <div className="msg-user">{T.user}</div>
          <div className="msg-bot-row"><Mascot cfg={bot} state="talking" size={24} /><div className="msg-bot">{T.bot1}</div></div>
          <Ev icon="globe" when={T.ev1.when}><b>{T.ev1.b}</b> · {T.ev1.t}</Ev>
          <div className="msg-bot-row"><Mascot cfg={bot} state="idle" size={24} /><div className="msg-bot">{T.bot2}</div></div>
          {mailWidget}
          <Ev icon="clock-loop" when={T.ev2.when}><b>{T.ev2.b}</b> · {T.ev2.t} · <button className="travail-press" style={{ color: "var(--t1)", textDecoration: "underline", textUnderlineOffset: 2 }} onClick={() => go("automations")}>{t("work.view")}</button></Ev>
          <Steps steps={steps} defaultOpen={v === "running" || v === "done"} />
          {v === "blocked" && <div className="travail-widget" data-hl>
            <div className="travail-widget-h"><span className="travail-grow"><Icon name="key" size={16} />{T.cred.header}</span><span className="badge err">{t("work.task.status.blocked")}</span></div>
            <form className="travail-widget-b travail-cred" onSubmit={(e) => { e.preventDefault(); if (cred.pw) { toast.add({ title: t("work.task.toastCred"), description: t("work.task.toastCredDesc", { name }), data: { icon: "key" } }); setV("running"); } }}>
              <p style={{ color: "var(--t2)", marginBottom: 12 }}>{T.cred.text.replace("{name}", name)}</p>
              <div className="field"><label htmlFor="travail-cid">{t("work.task.login")}</label><input id="travail-cid" className="input" autoComplete="username" value={cred.id} onChange={(e) => setCred({ ...cred, id: e.target.value })} /></div>
              <div className="field"><label htmlFor="travail-cpw">{t("work.task.password")}</label><input id="travail-cpw" className="input" type="password" autoComplete="current-password" value={cred.pw} onChange={(e) => setCred({ ...cred, pw: e.target.value })} aria-describedby="travail-cnote" /></div>
              <div className="travail-actions"><button className="btn primary" disabled={!cred.pw}>{t("work.task.submitCred")}</button><button type="button" className="btn secondary" onClick={() => { setPane(true); setTake(true); }}>{t("work.task.signInMyself")}</button><button type="button" className="btn secondary" onClick={() => setV("running")}>{T.cred.skip}</button></div>
              <span id="travail-cnote" className="travail-note"><Icon name="shield-check" size={16} />{t("work.task.credNote")}</span>
            </form>
          </div>}
          {v === "done" && <div className="travail-widget">
            <div className="travail-widget-h"><span className="travail-grow"><Icon name="check-circle" size={16} />{t("work.task.recap")}</span><span className="badge ok">{T.recap.badge}</span></div>
            <div className="travail-widget-b">
              <div className="travail-recap">{T.recap.stats.map(([b, s]) => <div key={s}><b>{b}</b><span>{s}</span></div>)}</div>
              <div className="travail-files">
                {T.recap.files.map(([ic, x, s]) => (
                  <button key={x} className="travail-file" onClick={() => (ic === "file" ? go("file-xlsx") : undefined)}><span className="li-ic"><Icon name={ic} size={16} /></span><span className="travail-grow"><span className="ttl">{x}</span><span className="travail-meta">{s}</span></span><Icon name="chevron-right" size={16} /></button>))}
              </div>
            </div>
          </div>}
          {v === "failed" && <div className="msg-bot-row"><Mascot cfg={bot} state="blocked" size={24} /><div className="msg-bot">{T.fail.bot}</div></div>}
        </div></div>
        {!pane && running && <div className="travail-status">
          <Mascot cfg={bot} state={state} size={24} />
          <span className="travail-grow"><span style={{ fontWeight: 500 }}>{v === "approval" ? t("work.task.waitingApproval") : T.statusDoing}</span><span className="travail-meta">{t("work.task.statusMeta", { site: T.site, step: done + 1, total: steps.length })}</span></span>
          <span className="travail-thumb" style={{ backgroundImage: `url(/img/${hourWall(new Date().getHours())}.png)` }} aria-hidden />
          <button className="btn secondary" onClick={() => setPane(true)}><Icon name="cpu" size={16} />{t("work.task.showComputer")}</button>
        </div>}
        <div className="dock"><Composer placeholder={t("work.task.composer", { name })} onSend={(x) => { toast.add({ title: t("work.task.toastInstruction"), description: x, data: { icon: "bot" } }); }} /></div>
      </div>
      <aside className="travail-pane" aria-label={t("work.pc.title")} aria-hidden={!pane}>
        {pane && <>
          <div className="pane-head"><span className="title">{t("work.pc.titleOf", { name })}</span><div className="spacer" /><button className="btn primary" style={{ height: 28, padding: "0 10px", marginRight: 4 }} onClick={() => setTake(true)}><Icon name="expand" size={16} />{t("work.pc.takeOver")}</button><IconBtn icon="pin" label={t("work.pc.pinned")} /><IconBtn icon="close" label={t("work.task.hideComputer")} onClick={() => setPane(false)} /></div>
          <div className="travail-pc-wrap">
            <BotComputer paused={paused || v === "done" || v === "failed" || v === "blocked"} />
            <div className="travail-pc-foot"><Mascot cfg={bot} state={state} size={20} /><span className="travail-grow travail-ell">{name} {doing}</span></div>
          </div>
        </>}
      </aside>
      {take && <div className="travail-take" role="dialog" aria-modal="true" aria-label={t("work.pc.takeOverLabel")}>
        <div className="travail-take-bar"><span className="badge wait"><Icon name="user" size={16} />{t("work.pc.yourControl")}</span><span className="travail-meta">{t("work.pc.waitsForYou", { name })}</span><div className="spacer" style={{ flex: 1 }} />
          <button className="btn primary" autoFocus onClick={() => { setTake(false); toast.add({ title: t("work.pc.toastBack", { name }), data: { icon: "bot" } }); }}><Icon name="collapse" size={16} />{t("work.pc.handBack")}<kbd className="mono" style={{ opacity: .6 }}>{t("work.pc.esc")}</kbd></button></div>
        <BotComputer user />
      </div>}
    </div>
  </>);
}

const textOf = (m: MessageWithParts) => m.parts.map((p) => (p.type === "text" && !p.synthetic ? p.text : "")).join("").trim();
const dur = (p: ToolPart) => (p.state.status === "completed" || p.state.status === "error" ? (() => { const s = Math.round((p.state.time.end - p.state.time.start) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; })() : "—");

function WorkTaskLive({ id }: { id: string }) {
  const t = useT();
  const go = useGo();
  const toast = useToast();
  const session = useQuery<Session | null>(() => (id ? api.sessions.get(id) : Promise.resolve(null)), [id], (e) => e.type === "session.updated");
  const bots = useBots();
  const perms = usePermissions();
  const { msgs, status } = useMessages(id || undefined);
  const s = session.state === "ready" ? session.data : null;
  const bot = bots.state === "ready" ? bots.data.find((b) => b.id === s?.botID) : undefined;
  const main = useMainBot();
  const cfg = bot ? { ...main!.cfg, name: bot.name } : main?.cfg;
  const asking = perms.state === "ready" && perms.data.some((p) => p.sessionID === id);
  const v = asking ? "approval" : status === "busy" || status === "retry" ? "running" : status === "error" ? "failed" : taskOutcome(msgs);
  const state = ({ approval: "waiting", running: "working", failed: "blocked", done: "done", todo: "idle", paused: "asleep" } as Record<string, State>)[v];
  const name = bot?.name ?? cfg?.name ?? "";
  const steps: [string, StepS, string][] = msgs.flatMap((m) => m.parts.filter((p): p is ToolPart => p.type === "tool")).map((p) => [
    toolTitle(t, p), p.state.status === "completed" ? "ok" : p.state.status === "error" ? "err" : "run", dur(p)]);
  const thread = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { const el = thread.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length]);
  if (!id || session.state === "error") return (<>
    <div className="content-top"><IconBtn icon="arrow-left" label={t("work.task.back")} onClick={() => go("work-home")} /></div>
    <Empty state="thinking" title={t("work.task.missingTitle")} text={t("work.task.missingText")}><button className="btn secondary" onClick={() => go("work-home")}>{t("work.inbox.backToBoard")}</button></Empty>
  </>);
  const send = async (x: string) => {
    try { await api.sessions.prompt(id, { parts: [{ type: "text", text: x }] }); return true; }
    catch { toast.add({ title: t("work.error.send"), data: { icon: "alert-triangle" } }); return false; }
  };
  return (<>
    <div className="content-top">
      <IconBtn icon="arrow-left" label={t("work.task.back")} onClick={() => go("work-home")} />
      <span className="title travail-ell" style={{ maxWidth: 360 }}>{s?.title}</span>
      {s && <span className={"badge " + (v === "todo" ? "" : BADGE[v] ?? "run")} style={{ marginLeft: 6 }}>{v === "running" && <span className="spin" />}{v === "todo" ? t("work.col.todo") : t(`work.task.status.${v}`)}</span>}
      <div className="spacer" />
      {v === "running" && <IconBtn icon="stop" label={t("work.task.stop")} onClick={() => api.sessions.abort(id).then(() => toast.add({ title: t("work.task.toastStopped"), data: { icon: "stop" } }), () => {})} />}
    </div>
    <div className="travail-task">
      <div className="travail-tl">
        {v === "failed" && <div className="banner err travail-banner" style={{ margin: "0 28px 8px" }}><Icon name="alert-triangle" size={16} /><span>{t("work.task.status.failed")}</span><span className="grow">{t("work.task.failedLive")}</span></div>}
        <div className="thread" ref={thread}><div className="thread-inner" style={{ gap: 16 }}>
          {msgs.map((m) => { const x = textOf(m); if (!x) return null; return m.info.role === "user"
            ? <div key={m.info.id} className="msg-user">{x}</div>
            : <div key={m.info.id} className="msg-bot-row">{cfg && <Mascot cfg={cfg} state="idle" size={24} />}<div className="msg-bot">{x}</div></div>; })}
          {steps.length > 0 && <Steps steps={steps} defaultOpen={v === "running"} />}
        </div></div>
        {(v === "running" || v === "approval") && cfg && <div className="travail-status">
          <Mascot cfg={cfg} state={state} size={24} />
          <span className="travail-grow"><span style={{ fontWeight: 500 }}>{v === "approval" ? t("work.task.waitingApproval") : t("work.task.doing.running_live")}</span><span className="travail-meta">{t("work.task.stepsDone", { done: steps.filter((x) => x[1] === "ok").length, total: steps.length })}</span></span>
          {v === "approval" && <button className="btn secondary" onClick={() => go("approvals")}>{t("work.toApprove")}</button>}
        </div>}
        <div className="dock"><Composer placeholder={t("work.task.composer", { name })} onSend={send} /></div>
      </div>
      <aside className="travail-pane" aria-hidden />
    </div>
  </>);
}
