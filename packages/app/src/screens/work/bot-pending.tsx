import * as React from "react";
import type { PendingApprovals, PolicyEvaluations } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { LiveApprovalTransfer } from "./contract-panels";
import { Mascot, type MascotConfig } from "../../mascot/Mascot";
import { toolName } from "../../state/tool-label";
import { Collapsible } from "@base-ui/react/collapsible";
import { Icon } from "../../kit/ui";

/** The producer seals the widget text as `Allow <tool>?\n<reason>\n<action JSON>\nAlways grants ...`; show a short summary, keep the rest behind a toggle. */
export function approvalSummary(text: string): { summary: string; details: string } {
  const body = text.split("\n").slice(1).join("\n");
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  let json = "";
  if (start >= 0 && end > start) json = body.slice(start, end + 1);
  let summary = "";
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const pick = ["command", "cmd", "path", "filePath", "file", "url", "query"].map(k => o[k]).find(v => typeof v === "string") ?? Object.values(o).find(v => typeof v === "string");
    if (typeof pick === "string") summary = pick;
  } catch { /* unparsable action: details only */ }
  const clip = summary.replace(/\s+/g, " ").trim();
  return { summary: clip.length > 140 ? `${clip.slice(0, 139)}…` : clip, details: body.trim() };
}

export function BotPending({ epoch, id, owns, inline, messages }: { epoch: string; id?: string; owns(): boolean; inline?: MascotConfig; messages?: { id: string; text: string }[] }) {
  const t = useT();
  const [rows, setRows] = React.useState<PendingApprovals>(), [audit, setAudit] = React.useState<PolicyEvaluations>();
  const [error, setError] = React.useState(false), [busy, setBusy] = React.useState(false);
  const [alwaysFor, setAlwaysFor] = React.useState<string>(), [alwaysAck, setAlwaysAck] = React.useState(false);
  const [decision, setDecision] = React.useState<{ id: string; state: "allowed" | "denied" | "acknowledged" | "unconfirmed" | "alwaysStored" | "alwaysForbidden" | "expired" }>();
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
  async function decide(row: PendingApprovals["items"][number], action: "allow" | "deny", always?: true) {
    if (!current() || pending.current || !row.message_id) return;
    pending.current = true; setBusy(true); setError(false); ++sequence.current;
    // No outcome endpoint or decision invalidation exists. Only a successful list reread confirms removal.
    setDecision({ id: row.id, state: "unconfirmed" });
    try {
      const result = await api.workBot.approvalDecide(row.mascot_id, row.message_id, always ? { epoch, action, always } : { epoch, action });
      if (!current()) return;
      const actual = await api.workBot.pendingApprovals(epoch, id);
      if (!current()) return;
      setRows(actual);
      const settled = actual.items.some(item => item.id === row.id) ? "unconfirmed" : result.resumed === undefined ? "acknowledged" : result.resumed ? "allowed" : "denied";
      // The producer silently skips a standing grant it may not hold (outbound tools, account policy); only the stored rules confirm Always.
      const standing = always && settled === "allowed" && id ? (await api.workBot.toolRules(id, epoch)).items.some(rule => rule.effect === "always_allow" && rule.match_kind === "tool" && rule.match_value === row.tool_name) : undefined;
      if (!current()) return;
      setDecision({ id: row.id, state: standing === false ? "alwaysForbidden" : standing ? "alwaysStored" : settled });
      if (id) {
        const evaluations = await api.workBot.policyEvaluations(id, epoch);
        if (current()) setAudit(evaluations);
      }
    } catch {
      if (!current()) return;
      const actual = await api.workBot.pendingApprovals(epoch, id).catch(() => undefined);
      if (!current()) return;
      if (actual) { setRows(actual); if (!actual.items.some(item => item.id === row.id)) { setDecision({ id: row.id, state: "expired" }); return; } }
      setError(true);
    }
    finally { pending.current = false; if (current()) setBusy(false); }
  }
  const reveal = React.useCallback((el: HTMLElement | null) => el?.scrollIntoView({ block: "end" }), []);
  if (inline) return <>{rows?.items.filter(row => row.message_id).map(row => <div className="msg-bot-row bot-thread-row" key={row.id} ref={reveal} data-testid="bot-thread-approval" data-approval-id={row.id}>
    <Mascot cfg={inline} state="waiting" size={24} />
    {(() => { const { summary, details } = approvalSummary(messages?.find(m => m.id === row.message_id)?.text ?? ""); return <div className="bot-approval" role="group" aria-label={t("workBot.thread.approvalTitle", { tool: toolName(t, row.tool_name) })}>
      <b className="bot-approval-title"><Icon name="shield-check" size={16} />{t("workBot.thread.approvalTitle", { tool: toolName(t, row.tool_name) })}</b>
      {summary && <code className="bot-approval-sum" data-testid="bot-approval-summary">{summary}</code>}
      {details && <Collapsible.Root className="bot-approval-more"><Collapsible.Trigger className="bot-approval-toggle">{t("workBot.thread.approvalDetails")}</Collapsible.Trigger><Collapsible.Panel><pre>{details}</pre></Collapsible.Panel></Collapsible.Root>}
      <span className="bot-bubble-actions"><button className="btn secondary" data-testid="bot-pending-deny" disabled={busy} onClick={() => void decide(row, "deny")}>{t("workBot.pending.deny")}</button><button className="btn primary" data-testid="bot-pending-allow" disabled={busy} onClick={() => void decide(row, "allow")}>{t("workBot.pending.allow")}</button></span>
    </div>; })()}</div>)}
    {error && <p className="bot-thread-note" role="alert" data-testid="bot-pending-error">{t("workBot.pending.error")}</p>}</>;
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
      <button className="btn secondary" data-testid="bot-pending-always" aria-label={t("workBot.pending.alwaysTool", { tool: row.tool_name })} disabled={busy || !row.message_id || decision?.id === row.id} onClick={() => { setAlwaysFor(row.id); setAlwaysAck(false); }}>{t("workBot.pending.always")}</button>
      {alwaysFor === row.id && <div role="dialog" aria-modal="false" aria-labelledby={`always-${row.id}`} className="banner warn" data-testid="bot-pending-always-dialog">
        <p id={`always-${row.id}`}>{t("workBot.pending.alwaysConfirm", { tool: row.tool_name })}</p>
        <label><input type="checkbox" data-testid="bot-pending-always-ack" checked={alwaysAck} onChange={e => setAlwaysAck(e.target.checked)} /> {t("workBot.pending.alwaysAck")}</label>
        <button className="btn primary" data-testid="bot-pending-always-confirm" disabled={busy || !alwaysAck || !row.message_id} onClick={() => { setAlwaysFor(undefined); void decide(row, "allow", true); }}>{t("workBot.pending.alwaysGrant")}</button>
        <button className="btn secondary" onClick={() => setAlwaysFor(undefined)}>{t("workBot.skills.cancel")}</button>
      </div>}
      <LiveApprovalTransfer epoch={epoch} approval={row.id} done={() => void load()} />
    </article>)}
    {id && <><h3>{t("workBot.pending.evaluations")}</h3><p>{t("workBot.pending.auditBoundary")}</p>{audit?.items.map(item => <p key={item.id} data-testid="bot-policy-evaluation">{item.tool_name} · {t(`workBot.pending.evaluation.${item.evaluation}`)} · {t(`workBot.pending.source.${item.source}`)}</p>)}</>}
  </section>;
}
