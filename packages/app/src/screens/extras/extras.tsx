// Workspace extras (design lot-workspace-extras.tsx) on the real trunk routes through the main-process contract
// transport: /v1/task-plans, /v1/approval-policy and /v1/orgs. Widgets have no producer route, so they show their
// honest unavailable state (as the web app does). The local browser screen lives in browser.tsx.
import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { ContractCall } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { useNav } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { Icon, IconBtn, Pop, MItem } from "../../kit/ui";
import "./extras.css";

const R = "workspace-extras";
type Plan = { id: string; title: string; status: "draft" | "in_progress" | "done"; step_count: number; done_count: number; steps?: Step[] };
type Step = { id: string; sequence: number; title: string; status: StepStatus; note?: string };
type StepStatus = "pending" | "in_progress" | "done" | "skipped";
type Mode = "ask" | "always_ask";
type Policy = Record<string, Record<string, Mode>>;
const STEP: StepStatus[] = ["pending", "in_progress", "done", "skipped"];
const VERBS = ["read", "edit", "shell", "pay"], SURFACES = ["chat", "code", "bot"];
const LINKS: [string, string, string][] = [["library-dashboard", "widgets", "projects"], ["planning", "planning", "history"], ["browser-authorization", "browser", "globe"], ["settings-organisation", "organisation", "agent"], ["settings-approvals", "approvals", "shield-check"], ["whats-new", "whatsNew", "info"]];
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const codeOf = (e: unknown) => typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "provider_error";
const call = async <T,>(c: ContractCall) => (await api.code.contract(c)).data as T;
const settled = (s: StepStatus) => s === "done" || s === "skipped";

/** Signed-in remote owner epoch; null while local or signed out. */
function useOwner() {
  const connection = useQuery(() => api.connection.get(), []);
  const remote = connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn;
  const owner = useQuery(async () => remote ? (await api.code.models()).epoch : null, [remote]);
  return connection.state === "error" || owner.state === "error" ? { state: "error" as const, reload: () => { connection.reload(); owner.reload(); } }
    : connection.state !== "ready" || owner.state !== "ready" ? { state: "loading" as const } : owner.data ? { state: "ready" as const, epoch: owner.data } : { state: "local" as const };
}

export function Page({ title, back, action, children }: { title: string; back?: string; action?: React.ReactNode; children: React.ReactNode }) {
  const t = useT(), { go } = useNav();
  return <div className={R}><div className="content-top">{back && <IconBtn icon="arrow-left" label={t("extras.back")} onClick={() => go(back)} />}<span className="title">{title}</span><div className="spacer" />{action}
    <Pop align="end" trigger={<button className="ibtn" aria-label={t("extras.more")}><Icon name="more-dots" /></button>}>{LINKS.map(([route, k, icon]) => <MItem key={route} icon={icon} onClick={() => go(route)}>{t(`extras.link.${k}`)}</MItem>)}</Pop></div>
    <div className={`page ${R}-page`}><div className={`${R}-body`}>{children}</div></div></div>;
}
function Notice({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return <div className={`${R}-notice`} role={error ? "alert" : "status"} data-error={error || undefined}><Icon name={error ? "alert-triangle" : "info"} /><div>{children}</div></div>;
}
export function Empty({ title, icon = "history", action, children }: { title: string; icon?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className={`${R}-empty`}><Icon name={icon} /><h2>{title}</h2><p>{children}</p>{action}</section>;
}
function Skeleton() {
  const t = useT();
  return <div className={`${R}-skeleton`} aria-busy="true" aria-label={t("extras.loading")}><span className="skel title" />{[0, 1, 2].map(n => <div key={n}><span className="skel line" /><span className="skel line" /></div>)}</div>;
}
function Failed({ code, retry }: { code?: string; retry: () => void }) {
  const t = useT();
  const denied = code === "permission_denied";
  return <Empty icon={denied ? "key" : "alert-triangle"} title={t(denied ? "extras.denied.title" : "extras.failed.title")} action={!denied && <button className="btn secondary" data-testid="extras-retry" onClick={retry}>{t("extras.retry")}</button>}>{t(denied ? "extras.denied.body" : "extras.failed.body")}</Empty>;
}
/** Renders children with the owner epoch, or the signed-out / loading / failure state. */
function Owned({ owner: given, children }: { owner?: ReturnType<typeof useOwner>; children: (epoch: string) => React.ReactNode }) {
  const t = useT(), { go } = useNav(), own = useOwner(), owner = given ?? own;
  if (owner.state === "loading") return <Skeleton />;
  if (owner.state === "error") return <Failed retry={owner.reload} />;
  if (owner.state === "local") return <Empty icon="key" title={t("extras.signedOut.title")} action={<button className="btn primary" data-testid="extras-sign-in" onClick={() => go("settings", { v: "connection" })}>{t("extras.signedOut.action")}</button>}>{t("extras.signedOut.body")}</Empty>;
  return <>{children(owner.epoch)}</>;
}
function Modal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; children: React.ReactNode }) {
  const t = useT();
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className={`backdrop ${R}-backdrop`} /><Dialog.Popup className={`dialog ${R}-dialog ${R}`}>
    <div className={`${R}-heading`}><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="ibtn" aria-label={t("extras.close")}><Icon name="close" /></Dialog.Close></div><Dialog.Description>{description}</Dialog.Description>{children}</Dialog.Popup></Dialog.Portal></Dialog.Root>;
}
function useAction() {
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState<string>();
  const run = async (action: () => Promise<unknown>, done?: () => void) => {
    if (busy) return false; setBusy(true); setError(undefined);
    try { await action(); done?.(); return true; } catch (e) { setError(codeOf(e)); return false; } finally { setBusy(false); }
  };
  return { busy, error, run };
}
function ActionError({ code }: { code?: string }) {
  const t = useT();
  return code ? <Notice error><span data-testid="extras-error" data-code={code}>{t(`extras.error.${["not_found", "conflict", "permission_denied", "invalid_request"].includes(code) ? code : "other"}`)}</span></Notice> : null;
}
const statusBadge = (s: string) => s === "done" ? "ok" : s === "in_progress" ? "run" : "";

export function Widgets() {
  const t = useT(), { go } = useNav();
  return <Page title={t("extras.widgets.title")} action={<button className="btn secondary" onClick={() => go("planning")}><Icon name="history" />{t("extras.link.planning")}</button>}>
    <h1>{t("extras.widgets.h1")}</h1><p className={`${R}-lead`}>{t("extras.widgets.lead")}</p>
    <Empty icon="projects" title={t("extras.widgets.emptyTitle")} action={<button className="btn primary" data-testid="widgets-new-chat" onClick={() => go("home")}>{t("extras.widgets.emptyAction")}</button>}>{t("extras.widgets.emptyBody")}</Empty>
  </Page>;
}

export function Planning() {
  const t = useT(), { go } = useNav();
  const [creating, setCreating] = React.useState(false), owner = useOwner();
  return <Page title={t("extras.link.planning")} action={owner.state === "ready" && <button className="btn primary" data-testid="plan-new" onClick={() => setCreating(true)}><Icon name="plus" />{t("extras.plan.new")}</button>}>
    <h1>{t("extras.plan.h1")}</h1><p className={`${R}-lead`}>{t("extras.plan.lead")}</p>
    <Owned owner={owner}>{epoch => <PlanList epoch={epoch} creating={creating} setCreating={setCreating} open={id => go("planning-detail", { plan: id })} />}</Owned>
  </Page>;
}

function PlanList({ epoch, creating, setCreating, open }: { epoch: string; creating: boolean; setCreating: (o: boolean) => void; open: (id: string) => void }) {
  const t = useT(), a = useAction();
  const list = useQuery(() => call<{ items: Plan[] }>({ epoch, op: "plans.list" }), [epoch]);
  const [q, setQ] = React.useState(""), [filter, setFilter] = React.useState("all");
  const [title, setTitle] = React.useState(""), [steps, setSteps] = React.useState("");
  if (list.state === "loading") return <Skeleton />;
  if (list.state === "error") return <Failed code={list.code} retry={list.reload} />;
  const shown = list.data.items.filter(p => norm(p.title).includes(norm(q)) && (filter === "all" || p.status === filter));
  const create = (e: React.FormEvent) => {
    e.preventDefault(); if (!title.trim()) return;
    const lines = steps.split("\n").map(s => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
    void a.run(() => call<Plan>({ epoch, op: "plans.create", body: { title: title.trim(), steps: lines } }), () => { setCreating(false); setTitle(""); setSteps(""); list.reload(); });
  };
  return <>
    <div className={`${R}-toolbar`}><label className={`${R}-search`}><Icon name="search" /><input type="search" aria-label={t("extras.plan.search")} placeholder={t("extras.plan.search")} value={q} onChange={e => setQ(e.target.value)} /></label>
      <label>{t("extras.plan.status")} <select className="input" data-testid="plan-filter" value={filter} onChange={e => setFilter(e.target.value)}>{["all", "draft", "in_progress", "done"].map(f => <option key={f} value={f}>{t(`extras.plan.filter.${f}`)}</option>)}</select></label></div>
    {shown.length ? <ul className={`${R}-plan-list`} data-testid="plan-list">{shown.map(p => <li key={p.id}><button data-testid="plan-row" data-plan={p.id} onClick={() => open(p.id)}><Icon name="history" /><span className={`${R}-grow`}><strong>{p.title}</strong><small>{t("extras.plan.progress", { done: p.done_count, total: p.step_count })}</small></span><span className={`badge ${statusBadge(p.status)}`}>{t(`extras.plan.filter.${p.status}`)}</span><Icon name="chevron-right" /></button></li>)}</ul>
      : <Empty title={t(q || filter !== "all" ? "extras.plan.noMatch" : "extras.plan.emptyTitle")} action={q || filter !== "all" ? <button className="btn secondary" onClick={() => { setQ(""); setFilter("all"); }}>{t("extras.plan.clear")}</button> : <button className="btn secondary" onClick={() => setCreating(true)}>{t("extras.plan.new")}</button>}>{t(q || filter !== "all" ? "extras.plan.noMatchBody" : "extras.plan.emptyBody")}</Empty>}
    <p className={`${R}-footnote`}>{t("extras.plan.count", { count: shown.length })}</p>
    <Modal open={creating} onOpenChange={o => { if (!a.busy) setCreating(o); }} title={t("extras.plan.new")} description={t("extras.plan.dialog")}>
      <form onSubmit={create}><label className="field">{t("extras.plan.titleLabel")}<input className="input" data-testid="plan-title" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} disabled={a.busy} autoFocus /></label>
        <label className="field">{t("extras.plan.stepsLabel")}<textarea className="input" data-testid="plan-steps" rows={5} value={steps} onChange={e => setSteps(e.target.value)} disabled={a.busy} /></label>
        <ActionError code={a.error} />
        <div className={`${R}-actions`}><button type="button" className="btn secondary" onClick={() => setCreating(false)}>{t("extras.cancel")}</button><button type="submit" className="btn primary" data-testid="plan-create" disabled={a.busy || !title.trim()}>{t("extras.plan.create")}</button></div></form>
    </Modal>
  </>;
}

export function PlanDetail() {
  const t = useT(), { params } = useNav();
  const id = params.get("plan") ?? "";
  return <Page title={t("extras.plan.detailTitle")} back="planning"><Owned>{epoch => /^tpl_[0-9A-Za-z]{26}$/.test(id) ? <PlanBody key={id} epoch={epoch} id={id} /> : <Missing />}</Owned></Page>;
}
function Missing() {
  const t = useT(), { go } = useNav();
  return <Empty icon="file" title={t("extras.plan.missing")} action={<button className="btn secondary" onClick={() => go("planning")}>{t("extras.plan.all")}</button>}>{t("extras.plan.missingBody")}</Empty>;
}
function PlanBody({ epoch, id }: { epoch: string; id: string }) {
  const t = useT(), { go } = useNav(), a = useAction();
  const plan = useQuery(() => call<Plan>({ epoch, op: "plans.get", params: { plan: id } }), [epoch, id]);
  const [selected, setSelected] = React.useState(""), [newStep, setNewStep] = React.useState(""), [remove, setRemove] = React.useState<Step | "plan" | null>(null);
  if (plan.state === "loading") return <Skeleton />;
  if (plan.state === "error") return plan.code === "not_found" ? <Missing /> : <Failed code={plan.code} retry={plan.reload} />;
  const p = plan.data, steps = p.steps ?? [], done = steps.filter(s => settled(s.status)).length, step = steps.find(s => s.id === selected);
  const patch = (s: Step, status: StepStatus) => a.run(() => call({ epoch, op: "plans.step.update", params: { plan: id, step: s.id }, body: { status } }), plan.reload);
  return <>
    <h1>{p.title}</h1><p className={`${R}-lead`}>{t("extras.plan.detailLead")}</p>
    <div className={`${R}-section-head`}><span className={`badge ${statusBadge(p.status)}`} data-testid="plan-status" data-status={p.status}>{t(`extras.plan.filter.${p.status}`)}</span><code>{p.id}</code><span className={`${R}-grow`} /><button className="btn secondary" data-testid="plan-delete" disabled={a.busy} onClick={() => setRemove("plan")}><Icon name="trash" />{t("extras.plan.delete")}</button></div>
    <label className={`${R}-progress`}>{t("extras.plan.progress", { done, total: steps.length })}<progress value={done} max={Math.max(1, steps.length)} /></label>
    {steps.length ? <ol className={`${R}-steps`}>{steps.map((s, i) => <li key={s.id} data-testid="plan-step" data-status={s.status} data-selected={s.id === selected || undefined}>
      <button className={`${R}-tick`} data-testid="step-tick" aria-pressed={settled(s.status)} aria-label={t(settled(s.status) ? "extras.step.reopen" : "extras.step.finish", { title: s.title })} disabled={a.busy} onClick={() => void patch(s, settled(s.status) ? "pending" : "done")}>{s.status !== "pending" && <Icon name={s.status === "done" ? "check-circle" : s.status === "skipped" ? "arrow-right" : "clock-loop"} />}</button>
      <button className={`${R}-step-open`} onClick={() => setSelected(s.id)}><span className={`${R}-muted`}>{t("extras.step.n", { n: i + 1 })}</span><strong>{s.title}</strong></button><span className={`badge ${statusBadge(s.status)}`}>{t(`extras.step.${s.status}`)}</span>
    </li>)}</ol> : <Empty title={t("extras.plan.noSteps")}>{t("extras.plan.noStepsBody")}</Empty>}
    {step && <section className={`${R}-step-detail`} aria-label={t("extras.step.detail")}><div className={`${R}-section-head`}><h2>{step.title}</h2><IconBtn icon="close" label={t("extras.close")} onClick={() => setSelected("")} /></div><p>{step.note ?? t("extras.step.noNote")}</p>
      <div className={`${R}-actions`}><label className={`${R}-inline-field`}>{t("extras.plan.status")}<select className="input" data-testid="step-status" disabled={a.busy} value={step.status} onChange={e => { const v = e.target.value as StepStatus; if (STEP.includes(v)) void patch(step, v); }}>{STEP.map(s => <option key={s} value={s}>{t(`extras.step.${s}`)}</option>)}</select></label>
        <button className="btn secondary" data-testid="step-delete" disabled={a.busy} onClick={() => setRemove(step)}><Icon name="trash" />{t("extras.step.delete")}</button></div></section>}
    <form className={`${R}-add-step`} onSubmit={e => { e.preventDefault(); if (!newStep.trim()) return; void a.run(() => call({ epoch, op: "plans.step.add", params: { plan: id }, body: { title: newStep.trim() } }), () => { setNewStep(""); plan.reload(); }); }}>
      <label className="field">{t("extras.step.new")}<input className="input" data-testid="step-new" value={newStep} onChange={e => setNewStep(e.target.value)} maxLength={500} disabled={a.busy} placeholder={t("extras.step.placeholder")} /></label>
      <button type="submit" className="btn primary" data-testid="step-add" disabled={a.busy || !newStep.trim()}>{t("extras.step.add")}</button></form>
    <ActionError code={a.error} />
    <Modal open={!!remove} onOpenChange={o => { if (!o && !a.busy) setRemove(null); }} title={t(remove === "plan" ? "extras.plan.deleteTitle" : "extras.step.deleteTitle")} description={remove === "plan" ? p.title : remove?.title ?? ""}>
      <div className={`${R}-actions`}><button className="btn secondary" onClick={() => setRemove(null)}>{t("extras.keep")}</button><button className="btn primary" data-testid="confirm-delete" disabled={a.busy} onClick={() => {
        if (remove === "plan") void a.run(() => call({ epoch, op: "plans.remove", params: { plan: id } }), () => go("planning"));
        else if (remove) void a.run(() => call({ epoch, op: "plans.step.remove", params: { plan: id, step: remove.id } }), () => { setRemove(null); setSelected(""); plan.reload(); });
      }}>{t("extras.confirmDelete")}</button></div>
    </Modal>
  </>;
}

function SettingsFrame({ kind, children }: { kind: string; children: React.ReactNode }) {
  const t = useT(), { go } = useNav();
  const k = LINKS.find(([route]) => route === kind)![1];
  return <Page title={t("extras.settings.title", { section: t(`extras.link.${k}`) })}>
    <div className={`${R}-settings`}><nav aria-label={t("extras.settings.sections")}><h2>{t("extras.settings.heading")}</h2>{LINKS.filter(([route]) => route.startsWith("settings-") || route === "whats-new").map(([route, key, icon]) => <button key={route} data-testid={`extras-nav-${route}`} aria-current={route === kind ? "page" : undefined} onClick={() => { if (route !== kind) go(route); }}><Icon name={icon} />{t(`extras.link.${key}`)}</button>)}</nav>
      <section className={`${R}-settings-pane`}><div className={`${R}-settings-scroll`}>{children}</div></section></div>
  </Page>;
}

export function Organisation() {
  const t = useT();
  return <SettingsFrame kind="settings-organisation"><h2>{t("extras.org.h2")}</h2><p className={`${R}-lead`}>{t("extras.org.lead")}</p>
    <Owned>{epoch => <OrgList epoch={epoch} />}</Owned></SettingsFrame>;
}
function OrgList({ epoch }: { epoch: string }) {
  const t = useT();
  // The trunk has no /v1/orgs route yet: any refusal is "unavailable", never an invented personal workspace.
  const orgs = useQuery(() => call<{ items?: { id: string; name: string; role: string }[] }>({ epoch, op: "orgs.list" }), [epoch]);
  if (orgs.state === "loading") return <Skeleton />;
  const items = orgs.state === "ready" && Array.isArray(orgs.data?.items) ? orgs.data.items.filter(o => typeof o?.name === "string") : null;
  if (!items) return <Empty icon="agent" title={t("extras.org.unavailable")} action={<button className="btn secondary" data-testid="extras-retry" onClick={orgs.reload}>{t("extras.retry")}</button>}><span data-testid="org-unavailable">{t("extras.org.unavailableBody")}</span></Empty>;
  if (!items.length) return <Empty icon="agent" title={t("extras.org.none")}>{t("extras.org.noneBody")}</Empty>;
  return <ul className={`${R}-people`}>{items.map(o => <li key={o.id}><span className={`${R}-avatar`}>{o.name.split(" ").map(s => s[0]).slice(0, 2).join("")}</span><span className={`${R}-grow`}><strong>{o.name}</strong></span><span>{t(`extras.org.role.${["owner", "admin"].includes(o.role) ? o.role : "member"}`)}</span></li>)}</ul>;
}

export function Approvals() {
  const t = useT();
  return <SettingsFrame kind="settings-approvals"><h2>{t("extras.appr.h2")}</h2><p className={`${R}-lead`}>{t("extras.appr.lead")}</p>
    <Owned>{epoch => <PolicyMatrix epoch={epoch} />}</Owned></SettingsFrame>;
}
function PolicyMatrix({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav(), a = useAction();
  const read = useQuery(() => call<{ policy: Policy }>({ epoch, op: "policy.get" }), [epoch]);
  const [draft, setDraft] = React.useState<Policy>(), [diff, setDiff] = React.useState<unknown>(), [saved, setSaved] = React.useState(false);
  if (read.state === "loading") return <Skeleton />;
  if (read.state === "error") return <Failed code={read.code} retry={read.reload} />;
  const stored = read.data.policy, policy = draft ?? stored;
  const mode = (p: Policy, v: string, s: string): Mode => p?.[v]?.[s] === "always_ask" ? "always_ask" : "ask";
  const dirty = VERBS.some(v => SURFACES.some(s => mode(policy, v, s) !== mode(stored, v, s)));
  const set = (v: string, s: string, m: Mode) => { setSaved(false); setDraft(Object.fromEntries(VERBS.map(x => [x, Object.fromEntries(SURFACES.map(y => [y, x === v && y === s ? m : mode(policy, x, y)]))]))); };
  return <>
    <div className={`${R}-tabs`} role="group" aria-label={t("extras.appr.tabs")}><button aria-pressed="true">{t("extras.appr.policy")}</button><button aria-pressed="false" data-testid="appr-requests" onClick={() => go("approvals")}>{t("extras.appr.requests")}</button></div>
    <div className={`${R}-matrix-wrap`}><table className={`${R}-matrix`} data-testid="policy-matrix"><caption>{t("extras.appr.caption")}</caption><thead><tr><th scope="col">{t("extras.appr.action")}</th>{SURFACES.map(s => <th key={s} scope="col">{t(`extras.appr.surface.${s}`)}</th>)}</tr></thead>
      <tbody>{VERBS.map(v => <tr key={v}><th scope="row">{t(`extras.appr.verb.${v}`)}</th>{SURFACES.map(s => <td key={s}>{v === "pay" ? <span className={`${R}-locked`}><Icon name="key" />{t("extras.appr.mode.always_ask")}</span>
        : <select className="input" data-testid={`policy-${v}-${s}`} aria-label={t("extras.appr.cell", { verb: t(`extras.appr.verb.${v}`), surface: t(`extras.appr.surface.${s}`) })} disabled={a.busy} value={mode(policy, v, s)} onChange={e => { if (e.target.value === "ask" || e.target.value === "always_ask") set(v, s, e.target.value); }}>{(["ask", "always_ask"] as const).map(m => <option key={m} value={m}>{t(`extras.appr.mode.${m}`)}</option>)}</select>}</td>)}</tr>)}</tbody></table></div>
    <p className={`${R}-footnote`}>{t("extras.appr.footnote")}</p>
    <div className={`${R}-actions`}><button className="btn secondary" disabled={!dirty || a.busy} onClick={() => setDraft(undefined)}>{t("extras.appr.discard")}</button>
      <button className="btn primary" data-testid="policy-save" disabled={!dirty || a.busy} onClick={() => void a.run(() => call({ epoch, op: "policy.put", body: { policy } }), () => { setDraft(undefined); setSaved(true); setDiff(undefined); read.reload(); })}>{t("extras.appr.save")}</button></div>
    {saved && <Notice><span data-testid="policy-saved">{t("extras.appr.saved")}</span></Notice>}
    <ActionError code={a.error} />
    <div className={`${R}-setting-row`}><div><h3>{t("extras.appr.diffTitle")}</h3><p>{t("extras.appr.diffBody")}</p></div><button className="btn secondary" data-testid="policy-diff" disabled={a.busy} onClick={() => diff ? setDiff(undefined) : void a.run(async () => setDiff(await call({ epoch, op: "policy.diff" })))}>{t(diff ? "extras.appr.hide" : "extras.appr.show")}</button></div>
    {diff !== undefined && <pre className={`${R}-code`} data-testid="policy-diff-body">{JSON.stringify(diff, null, 2)}</pre>}
  </>;
}

const NEWS = [{ id: "c0-batch-36", date: "2026-09-14" }];
const READ_KEY = "cortex.whatsNew.read";
export function WhatsNew() {
  const t = useT(), { go } = useNav();
  const [q, setQ] = React.useState("");
  const [read, setRead] = React.useState(() => localStorage.getItem(READ_KEY) ?? "");
  const entries = NEWS.map(n => ({ ...n, title: t(`extras.news.${n.id}.title`), body: t(`extras.news.${n.id}.body`) })).filter(n => norm(n.title + n.body).includes(norm(q)));
  return <SettingsFrame kind="whats-new"><h2>{t("extras.news.h2")}</h2><p className={`${R}-lead`}>{t("extras.news.lead")}</p>
    <label className={`${R}-search`}><Icon name="search" /><input type="search" aria-label={t("extras.news.search")} placeholder={t("extras.news.search")} value={q} onChange={e => setQ(e.target.value)} /></label>
    {entries.length ? <ol className={`${R}-news`}>{entries.map(n => <li key={n.id} data-testid="news-entry"><div className={`${R}-section-head`}><time dateTime={n.date}>{new Date(`${n.date}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: "long", timeZone: "UTC" })}</time><span className="badge">{t(read === n.id ? "extras.news.read" : "extras.news.catalog")}</span></div><h3>{n.title}</h3><p>{n.body}</p>
      <div className={`${R}-actions`}><button className="btn secondary" onClick={() => go("settings-organisation")}>{t("extras.news.toOrg")}</button><button className="btn primary" data-testid="news-mark-read" disabled={read === n.id} onClick={() => { localStorage.setItem(READ_KEY, n.id); setRead(n.id); }}>{t(read === n.id ? "extras.news.marked" : "extras.news.mark")}</button></div></li>)}</ol>
      : <p className={`${R}-empty-line`}>{t(q ? "extras.news.noMatch" : "extras.news.empty")}</p>}
  </SettingsFrame>;
}
