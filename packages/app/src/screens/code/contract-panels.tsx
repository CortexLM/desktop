import * as React from "react";
import type { ContractCall } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Icon, IconBtn, MItem, MSep, Pop } from "../../kit/ui";
import { useQuery } from "../../state/live";
import { ChipMenu } from "./parts";

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

// Machines Cloud (design: lot-security Machines): occupancy metrics, search + state filter, machine list, selected machine detail.
const STATES = ["all", "running", "hibernated", "stopped"] as const;
type Tree = { path: string; session_id?: string; branch?: string };
const slug = (r: Row) => { const u = String(r.repo_url ?? ""); return /github\.com[/:]([^/]+\/[^/?#]+?)(?:\.git)?(?:[/?#]|$)/.exec(u)?.[1] ?? (u || String(r.id)); };
export function LiveRuntimeAdmin({ epoch }: { epoch: string }) {
  const t = useT(), c = useContract();
  const runtimes = useQuery(() => call<{ items: Row[] }>({ epoch, op: "code.runtimes" }), [epoch]);
  const [filter, setFilter] = React.useState<string>("all"), [query, setQuery] = React.useState(""), [selected, setSelected] = React.useState("");
  const all = runtimes.state === "ready" ? runtimes.data.items : [];
  const trees = (r: Row) => Array.isArray(r.worktrees) ? r.worktrees as Tree[] : [];
  const items = all.filter(r => (filter === "all" || r.status === filter) && slug(r).toLowerCase().includes(query.trim().toLowerCase()));
  const current = items.find(r => r.id === selected) ?? items[0];
  const used = all.reduce((n, r) => n + trees(r).length, 0), max = all.reduce((n, r) => n + Number(r.max_worktrees ?? 1), 0);
  return <section className="code-machines" data-testid="live-machines">
    <div className="code-machines-head"><div><h1>{t("code.machines.heading")}</h1><p>{t("code.machines.lead")}</p></div>
      <button className="btn secondary" data-testid="machines-refresh" disabled={runtimes.state === "loading"} onClick={runtimes.reload}><Icon name="refresh" size={16} />{t("code.machines.refresh")}</button></div>
    {runtimes.state === "error" ? <div className="empty code-machines-empty"><Icon name="cpu" /><h2>{t("code.contract.error.other")}</h2><button className="btn secondary" onClick={runtimes.reload}>{t("code.retry")}</button></div>
      : runtimes.state === "ready" && !all.length ? <div className="empty code-machines-empty" data-testid="machines-none"><Icon name="cpu" /><h2>{t("code.machines.emptyTitle")}</h2><p>{t("code.machines.emptyBody")}</p></div>
      : runtimes.state === "ready" && <>
        <dl className="code-metrics">
          <div><dt>{t("code.machines.count")}</dt><dd data-testid="machines-count">{all.length}</dd></div>
          <div><dt>{t("code.machines.busy")}</dt><dd data-testid="machines-busy">{used}</dd></div>
          <div><dt>{t("code.machines.free")}</dt><dd>{Math.max(0, max - used)}</dd></div>
        </dl>
        <div className="code-toolbar">
          <label className="code-search"><Icon name="search" size={16} /><input type="search" data-testid="machines-search" aria-label={t("code.machines.search")} placeholder={t("code.machines.search")} value={query} onChange={e => setQuery(e.target.value)} /></label>
          <ChipMenu testId="machines-filter" ariaLabel={t("code.machines.state")} label={t(`code.contract.machine.${filter}`)} value={filter} items={STATES.map(k => ({ value: k, label: t(`code.contract.machine.${k}`) }))} onChange={setFilter} />
        </div>
        {!items.length ? <p className="code-hint" data-testid="machines-empty">{t("code.contract.noMachines")}</p> : <ul className="code-mlist">{items.map(r => {
          const n = trees(r).length, cap = Number(r.max_worktrees ?? 1);
          return <li key={String(r.id)}><button className="code-mrow" data-testid="machine-row" data-status={String(r.status)} aria-pressed={current?.id === r.id} onClick={() => setSelected(String(r.id))}>
            <Icon name="cpu" /><span className="code-grow"><b className="code-ell">{slug(r)}</b><small>{t("code.machines.spec", { cpu: Number(r.vcpus ?? 0), mem: Math.round(Number(r.memory_mib ?? 0) / 1024) })}</small></span>
            <span className="code-mrow-end"><MachineBadge status={String(r.status)} /><small data-testid="machine-capacity">{t("code.contract.worktrees", { used: n, max: cap })}</small></span>
          </button></li>;
        })}</ul>}
        {current && <MachineDetail key={String(current.id)} epoch={epoch} runtime={current} trees={trees(current)} reload={runtimes.reload} c={c} />}
      </>}
    <ContractError code={c.error} />
  </section>;
}

const TONE: Record<string, string> = { running: "ok", requested: "run", stopping: "run", failed: "err" };
function MachineBadge({ status }: { status: string }) {
  const t = useT();
  return <span className={"badge " + (TONE[status] ?? "code-mute")}>{t(`code.contract.machine.${["running", "hibernated", "stopped", "requested", "snapshotted", "stopping", "failed"].includes(status) ? status : "stopped"}`)}</span>;
}

function MachineDetail({ epoch, runtime, trees, reload, c }: { epoch: string; runtime: Row; trees: Tree[]; reload: () => void; c: ReturnType<typeof useContract> }) {
  const t = useT(), id = String(runtime.id), cap = Number(runtime.max_worktrees ?? 1);
  const [open, setOpen] = React.useState(false), [name, setName] = React.useState(""), [value, setValue] = React.useState(""), [hosts, setHosts] = React.useState("");
  const secrets = useQuery(async () => open ? call<{ items: { name: string }[] }>({ epoch, op: "code.secrets", params: { runtime: id } }) : { items: [] }, [open, epoch, id]);
  const egress = useQuery(async () => open ? call<{ allow: string[] }>({ epoch, op: "code.egress", params: { runtime: id } }) : { allow: [] }, [open, epoch, id]);
  React.useEffect(() => { if (egress.state === "ready") setHosts(egress.data.allow.join(", ")); }, [egress.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const life = (action: "resume" | "hibernate") => void c.run(() => call({ epoch, op: "code.runtime.lifecycle", params: { runtime: id }, body: { action } }), reload);
  return <section className="code-mdetail" data-testid="machine-detail">
    <div className="code-card-row"><h2 className="h3 code-grow">{t("code.machines.worktrees", { name: slug(runtime) })}</h2><span className="code-meta code-num">{trees.length}/{cap}</span></div>
    <meter className="code-mmeter" min={0} max={cap} value={trees.length} aria-label={t("code.contract.worktrees", { used: trees.length, max: cap })} />
    {trees.length ? <div className="list">{trees.map(w => <div key={w.path} className="li"><Icon name="git-branch" size={16} /><span className="grow"><span className="ttl mono code-ell">{w.branch || w.path}</span><span className="sub mono">{w.path}</span></span><span className="code-meta">{t(w.session_id ? "code.machines.linked" : "code.machines.noSession")}</span></div>)}</div>
      : <p className="code-hint">{t("code.machines.noTrees")}</p>}
    <div className="code-row-gap code-mactions">
      {runtime.status === "running"
        ? <button className="btn secondary" data-testid="machine-sleep" disabled={c.busy} onClick={() => life("hibernate")}><Icon name="pause" size={16} />{t("code.contract.sleep")}</button>
        : <button className="btn secondary" data-testid="machine-wake" disabled={c.busy} onClick={() => life("resume")}><Icon name="play" size={16} />{t("code.contract.wake")}</button>}
      <button className="btn secondary" data-testid="machine-open" aria-expanded={open} onClick={() => setOpen(v => !v)}><Icon name="settings" size={16} />{t("code.contract.configure")}</button>
      <div className="spacer" />
      <button className="btn secondary code-danger" data-testid="machine-delete" disabled={c.busy} onClick={() => { if (confirm(t("code.contract.deleteConfirm"))) void c.run(() => call({ epoch, op: "code.runtime.remove", params: { runtime: id } }), reload); }}><Icon name="trash" size={16} />{t("code.contract.delete")}</button>
    </div>
    {open && <div className="code-machine-detail">
      <h3 className="h3">{t("code.contract.secretName")}</h3>
      {secrets.state === "ready" && secrets.data.items.length > 0 && <div className="list">{secrets.data.items.map(s => <div key={s.name} className="li code-secret" data-testid="secret-row"><Icon name="key" size={16} /><span className="grow mono">{s.name}</span>
        <button className="btn secondary" data-testid="secret-remove" disabled={c.busy} onClick={() => void c.run(() => call({ epoch, op: "code.secrets.remove", params: { runtime: id, secret: s.name } }), secrets.reload)}>{t("code.contract.remove")}</button></div>)}</div>}
      <form className="code-row-gap" onSubmit={e => { e.preventDefault(); void c.run(() => call({ epoch, op: "code.secrets.put", params: { runtime: id, secret: name }, body: { value } }), () => { setName(""); setValue(""); secrets.reload(); }); }}>
        <input className="input mono" data-testid="secret-name" aria-label={t("code.contract.secretName")} placeholder={t("code.contract.secretName")} value={name} onChange={e => setName(e.target.value.toUpperCase())} />
        <input className="input code-grow" type="password" autoComplete="off" data-testid="secret-value" aria-label={t("code.contract.secretValue")} placeholder={t("code.contract.secretValue")} value={value} onChange={e => setValue(e.target.value)} />
        <button className="btn primary" data-testid="secret-save" disabled={c.busy || !name || !value}>{t("code.contract.save")}</button>
      </form>
      <h3 className="h3">{t("code.contract.egress")}</h3>
      <form className="code-row-gap" onSubmit={e => { e.preventDefault(); void c.run(() => call({ epoch, op: "code.egress.put", params: { runtime: id }, body: { allow: hosts.split(/[\s,]+/).filter(Boolean), confirm: true } }), egress.reload); }}>
        <input className="input code-grow mono" data-testid="egress-hosts" aria-label={t("code.contract.egress")} value={hosts} onChange={e => setHosts(e.target.value)} />
        <button className="btn primary" data-testid="egress-save" disabled={c.busy}>{t("code.contract.save")}</button>
      </form>
    </div>}
  </section>;
}

export function LiveRepoToggle({ epoch, fullName, enabled, reload }: { epoch: string; fullName: string; enabled?: boolean; reload: () => void }) {
  const t = useT(), c = useContract(), [owner, repo] = fullName.split("/") as [string, string];
  return <span className="code-row-gap" data-testid="repo-toggle">
    <Pop align="end" width={220} trigger={<IconBtn icon="more-horizontal" data-testid="repo-menu" disabled={c.busy} label={t("code.optionsOf", { name: fullName })} />}>
      <MItem icon={enabled === false ? "play" : "pause"} onClick={() => void c.run(() => call({ epoch, op: "code.repository.put", params: { owner, repo }, body: { enabled: enabled === false } }), reload)}>{t(enabled === false ? "code.contract.enable" : "code.contract.disable")}</MItem>
      <MSep /><MItem icon="trash" danger onClick={() => void c.run(() => call({ epoch, op: "code.repository.remove", params: { owner, repo } }), reload)}>{t("code.contract.remove")}</MItem>
    </Pop>
    <ContractError code={c.error} />
  </span>;
}
