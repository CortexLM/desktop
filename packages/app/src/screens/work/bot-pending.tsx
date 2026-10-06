import * as React from "react";
import type { PendingApprovals, PolicyEvaluations } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";

export function BotPending({ epoch, id, owns }: { epoch: string; id?: string; owns(): boolean }) {
  const t = useT();
  const [rows, setRows] = React.useState<PendingApprovals>(), [audit, setAudit] = React.useState<PolicyEvaluations>();
  const [error, setError] = React.useState(false), [busy, setBusy] = React.useState(false);
  const [decision, setDecision] = React.useState<{ id: string; state: "allowed" | "denied" | "acknowledged" | "unconfirmed" }>();
  const mounted = React.useRef(true), pending = React.useRef(false), sequence = React.useRef(0);
  const current = () => mounted.current && owns();
  async function load() {
    const token = ++sequence.current;
    setError(false);
    try {
      const result = await api.workBot.pendingApprovals(epoch, id);
      if (current() && token === sequence.current) { setRows(result); setDecision(undefined); }
      if (id) {
        const evaluations = await api.workBot.policyEvaluations(id, epoch);
        if (current() && token === sequence.current) setAudit(evaluations);
      }
    } catch { if (current() && token === sequence.current) setError(true); }
  }
  React.useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; sequence.current++; }; }, [epoch, id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function decide(row: PendingApprovals["items"][number], action: "allow" | "deny") {
    if (!current() || pending.current || !row.message_id) return;
    pending.current = true; setBusy(true); setError(false); ++sequence.current;
    // No outcome endpoint or decision invalidation exists. Only a successful list reread confirms removal.
    setDecision({ id: row.id, state: "unconfirmed" });
    try {
      const result = await api.workBot.approvalDecide(row.mascot_id, row.message_id, { epoch, action });
      if (!current()) return;
      const actual = await api.workBot.pendingApprovals(epoch, id);
      if (!current()) return;
      setRows(actual);
      setDecision({ id: row.id, state: actual.items.some(item => item.id === row.id) ? "unconfirmed" : result.resumed === undefined ? "acknowledged" : result.resumed ? "allowed" : "denied" });
      if (id) {
        const evaluations = await api.workBot.policyEvaluations(id, epoch);
        if (current()) setAudit(evaluations);
      }
    } catch { if (current()) setError(true); }
    finally { pending.current = false; if (current()) setBusy(false); }
  }
  return <section className="travail-panel bot-apps" data-testid="bot-pending" aria-labelledby="bot-pending-title">
    <h2 id="bot-pending-title">{t(id ? "workBot.pending.bot" : "workBot.pending.account")}</h2>
    <p>{t("workBot.pending.boundary")}</p>
    <button className="btn secondary" data-testid="bot-pending-refresh" disabled={busy} onClick={() => void load()}>{t("workBot.pending.refresh")}</button>
    {error && <p className="banner err" role="alert" data-testid="bot-pending-error">{t("workBot.pending.error")}</p>}
    {decision && <p role="status" data-testid="bot-pending-decision" data-decision-state={decision.state}>{t(`workBot.pending.${decision.state}`)}</p>}
    {!rows && !error && <p role="status">{t("workBot.loading")}</p>}
    {rows && !rows.items.length && <p data-testid="bot-pending-empty">{t("workBot.pending.empty")}</p>}
    {rows?.items.map(row => <article className="bot-apps-row" key={row.id} data-testid="bot-pending-row" data-approval-id={row.id} data-bot-id={row.mascot_id}>
      <div className="travail-grow"><h3>{row.tool_name}</h3><time dateTime={row.created_at}>{row.created_at}</time>{!row.message_id && <p>{t("workBot.pending.unlinked")}</p>}</div>
      <button className="btn primary" data-testid="bot-pending-allow" aria-label={t("workBot.pending.allowTool", { tool: row.tool_name })} disabled={busy || !row.message_id || decision?.id === row.id} onClick={() => void decide(row, "allow")}>{t("workBot.pending.allow")}</button>
      <button className="btn secondary" data-testid="bot-pending-deny" aria-label={t("workBot.pending.denyTool", { tool: row.tool_name })} disabled={busy || !row.message_id || decision?.id === row.id} onClick={() => void decide(row, "deny")}>{t("workBot.pending.deny")}</button>
    </article>)}
    {id && <><h3>{t("workBot.pending.evaluations")}</h3><p>{t("workBot.pending.auditBoundary")}</p>{audit?.items.map(item => <p key={item.id} data-testid="bot-policy-evaluation">{item.tool_name} · {t(`workBot.pending.evaluation.${item.evaluation}`)} · {t(`workBot.pending.source.${item.source}`)}</p>)}</>}
  </section>;
}
