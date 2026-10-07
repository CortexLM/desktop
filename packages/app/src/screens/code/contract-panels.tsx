import * as React from "react";
import type { ContractCall } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Icon } from "../../kit/ui";
import { useQuery } from "../../state/live";

export type Owner = { epoch: string; session: string };
type Row = Record<string, unknown>;
const call = async <T,>(c: ContractCall) => (await api.code.contract(c)).data as T;
const codeOf = (e: unknown) => typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "provider_error";

export function useContract() {
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState<string>();
  const run = async (action: () => Promise<unknown>, done?: () => void) => {
    if (busy) return; setBusy(true); setError(undefined);
    try { await action(); done?.(); } catch (e) { setError(codeOf(e)); } finally { setBusy(false); }
  };
  return { busy, error, run };
}

export function ContractError({ code }: { code?: string }) {
  const t = useT();
  return code ? <div className="banner err" role="alert" data-testid="contract-error" data-code={code}>{t(`code.contract.error.${["not_found", "conflict", "permission_denied", "invalid_request"].includes(code) ? code : "other"}`)}</div> : null;
}

export function LiveAttempts({ epoch, session }: Owner) {
  const t = useT(), c = useContract();
  const list = useQuery(() => call<{ items: Row[] }>({ epoch, op: "code.attempts", params: { session } }), [epoch, session]);
  return <section data-testid="live-attempts">
    <h3>{t("code.contract.attempts")}</h3>
    {list.state === "ready" && !list.data.items.length && <p className="code-hint">{t("code.contract.noAttempts")}</p>}
    {list.state === "ready" && list.data.items.map(a => <div key={String(a.id)} className="li" data-testid="attempt-row" data-status={String(a.status)}>
      <span className="grow">{t("code.contract.attempt", { n: Number(a.index) + 1 })} · {t(`code.contract.status.${String(a.status)}`)}</span>
      <button className="btn secondary" data-testid="attempt-choose" disabled={c.busy || a.chosen === true || a.status !== "ready"} onClick={() => void c.run(() => call({ epoch, op: "code.attempts.choose", params: { session, attempt: String(a.id) } }), list.reload)}>{a.chosen ? t("code.attempts.kept") : t("code.attempts.choose")}</button>
    </div>)}
    <button className="btn secondary" data-testid="attempt-retry" disabled={c.busy} onClick={() => void c.run(() => call({ epoch, op: "code.attempts.retry", params: { session }, body: {} }), list.reload)}>{t("code.contract.retry")}</button>
    <ContractError code={c.error ?? (list.state === "error" ? "other" : undefined)} />
  </section>;
}

export function LiveComments({ epoch, session, path }: Owner & { path: string }) {
  const t = useT(), c = useContract();
  const [line, setLine] = React.useState("1"), [body, setBody] = React.useState("");
  const list = useQuery(() => call<{ items: Row[] }>({ epoch, op: "code.comments", params: { session } }), [epoch, session]);
  const items = list.state === "ready" ? list.data.items.filter(x => x.path === path) : [];
  return <section data-testid="live-comments">
    {items.map(x => <div key={String(x.id)} className="li" data-testid="comment-row"><span className="mono">{t("code.contract.lineN", { n: Number(x.line) })}</span><span className="grow">{String(x.body)}</span>
      <button className="btn secondary" data-testid="comment-remove" disabled={c.busy} onClick={() => void c.run(() => call({ epoch, op: "code.comments.remove", params: { session, comment: String(x.id) } }), list.reload)}>{t("code.contract.remove")}</button></div>)}
    <form className="li" onSubmit={e => { e.preventDefault(); void c.run(() => call({ epoch, op: "code.comments.add", params: { session }, body: { path, line: Number(line), side: "new", body } }), () => { setBody(""); list.reload(); }); }}>
      <input className="input" style={{ width: 72 }} aria-label={t("code.contract.line")} data-testid="comment-line" inputMode="numeric" value={line} onChange={e => setLine(e.target.value)} />
      <input className="input grow" aria-label={t("code.contract.comment")} data-testid="comment-body" value={body} onChange={e => setBody(e.target.value)} />
      <button className="btn primary" data-testid="comment-add" disabled={c.busy || !body.trim()}>{t("code.contract.addComment")}</button>
    </form>
    <ContractError code={c.error} />
  </section>;
}

export function LiveResolve({ epoch, session, path }: Owner & { path: string }) {
  const t = useT(), c = useContract(), [done, setDone] = React.useState<string>();
  return <div className="ctx-bar" data-testid="live-resolve">
    {(["ours", "theirs", "both"] as const).map(choice => <button key={choice} className="btn secondary" data-testid={`resolve-${choice}`} disabled={c.busy}
      onClick={() => void c.run(() => call({ epoch, op: "code.diff.resolve", params: { session }, body: { path, choice } }), () => setDone(choice))}>{t(`code.contract.resolve.${choice}`)}</button>)}
    {done && <span className="code-meta" data-testid="resolve-done">{t("code.diff.resolved")}</span>}
    <ContractError code={c.error} />
  </div>;
}

export function LivePrReview({ epoch, session }: Owner) {
  const t = useT(), c = useContract(), [body, setBody] = React.useState(""), [state, setState] = React.useState<string>(), [who, setWho] = React.useState("");
  const reviewers = useQuery(() => call<{ items: { login: string }[] }>({ epoch, op: "code.pr.reviewers", params: { session } }), [epoch, session]);
  const review = (decision: "approve" | "request_changes") => void c.run(async () => setState(String((await call<Row>({ epoch, op: "code.pr.review", params: { session }, body: { decision, ...(body.trim() ? { body } : {}) } })).state)));
  return <section data-testid="live-pr-review">
    <textarea className="input" data-testid="pr-review-body" aria-label={t("code.contract.reviewBody")} value={body} onChange={e => setBody(e.target.value)} />
    <div className="ctx-bar">
      <button className="btn primary" data-testid="pr-approve" disabled={c.busy} onClick={() => review("approve")}>{t("code.contract.approve")}</button>
      <button className="btn secondary" data-testid="pr-request-changes" disabled={c.busy || !body.trim()} onClick={() => review("request_changes")}>{t("code.contract.requestChanges")}</button>
      {state && <span className="code-meta" data-testid="pr-review-state">{state}</span>}
    </div>
    <div className="li">
      <input className="input grow" data-testid="pr-reviewer" aria-label={t("code.contract.reviewer")} value={who} onChange={e => setWho(e.target.value)} />
      <button className="btn secondary" data-testid="pr-reviewer-add" disabled={c.busy || !who.trim()} onClick={() => void c.run(() => call({ epoch, op: "code.pr.reviewers.request", params: { session }, body: { reviewers: [who.trim()] } }), reviewers.reload)}>{t("code.contract.requestReview")}</button>
    </div>
    {reviewers.state === "ready" && reviewers.data.items.map(r => <span key={r.login} className="badge" data-testid="pr-reviewer-row">{r.login}</span>)}
    <ContractError code={c.error} />
  </section>;
}

export function LiveSessionGrant({ epoch, session }: Owner) {
  const t = useT(), c = useContract(), [grant, setGrant] = React.useState<{ expires_at: string }>(), [now, setNow] = React.useState(Date.now());
  React.useEffect(() => { if (!grant) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [grant]);
  const left = grant ? Math.max(0, Math.round((Date.parse(grant.expires_at) - now) / 60000)) : 0;
  return <div className="ctx-bar" data-testid="live-session-grant">
    {grant && left > 0
      ? <><span className="code-meta" data-testid="grant-active">{t("code.contract.grantActive", { n: left })}</span>
        <button className="btn secondary" data-testid="grant-revoke" disabled={c.busy} onClick={() => void c.run(() => call({ epoch, op: "code.grant.revoke", params: { session } }), () => setGrant(undefined))}>{t("code.contract.grantRevoke")}</button></>
      : <button className="btn secondary" data-testid="grant-10min" disabled={c.busy} onClick={() => void c.run(async () => setGrant(await call<{ expires_at: string }>({ epoch, op: "code.grant", params: { session }, body: { ttl_seconds: 600 } })))}>{t("code.contract.grant10")}</button>}
    {grant && left === 0 && <span className="code-meta" data-testid="grant-expired">{t("code.contract.grantExpired")}</span>}
    <ContractError code={c.error} />
  </div>;
}

export function LiveRuntimeAdmin({ epoch }: { epoch: string }) {
  const t = useT(), c = useContract();
  const runtimes = useQuery(() => call<{ items: Row[] }>({ epoch, op: "code.runtimes" }), [epoch]);
  const [filter, setFilter] = React.useState("all");
  const items = runtimes.state === "ready" ? runtimes.data.items.filter(r => filter === "all" || r.status === filter) : [];
  return <section data-testid="live-machines">
    <select className="input" data-testid="machines-filter" aria-label={t("code.contract.filter")} value={filter} onChange={e => setFilter(e.target.value)}>
      {["all", "running", "hibernated", "stopped"].map(s => <option key={s} value={s}>{t(`code.contract.machine.${s}`)}</option>)}
    </select>
    {runtimes.state === "ready" && !items.length && <p className="code-hint" data-testid="machines-empty">{t("code.contract.noMachines")}</p>}
    {items.map(r => <RuntimeRow key={String(r.id)} epoch={epoch} runtime={r} reload={runtimes.reload} c={c} />)}
    <ContractError code={c.error ?? (runtimes.state === "error" ? "other" : undefined)} />
  </section>;
}

function RuntimeRow({ epoch, runtime, reload, c }: { epoch: string; runtime: Row; reload: () => void; c: ReturnType<typeof useContract> }) {
  const t = useT(), id = String(runtime.id);
  const [open, setOpen] = React.useState(false), [name, setName] = React.useState(""), [value, setValue] = React.useState(""), [hosts, setHosts] = React.useState("");
  const secrets = useQuery(async () => open ? call<{ items: { name: string }[] }>({ epoch, op: "code.secrets", params: { runtime: id } }) : { items: [] }, [open, epoch, id]);
  const egress = useQuery(async () => open ? call<{ allow: string[] }>({ epoch, op: "code.egress", params: { runtime: id } }) : { allow: [] }, [open, epoch, id]);
  React.useEffect(() => { if (egress.state === "ready") setHosts(egress.data.allow.join(", ")); }, [egress.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const trees = Array.isArray(runtime.worktrees) ? runtime.worktrees as Row[] : [];
  return <div className="code-machine" data-testid="machine-row" data-status={String(runtime.status)}>
    <div className="li"><Icon name="server" size={16} /><span className="grow mono">{id}</span>
      <span className="code-meta" data-testid="machine-capacity">{t("code.contract.worktrees", { used: trees.length, max: Number(runtime.max_worktrees ?? 1) })}</span>
      <span className="badge">{String(runtime.status)}</span>
      <button className="btn secondary" data-testid="machine-wake" disabled={c.busy || runtime.status === "running"} onClick={() => void c.run(() => call({ epoch, op: "code.runtime.lifecycle", params: { runtime: id }, body: { action: "resume" } }), reload)}>{t("code.contract.wake")}</button>
      <button className="btn secondary" data-testid="machine-sleep" disabled={c.busy || runtime.status !== "running"} onClick={() => void c.run(() => call({ epoch, op: "code.runtime.lifecycle", params: { runtime: id }, body: { action: "hibernate" } }), reload)}>{t("code.contract.sleep")}</button>
      <button className="btn secondary" data-testid="machine-delete" disabled={c.busy} onClick={() => { if (confirm(t("code.contract.deleteConfirm"))) void c.run(() => call({ epoch, op: "code.runtime.remove", params: { runtime: id } }), reload); }}>{t("code.contract.delete")}</button>
      <button className="btn secondary" data-testid="machine-open" aria-expanded={open} onClick={() => setOpen(v => !v)}>{t("code.contract.configure")}</button>
    </div>
    {open && <div className="code-machine-detail">
      {trees.map(w => <div key={String(w.session_id)} className="li mono code-meta">{String(w.path)} · {String(w.branch ?? "")}</div>)}
      {secrets.state === "ready" && secrets.data.items.map(s => <div key={s.name} className="li code-secret" data-testid="secret-row"><span className="grow mono">{s.name}</span>
        <button className="btn secondary" data-testid="secret-remove" disabled={c.busy} onClick={() => void c.run(() => call({ epoch, op: "code.secrets.remove", params: { runtime: id, secret: s.name } }), secrets.reload)}>{t("code.contract.remove")}</button></div>)}
      <form className="li" onSubmit={e => { e.preventDefault(); void c.run(() => call({ epoch, op: "code.secrets.put", params: { runtime: id, secret: name }, body: { value } }), () => { setName(""); setValue(""); secrets.reload(); }); }}>
        <input className="input mono" data-testid="secret-name" aria-label={t("code.contract.secretName")} value={name} onChange={e => setName(e.target.value.toUpperCase())} />
        <input className="input grow" type="password" autoComplete="off" data-testid="secret-value" aria-label={t("code.contract.secretValue")} value={value} onChange={e => setValue(e.target.value)} />
        <button className="btn primary" data-testid="secret-save" disabled={c.busy || !name || !value}>{t("code.contract.save")}</button>
      </form>
      <form className="li" onSubmit={e => { e.preventDefault(); void c.run(() => call({ epoch, op: "code.egress.put", params: { runtime: id }, body: { allow: hosts.split(/[\s,]+/).filter(Boolean), confirm: true } }), egress.reload); }}>
        <input className="input grow mono" data-testid="egress-hosts" aria-label={t("code.contract.egress")} value={hosts} onChange={e => setHosts(e.target.value)} />
        <button className="btn primary" data-testid="egress-save" disabled={c.busy}>{t("code.contract.save")}</button>
      </form>
    </div>}
  </div>;
}

export function LiveRepoToggle({ epoch, fullName, enabled, reload }: { epoch: string; fullName: string; enabled?: boolean; reload: () => void }) {
  const t = useT(), c = useContract(), [owner, repo] = fullName.split("/") as [string, string];
  return <span className="ctx-bar" data-testid="repo-toggle">
    <button className="btn secondary" data-testid="repo-enable" disabled={c.busy} onClick={() => void c.run(() => call({ epoch, op: "code.repository.put", params: { owner, repo }, body: { enabled: !enabled } }), reload)}>{t(enabled === false ? "code.contract.enable" : "code.contract.disable")}</button>
    <button className="btn secondary" data-testid="repo-remove" disabled={c.busy} onClick={() => void c.run(() => call({ epoch, op: "code.repository.remove", params: { owner, repo } }), reload)}>{t("code.contract.remove")}</button>
    <ContractError code={c.error} />
  </span>;
}
