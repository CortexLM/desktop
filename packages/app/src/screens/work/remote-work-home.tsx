// Signed-in Work home: task composer + suggestions on first run, then the board of Bot jobs (design work-home).
import * as React from "react";
import type { WorkBotView, WorkJob } from "@cortex/schema";
import { api } from "../../api";
import { useQuery } from "../../state/live";
import { useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { Icon, IconBtn, Tip, useToast } from "../../kit/ui";
import { Composer } from "../../components/composer";
import { Mascot } from "../../mascot/Mascot";
import { css, lookMascot, Empty, Top, useAgo } from "./common";

type Col = "todo" | "doing" | "review" | "done";
const COLS: [Col, string][] = [["todo", ""], ["doing", "run"], ["review", "wait"], ["done", "ok"]];
const colOf = (s: WorkJob["status"]): Col => (s === "running" ? "doing" : s === "queued" || s === "paused" ? "todo" : "done");

export function RemoteWorkHome({ epoch, bots, ready }: { epoch: string; bots: WorkBotView[]; ready: boolean }) {
  const t = useT(), { go } = useNav(), toast = useToast(), ago = useAgo();
  const [who, setWho] = React.useState("");
  const ids = bots.map(b => b.id).join(",");
  const jobs = useQuery(async () => epoch ? (await Promise.all(bots.map(async bot => (await api.workBot.snapshot(bot.id, epoch)).jobs.map(job => ({ job, bot }))))).flat() : [],
    [epoch, ids], e => e.type === "workBot.changed" && e.properties.epoch === epoch);
  const pending = useQuery(async () => epoch ? (await api.workBot.pendingApprovals(epoch)).items : [], [epoch], e => e.type === "workBot.changed" && e.properties.epoch === epoch);
  const target = bots.find(b => b.id === who) ?? bots[0];
  const all = jobs.state === "ready" ? jobs.data.filter(x => !who || x.bot.id === who).sort((a, b) => b.job.created_at.localeCompare(a.job.created_at)) : [];
  const asks = pending.state === "ready" ? pending.data.filter(p => !who || p.mascot_id === who) : [];
  const add = async (goal: string) => {
    if (!target || !goal.trim()) return false;
    try {
      await api.workBot.enqueue(target.id, { epoch, kind: "general-purpose", goal: goal.trim() });
      toast.add({ title: t("work.home.toastHanded", { name: target.name }), description: goal, data: { icon: "bot" } });
      jobs.reload();
      return true;
    } catch { toast.add({ title: t("work.error.send"), data: { icon: "alert-triangle" } }); return false; }
  };
  const open = (bot: string) => go("work-task", { source: "work-bot-api", id: bot, epoch });
  const toReview = pending.state === "ready" ? pending.data.length : 0;
  const top = <Top title={t("work.home.title")}>
    <IconBtn icon="history" label={t("work.activity")} onClick={() => go("activity")} />
    <IconBtn icon="clock-loop" label={t("work.routines")} onClick={() => go("automations")} />
    {toReview > 0 && <Tip label={t("work.toApprove")}><button className="btn secondary" style={{ height: 28 }} data-testid="work-home-to-approve" onClick={() => go("approvals")}><span className="travail-dot" data-s="wait" />{t("work.home.toApproveCount", { count: toReview })}</button></Tip>}
  </Top>;
  if (ready && !bots.length) return <>{top}<Empty state="idle" title={t("bots.page.noneTitle")} text={t("bots.page.noneText")}><button className="btn primary" data-testid="bot-create-start" onClick={() => go("bot-new")}><Icon name="plus" size={16} />{t("bots.new.title")}</button></Empty></>;
  const loading = !ready || jobs.state === "loading";
  const empty = !loading && jobs.state === "ready" && !jobs.data.length && !toReview;
  const failed = jobs.state === "error" || pending.state === "error";
  const name = target?.name ?? "";
  return <>{top}
    <div className={empty ? "empty travail-empty" : "page"} data-testid="remote-work-home" data-owner-epoch={epoch}>
      {failed && <div className="banner err" role="alert" data-testid="work-home-error">{t("work.error.loadTitle")}<button className="btn secondary" onClick={() => { jobs.reload(); pending.reload(); }}>{t("common.retry")}</button></div>}
      {empty && <><Mascot cfg={target ? lookMascot(target) : lookMascot({ name: "" })} state="listening" size={88} track interactive /><h2>{t("work.home.emptyTitle", { name })}</h2><p>{t("work.home.emptyText", { name })}</p></>}
      <div className={empty ? undefined : "travail-compose"} style={empty ? { width: 560, maxWidth: "100%" } : undefined}><Composer placeholder={t("work.home.composer")} onSend={add} testId="work-home-composer" /></div>
      {empty ? <div className="suggestions" style={{ maxWidth: 560 }}>
        {[t("work.home.sugg1"), t("work.home.sugg2"), t("work.home.sugg3")].map((s, i) => <button key={s} className="suggestion" data-testid="work-home-suggestion" style={css(i)} onClick={() => void add(s)}><Icon name="bot" size={16} />{s}</button>)}
      </div> : <>
        {bots.length > 1 && <div className="travail-filters" role="group" aria-label={t("work.home.filterByBot")}>
          {[undefined, ...bots].map(b => <button key={b?.id ?? "all"} className="chip" aria-pressed={who === (b?.id ?? "")} data-pressed={who === (b?.id ?? "") || undefined} onClick={() => setWho(b?.id ?? "")}>{b && <Mascot cfg={lookMascot(b)} size={18} state="idle" />}{b?.name ?? t("work.all")}</button>)}
        </div>}
        <div className="travail-board" aria-busy={loading || undefined} aria-label={loading ? t("work.home.loading") : undefined} data-testid="work-home-board">
          {COLS.map(([c, s], ci) => {
            const xs = c === "review" ? [] : all.filter(x => colOf(x.job.status) === c);
            const n = c === "review" ? asks.length : xs.length;
            return <section key={c} className="travail-col" data-col={c} aria-label={t(`work.col.${c}`)}>
              <div className="travail-col-head"><span className="travail-dot" data-s={s} />{t(`work.col.${c}`)}<span className="travail-meta">{loading ? "" : n}</span></div>
              {loading ? [0, 1].slice(0, 2 - (ci % 2)).map(i => <div key={i} className="travail-skelcard"><span className="skel line" style={{ width: `${86 - i * 14}%` }} /><span className="skel line" style={{ width: "50%" }} /></div>)
                : c === "review" ? asks.map((p, i) => { const bot = bots.find(b => b.id === p.mascot_id); return <button key={p.id} className="travail-kcard travail-rise" style={css(i)} data-testid="work-home-approval" onClick={() => go("approvals")}>
                  <span className="travail-kcard-t">{t("work.home.approvalCard", { tool: p.tool_name })}</span>
                  <span className="travail-kcard-f">{bot && <Mascot cfg={lookMascot(bot)} size={18} state="waiting" />}<span className="travail-grow">{bot?.name ?? ""} · {ago(p.created_at)}</span></span></button>; })
                : xs.map(({ job, bot }, i) => <button key={job.id} className="travail-kcard travail-rise" style={css(i)} data-testid="work-home-card" data-status={job.status} onClick={() => open(bot.id)}>
                  <span className="travail-kcard-t">{job.goal}</span>
                  <span className="travail-kcard-f"><Mascot cfg={lookMascot(bot)} size={18} state={job.status === "running" ? "working" : "idle"} /><span className="travail-grow">{bot.name} · {job.status === "failed" || job.status === "cancelled" || job.status === "paused" ? `${t(`workBot.status.${job.status}`)} · ` : ""}{ago(job.created_at)}</span></span></button>)}
              {!loading && !n && <div className="travail-col-empty">{t("work.home.colEmpty")}</div>}
            </section>;
          })}
        </div>
      </>}
    </div>
  </>;
}
