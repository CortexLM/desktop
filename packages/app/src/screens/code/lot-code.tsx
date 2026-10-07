// Cortex Code: tasks, review, full diff, terminal, environments, pull request, settings.
import * as React from "react";
import { Progress } from "@base-ui/react/progress";
import { Meter } from "@base-ui/react/meter";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { PermissionRule } from "@cortex/schema";
import { Icon, IconBtn, Pop, MItem, MSep, Segmented, Switch, useToast } from "../../kit/ui";
import type { State } from "../../mascot/Mascot";
import { useVariant } from "../../registry";
import { useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview, useFixtures } from "../../preview";
import { CodeConnection, RemoteCodeSession } from "./remote-code";
import { api } from "../../api";
import { useSessions, useQuery } from "../../state/live";
import { Agent, Av, Badge, CiIcon, Delta, LiveEmpty, Split, Unified, basename, ix, parse, rich, unfold, useAgo, type CS } from "./parts";
import type { CodeFx, St, TaskFx, TK } from "./fixtures";
import { RemoteCodeSettings } from "./remote-code";

/** Git and file identifiers, not copy. */
const BASE_BRANCH = "main";
const INSTRUCTIONS_FILE = "AGENTS.md";

const NB = "\u202f";
const useFx = () => useFixtures<CodeFx>("code");

/* =====================================================================
   1. Tasks
   ===================================================================== */
const ST: Record<St, [string, string]> = { run: ["run", "code.status.running"], review: ["wait", "code.status.toReview"], merged: ["ok", "code.status.merged"], fail: ["err", "code.status.failed"], archived: ["", "code.status.archived"] };
const FILTERS: [string, St | ""][] = [["code.tasks.filter.all", ""], ["code.tasks.filter.running", "run"], ["code.tasks.filter.review", "review"], ["code.tasks.filter.merged", "merged"], ["code.tasks.filter.failed", "fail"], ["code.tasks.filter.archived", "archived"]];

// Signed-in desktop: the design sub-screens open the owned live session (review, diff, terminal, environment, PR tabs).
function LiveSessionScreen() {
  const { params } = useNav();
  return params.get("id") && params.get("epoch") ? <RemoteCodeSession /> : <CodeConnection local={<LiveEmpty />} />;
}

export function TasksScreen() {
  const [v, setV] = useVariant("list");
  if (!isPreview()) return <TasksLive />;
  return v === "attempts" ? <Attempts back={() => setV("list")} key={v} /> : <TaskList key={v} v={v} />;
}

function TasksTop() {
  const t = useT();
  const { go } = useNav();
  return <div className="content-top"><span className="title">{t("code.tasks.title")}</span><div className="spacer" />
    <button className="btn primary code-h28" onClick={() => go("code")}><Icon name="compose" size={16} />{t("code.newTask")}</button>
  </div>;
}
function TasksEmpty() {
  const t = useT();
  const { go } = useNav();
  return (
    <div className="empty">
      <Agent state="idle" size={72} />
      <h2>{t("code.tasks.emptyTitle")}</h2>
      <p>{t("code.tasks.emptyBody")}</p>
      <div className="code-row-gap"><button className="btn primary" onClick={() => go("code")}><Icon name="compose" size={16} />{t("code.newTask")}</button><button className="btn secondary" onClick={() => go("code-settings")}><Icon name="folder-code" size={16} />{t("code.connectRepo")}</button></div>
    </div>
  );
}
function NoMatch({ clear }: { clear: () => void }) {
  const t = useT();
  return <div className="empty code-empty-sm"><Icon name="search" size={20} /><h2>{t("code.tasks.noMatchTitle")}</h2><p>{t("code.tasks.noMatchBody")}</p><button className="btn secondary" onClick={clear}>{t("code.tasks.clearFilters")}</button></div>;
}
function RepoPicker({ repos, repo, setRepo }: { repos: string[]; repo: string; setRepo: (r: string) => void }) {
  const t = useT();
  return (
    <Pop align="end" width={200} trigger={<button className="ctx"><Icon name="folder-code" size={16} />{repo || t("code.tasks.allRepos")}<Icon name="chevron-down" size={12} /></button>}>
      <MItem icon={!repo ? "check" : undefined} onClick={() => setRepo("")}>{t("code.tasks.allRepos")}</MItem><MSep />
      {repos.map((r) => <MItem key={r} icon={r === repo ? "check" : "folder-code"} onClick={() => setRepo(r)}>{r}</MItem>)}
    </Pop>
  );
}
function Search({ q, setQ }: { q: string; setQ: (q: string) => void }) {
  const t = useT();
  return <label className="code-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("code.search")} aria-label={t("code.tasks.searchLabel")} /></label>;
}

function TaskList({ v }: { v: string }) {
  const t = useT();
  const { go } = useNav();
  const fx = useFx().tasks;
  const [, setV] = useVariant("list");
  const empty = v === "empty";
  const [f, setF] = React.useState<St | "">(v === "filtered" ? "review" : "");
  const [repo, setRepo] = React.useState(v === "filtered" ? fx.repos[0] : "");
  const [q, setQ] = React.useState("");
  const all = empty ? [] : fx.list;
  const rows = all.filter((x) => (!f || x.st === f) && (!repo || x.repo === repo) && x.t.toLowerCase().includes(q.trim().toLowerCase()));
  const open = (x: TaskFx) => (x.n ? setV("attempts") : go(x.st === "review" ? "code-review" : x.st === "fail" ? "code-terminal" : x.st === "merged" ? "code-pr" : "code-session"));
  return (<>
    <TasksTop />
    {empty ? <TasksEmpty /> : (
      <div className="page"><div className="code-wrap">
        <div className="code-tools">
          <div className="chips code-chips" role="group" aria-label={t("code.tasks.filterLabel")}>
            {FILTERS.map(([l, s]) => <button key={l} className="chip" aria-pressed={f === s} data-pressed={f === s || undefined} onClick={() => setF(s)}>{t(l)}<span className="code-chip-n">{all.filter((x) => !s || x.st === s).length}</span></button>)}
          </div>
          <div className="spacer" />
          <Search q={q} setQ={setQ} />
          <RepoPicker repos={fx.repos} repo={repo} setRepo={setRepo} />
        </div>
        {rows.length === 0 ? <NoMatch clear={() => { setF(""); setRepo(""); setQ(""); }} /> : fx.repos.filter((r) => rows.some((x) => x.repo === r)).map((r, gi) => (
          <section key={r} className="code-group" style={ix(gi)}>
            <div className="code-group-h"><Icon name="folder-code" size={16} /><span>{r}</span><span className="code-meta">{rows.filter((x) => x.repo === r).length}</span></div>
            <div className="list">
              {rows.filter((x) => x.repo === r).map((x, i) => (
                <button key={x.t} className="code-trow" style={ix(i)} onClick={() => open(x)}>
                  <span className="code-tmain">
                    <span className="ttl">{x.t}{x.n && <span className="code-pill">{t("code.tasks.attempts", { count: x.n })}</span>}</span>
                    <span className="sub"><Icon name="git-branch" size={12} /><span className="mono">{x.br}</span><span>·</span><span>{x.env}</span><span>·</span><span>{x.when}</span></span>
                  </span>
                  {x.n ? <span className="code-meta">{t("code.tasks.inProgress")}</span> : <Delta a={x.a} d={x.d} />}
                  <span className="code-meta code-num"><Icon name="history" size={12} />{x.dur}</span>
                  <Badge k={ST[x.st][0]} spin={x.st === "run"}>{t(ST[x.st][1])}</Badge>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div></div>
    )}
  </>);
}

function TasksLive() {
  const t = useT();
  const { go } = useNav();
  const ago = useAgo();
  const sessions = useSessions("code");
  const [repo, setRepo] = React.useState("");
  const [q, setQ] = React.useState("");
  if (sessions.state === "loading") return <TasksTop />;
  if (sessions.state === "error") return <><TasksTop /><div className="empty"><h2>{t("code.tasks.loadFailed")}</h2><button className="btn secondary" onClick={sessions.reload}><Icon name="refresh" size={16} />{t("code.retry")}</button></div></>;
  const all = sessions.data;
  if (!all.length) return <><TasksTop /><TasksEmpty /></>;
  const repoOf = (d?: string) => basename(d) || t("code.tasks.noFolder");
  const repos = [...new Set(all.map((s) => repoOf(s.directory)))];
  const rows = all.filter((s) => (!repo || repoOf(s.directory) === repo) && (s.title || "").toLowerCase().includes(q.trim().toLowerCase()));
  return (<>
    <TasksTop />
    <div className="page"><div className="code-wrap">
      <div className="code-tools"><div className="spacer" /><Search q={q} setQ={setQ} /><RepoPicker repos={repos} repo={repo} setRepo={setRepo} /></div>
      {rows.length === 0 ? <NoMatch clear={() => { setRepo(""); setQ(""); }} /> : repos.filter((r) => rows.some((s) => repoOf(s.directory) === r)).map((r, gi) => (
        <section key={r} className="code-group" style={ix(gi)}>
          <div className="code-group-h"><Icon name="folder-code" size={16} /><span>{r}</span><span className="code-meta">{rows.filter((s) => repoOf(s.directory) === r).length}</span></div>
          <div className="list">
            {rows.filter((s) => repoOf(s.directory) === r).map((s, i) => (
              <button key={s.id} className="code-trow" style={ix(i)} onClick={() => go("code-session", { id: s.id })}>
                <span className="code-tmain">
                  <span className="ttl">{s.title || t("code.untitled")}</span>
                  <span className="sub">{s.directory && <><Icon name="folder" size={12} /><span className="mono">{s.directory}</span><span>·</span></>}<span>{ago(s.time.updated)}</span></span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div></div>
  </>);
}

function Attempts({ back }: { back: () => void }) {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fx = useFx().attempts;
  const [tick, setTick] = React.useState(5);
  const [pick, setPick] = React.useState<number | null>(null);
  React.useEffect(() => { if (tick >= 13) return; const tm = setInterval(() => setTick((x) => x + 1), 900); return () => clearInterval(tm); }, [tick >= 13]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = fx.items.filter((a) => tick >= a.done).length;
  const choose = (i: number) => { setPick(i); toast.add({ title: t("code.attempts.picked", { n: i + 1 }), description: t("code.attempts.pickedBody"), data: { icon: "check-circle", undo: true, onUndo: () => setPick(null) } }); };
  return (<>
    <div className="content-top">
      <IconBtn icon="arrow-left" label={t("code.attempts.back")} onClick={back} />
      <span className="title">{fx.title}</span>
      <Badge k={finished === 4 ? "ok" : "run"} spin={finished < 4}>{t("code.attempts.finished", { n: finished, total: 4 })}</Badge>
      <div className="spacer" />
      <button className="btn secondary code-h28" onClick={() => go("code-diff")}><Icon name="diff" size={16} />{t("code.attempts.compare")}</button>
      <button className="btn primary code-h28" disabled={pick === null} onClick={() => go("code-pr")}><Icon name="pull-request" size={16} />{t("code.createPr")}</button>
    </div>
    <div className="page"><div className="code-wrap">
      <div className="code-att-intro"><span className="ctx"><Icon name="folder-code" size={16} />{fx.repo}</span><span className="ctx"><Icon name="git-branch" size={16} />{fx.branch}</span><span className="ctx"><Icon name="cpu" size={16} />{fx.env}</span></div>
      {finished >= 2 && pick === null && (
        <div className="banner info code-banner"><Icon name="sparkle-free" size={16} /><span>{t("code.attempts.recommend", { n: 1 })}</span><span className="grow">{fx.recommendBody}</span><button className="btn secondary code-h28" onClick={() => choose(0)}>{t("code.attempts.choose")}</button></div>
      )}
      <div className="code-att">
        {fx.items.map((a, i) => {
          const done = tick >= a.done, pct = Math.min(100, Math.round((tick / a.done) * 100));
          const st: State = !done ? "working" : a.fail ? "blocked" : pick === i ? "done" : "idle";
          return (
            <article key={i} className="code-att-card" style={ix(i)} data-on={pick === i || undefined} data-dim={pick !== null && pick !== i || undefined}>
              <header><Agent state={st} size={32} /><span className="code-grow"><b>{t("code.attempts.attempt", { n: i + 1 })}</b><span className="sub">{done ? (a.fail ? t("code.attempts.partialFail") : t("code.attempts.doneIn", { time: fx.durations[i] })) : t("code.attempts.running")}</span></span>
                {done ? <Badge k={a.fail ? "err" : "ok"}>{a.fail ? t("code.attempts.testsFailing", { count: 3 }) : t("code.attempts.testsGreen")}</Badge> : <span className="code-meta code-num">{pct}{NB}%</span>}
              </header>
              {!done && <Progress.Root value={pct} className="code-prog" aria-label={t("code.attempts.progress", { n: i + 1 })}><Progress.Track className="code-prog-t"><Progress.Indicator className="code-prog-i" /></Progress.Track></Progress.Root>}
              <p className="code-att-note">{a.note}</p>
              <dl className="code-stats">
                <div><dt>{t("code.attempts.statDiff")}</dt><dd>{done ? <Delta a={a.a} d={a.d} /> : "—"}</dd></div>
                <div><dt>{t("code.attempts.statFiles")}</dt><dd>{done ? a.files : "—"}</dd></div>
                <div><dt>{t("code.attempts.statTests")}</dt><dd>{done ? a.tests : "—"}</dd></div>
                <div><dt>{t("code.attempts.statP95")}</dt><dd>{done ? a.p95 : "—"}</dd></div>
              </dl>
              {done && a.diff.length > 0 ? <pre className="code-mini">{a.diff.map((l, j) => <div key={j} data-k={l[0] === "+" ? "add" : "del"}>{l}</div>)}</pre> : <div className="code-mini code-mini-skel"><span className="skel line" style={{ width: "80%" }} /><span className="skel line" style={{ width: "62%" }} /><span className="skel line" style={{ width: "70%" }} /></div>}
              <footer>
                <button className="btn secondary code-h28" disabled={!done} onClick={() => go("code-diff")}>{t("code.attempts.viewDiff")}</button>
                <button className="btn primary code-h28" disabled={!done || a.fail || pick === i} onClick={() => choose(i)}>{pick === i ? <><Icon name="check" size={16} />{t("code.attempts.kept")}</> : t("code.attempts.choose")}</button>
              </footer>
            </article>
          );
        })}
      </div>
    </div></div>
  </>);
}

/* =====================================================================
   2. Code review
   ===================================================================== */
const SEV: Record<string, [string, string]> = { high: ["err", "code.sev.high"], medium: ["wait", "code.sev.medium"], low: ["", "code.sev.low"] };

export function ReviewScreen() { const [v] = useVariant("review"); return isPreview() ? <Review key={v} v={v} /> : <LiveSessionScreen />; }
function Review({ v }: { v: string }) {
  const t = useT();
  const toast = useToast();
  const fx = useFx().review;
  const [applied, setApplied] = React.useState(v !== "review");
  const [approved, setApproved] = React.useState(v === "approved");
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const apply = () => { setApplied(true); toast.add({ title: t("code.review.applied"), description: t("code.review.appliedBody", { commit: fx.commit, branch: fx.commitBranch }), data: { icon: "check-circle", undo: true, onUndo: () => setApplied(false) } }); };
  const open = ["c1", "c2", "c3"].filter((c) => !dismissed.includes(c) && !(c === "c1" && applied)).length;
  const src = fx.src.replace("{page}", applied ? fx.pageNew : fx.pageOld);
  const Comment = ({ id, sev, children, sugg }: { id: string; sev: string; children: React.ReactNode; sugg?: boolean }) => dismissed.includes(id) ? null : (
    <div className="code-cmt" data-sev={sev}>
      <div className="code-cmt-h"><Agent state={id === "c1" && applied ? "done" : "idle"} size={22} /><b>{t("code.agent")}</b><Badge k={SEV[sev][0]}>{t(SEV[sev][1])}</Badge><span className="code-meta">{t("code.review.when")}</span><div className="spacer" />
        {!(id === "c1" && applied) && <IconBtn icon="close" label={t("code.review.dismissLabel")} size={16} onClick={() => setDismissed((d) => [...d, id])} />}
      </div>
      <div className="code-cmt-b">{children}</div>
      {sugg && (applied ? (
        <div className="code-cmt-done"><Icon name="check-circle" size={16} />{t("code.review.appliedShort")} · <span className="mono">{fx.commit}</span></div>
      ) : (<>
        <div className="code-sugg"><div className="code-sugg-h">{t("code.review.suggestion")}</div>
          <div className="code-dl" data-k="del"><span className="code-sg">-</span><span className="code-src">{fx.pageOld.slice(1)}</span></div>
          <div className="code-dl" data-k="add"><span className="code-sg">+</span><span className="code-src">{fx.pageNew.slice(1)}</span></div>
        </div>
        <div className="code-cmt-f"><button className="btn primary code-h28" onClick={apply}><Icon name="check" size={16} />{t("code.review.apply")}</button><button className="btn secondary code-h28" onClick={() => setDismissed((d) => [...d, id])}>{t("code.review.dismiss")}</button></div>
      </>))}
    </div>
  );
  return (<>
    <div className="content-top">
      <span className="title">{fx.title}</span>
      <Badge k={approved ? "ok" : applied ? "run" : "wait"}>{approved ? t("code.review.approved") : applied ? t("code.review.fixed") : t("code.review.changesSuggested")}</Badge>
      <div className="spacer" />
      {approved ? <button className="btn secondary code-h28" onClick={() => setApproved(false)}>{t("code.review.unapprove")}</button> : <>
        <button className="btn secondary code-h28" onClick={() => toast.add({ title: t("code.review.changesRequested"), description: t("code.review.notified", { name: fx.author[1] }), data: { icon: "mail" } })}>{t("code.review.requestChanges")}</button>
        <button className="btn primary code-h28" onClick={() => { setApproved(true); toast.add({ title: t("code.review.prApproved"), description: t("code.review.canMerge", { ref: fx.prRef }), data: { icon: "check-circle" } }); }}><Icon name="check" size={16} />{t("code.review.approve")}</button>
      </>}
    </div>
    <div className="code-cols">
      <div className="code-main">
        {approved && <div className="banner info code-banner code-ok"><Icon name="check-circle" size={16} /><span>{t("code.review.youApproved")}</span><span className="grow">{t("code.review.canMergeInto", { name: fx.author[1], base: fx.base })}</span></div>}
        <div className="code-prhead">
          <h1>{fx.prTitle}</h1>
          <div className="code-prmeta"><Av who={fx.author[0]} name={fx.author[1]} tone={1} /><span>{t("code.review.wantsToMerge", { name: fx.author[1] })}</span><span className="ctx code-static"><Icon name="git-branch" size={16} />{fx.branch}</span><Icon name="arrow-right" size={12} /><span className="ctx code-static">{fx.base}</span><Delta a={13} d={2} /></div>
        </div>
        <div className="diff code-file">
          <div className="code-head"><Icon name="file-code" size={16} /><span style={{ marginLeft: 6 }}>{fx.srcFile}</span><Delta a={8} d={2} /><IconBtn icon="copy" label={t("code.copyPath")} /></div>
          <Unified lines={parse(src)} extra={(i) => i === 4 ? (
            <Comment id="c1" sev="high" sugg>{rich(fx.c1)}</Comment>
          ) : i === 7 ? (
            <Comment id="c2" sev="medium">{rich(fx.c2)}</Comment>
          ) : null} />
        </div>
        <div className="diff code-file">
          <div className="code-head"><Icon name="file-code" size={16} /><span style={{ marginLeft: 6 }}>{fx.testFile}</span><Delta a={5} d={0} /><IconBtn icon="copy" label={t("code.copyPath")} /></div>
          <Unified lines={parse(fx.test)} extra={(i) => i === 5 ? <Comment id="c3" sev="low">{rich(fx.c3)}</Comment> : null} />
        </div>
      </div>
      <aside className="code-aside">
        <div className="code-card">
          <div className="code-card-h"><Agent state={approved ? "done" : applied ? "idle" : "waiting"} size={36} /><span className="code-grow"><b>{t("code.review.riskTitle")}</b><span className="sub">{t("code.review.riskSub", { files: 2, tests: 48 })}</span></span></div>
          <Meter.Root value={applied ? 30 : 62} className="code-meter" aria-label={t("code.review.risk")}>
            <div className="code-meter-l"><Meter.Label>{t("code.review.risk")}</Meter.Label><span className="code-meta">{applied ? t("code.sev.low") : t("code.review.riskMedium")}</span></div>
            <Meter.Track className="code-meter-t" data-tone={applied ? "ok" : "wait"}><Meter.Indicator className="code-meter-i" /></Meter.Track>
          </Meter.Root>
          <ul className="code-sevs">
            <li><Badge k="err">{t("code.sev.critical")}</Badge><span className="code-grow">{t("code.review.none")}</span><span className="code-num">0</span></li>
            <li><Badge k="err">{t("code.sev.high")}</Badge><span className="code-grow">{applied ? t("code.review.fixed") : t("code.review.unvalidated")}</span><span className="code-num">{applied ? 0 : 1}</span></li>
            <li><Badge k="wait">{t("code.sev.medium")}</Badge><span className="code-grow">{t("code.review.missingIndex")}</span><span className="code-num">{dismissed.includes("c2") ? 0 : 1}</span></li>
            <li><Badge k="">{t("code.sev.low")}</Badge><span className="code-grow">{t("code.review.coverage")}</span><span className="code-num">{dismissed.includes("c3") ? 0 : 1}</span></li>
          </ul>
          <p className="code-note">{applied ? t("code.review.noteApplied") : t("code.review.noteOpen")}</p>
        </div>
        <div className="code-card">
          <div className="code-label">{t("code.checks")}</div>
          {([["code.review.lint", "ok"], ["code.review.unit", "ok"], ["code.review.e2e", applied ? "run" : "ok"]] as const).map(([n, s]) => <div key={n} className="code-ci-mini"><CiIcon s={s} /><span className="code-grow">{t(n)}</span><span className="code-meta">{s === "run" ? t("code.review.rerun") : t("code.passed")}</span></div>)}
          <div className="code-label" style={{ marginTop: 14 }}>{t("code.review.openComments")}</div>
          <div className="code-meta">{t("code.review.openCount", { n: open, total: 3 })}</div>
        </div>
      </aside>
    </div>
  </>);
}

/* =====================================================================
   3. Full diff
   ===================================================================== */
const ST_LBL = { A: "code.diff.added", M: "code.diff.modified", D: "code.diff.deleted" };
type Cm = { who: string; text: string };

export function DiffScreen() { const [v] = useVariant("unified"); return isPreview() ? <DiffView key={v} v={v} /> : <LiveSessionScreen />; }
function DiffView({ v }: { v: string }) {
  const t = useT();
  const toast = useToast();
  const fx = useFx().diff;
  const modes = [t("code.diff.unified"), t("code.diff.split")];
  const [mode, setMode] = React.useState(v === "split" ? modes[1] : modes[0]);
  const [sel, setSel] = React.useState(1);
  const [unf, setUnf] = React.useState<string[]>([]);
  const k0 = `${fx.files[1].path}:17`;
  const [cms, setCms] = React.useState<Record<string, Cm[]>>(v === "comment" ? { [k0]: [{ who: fx.me[0], text: fx.comment }] } : {});
  const [openAt, setOpenAt] = React.useState<string | null>(v === "comment" ? k0 : null);
  const [draft, setDraft] = React.useState("");
  const [res, setRes] = React.useState<null | string[]>(null);
  const f = fx.files[sel];
  const base = parse(f.src, f.hidden ? fx.hidden : []);
  const lines = unf.includes(f.path) ? unfold(base) : base;
  const key = (i: number) => `${f.path}:${i}`;
  const post = (k: string) => {
    const x = draft.trim(); if (!x) return;
    setCms((c) => ({ ...c, [k]: [...(c[k] ?? []), { who: fx.me[0], text: x }] })); setDraft("");
    window.setTimeout(() => setCms((c) => ({ ...c, [k]: [...(c[k] ?? []), { who: "bot", text: fx.reply }] })), 1400);
  };
  const extra = (i: number) => {
    const k = key(i), list = cms[k] ?? [];
    if (!list.length && openAt !== k) return null;
    return (
      <div className="code-thread">
        {list.map((c, j) => (
          <div key={j} className="code-tc">
            {c.who === "bot" ? <Agent state="talking" size={22} /> : <Av who={c.who} name={fx.me[1]} tone={0} />}
            <div className="code-grow"><b>{c.who === "bot" ? t("code.agent") : fx.me[1]}</b><span className="code-meta"> · {j === 0 ? t("code.diff.twoMinAgo") : t("code.justNow")}</span><p>{c.text}</p></div>
          </div>
        ))}
        {openAt === k && (
          <form className="code-reply" onSubmit={(e) => { e.preventDefault(); post(k); }}>
            <textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={list.length ? t("code.diff.replyPlaceholder") : t("code.diff.commentPlaceholder")} aria-label={t("code.diff.commentLabel")} autoFocus={v !== "comment"} />
            <div className="code-row-gap"><span className="code-meta">{t("code.diff.readsComments")}</span><div className="spacer" /><button type="button" className="btn secondary code-h28" onClick={() => { setOpenAt(null); setDraft(""); }}>{t("code.cancel")}</button><button type="submit" className="btn primary code-h28" disabled={!draft.trim()}>{t("code.diff.comment")}</button></div>
          </form>
        )}
      </div>
    );
  };
  const resolve = (r: string[], label: string) => { setRes(r); toast.add({ title: t("code.diff.resolved"), description: label, data: { icon: "check-circle", undo: true, onUndo: () => setRes(null) } }); };
  const conflict = v === "conflict" && f.path === fx.conflictFile;
  const View = mode === modes[0] ? Unified : Split;
  return (<>
    <div className="content-top">
      <span className="title">{fx.title}</span><span className="ctx code-static"><Icon name="git-branch" size={16} />{fx.branch}</span>
      <div className="spacer" /><Delta a={214} d={37} /><span className="code-sep" />
      <Segmented items={modes} value={mode} onChange={setMode} />
    </div>
    {v === "conflict" && (res ? (
      <div className="banner info code-banner code-ok"><Icon name="check-circle" size={16} /><span>{t("code.diff.resolved")}</span><span className="grow">{t("code.diff.validateHint")}</span><button className="btn primary code-h28" onClick={() => toast.add({ title: t("code.diff.validated"), description: t("code.diff.upToDate", { branch: fx.branch, base: fx.baseBranch }), data: { icon: "git-branch" } })}>{t("code.diff.validate")}</button></div>
    ) : (
      <div className="banner warn code-banner"><Icon name="alert-triangle" size={16} /><span>{t("code.diff.conflictTitle", { base: fx.baseBranch })}</span><span className="grow">{fx.conflictBody}</span></div>
    ))}
    <div className="code-dsplit">
      <nav className="code-tree" aria-label={t("code.diff.changedFiles")}>
        <div className="code-label">{t("code.diff.filesChanged", { count: fx.files.length })}</div>
        {fx.tree.map(([dir, ids]) => (
          <div key={dir}>
            <div className="code-tdir"><Icon name="folder" size={16} />{dir}</div>
            {ids.map((i) => (
              <button key={i} className="code-tfile" aria-current={sel === i || undefined} onClick={() => setSel(i)}>
                <span className="code-st" data-s={fx.files[i].st} title={t(ST_LBL[fx.files[i].st])}>{fx.files[i].st}</span>
                <span className="code-grow code-ell">{fx.files[i].path.split("/").pop()}</span>
                {v === "conflict" && i === 1 && !res ? <Icon name="alert-triangle" size={16} className="code-warn-ic" /> : <Delta a={fx.files[i].a} d={fx.files[i].d} />}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="code-dpane" key={f.path + mode}>
        {conflict && !res && (
          <div className="diff code-file code-conf">
            <div className="code-head"><Icon name="alert-triangle" size={16} /><span style={{ marginLeft: 6 }}>{t("code.diff.conflictLines", { file: fx.conflictFile, from: 5, to: 6 })}</span></div>
            <div className="code-conf-m">{"<<<<<<< "}{fx.oursLabel}</div>
            {fx.ours.map((l) => <div key={l} className="code-dl" data-k="ours"><span className="code-src">{l}</span></div>)}
            <div className="code-conf-m">=======</div>
            {fx.theirs.map((l) => <div key={l} className="code-dl" data-k="theirs"><span className="code-src">{l}</span></div>)}
            <div className="code-conf-m">{">>>>>>> "}{fx.baseBranch}</div>
            <div className="code-conf-a">
              <button className="btn secondary code-h28" onClick={() => resolve(fx.ours, t("code.diff.keptMine"))}>{t("code.diff.keepMine")}</button>
              <button className="btn secondary code-h28" onClick={() => resolve(fx.theirs, t("code.diff.keptBase", { base: fx.baseBranch }))}>{t("code.diff.keepBase", { base: fx.baseBranch })}</button>
              <button className="btn secondary code-h28" onClick={() => resolve([...fx.ours, ...fx.theirs], t("code.diff.keptBoth"))}>{t("code.diff.keepBoth")}</button>
              <div className="spacer" />
              <button className="btn primary code-h28" onClick={() => resolve(fx.cortex, t("code.diff.keptCortex"))}><Icon name="sparkle-free" size={16} />{t("code.diff.resolveWithCortex")}</button>
            </div>
          </div>
        )}
        {conflict && res && (
          <div className="diff code-file"><div className="code-head"><Icon name="check-circle" size={16} /><span style={{ marginLeft: 6 }}>{t("code.diff.resolution", { file: fx.conflictFile })}</span></div>
            {res.map((l, j) => <div key={j} className="code-dl" data-k="add"><span className="code-ln">{5 + j}</span><span className="code-sg">+</span><span className="code-src">{l}</span></div>)}
          </div>
        )}
        <div className="diff code-file">
          <div className="code-head"><Icon name="file-code" size={16} /><span style={{ marginLeft: 6 }}>{f.path}</span><span className="code-meta" style={{ flex: "none", marginRight: 8, fontFamily: "var(--font)" }}>{t(ST_LBL[f.st])}</span><Delta a={f.a} d={f.d} /><IconBtn icon="copy" label={t("code.copyPath")} onClick={() => toast.add({ title: t("code.pathCopied"), description: f.path, data: { icon: "copy" } })} /></div>
          <View lines={lines} extra={extra} onComment={(i) => { setOpenAt(key(i)); setDraft(""); }} onUnfold={() => setUnf((u) => [...u, f.path])} />
          {f.more && <div className="code-more">{f.more}</div>}
        </div>
      </div>
    </div>
  </>);
}

/* =====================================================================
   4. Terminal and logs
   ===================================================================== */
export function TerminalScreen() { const [v, setV] = useVariant("running"); return isPreview() ? <Terminal key={v} v={v} setV={setV} /> : <LiveSessionScreen />; }
function Terminal({ v, setV }: { v: string; setV: (v: string) => void }) {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fx = useFx().terminal;
  const fail = v === "failed";
  const RUN = React.useMemo(() => [...fx.base, ...fx.run], [fx]);
  const FAIL = React.useMemo(() => [...fx.base, ...fx.fail], [fx]);
  const ASK = RUN.findIndex((l) => l[0] === "ask");
  const script = fail ? FAIL : RUN;
  const [n, setN] = React.useState(v === "running" ? 2 : v === "approval" ? ASK + 1 : script.length);
  const [dec, setDec] = React.useState<null | "once" | "always" | "deny">(v === "done" ? "once" : null);
  const [stopped, setStopped] = React.useState(false);
  const tabs = [t("code.terminal.tab"), t("code.terminal.logs")];
  const [tab, setTab] = React.useState(tabs[0]);
  const ref = React.useRef<HTMLDivElement>(null);
  const blocked = !fail && n === ASK + 1 && dec === null;
  const done = n >= script.length;
  React.useEffect(() => {
    if (done || blocked || stopped) return;
    const tm = setInterval(() => setN((x) => Math.min(x + 1, script.length)), 360);
    return () => clearInterval(tm);
  }, [done, blocked, stopped, script.length]);
  React.useEffect(() => { const el = ref.current; if (el) el.scrollTo({ top: el.scrollHeight }); }, [n, dec, tab]);
  const decide = (d: "once" | "always" | "deny") => {
    setDec(d);
    if (d === "always") toast.add({ title: t("code.terminal.ruleAdded"), description: t("code.terminal.ruleAddedBody", { cmd: RUN[ASK][1], repo: fx.repo }), data: { icon: "shield-check", undo: true, onUndo: () => setDec("once") } });
  };
  const state: State = stopped ? "asleep" : blocked ? "waiting" : done ? (fail ? "blocked" : "done") : "working";
  const [title, sub] = stopped ? [t("code.terminal.stoppedTitle"), t("code.terminal.stoppedSub")] : blocked ? [t("code.terminal.waitingTitle"), t("code.terminal.waitingSub")] : done ? (fail ? [t("code.attempts.testsFailing", { count: 2 }), fx.failSub] : [t("code.terminal.doneTitle"), fx.doneSub]) : [t("code.terminal.workingTitle"), t("code.terminal.workingSub", { env: fx.env })];
  const steps: [string, number][] = fail ? [["code.terminal.step.install", 0], ["code.terminal.step.lint", 4], ["code.terminal.step.tests", 6]] : [["code.terminal.step.install", 0], ["code.terminal.step.lint", 4], ["code.terminal.step.tests", 6], ["code.terminal.step.approval", ASK], ["code.terminal.step.build", ASK + 1]];
  const isAsk = (i: number) => steps[i][0] === "code.terminal.step.approval";
  const stepSt = (i: number): CS => {
    const start = steps[i][1], end = steps[i + 1]?.[1] ?? script.length;
    if (n <= start) return "wait";
    if (blocked && isAsk(i)) return "ask";
    if (n >= end && (i < steps.length - 1 || done)) return fail && i === steps.length - 1 ? "err" : "ok";
    return stopped ? "wait" : "run";
  };
  const shown = script.slice(0, n).map(([k, s]): [TK, string] => [k, dec === "deny" && s === fx.build ? fx.buildAlt : s]).filter(([k, s]) => !(dec === "deny" && k === "cmd" && s === RUN[ASK][1]));
  const badge = stopped ? <Badge k="">{t("code.terminal.stopped")}</Badge> : blocked ? <Badge k="wait">{t("code.terminal.approvalRequired")}</Badge> : done ? (fail ? <Badge k="err">{t("code.status.failed")}</Badge> : <Badge k="ok">{t("code.status.done")}</Badge>) : <Badge k="run" spin>{t("code.status.running")}</Badge>;
  const jst = (st: CS) => st === "ok" ? t("code.passed") : st === "err" ? t("code.terminal.jFailed") : st === "ask" ? t("code.terminal.jWaiting") : t("code.tasks.inProgress");
  return (<>
    <div className="content-top">
      <span className="title">{fx.title}</span>{badge}
      <div className="spacer" />
      <Segmented items={tabs} value={tab} onChange={setTab} />
      <IconBtn icon="copy" label={t("code.terminal.copyOutput")} onClick={() => toast.add({ title: t("code.terminal.outputCopied"), description: t("code.terminal.lines", { count: shown.length }), data: { icon: "copy" } })} />
    </div>
    <div className="code-cols">
      <div className="code-main code-term-wrap">
        {tab === tabs[0] ? (
          <div className="term code-term" ref={ref} role="log" aria-live="polite" aria-label={t("code.terminal.outputLabel")}>
            {shown.map(([k, s], i) => k === "ask" ? (
              dec === null ? (
                <div key={i} className="code-ask" role="alertdialog" aria-label={t("code.terminal.approvalRequired")}>
                  <div className="code-ask-h"><Icon name="shield-check" size={16} /><span>{t("code.terminal.wantsToRun")} <code>{s}</code></span></div>
                  <p>{rich(t("code.terminal.askBody", { build: fx.build }))}</p>
                  <div className="code-row-gap">
                    <button className="btn primary code-h28" data-testid="permission-allow-once" onClick={() => decide("once")}>{t("code.terminal.allowOnce")}</button>
                    <button className="btn secondary code-h28" data-testid="permission-always" onClick={() => decide("always")}>{t("code.terminal.allowAlways")}</button>
                    <button className="btn secondary code-h28 code-danger" data-testid="permission-deny" onClick={() => decide("deny")}>{t("code.terminal.deny")}</button>
                  </div>
                </div>
              ) : <div key={i} className="code-tl" data-k="note">{dec === "deny" ? t("code.terminal.deniedBy", { name: fx.user }) : dec === "always" ? t("code.terminal.alwaysAllowed", { cmd: s }) : t("code.terminal.allowedOnceBy", { name: fx.user, cmd: s })}</div>
            ) : <div key={i} className="code-tl" data-k={k}>{k === "cmd" && <span className="code-ps">$ </span>}{s}</div>)}
            {stopped && <div className="code-tl" data-k="note">{t("code.terminal.stoppedBy", { name: fx.user })}</div>}
            {!done && !blocked && !stopped && <div className="code-tl code-cursor" aria-hidden><span /></div>}
          </div>
        ) : (
          <div className="code-journal" ref={ref}>
            {steps.map(([s], i) => { const st = stepSt(i); return st === "wait" ? null : (
              <div key={s} className="code-jrow" style={ix(i)}><span className="mono code-meta">{fx.times[i]}</span><CiIcon s={st} /><span className="code-grow">{t(s)}</span><span className="code-meta">{jst(st)}</span></div>
            ); })}
          </div>
        )}
      </div>
      <aside className="code-aside">
        <div className="code-card code-agent">
          <Agent state={state} size={64} />
          <b>{title}</b><span className="sub">{sub}</span>
          <div className="code-row-gap" style={{ marginTop: 8 }}>
            {done ? (fail ? <>
              <button className="btn secondary code-h28" onClick={() => setV("running")}><Icon name="refresh" size={16} />{t("code.terminal.rerun")}</button>
              <button className="btn primary code-h28" onClick={() => { toast.add({ title: t("code.terminal.fixing"), description: t("code.terminal.newRun"), data: { icon: "bug" } }); setV("running"); }}><Icon name="bug" size={16} />{t("code.terminal.fix")}</button>
            </> : <button className="btn primary code-h28" onClick={() => go("code-pr")}><Icon name="pull-request" size={16} />{t("code.createPr")}</button>)
              : stopped ? <button className="btn secondary code-h28" onClick={() => setStopped(false)}><Icon name="play" size={16} />{t("code.terminal.resume")}</button>
              : <button className="btn secondary code-h28" data-testid="code-stop" onClick={() => setStopped(true)}><Icon name="stop" size={16} />{t("code.terminal.stop")}</button>}
          </div>
        </div>
        <div className="code-card">
          <div className="code-label">{t("code.terminal.steps")}</div>
          {steps.map(([s], i) => <div key={s} className="code-ci-mini"><CiIcon s={stepSt(i)} /><span className="code-grow">{t(s)}</span></div>)}
        </div>
        <div className="code-card code-kv">
          <div><span>{t("code.terminal.kvEnv")}</span><b>{fx.env}</b></div>
          <div><span>{t("code.terminal.kvBranch")}</span><b className="mono">{fx.branch}</b></div>
          <div><span>{t("code.terminal.kvNetwork")}</span><b>{fx.network}</b></div>
          <div><span>{t("code.terminal.kvApprovals")}</span><b>{fx.approvals}</b></div>
        </div>
      </aside>
    </div>
  </>);
}

/* =====================================================================
   5. Environments
   ===================================================================== */
const NETS: [string, string, string][] = [["none", "code.env.net.none", "code.env.net.noneSub"], ["allowlist", "code.env.net.allowlist", "code.env.net.allowlistSub"], ["full", "code.env.net.full", "code.env.net.fullSub"]];

export function EnvScreen() { const [v, setV] = useVariant("list"); return isPreview() ? <Env key={v} v={v} setV={setV} /> : <LiveSessionScreen />; }
function Env({ v, setV }: { v: string; setV: (v: string) => void }) {
  const t = useT();
  const toast = useToast();
  const fx = useFx().env;
  const boot = v === "booting", err = v === "error";
  const logs = err ? fx.bootErr : fx.boot;
  const [n, setN] = React.useState(boot ? 3 : logs.length);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (!boot || n >= logs.length) return; const tm = setInterval(() => setN((x) => x + 1), 420); return () => clearInterval(tm); }, [boot, n >= logs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (boot && n === logs.length) toast.add({ title: t("code.env.readyToast"), description: t("code.env.readyToastBody", { env: fx.current, time: fx.bootTime }), data: { icon: "check-circle" } }); ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [image, setImage] = React.useState(fx.images[0]);
  const [script, setScript] = React.useState(fx.setup);
  const [net, setNet] = React.useState("allowlist");
  const [domains, setDomains] = React.useState(fx.domains);
  const [dom, setDom] = React.useState("");
  const [secrets, setSecrets] = React.useState(fx.secrets);
  const [sName, setSName] = React.useState(""); const [sVal, setSVal] = React.useState("");
  const [cache, setCache] = React.useState(true);
  const domOk = /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i.test(dom.trim());
  const nameOk = /^[A-Z_][A-Z0-9_]*$/.test(sName);
  const addDom = () => { if (domOk && !domains.includes(dom.trim().toLowerCase())) setDomains([...domains, dom.trim().toLowerCase()]); setDom(""); };
  const addSecret = () => { if (!nameOk || !sVal) return; setSecrets([...secrets, [sName, sVal.slice(-4), t("code.justNow")]]); setSName(""); setSVal(""); toast.add({ title: t("code.env.secretAdded"), description: t("code.env.secretAddedBody", { name: sName }), data: { icon: "key" } }); };
  const rmSecret = (k: string) => { const prev = secrets; setSecrets(secrets.filter((s) => s[0] !== k)); toast.add({ title: t("code.env.secretRemoved"), description: k, data: { icon: "trash", undo: true, onUndo: () => setSecrets(prev) } }); };
  const back = <IconBtn icon="arrow-left" label={t("code.env.back")} onClick={() => setV("list")} />;

  if (v === "list") return (<>
    <div className="content-top"><span className="title">{t("code.env.title")}</span><div className="spacer" /><button className="btn primary code-h28" onClick={() => setV("edit")}><Icon name="plus" size={16} />{t("code.env.new")}</button></div>
    <div className="page"><div className="code-wrap code-narrow">
      <p className="code-lead">{t("code.env.lead")}</p>
      <div className="list">
        {fx.envs.map((e, i) => (
          <div key={e.name} className="li code-env" style={ix(i)}>
            <span className="li-ic"><Icon name={e.ic} /></span>
            <span className="grow"><span className="ttl">{e.name}</span><span className="sub code-envsub"><span className="mono">{e.image}</span> · {e.stack}</span>
              <span className="code-envtags"><span><Icon name="folder-code" size={12} />{e.repos}</span><span><Icon name="globe" size={12} />{t("code.env.network", { net: e.net })}</span><span><Icon name="archive" size={12} />{t("code.env.cache", { cache: e.cache })}</span></span>
            </span>
            <Badge k={e.ready ? "ok" : ""}>{e.ready ? t("code.status.ready") : t("code.env.offline")}</Badge>
            <button className="btn secondary" onClick={() => setV("edit")}>{t("code.env.edit")}</button>
            <Pop align="end" width={200} trigger={<IconBtn icon="more-dots" label={t("code.optionsOf", { name: e.name })} />}>
              <MItem icon="play" onClick={() => setV("booting")}>{t("code.env.start")}</MItem>
              <MItem icon="copy">{t("code.env.duplicate")}</MItem><MSep />
              <MItem icon="trash" danger>{t("code.env.delete")}</MItem>
            </Pop>
          </div>
        ))}
      </div>
    </div></div>
  </>);

  if (v === "edit") return (<>
    <div className="content-top">{back}<span className="title">{fx.current}</span><div className="spacer" />
      <button className="btn secondary code-h28" onClick={() => setV("list")}>{t("code.cancel")}</button>
      <button className="btn primary code-h28" onClick={() => { toast.add({ title: t("code.env.saved"), description: t("code.env.savedBody"), data: { icon: "refresh" } }); setV("booting"); }}>{t("code.env.saveRestart")}</button>
    </div>
    <div className="page"><div className="code-wrap code-narrow code-form">
      <section><h3 className="h3">{t("code.env.image")}</h3>
        <Pop width={300} trigger={<button className="btn secondary code-select"><Icon name="cpu" size={16} /><span className="mono">{image}</span><Icon name="chevron-up-down" size={16} /></button>}>
          {fx.images.map((x) => <MItem key={x} icon={x === image ? "check" : undefined} onClick={() => setImage(x)}>{x}</MItem>)}
        </Pop>
        <p className="code-hint">{fx.stackHint}</p>
      </section>
      <section><h3 className="h3"><label htmlFor="code-setup">{t("code.env.setup")}</label></h3>
        <textarea id="code-setup" className="input code-script" value={script} onChange={(e) => setScript(e.target.value)} spellCheck={false} rows={7} />
        <p className="code-hint">{t("code.env.setupHint")}</p>
      </section>
      <section><h3 className="h3">{t("code.env.secrets")}</h3>
        <div className="list">
          {secrets.map(([k, last, when]) => (
            <div key={k} className="li code-secret"><Icon name="key" size={16} className="code-ic" /><span className="mono code-grow">{k}</span><span className="mono code-mask" aria-label={t("code.env.masked", { last })}>••••••••{last}</span><span className="code-meta">{when}</span>
              <IconBtn icon="trash" label={t("code.env.removeSecret", { name: k })} onClick={() => rmSecret(k)} /></div>
          ))}
          <form className="li code-secret-add" onSubmit={(e) => { e.preventDefault(); addSecret(); }}>
            <input className="input mono" value={sName} onChange={(e) => setSName(e.target.value.toUpperCase())} placeholder={t("code.env.namePlaceholder")} aria-label={t("code.env.nameLabel")} aria-invalid={!!sName && !nameOk} />
            <input className="input mono" type="password" value={sVal} onChange={(e) => setSVal(e.target.value)} placeholder={t("code.env.valuePlaceholder")} aria-label={t("code.env.valueLabel")} autoComplete="off" />
            <button className="btn secondary" disabled={!nameOk || !sVal}>{t("code.add")}</button>
          </form>
        </div>
        <p className="code-hint">{sName && !nameOk ? t("code.env.nameRule") : t("code.env.secretHint")}</p>
      </section>
      <section><h3 className="h3" id="code-net-l">{t("code.env.netTitle")}</h3>
        <RadioGroup value={net} onValueChange={(x) => setNet(x as string)} className="code-radios" aria-labelledby="code-net-l">
          {NETS.map(([id, l, s]) => (
            <label key={id} className="code-radio-row"><Radio.Root value={id} className="code-radio"><Radio.Indicator className="code-radio-i" /></Radio.Root>
              <span className="code-grow"><span className="ttl">{t(l)}</span><span className="sub">{t(s)}</span></span>{id === "full" && <Badge k="wait">{t("code.env.risky")}</Badge>}</label>
          ))}
        </RadioGroup>
        {net === "allowlist" && (
          <div className="code-domains">
            {domains.map((d) => <span key={d} className="code-dom mono">{d}<button aria-label={t("code.env.removeDomain", { domain: d })} onClick={() => setDomains(domains.filter((x) => x !== d))}><Icon name="close" size={12} /></button></span>)}
            <form onSubmit={(e) => { e.preventDefault(); addDom(); }} className="code-dom-add"><input className="input mono" value={dom} onChange={(e) => setDom(e.target.value)} placeholder={fx.domainPlaceholder} aria-label={t("code.env.domainLabel")} aria-invalid={!!dom && !domOk} /><button className="btn secondary" disabled={!domOk}>{t("code.add")}</button></form>
          </div>
        )}
      </section>
      <section><h3 className="h3">{t("code.env.cacheTitle")}</h3>
        <div className="list"><div className="li"><span className="grow"><span className="ttl">{t("code.env.keepCache")}</span><span className="sub">{fx.cacheSub}</span></span><Switch checked={cache} onCheckedChange={setCache} aria-label={t("code.env.keepCacheLabel")} /></div>
          <div className="li"><span className="grow"><span className="ttl">{t("code.env.clearCache")}</span><span className="sub">{t("code.env.clearCacheSub")}</span></span><button className="btn secondary" disabled={!cache} onClick={() => toast.add({ title: t("code.env.cleared"), description: fx.cacheFreed, data: { icon: "trash" } })}>{t("code.env.clear")}</button></div></div>
      </section>
    </div></div>
  </>);

  const pct = Math.round((n / logs.length) * 100);
  const ready = boot && n >= logs.length;
  return (<>
    <div className="content-top">{back}<span className="title">{fx.current}</span>
      {err ? <Badge k="err">{t("code.env.bootFailed")}</Badge> : ready ? <Badge k="ok">{t("code.status.ready")}</Badge> : <Badge k="run" spin>{t("code.env.booting")}</Badge>}<div className="spacer" />
    </div>
    {err && <div className="banner err code-banner"><Icon name="x-circle" size={16} /><span>{t("code.env.setupFailed")}</span><span className="grow">{fx.errBody}</span>
      <button className="btn secondary code-h28" onClick={() => setV("edit")}>{t("code.env.editSecrets")}</button><button className="btn primary code-h28" onClick={() => setV("booting")}><Icon name="refresh" size={16} />{t("code.retry")}</button></div>}
    <div className="code-cols">
      <div className="code-main code-term-wrap">
        {!err && <Progress.Root value={pct} className="code-prog code-prog-top" aria-label={t("code.env.bootLabel")}><Progress.Track className="code-prog-t"><Progress.Indicator className="code-prog-i" /></Progress.Track></Progress.Root>}
        <div className="term code-term" ref={ref} role="log" aria-live="polite" aria-label={t("code.env.bootLog")}>
          {logs.slice(0, n).map((l, i) => {
            const k = l.startsWith("$") ? "cmd" : l.startsWith("!") ? "err" : l.startsWith("✓") ? "ok" : "dim";
            return <div key={i} className="code-tl" data-k={k}><span className="code-ts">00:{String(Math.round(i * 3.4)).padStart(2, "0")}</span>{k === "err" || k === "ok" ? l.slice(1) : l}</div>;
          })}
          {boot && !ready && <div className="code-tl code-cursor" aria-hidden><span /></div>}
        </div>
      </div>
      <aside className="code-aside">
        <div className="code-card code-agent"><Agent state={err ? "blocked" : ready ? "done" : "working"} size={64} />
          <b>{err ? t("code.env.blockedTitle") : ready ? t("code.env.readyTitle") : t("code.env.preparing")}</b>
          <span className="sub">{err ? fx.errLine : ready ? t("code.env.readySub", { time: fx.bootTime }) : t("code.env.progressSub", { pct: `${pct}${NB}%` })}</span></div>
        <div className="code-card code-kv">
          <div><span>{t("code.env.image")}</span><b className="mono">{fx.images[0]}</b></div>
          <div><span>{t("code.env.repo")}</span><b>{fx.repo}</b></div>
          <div><span>{t("code.terminal.kvNetwork")}</span><b>{fx.netSummary}</b></div>
          <div><span>{t("code.env.secrets")}</span><b>{fx.secretsSummary}</b></div>
        </div>
      </aside>
    </div>
  </>);
}

/* =====================================================================
   6. Pull request
   ===================================================================== */
const MERGES = ["code.pr.squash", "code.pr.mergeCommit", "code.pr.rebase"];

export function PrScreen() { const [v, setV] = useVariant("draft"); return isPreview() ? <Pr key={v} v={v} setV={setV} /> : <LiveSessionScreen />; }
function Pr({ v, setV }: { v: string; setV: (v: string) => void }) {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const fx = useFx().pr;
  const draft = v === "draft", merged = v === "merged", failed = v === "failed";
  const [k, setK] = React.useState(v === "checks" ? 0 : 5);
  const [title, setTitle] = React.useState(fx.title);
  const [desc, setDesc] = React.useState(fx.desc);
  const [revs, setRevs] = React.useState(fx.reviewers);
  const [method, setMethod] = React.useState(MERGES[0]);
  const [merging, setMerging] = React.useState(false);
  const [branchGone, setBranchGone] = React.useState(false);
  React.useEffect(() => { if (v !== "checks" || k >= 5) return; const tm = setInterval(() => setK((x) => x + 1), 1000); return () => clearInterval(tm); }, [v, k >= 5]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (v === "checks" && k === 5) toast.add({ title: t("code.pr.allGreen"), description: t("code.pr.readyBody", { ref: fx.ref }), data: { icon: "check-circle" } }); }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const cs = (i: number): CS => draft ? "wait" : failed ? (i === 3 ? "err" : i === 4 ? "skip" : "ok") : i < k ? "ok" : i === k ? "run" : "wait";
  const ready = !draft && !failed && k >= 5;
  const okN = fx.checks.filter((_, i) => cs(i) === "ok").length;
  const approved = v === "ready" || merged;
  const merge = () => { setMerging(true); window.setTimeout(() => { setV("merged"); toast.add({ title: t("code.pr.mergedToast"), description: t("code.pr.mergedToastBody", { method: t(method), sha: fx.sha }), data: { icon: "pull-request" } }); }, 900); };
  const create = (asDraft: boolean) => { toast.add({ title: asDraft ? t("code.pr.draftCreated") : t("code.session.prCreated"), description: fx.ref, data: { icon: "pull-request" } }); setV("checks"); };
  const status = draft ? null : merged ? <Badge k="ok">{t("code.status.merged")}</Badge> : failed ? <Badge k="err">{t("code.pr.checksFailed")}</Badge> : ready ? <Badge k="ok">{t("code.pr.readyToMerge")}</Badge> : <Badge k="run" spin>{t("code.pr.checksRunning")}</Badge>;
  const agentSt: State = draft ? "talking" : merged ? "done" : failed ? "blocked" : ready ? "waiting" : "working";
  const ckSt = (s: CS, dur: string) => s === "ok" || s === "err" ? dur : s === "run" ? t("code.tasks.inProgress") : s === "skip" ? t("code.pr.cancelled") : t("code.pr.pending");
  return (<>
    <div className="content-top">
      <span className="title">{draft ? t("code.pr.createTitle") : fx.ref}</span>{status}<div className="spacer" />
      {draft && <><button className="btn secondary code-h28" onClick={() => create(true)}>{t("code.pr.createDraft")}</button><button className="btn primary code-h28" disabled={!title.trim()} onClick={() => create(false)}><Icon name="pull-request" size={16} />{t("code.pr.create")}</button></>}
      {!draft && <IconBtn icon="link" label={t("code.pr.copyLink")} onClick={() => toast.add({ title: t("code.pr.linkCopied"), description: fx.ref, data: { icon: "link" } })} />}
    </div>
    <div className="code-cols">
      <div className="code-main"><div className="code-prbody">
        {merged && <div className="banner info code-banner code-ok code-flat"><Icon name="check-circle" size={16} /><span>{t("code.pr.mergedInto", { base: "main" })}</span><span className="grow">{t("code.pr.mergedBy", { name: fx.user })} · <span className="mono">{fx.sha}</span> · {t("code.justNow")}</span></div>}
        <div className="code-gen"><Agent state={agentSt} size={28} /><span className="code-grow">{draft ? t("code.pr.genDraft") : merged ? t("code.pr.genMerged") : failed ? fx.e2eFail : ready ? t("code.pr.genReady", { name: fx.approvedBy }) : t("code.pr.genWatching")}</span>
          {draft && <IconBtn icon="refresh" label={t("code.pr.regenerate")} onClick={() => { setTitle(fx.title); setDesc(fx.desc); toast.add({ title: t("code.pr.regenerated"), data: { icon: "sparkle-free" } }); }} />}</div>
        {draft ? (<>
          <div className="field"><label htmlFor="code-pr-t">{t("code.pr.titleLabel")}</label><input id="code-pr-t" className="input code-title-in" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
          <div className="field"><label htmlFor="code-pr-d">{t("code.pr.descLabel")}</label><textarea id="code-pr-d" className="input code-desc-in" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </>) : (<>
          <h1 className="code-prtitle">{title}<span className="code-meta"> #482</span></h1>
          <div className="code-md">{desc.split("\n").map((l, i) => l.startsWith("## ") ? <h4 key={i}>{l.slice(3)}</h4> : l.startsWith("- ") ? <div key={i} className="code-li">{l.slice(2)}</div> : l ? <p key={i}>{l}</p> : null)}</div>
        </>)}
        <div className="code-prmeta"><span className="ctx code-static"><Icon name="git-branch" size={16} />{branchGone ? <s>{fx.branch}</s> : fx.branch}</span><Icon name="arrow-right" size={12} /><span className="ctx code-static">{BASE_BRANCH}</span><span className="code-meta">{t("code.pr.files", { count: fx.files })}</span><Delta a={fx.a} d={fx.d} /></div>
      </div></div>
      <aside className="code-aside">
        <div className="code-card">
          <div className="code-card-row"><span className="code-label">{t("code.pr.reviewers")}</span>
            <Pop align="end" width={220} trigger={<IconBtn icon="plus" label={t("code.pr.addReviewer")} size={16} disabled={merged} />}>
              {fx.more.filter(([w]) => !revs.some((r) => r[0] === w)).map(([w, nm]) => <MItem key={w} icon="user" onClick={() => setRevs([...revs, [w, nm]])}>{nm}</MItem>)}
            </Pop></div>
          {revs.map(([w, nm], i) => (
            <div key={w} className="code-rev"><Av who={w} name={nm} tone={i + 1} mark={approved && i === 0 ? "ok" : undefined} /><span className="code-grow">{nm}</span>
              <span className="code-meta">{approved ? (i === 0 ? t("code.pr.approvedIt") : i === 1 ? t("code.pr.commented") : t("code.pr.pending")) : draft ? t("code.pr.suggested") : t("code.pr.pending")}</span>
              {draft && <IconBtn icon="close" label={t("code.pr.removeReviewer", { name: nm })} size={16} onClick={() => setRevs(revs.filter((r) => r[0] !== w))} />}</div>
          ))}
          {draft && <p className="code-hint">{fx.reviewerHint}</p>}
        </div>
        <div className="code-card">
          <div className="code-card-row"><span className="code-label">{t("code.checks")}</span><span className="code-meta">{draft ? t("code.pr.onLaunch") : t("code.pr.passedCount", { n: okN, total: 5 })}</span></div>
          {fx.checks.map(([nm, cmd, dur], i) => (
            <React.Fragment key={nm}>
              <div className="code-check" data-s={cs(i)}><CiIcon s={cs(i)} /><span className="code-grow"><span className="ttl">{nm}</span><span className="sub mono">{cmd}</span></span><span className="code-meta">{ckSt(cs(i), dur)}</span></div>
              {cs(i) === "err" && <pre className="code-cilog">{fx.ciLog}</pre>}
            </React.Fragment>
          ))}
          {failed && <div className="code-row-gap" style={{ marginTop: 10 }}><button className="btn secondary code-h28" onClick={() => setV("checks")}><Icon name="refresh" size={16} />{t("code.terminal.rerun")}</button><button className="btn primary code-h28" onClick={() => { toast.add({ title: t("code.pr.fixingE2e"), description: t("code.pr.fixingE2eBody"), data: { icon: "bug" } }); go("code-terminal"); }}><Icon name="bug" size={16} />{t("code.pr.fixWithCortex")}</button></div>}
        </div>
        {!draft && (
          <div className="code-card code-merge" data-s={merged ? "ok" : ready ? "ready" : failed ? "err" : "wait"}>
            {merged ? (<>
              <div className="code-card-row"><Icon name="pull-request" size={16} /><b className="code-grow">{t("code.status.merged")}</b></div>
              <p className="code-hint">{t("code.pr.branchCanGo", { branch: fx.branch })}</p>
              <div className="code-row-gap"><button className="btn secondary code-h28" disabled={branchGone} onClick={() => { setBranchGone(true); toast.add({ title: t("code.pr.branchDeleted"), description: fx.branch, data: { icon: "trash", undo: true, onUndo: () => setBranchGone(false) } }); }}>{branchGone ? t("code.pr.branchDeleted") : t("code.pr.deleteBranch")}</button><button className="btn primary code-h28" onClick={() => go("code-tasks")}>{t("code.pr.backToTasks")}</button></div>
            </>) : ready ? (<>
              <div className="code-card-row"><Icon name="check-circle" size={16} className="code-ok-ic" /><b className="code-grow">{t("code.pr.readyToMerge")}</b></div>
              <p className="code-hint">{approved ? t("code.pr.approvalsMet") : t("code.pr.approvalsWaiting")}</p>
              <div className="code-mergebtn">
                <button className="btn primary" disabled={merging} onClick={merge}>{merging ? <><span className="spin" />{t("code.pr.merging")}</> : t(method)}</button>
                <Pop align="end" width={240} trigger={<button className="btn primary code-mergechev" aria-label={t("code.pr.mergeMethod")} disabled={merging}><Icon name="chevron-down" size={16} /></button>}>
                  {MERGES.map((m) => <MItem key={m} icon={m === method ? "check" : undefined} onClick={() => setMethod(m)}>{t(m)}</MItem>)}
                </Pop>
              </div>
            </>) : (<>
              <div className="code-card-row"><Icon name={failed ? "x-circle" : "history"} size={16} className={failed ? "code-err-ic" : undefined} /><b className="code-grow">{failed ? t("code.pr.mergeBlocked") : t("code.pr.waitingChecks")}</b></div>
              <p className="code-hint">{failed ? t("code.pr.blockedHint", { check: fx.checks[3][0] }) : t("code.pr.waitingHint", { count: 5 })}</p>
              <button className="btn primary" disabled>{t(method)}</button>
            </>)}
          </div>
        )}
      </aside>
    </div>
  </>);
}

/* =====================================================================
   7. Cortex Code settings
   ===================================================================== */
const SECS: [string, string, string][] = [["repos", "code.settings.repos", "folder-code"], ["instructions", "code.settings.instructions", "file-code"], ["approvals", "code.settings.approvals", "shield-check"], ["usage", "code.settings.usage", "bolt"]];
const APPROVALS: [string, string, string][] = [
  ["ask", "code.settings.mode.ask", "code.settings.mode.askSub"],
  ["auto", "code.settings.mode.auto", "code.settings.mode.autoSub"],
  ["full", "code.settings.mode.full", "code.settings.mode.fullSub"],
];

export function SettingsScreen() {
  const t = useT();
  const [v, setV] = useVariant("repos");
  const preview = isPreview();
  return (<>
    <div className="content-top"><span className="title">{t("code.settings.title")}</span></div>
    <div className="page"><div className="pg-set">
      <nav className="pg-nav" aria-label={t("code.settings.sections")}>
        {SECS.map(([id, l, ic]) => <button key={id} className="pg-nav-i" aria-current={v === id || undefined} onClick={() => setV(id)}><Icon name={ic} size={16} />{t(l)}</button>)}
      </nav>
      <div className="pg-panel" key={v}>
        <div className="page-title">{t(SECS.find((s) => s[0] === v)?.[1] ?? SECS[0][1])}</div>
        {preview ? (v === "approvals" ? <SetApprovals /> : v === "instructions" ? <SetAgents /> : v === "usage" ? <SetUsage /> : <SetRepos />)
          : <RemoteCodeSettings key={v} section={v} local={v === "approvals" ? <SetApprovalsLive /> : <Unavailable />} />}
      </div>
    </div></div>
  </>);
}
function Unavailable() {
  const t = useT();
  return <div className="empty code-empty-sm"><Icon name="cpu" size={20} /><h2>{t("code.settings.unavailableTitle")}</h2><p>{t("code.settings.unavailableBody")}</p></div>;
}
function SetRepos() {
  const t = useT();
  const toast = useToast();
  const fx = useFx().settings;
  const [repos, setRepos] = React.useState(fx.repos);
  const avail = fx.avail.filter((r) => !repos.some((x) => x.r === r));
  const remove = (r: string) => { const prev = repos; setRepos(repos.filter((x) => x.r !== r)); toast.add({ title: t("code.settings.repoDisconnected"), description: r, data: { icon: "folder-code", undo: true, onUndo: () => setRepos(prev) } }); };
  return (<>
    <div className="code-card-row" style={{ marginBottom: 10 }}><h3 className="h3" style={{ margin: 0, flex: 1 }}>{t("code.settings.gitHost", { org: fx.org })}</h3>
      <Pop align="end" width={260} trigger={<button className="btn secondary code-h28"><Icon name="plus" size={16} />{t("code.connectRepo")}</button>}>
        {avail.length ? avail.map((r) => <MItem key={r} icon="folder-code" onClick={() => { setRepos([...repos, { o: fx.repos[0].o, r, s: t("code.settings.syncing"), on: true }]); toast.add({ title: t("code.settings.repoConnected"), description: r, data: { icon: "folder-code" } }); }}>{r}</MItem>) : <div className="code-hint" style={{ padding: "8px 10px" }}>{t("code.settings.allConnected")}</div>}
      </Pop></div>
    <div className="list">
      {repos.map((x, i) => (
        <div key={x.r} className="li" style={ix(i)}>
          <span className="code-av code-av-org" data-tone={x.o === fx.repos[0].o ? 0 : 2} aria-hidden>{x.o}</span>
          <span className="grow"><span className="ttl mono code-repo">{x.r}</span><span className="sub"><Icon name="git-branch" size={12} /> {x.s}</span></span>
          <Switch checked={x.on} onCheckedChange={(on) => setRepos(repos.map((y) => y.r === x.r ? { ...y, on } : y))} aria-label={t("code.settings.allowOn", { repo: x.r })} />
          <Pop align="end" width={220} trigger={<IconBtn icon="more-dots" label={t("code.optionsOf", { name: x.r })} />}>
            <MItem icon="git-branch">{t("code.settings.changeBranch")}</MItem><MItem icon="refresh">{t("code.settings.sync")}</MItem><MSep />
            <MItem icon="trash" danger onClick={() => remove(x.r)}>{t("code.settings.disconnect")}</MItem>
          </Pop>
        </div>
      ))}
    </div>
    <p className="code-hint" style={{ marginTop: 10 }}>{t("code.settings.pushHint")}</p>
  </>);
}
function SetAgents() {
  const t = useT();
  const toast = useToast();
  const fx = useFx().settings;
  const [repo, setRepo] = React.useState(fx.repoNames[0]);
  const [saved, setSaved] = React.useState(fx.agents);
  const [txt, setTxt] = React.useState(fx.agents);
  const dirty = txt !== saved;
  return (<>
    <p className="code-lead">{rich(t("code.settings.agentsLead"))}</p>
    <div className="diff code-file code-md-ed">
      <div className="code-head"><Icon name="file-code" size={16} /><span style={{ marginLeft: 6 }}>{INSTRUCTIONS_FILE}</span>
        <Pop align="end" width={180} trigger={<button className="ctx"><Icon name="folder-code" size={16} />{repo}<Icon name="chevron-down" size={12} /></button>}>
          {fx.repoNames.map((r) => <MItem key={r} icon={r === repo ? "check" : "folder-code"} onClick={() => setRepo(r)}>{r}</MItem>)}
        </Pop>
      </div>
      <textarea className="code-agents" value={txt} onChange={(e) => setTxt(e.target.value)} spellCheck={false} aria-label={t("code.settings.agentsOf", { repo })} />
    </div>
    <div className="code-row-gap" style={{ marginTop: 12 }}>
      <span className="code-meta">{t("code.settings.chars", { count: txt.length })} · {dirty ? t("code.settings.unsaved") : t("code.settings.savedOn", { branch: "main" })}</span><div className="spacer" />
      <button className="btn secondary" disabled={!dirty} onClick={() => setTxt(saved)}>{t("code.settings.revert")}</button>
      <button className="btn primary" disabled={!dirty} onClick={() => { setSaved(txt); toast.add({ title: t("code.settings.agentsSaved"), description: t("code.settings.commitOn", { repo, branch: "main" }), data: { icon: "check-circle" } }); }}>{t("code.save")}</button>
    </div>
  </>);
}

type ApprovalsProps = { mode: string; setMode: (m: string) => void; allow: string[]; setAllow: (a: string[], removed?: string) => void; fromTask?: string; live?: boolean };
function ApprovalsBody({ mode, setMode, allow, setAllow, fromTask, live }: ApprovalsProps) {
  const t = useT();
  const [cmd, setCmd] = React.useState("");
  return (<>
    <h3 className="h3" id="code-appr-l" style={{ marginTop: live ? 0 : 24 }}>{t("code.settings.autoApprovals")}</h3>
    <RadioGroup value={mode} onValueChange={(x) => setMode(x as string)} className="code-radios" aria-labelledby="code-appr-l">
      {/* Full autonomy is cloud-only; this local engine never offers it live. */}
      {APPROVALS.map(([id, l, s]) => <label key={id} className="code-radio-row"><Radio.Root value={id} className="code-radio" disabled={live && id === "full"}><Radio.Indicator className="code-radio-i" /></Radio.Root><span className="code-grow"><span className="ttl">{t(l)}</span><span className="sub">{t(s)}</span></span>{id === "full" && <Badge k="wait">{t("code.settings.cloudOnly")}</Badge>}</label>)}
    </RadioGroup>
    <h3 className="h3" style={{ marginTop: 24 }}>{t("code.settings.alwaysAllowed")}</h3>
    <div className="list">
      {allow.map((c) => <div key={c} className="li code-secret"><Icon name="terminal" size={16} className="code-ic" /><span className="mono code-grow">{c}</span>{c === fromTask && <span className="code-meta">{t("code.settings.fromTask")}</span>}<IconBtn icon="trash" label={t("code.settings.removeRule", { cmd: c })} onClick={() => setAllow(allow.filter((x) => x !== c), c)} /></div>)}
      <form className="li code-secret-add" onSubmit={(e) => { e.preventDefault(); const c = cmd.trim(); if (c && !allow.includes(c)) setAllow([...allow, c]); setCmd(""); }}>
        <input className="input mono" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={t("code.settings.cmdPlaceholder")} aria-label={t("code.settings.cmdLabel")} /><button className="btn secondary" disabled={!cmd.trim()}>{t("code.add")}</button>
      </form>
    </div>
    <p className="code-hint" style={{ marginTop: 10 }}>{t("code.settings.forceHint")}</p>
  </>);
}
function SetApprovals() {
  const t = useT();
  const toast = useToast();
  const fx = useFx().settings;
  const models = [t("code.model.fast"), t("code.model.thinking")];
  const [model, setModel] = React.useState(models[1]);
  const [mode, setMode] = React.useState("auto");
  const [allow, setAllowS] = React.useState(fx.allow);
  const setAllow = (a: string[], removed?: string) => { const p = allow; setAllowS(a); if (removed) toast.add({ title: t("code.settings.ruleRemoved"), description: removed, data: { icon: "trash", undo: true, onUndo: () => setAllowS(p) } }); };
  return (<>
    <div className="list code-approval-defaults">
      <div className="li"><span className="grow"><span className="ttl">{t("code.settings.defaultModel")}</span><span className="sub">{t("code.settings.defaultModelSub")}</span></span>
        <Pop align="end" width={220} trigger={<button className="btn secondary">{model}<Icon name="chevron-up-down" size={16} /></button>}>
          {models.map((m) => <MItem key={m} icon={m === model ? "check" : undefined} onClick={() => setModel(m)}>{m}</MItem>)}
        </Pop></div>
      <div className="li"><span className="grow"><span className="ttl">{t("code.settings.notify")}</span><span className="sub">{t("code.settings.notifySub")}</span></span><Switch defaultChecked aria-label={t("code.settings.notifyLabel")} /></div>
    </div>
    <ApprovalsBody mode={mode} setMode={setMode} allow={allow} setAllow={setAllow} fromTask={fx.fromTask} />
  </>);
}

// Approval modes map onto user rules layered after the engine defaults (bash/write/edit ask):
// ask = defaults only, auto = file writes allowed, plus one bash allow rule per listed command.
const isOurs = (r: PermissionRule) => (r.tool === "bash" && r.action === "allow" && r.pattern !== "*") || ((r.tool === "edit" || r.tool === "write") && r.pattern === "*" && r.action === "allow");
function SetApprovalsLive() {
  const t = useT();
  const toast = useToast();
  const rules = useQuery(() => api.permissions.rules(), [], () => false);
  const [local, setLocal] = React.useState<PermissionRule[] | null>(null);
  const cur = local ?? (rules.state === "ready" ? rules.data : null);
  if (rules.state === "error") return <div className="empty code-empty-sm"><h2>{t("code.settings.rulesFailed")}</h2><button className="btn secondary" onClick={rules.reload}><Icon name="refresh" size={16} />{t("code.retry")}</button></div>;
  if (!cur) return null;
  const mode = cur.some((r) => r.tool === "edit" && r.action === "allow" && r.pattern === "*") ? "auto" : "ask";
  const allow = cur.filter((r) => r.tool === "bash" && r.action === "allow" && r.pattern !== "*").map((r) => r.pattern);
  const save = async (m: string, a: string[]) => {
    const next: PermissionRule[] = [...cur.filter((r) => !isOurs(r)),
      ...(m === "auto" ? (["edit", "write"] as const).map((tool) => ({ tool, pattern: "*", action: "allow" as const })) : []),
      ...a.map((pattern) => ({ tool: "bash", pattern, action: "allow" as const }))];
    const prev = cur;
    setLocal(next);
    try { setLocal(await api.permissions.setRules(next)); } catch { setLocal(prev); toast.add({ title: t("code.settings.rulesSaveFailed"), data: { icon: "x-circle" } }); }
  };
  return <ApprovalsBody live mode={mode} setMode={(m) => void save(m, allow)} allow={allow} setAllow={(a, removed) => { void save(mode, a); if (removed) toast.add({ title: t("code.settings.ruleRemoved"), description: removed, data: { icon: "trash" } }); }} />;
}

function SetUsage() {
  const t = useT();
  const { go } = useNav();
  const fx = useFx().settings;
  const M = ({ label, v, max, unit }: { label: string; v: number; max: number; unit: string }) => (
    <Meter.Root value={v} max={max} className="code-meter" aria-label={label}>
      <div className="code-meter-l"><Meter.Label>{label}</Meter.Label><span className="code-meta code-num">{t("code.settings.ofMax", { v, max, unit })}</span></div>
      <Meter.Track className="code-meter-t" data-tone={v / max >= 0.8 ? "wait" : "ok"}><Meter.Indicator className="code-meter-i" /></Meter.Track>
    </Meter.Root>
  );
  return (<>
    <div className="banner warn code-banner code-flat"><Icon name="alert-triangle" size={16} /><span>{t("code.settings.usedPct", { pct: `82${NB}%` })}</span><span className="grow">{fx.reset}</span><button className="btn secondary code-h28" onClick={() => go("pricing")}>{t("code.settings.raiseLimit")}</button></div>
    <div className="code-card code-meters">
      <M label={t("code.settings.mCloud")} v={41} max={50} unit={t("code.settings.uTasks")} />
      <M label={t("code.settings.mMinutes")} v={412} max={600} unit={t("code.settings.uMin")} />
      <M label={t("code.settings.mParallel")} v={3} max={4} unit={t("code.settings.uMax")} />
      <M label={t("code.settings.mReviews")} v={18} max={100} unit={t("code.settings.uReviews")} />
    </div>
    <h3 className="h3" style={{ marginTop: 24 }}>{t("code.settings.byRepo")}</h3>
    <div className="list">
      {fx.usage.map(([r, tk, m, p], i) => (
        <div key={r} className="li code-urow" style={ix(i)}><Icon name="folder-code" size={16} className="code-ic" /><span className="grow ttl">{r}</span><span className="code-meta code-num">{t("code.settings.nTasks", { count: tk })}</span><span className="code-meta code-num">{t("code.settings.nMin", { n: m })}</span><span className="code-meta code-num">{t("code.settings.nPr", { n: p })}</span></div>
      ))}
    </div>
  </>);
}
