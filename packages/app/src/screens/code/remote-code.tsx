import * as React from "react";
import { CodeSessionPatch, type CodeFileView, type CodeSessionView, type CodeSnapshot, type RemoteModel } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Icon, IconBtn, Segmented } from "../../kit/ui";
import { useNav, readHash } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { useSendEnter } from "../../state/send-enter";
import { splitRows } from "./split-rows";
import { ChipMenu, LiveEmpty } from "./parts";
import { ContractError, useContract, LiveAttempts, LiveComments, LivePrReview, LiveRepoToggle, LiveResolve, LiveRuntimeAdmin, LiveSessionGrant } from "./contract-panels";

function useOwner(epoch = "") {
  const { entryKey, params } = useNav();
  const id = params.get("id"), routeEpoch = params.get("epoch");
  const token = React.useMemo(() => ({ entryKey, epoch, id, routeEpoch }), [entryKey, epoch, id, routeEpoch]);
  const current = React.useRef(token);
  const mounted = React.useRef(true);
  React.useLayoutEffect(() => { current.current = token; mounted.current = true; return () => { mounted.current = false; }; }, [token]);
  return () => { const route = readHash(); return mounted.current && current.current === token && route.entryKey === entryKey && route.params.get("id") === id && route.params.get("epoch") === routeEpoch; };
}

export function CodeConnection({ local, remote }: { local: React.ReactNode; remote?: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []);
  if (connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn) return remote ?? <RemoteCodeHome />;
  return local;
}

// Design composer: one rounded field, the model chip and the send button; Enter follows the send-key preference.
function CodeComposer({ models, model, setModel: onModel, text, setText, busy, send }: {
  models: RemoteModel[]; model: string; setModel?(value: string): void; text: string; setText(value: string): void; busy: boolean; send(): void;
}) {
  const t = useT(), enter = useSendEnter();
  const has = !!text.trim();
  const name = models.find(m => m.slug === model)?.name ?? t("code.remote.chooseModel");
  return <form className="composer code-composer" data-has-text={has || undefined} onSubmit={e => { e.preventDefault(); if (!busy && has && model) send(); }}>
    <textarea rows={1} data-testid="code-composer-input" aria-label={t("code.home.placeholder")} placeholder={t("code.home.placeholder")} value={text} onChange={e => setText(e.target.value)} {...enter.field} />
    <ChipMenu className="model" side="top" align="end" testId="code-model-picker" ariaLabel={t("code.remote.model")} label={name} value={model} disabled={busy || !onModel}
      items={models.map(m => ({ value: m.slug, label: m.name }))} onChange={v => onModel?.(v)} />
    <button className="send" data-testid="code-api-send" type="submit" data-has-text={has ? "" : undefined} aria-label={t("code.remote.send")} disabled={busy || !has || !model}><Icon name="arrow-up" /></button>
  </form>;
}

function RemoteCodeHome() {
  const t = useT(), { go } = useNav();
  const catalog = useQuery(() => api.code.models(), []), sessions = useQuery(() => api.code.list(), []), capabilities = useQuery(() => api.code.capabilities(), []);
  const owns = useOwner(catalog.state === "ready" ? catalog.data.epoch : "");
  const [runtime, setRuntime] = React.useState<"local" | "cloud">("local");
  const [model, setModel] = React.useState(""), [text, setText] = React.useState(""), [repo, setRepo] = React.useState(""), [branch, setBranch] = React.useState("");
  const [filter, setFilter] = React.useState<StatusFilter>("all");
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false);
  // Default to the first model the producer lists; the picker still allows another one.
  const firstModel = catalog.state === "ready" ? catalog.data.models[0]?.slug ?? "" : "";
  React.useEffect(() => { if (firstModel) setModel(m => m || firstModel); }, [firstModel]);
  // No farm: cloud is refused before any request; the draft stays and nothing falls back to this computer.
  const cloudOff = capabilities.state === "ready" && !capabilities.data.cloud.available;
  const cloudRefused = runtime === "cloud" && cloudOff;
  const retained = React.useRef<{ id: string; epoch: string; runtime: string; model: string; repo: string; branch: string } | undefined>(undefined);
  const draft = React.useRef(text);
  const editText = (value: string) => { draft.current = value; setText(value); };
  const send = async () => {
    if (busy || catalog.state !== "ready" || cloudRefused) return;
    setBusy(true); setError(false);
    try {
      const stamp = `${runtime}:${model}:${repo}:${branch}`;
      let session = retained.current;
      if (!session || session.epoch !== catalog.data.epoch || `${session.runtime}:${session.model}:${session.repo}:${session.branch}` !== stamp) {
        const created = await api.code.create({ epoch: catalog.data.epoch, runtime, modelSlug: model, ...(runtime === "cloud" && repo.trim() ? { repo: repo.trim(), ...(branch ? { branch } : {}) } : {}) });
        if (!owns()) return;
        session = { id: created.id, epoch: created.epoch, runtime, model, repo, branch }; retained.current = session;
      }
      await api.code.prompt(session.id, { epoch: session.epoch, message: text });
      if (owns()) go("code-session", { source: "code-api", id: session.id, epoch: session.epoch, draft: draft.current, submitted: text });
    } catch { if (owns()) setError(true); }
    finally { if (owns()) setBusy(false); }
  };
  const envItems = [{ value: "local", label: t("code.remote.local"), hint: t("code.remote.localBody") }, { value: "cloud", label: t("code.remote.cloud"), hint: cloudOff ? t("code.home.cloudOff") : t("code.remote.cloudBody") }];
  const visible = sessions.state === "ready" ? sessions.data.filter(s => matches(filter, s.state)) : [];
  return <><div className="content-top"><div className="spacer" /><IconBtn icon="compose" label={t("code.newTask")} onClick={() => go("code")} /></div>
  <div className="home code-api">
    <h1>{t("code.home.title")}</h1>
    <CodeComposer models={catalog.state === "ready" ? catalog.data.models : []} model={model} setModel={setModel} text={text} setText={editText} busy={busy || cloudRefused} send={() => void send()} />
    <div className="ctx-bar" data-testid="code-context">
      {runtime === "cloud" && catalog.state === "ready" && <WorkspacePicker epoch={catalog.data.epoch} repo={repo} setRepo={v => { setRepo(v); setBranch(""); }} branch={branch} setBranch={setBranch} busy={busy} />}
      <ChipMenu icon={runtime === "cloud" ? "globe" : "cpu"} testId="code-env-picker" ariaLabel={t("code.remote.execution")} label={t(runtime === "cloud" ? "code.remote.cloud" : "code.remote.local")} value={runtime} disabled={busy} items={envItems} onChange={v => setRuntime(v === "cloud" ? "cloud" : "local")} />
    </div>
    {cloudRefused && <div className="banner warn code-home-note" role="status" data-testid="code-cloud-unavailable" data-reason={capabilities.state === "ready" ? capabilities.data.cloud.reason : undefined}><Icon name="info" size={16} /><span>{t("code.workspace.refused.code_compute_not_configured")}</span></div>}
    {(catalog.state === "error" || sessions.state === "error" || error) && <div className="banner err code-home-note" role="alert"><span className="grow">{t("code.remote.unavailable")}</span><button className="btn secondary" onClick={() => { catalog.reload(); sessions.reload(); }}>{t("code.retry")}</button></div>}
    {sessions.state === "ready" && sessions.data.length > 0 && <div className="tasks" data-testid="code-task-list">
      <div className="code-tasks-head"><span className="h3">{t("code.home.recent")}</span><div className="spacer" /><TaskFilter value={filter} onChange={setFilter} /></div>
      {!visible.length && <div className="code-hint" data-testid="code-tasks-no-match">{t("code.tasks.noMatchTitle")} <button className="code-link" onClick={() => setFilter("all")}>{t("code.tasks.clearFilters")}</button></div>}
      {visible.map((s, i) => <button className="task" key={s.id} style={{ ["--i" as string]: i }} data-testid="code-task" data-state={s.state} onClick={() => go("code-session", { source: "code-api", id: s.id, epoch: s.epoch })}>
        <span className="grow"><span className="ttl">{s.title || t("code.untitled")}</span><span className="sub">{[s.repo, t(s.runtime === "local" ? "code.remote.local" : "code.remote.cloud")].filter(Boolean).join(" · ")}</span></span>
        <StateBadge state={s.state} />
      </button>)}
    </div>}
  </div></>;
}

// Task list status filter over the producer session states.
type StatusFilter = "all" | "running" | "done" | "failed" | "cancelled";
const STATUS_OF: Partial<Record<CodeSessionView["state"], StatusFilter>> = { running: "running", connecting: "running", connected: "running", waiting: "running", permission_blocked: "running", completed: "done", failed: "failed", interrupted: "cancelled" };
const matches = (filter: StatusFilter, state: CodeSessionView["state"]) => filter === "all" || STATUS_OF[state] === filter;
const FILTER_LABEL: Record<StatusFilter, string> = { all: "code.tasks.filter.all", running: "code.tasks.filter.running", done: "code.status.done", failed: "code.tasks.filter.failed", cancelled: "code.status.cancelled" };
const BADGE: Record<StatusFilter, string> = { all: "code-mute", running: "run", done: "ok", failed: "err", cancelled: "code-mute" };
function StateBadge({ state }: { state: CodeSessionView["state"] }) {
  const t = useT(), f = STATUS_OF[state];
  return f ? <span className={"badge " + BADGE[f]}>{f === "running" && <span className="spin" />}{t(FILTER_LABEL[f])}</span> : null;
}
function TaskFilter({ value, onChange }: { value: StatusFilter; onChange(v: StatusFilter): void }) {
  const t = useT();
  return <ChipMenu testId="code-task-filter" align="end" ariaLabel={t("code.tasks.filterLabel")} label={t(FILTER_LABEL[value])} value={value}
    items={(Object.keys(FILTER_LABEL) as StatusFilter[]).map(f => ({ value: f, label: t(FILTER_LABEL[f]) }))} onChange={v => onChange(v as StatusFilter)} />;
}

// Cloud workspace chips over the producer's repositories and a repo's branches. A typed repository stays possible when
// the producer lists none (GitHub not connected and no earlier session); refusals are shown, never replaced by fixtures.
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
function WorkspacePicker({ epoch, repo, setRepo, branch, setBranch, busy }: { epoch: string; repo: string; setRepo(v: string): void; branch: string; setBranch(v: string): void; busy: boolean }) {
  const t = useT(), { go } = useNav();
  const repos = useQuery(() => api.code.repositories(epoch), [epoch]);
  const valid = REPO.test(repo.trim());
  const branches = useQuery(() => valid ? api.code.branches(epoch, repo.trim()) : Promise.resolve(undefined), [epoch, valid ? repo.trim() : ""]);
  const listed = repos.state === "ready" ? repos.data.items : [];
  const shortName = (r: string) => r.split("/").pop() || r;
  return <div className="code-pickers" data-testid="code-workspace-picker" data-github={repos.state === "ready" ? repos.data.githubState : repos.state}>
    {listed.length > 0
      ? <ChipMenu icon="folder-code" testId="code-repo-picker" ariaLabel={t("code.remote.repository")} label={repo ? shortName(repo) : t("code.remote.repoChoose")} value={repo} disabled={busy}
          items={listed.map(r => ({ value: r.fullName, label: r.fullName, hint: r.defaultBranch }))} onChange={setRepo} />
      : <label className="ctx code-ctx-input"><Icon name="folder-code" size={16} /><input data-testid="code-repo-input" aria-label={t("code.remote.repository")} placeholder={t("code.home.repoPlaceholder")} value={repo} disabled={busy} onChange={e => setRepo(e.target.value)} /></label>}
    {valid && branches.state === "ready" && branches.data && branches.data.items.length > 0 && <ChipMenu icon="git-branch" testId="code-branch-picker" ariaLabel={t("code.remote.prBranch")} label={branch || t("code.remote.branchDefault")} value={branch} disabled={busy}
      items={[{ value: "", label: t("code.remote.branchDefault") }, ...branches.data.items.map(b => ({ value: b, label: b }))]} onChange={setBranch} />}
    {repos.state === "ready" && !repos.data.githubConnected && <button type="button" className="ctx" data-testid="code-github-state" onClick={() => go("code-connect")}><Icon name="link" size={16} />{t("live.codeConnect.connect")}</button>}
    {(repos.state === "error" || (repos.state === "ready" && repos.data.githubError)) && <span className="code-chip-err" role="alert" data-testid="code-repos-error">{t("code.remote.reposFailed")}<button type="button" className="code-link" onClick={() => repos.reload()}>{t("code.retry")}</button></span>}
    {valid && (branches.state === "error" || (branches.state === "ready" && branches.data?.githubError)) && <span className="code-chip-err" role="alert" data-testid="code-branches-error">{t("code.remote.branchesFailed")}<button type="button" className="code-link" onClick={() => branches.reload()}>{t("code.retry")}</button></span>}
  </div>;
}

// LOCAL: the producer's configured developer workspace (no runtime row). Cloud: the owner's runtimes and images, read-only.
function SessionEnvironment({ epoch, runtime }: { epoch: string; runtime?: "local" | "cloud" }) {
  const t = useT();
  const env = useQuery(() => api.code.environment(epoch), [epoch]);
  if (env.state === "error") return <div className="banner err" role="alert" data-testid="code-env-error">{t("code.remote.unavailable")}</div>;
  if (env.state !== "ready") return null;
  return <div className="code-card code-kv" data-testid="code-environment" data-runtime={runtime} data-cloud={env.data.cloud.available ? "available" : "unavailable"}>
    <div><span>{t("code.remote.execution")}</span><b data-testid="code-env-runtime">{t(runtime === "local" ? "code.remote.local" : "code.remote.cloud")}</b></div>
    <div><span>{t("code.remote.cloud")}</span><b data-testid="code-env-cloud">{t(env.data.cloud.available ? "code.remote.envCloudReady" : "code.workspace.refused.code_compute_not_configured")}</b></div>
    {runtime === "local" && <p className="sub" data-testid="code-env-local">{t("code.remote.localBody")}</p>}
    {runtime === "cloud" && (env.data.runtimes.length ? env.data.runtimes.map(r => <div key={r.id} data-testid="code-env-runtime-row" data-status={r.status}><span className="mono">{r.repo_url}@{r.repo_ref}</span><b>{r.status} · {r.prepare_status}</b></div>) : <p className="sub" data-testid="code-env-no-runtime">{t("code.remote.envNoRuntime")}</p>)}
    <div><span>{t("code.remote.envImages")}</span><b data-testid="code-env-images">{env.data.images.length}</b></div>
  </div>;
}

// Draft PR preparation only: the title and branches are stored on the producer session; nothing is pushed or opened.
function PrDraft({ session, diff }: { session: CodeSnapshot["session"]; diff: string }) {
  const t = useT(), owns = useOwner();
  const [title, setTitle] = React.useState(session.title), [branch, setBranch] = React.useState(session.branch ?? ""), [base, setBase] = React.useState(session.baseBranch ?? "");
  const [state, setState] = React.useState<"idle" | "busy" | "saved" | "error">("idle");
  // Same branch rule as the producer; a bad name is refused here before any request.
  const badRef = (v: string) => !!v.trim() && !CodeSessionPatch.shape.branch.safeParse(v).success;
  const invalid = badRef(branch) || badRef(base);
  const files = [...diff.matchAll(/^diff --git a\/(\S+)/gm)].map(m => m[1]);
  const save = async () => {
    setState("busy");
    try { await api.code.prepare(session.id, { epoch: session.epoch, title: title.trim(), ...(branch.trim() ? { branch: branch.trim() } : {}), ...(base.trim() ? { baseBranch: base.trim() } : {}) }); if (owns()) setState("saved"); }
    catch { if (owns()) setState("error"); }
  };
  return <form className="code-prbody" data-testid="code-pr-draft" onSubmit={e => { e.preventDefault(); if (state !== "busy" && title.trim() && !invalid) void save(); }}>
    <p className="sub">{t("code.remote.prDraftBody")}</p>
    <label className="field">{t("code.pr.titleLabel")}<input className="input" data-testid="code-pr-title" value={title} maxLength={200} onChange={e => { setTitle(e.target.value); setState("idle"); }} /></label>
    <label className="field">{t("code.remote.prBranch")}<input className="input mono" data-testid="code-pr-branch" value={branch} maxLength={200} onChange={e => { setBranch(e.target.value); setState("idle"); }} /></label>
    <label className="field">{t("code.remote.prBase")}<input className="input mono" data-testid="code-pr-base" value={base} maxLength={200} onChange={e => { setBase(e.target.value); setState("idle"); }} /></label>
    <p className="sub" data-testid="code-pr-files" data-count={files.length}>{t("code.pr.files", { count: files.length })}</p>
    <div className="ctx-bar"><button className="btn primary" data-testid="code-pr-prepare" disabled={state === "busy" || !title.trim() || invalid} type="submit">{t("code.remote.prPrepare")}</button></div>
    {invalid && <div className="banner err" role="alert" data-testid="code-pr-invalid-ref">{t("code.remote.prInvalidRef")}</div>}
    {state === "saved" && <div className="banner" role="status" data-testid="code-pr-prepared">{t("code.remote.prPrepared")}</div>}
    {state === "error" && <div className="banner err" role="alert" data-testid="code-pr-error">{t("code.remote.unavailable")}</div>}
    {session.runtime === "cloud" && <OpenDraftPr session={session} title={title.trim()} ready={state === "saved"} />}
  </form>;
}

function OpenDraftPr({ session, title, ready }: { session: CodeSnapshot["session"]; title: string; ready: boolean }) {
  const t = useT(), c = useContract(), [pr, setPr] = React.useState<{ number: number; url: string }>();
  return <div className="ctx-bar" data-testid="code-pr-open-bar">
    <button className="btn secondary" type="button" data-testid="code-pr-open" disabled={c.busy || !ready || !!pr || !title} onClick={() => void c.run(async () => setPr((await api.code.contract({ epoch: session.epoch, op: "code.pr.open", params: { session: session.id }, body: { title } })).data as { number: number; url: string }))}>{t("code.contract.openDraftPr")}</button>
    {pr && <span className="code-meta" data-testid="code-pr-opened" data-number={pr.number}>{t("code.contract.prOpened", { n: pr.number })}</span>}
    <ContractError code={c.error} />
  </div>;
}

// Code settings against the signed-in producer; anything else keeps the local section.
export function CodeMachines() {
  const t = useT(), { go } = useNav();
  return <><div className="content-top"><IconBtn icon="arrow-left" label={t("code.machines.back")} onClick={() => go("code")} /><span className="title">{t("code.machines.title")}</span></div>
    <div className="page"><div className="code-wrap code-narrow"><RemoteCodeSettings section="machines" local={<SignInNeeded />} /></div></div></>;
}

// Shown where a section needs the signed-in Cortex account (cloud machines, repositories, usage).
export function SignInNeeded() {
  const t = useT(), { go } = useNav();
  return <div className="empty code-empty-sm" data-testid="code-sign-in-needed"><Icon name="cpu" size={20} /><h2>{t("code.settings.unavailableTitle")}</h2><p>{t("code.settings.unavailableBody")}</p>
    <button className="btn primary" onClick={() => go("connection")}>{t("live.connection.signIn")}</button></div>;
}

export function RemoteCodeSettings({ section, local }: { section: string; local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []);
  if (connection.state !== "ready") return null;
  if (connection.data.mode === "local" || !connection.data.signedIn || !["usage", "instructions", "approvals", "repos", "machines"].includes(section)) return local;
  return <RemoteSettingsBody section={section} local={local} />;
}

function RemoteSettingsBody({ section, local }: { section: string; local: React.ReactNode }) {
  const t = useT();
  const catalog = useQuery(() => api.code.models(), []);
  if (catalog.state === "error") return <div className="banner err" role="alert">{t("code.remote.unavailable")}</div>;
  if (catalog.state !== "ready") return null;
  const epoch = catalog.data.epoch;
  return section === "machines" ? <LiveRuntimeAdmin epoch={epoch} /> : section === "repos" ? <RemoteRepos epoch={epoch} /> : section === "usage" ? <RemoteUsage epoch={epoch} /> : section === "instructions" ? <RemoteInstructions epoch={epoch} /> : <><RemoteDefaultModel epoch={epoch} /><p className="code-hint" data-testid="code-approvals-local-scope">{t("code.remote.approvalsLocalScope")}</p>{local}</>;
}

function RemoteRepos({ epoch }: { epoch: string }) {
  const t = useT(), { go } = useNav();
  const repos = useQuery(() => api.code.repositories(epoch), [epoch]);
  if (repos.state === "error") return <div className="banner err" role="alert"><span className="grow">{t("code.remote.reposFailed")}</span><button className="btn secondary" onClick={repos.reload}>{t("code.retry")}</button></div>;
  if (repos.state !== "ready") return null;
  const d = repos.data, owner = (r: string) => r.split("/")[0] ?? r;
  return <div data-testid="code-repos-live" data-github={d.githubState}>
    <div className="code-card-row code-repos-head"><span className="code-meta code-grow">{t(d.githubConnected ? "live.codeConnect.github" : "live.codeConnect.noGithub")}</span>
      <button className="btn secondary code-h28" data-testid="code-repos-connect" onClick={() => go("code-connect")}><Icon name="plus" size={16} />{t(d.githubConnected ? "code.connectRepo" : "live.codeConnect.connect")}</button></div>
    {d.items.length ? <div className="list">{d.items.map(r => <div key={r.fullName} className="li" data-testid="code-repo-row">
      <span className="code-av code-av-org" data-tone={owner(r.fullName).length % 4} aria-hidden>{owner(r.fullName).slice(0, 2).toUpperCase()}</span>
      <span className="grow"><span className="ttl mono code-repo">{r.fullName}</span><span className="sub"><Icon name="git-branch" size={12} /> {[r.defaultBranch, t(r.private ? "live.private" : "live.public")].filter(Boolean).join(" · ")}</span></span>
      <LiveRepoToggle epoch={epoch} fullName={r.fullName} reload={repos.reload} />
    </div>)}</div>
      : <div className="empty code-empty-sm" data-testid="code-repos-empty"><Icon name="folder-code" size={20} /><h2>{t("code.settings.reposEmptyTitle")}</h2><p>{t("code.settings.reposEmptyBody")}</p></div>}
    <p className="code-hint">{t("code.settings.pushHint")}</p>
  </div>;
}

function RemoteUsage({ epoch }: { epoch: string }) {
  const t = useT();
  const usage = useQuery(() => api.code.usage(epoch), [epoch]);
  if (usage.state === "error") return <div className="banner err" role="alert" data-testid="code-usage-error">{t("code.remote.unavailable")}<button className="btn secondary" onClick={usage.reload}>{t("code.retry")}</button></div>;
  if (usage.state !== "ready") return null;
  const u = usage.data;
  return <div data-testid="code-usage" data-quantity={u.total_quantity}>
    <p className="code-lead">{t("code.remote.usagePeriod", { days: u.days })}</p>
    <div className="list">
      <div className="li"><span className="grow ttl">{t("code.remote.usageTotal")}</span><span className="code-meta code-num" data-testid="code-usage-total">{u.total_quantity}</span></div>
      {u.by_model.map(m => <div className="li" key={m.model_slug} data-testid="code-usage-model"><span className="grow mono">{m.model_slug}</span><span className="code-meta code-num">{t("code.remote.usageTokens", { input: m.input_tokens, output: m.output_tokens })}</span></div>)}
      {!u.by_model.length && <p className="sub" data-testid="code-usage-empty">{t("code.remote.usageEmpty")}</p>}
    </div>
  </div>;
}

function RemoteDefaultModel({ epoch }: { epoch: string }) {
  const t = useT();
  const settings = useQuery(() => api.code.settings(epoch), [epoch]);
  const [saving, setSaving] = React.useState(false), [failed, setFailed] = React.useState(false);
  if (settings.state === "error") return <div className="banner err" role="alert" data-testid="code-settings-error">{t("code.remote.unavailable")}</div>;
  if (settings.state !== "ready") return null;
  const choose = async (ref: string) => {
    setSaving(true); setFailed(false);
    try { await api.code.setDefaultModel(epoch, ref); settings.reload(); } catch { setFailed(true); } finally { setSaving(false); }
  };
  return <div className="list code-approval-defaults">
    <div className="li"><span className="grow"><span className="ttl">{t("code.settings.defaultModel")}</span><span className="sub">{t("code.settings.defaultModelSub")}</span></span>
      <ChipMenu className="btn secondary code-h28" align="end" testId="code-default-model" disabled={saving} ariaLabel={t("code.settings.defaultModel")} value={settings.data.defaultModel ?? ""}
        label={settings.data.models.find(m => m.ref === settings.data.defaultModel)?.name ?? t("code.remote.chooseModel")} items={settings.data.models.map(m => ({ value: m.ref, label: m.name }))} onChange={v => { if (v) void choose(v); }} /></div>
    {failed && <div className="banner err" role="alert" data-testid="code-default-model-error">{t("code.settings.rulesSaveFailed")}</div>}
  </div>;
}

// Read-only: the producer exposes the session workspace file read; it has no instructions write route.
function RemoteInstructions({ epoch }: { epoch: string }) {
  const t = useT();
  const sessions = useQuery(() => api.code.list(), []);
  const [id, setID] = React.useState("");
  const file = useQuery(() => id ? api.code.instructions(id, epoch) : Promise.resolve(undefined), [id, epoch]);
  if (sessions.state === "error") return <div className="banner err" role="alert">{t("code.remote.unavailable")}</div>;
  if (sessions.state !== "ready") return null;
  return <div data-testid="code-instructions">
    <p className="code-lead">{t("code.remote.instructionsLead")}</p>
    {sessions.data.length ? <ChipMenu className="btn secondary code-h28" icon="file-code" testId="code-instructions-session" ariaLabel={t("code.remote.instructionsSession")} value={id}
      label={sessions.data.find(x => x.id === id)?.title || t("code.remote.instructionsSession")}
      items={sessions.data.map(x => ({ value: x.id, label: x.title || t("code.untitled"), hint: [x.repo, t(x.runtime === "local" ? "code.remote.local" : "code.remote.cloud")].filter(Boolean).join(" · ") }))} onChange={setID} />
      : <div className="empty code-empty-sm" data-testid="code-instructions-empty"><Icon name="file-code" size={20} /><p>{t("code.remote.instructionsNoSession")}</p></div>}
    {file.state === "ready" && file.data?.state === "ready" && <div className="diff code-file"><div className="code-head">{file.data.path}</div><pre data-testid="code-instructions-content">{file.data.content}</pre></div>}
    {file.state === "ready" && file.data?.state === "missing" && <p className="sub" data-testid="code-instructions-missing">{t("code.remote.instructionsMissing")}</p>}
    {file.state === "ready" && file.data?.state === "refused" && <div className="banner warn" role="status" data-testid="code-instructions-refused" data-reason={file.data.reason}>{t(`code.workspace.refused.${file.data.reason}`)}</div>}
    {file.state === "ready" && file.data?.state === "refused" && sessions.data.find(s => s.id === id)?.runtime === "local" && <LocalInstructions />}
    {file.state === "error" && <div className="banner err" role="alert">{t("code.remote.unavailable")}</div>}
    <p className="code-hint">{t("code.remote.instructionsReadOnly")}</p>
  </div>;
}

// One block per file of the live `git diff`. Cloud sessions add the producer's per-file review (approve stages the
// file in the guest, reject restores it); LOCAL has no review route, so it stays read-only.
function LiveDiff({ session, diff, reload }: { session: CodeSnapshot["session"]; diff: string; reload: () => void }) {
  const t = useT(), owns = useOwner();
  const [folded, setFolded] = React.useState<string[]>([]), [busy, setBusy] = React.useState(""), [failed, setFailed] = React.useState("");
  const [decided, setDecided] = React.useState<Record<string, "approve" | "reject">>({});
  const [mode, setMode] = React.useState<"unified" | "split">("unified");
  const files = diff.split(/^(?=diff --git )/m).filter(Boolean).map(text => ({ path: /^diff --git a\/(\S+)/.exec(text)?.[1] ?? "", text }));
  const review = async (path: string, decision: "approve" | "reject") => {
    setBusy(path); setFailed("");
    try { await api.code.review(session.id, { epoch: session.epoch, path, decision }); if (owns()) { setDecided(d => ({ ...d, [path]: decision })); reload(); } }
    catch { if (owns()) setFailed(path); }
    finally { if (owns()) setBusy(""); }
  };
  return <div data-testid="code-live-diff">
    <div className="code-head"><span>{t("code.workspace.liveDiff")}</span><span className="code-meta">{t("code.pr.files", { count: files.length })}</span></div>
    <div className="ctx-bar code-diff-modes" role="group" aria-label={t("code.diff.unifiedLabel")}>{(["unified", "split"] as const).map(m => <button key={m} className="btn secondary" data-testid={`code-diff-mode-${m}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{t(m === "unified" ? "code.diff.unified" : "code.diff.split")}</button>)}</div>
    {files.map(f => <div className="diff" key={f.path} data-testid="code-diff-file" data-path={f.path} data-decision={decided[f.path]}>
      <div className="code-head"><span className="mono grow">{f.path}</span>
        <button className="btn secondary" data-testid="code-diff-copy" onClick={() => void navigator.clipboard?.writeText(f.path).catch(() => {})}>{t("code.remote.copyPath")}</button>
        <button className="btn secondary" data-testid="code-diff-fold" aria-expanded={!folded.includes(f.path)} onClick={() => setFolded(x => x.includes(f.path) ? x.filter(p => p !== f.path) : [...x, f.path])}>{t(folded.includes(f.path) ? "code.remote.expand" : "code.remote.collapse")}</button>
        {session.runtime === "cloud" && <>
          <button className="btn secondary" data-testid="code-diff-reject" disabled={!!busy} onClick={() => void review(f.path, "reject")}>{t("code.remote.reviewReject")}</button>
          <button className="btn primary" data-testid="code-diff-approve" disabled={!!busy} onClick={() => void review(f.path, "approve")}>{t("code.remote.reviewApprove")}</button></>}
      </div>
      {decided[f.path] && <p className="sub" role="status" data-testid="code-diff-decided">{t(decided[f.path] === "approve" ? "code.remote.reviewApproved" : "code.remote.reviewRejected")}</p>}
      {failed === f.path && <div className="banner err" role="alert" data-testid="code-diff-review-error">{t("code.remote.unavailable")}</div>}
      {session.runtime === "cloud" && <LiveResolve epoch={session.epoch} session={session.id} path={f.path} />}
      <LiveComments epoch={session.epoch} session={session.id} path={f.path} />
      {!folded.includes(f.path) && (mode === "unified" ? <pre>{f.text}</pre>
        : <div className="code-split mono" data-testid="code-diff-split" aria-label={t("code.diff.splitLabel")}>{splitRows(f.text).map((r, i) => <div className="code-sr" key={i}>{[r.left, r.right].map((h, j) => <div className="code-half" key={j} data-k={h.k}><span className="code-src">{h.text}</span></div>)}</div>)}</div>)}
    </div>)}
    {session.runtime !== "cloud" && <p className="code-hint" data-testid="code-diff-local-readonly">{t("code.remote.reviewLocalReadOnly")}</p>}
  </div>;
}

// LOCAL fallback when the backend cannot read the workspace: the desktop reads AGENTS.md from a folder picked here.
function LocalInstructions() {
  const t = useT();
  const pick = window.cortex?.pickDirectory;
  const [state, setState] = React.useState<{ dir: string; file?: CodeFileView; failed?: boolean } | null>(null);
  if (!pick) return null;
  const open = async () => {
    const dir = await pick().catch(() => null);
    if (!dir) return;
    setState({ dir });
    try { setState({ dir, file: await api.code.localInstructions(dir) }); } catch { setState({ dir, failed: true }); }
  };
  return <div data-testid="code-instructions-local">
    <p className="sub">{t("code.remote.instructionsLocalLead")}</p>
    <button className="btn secondary" data-testid="code-instructions-local-open" onClick={() => void open()}><Icon name="folder" size={16} />{t("code.remote.instructionsLocalOpen")}</button>
    {state?.file?.state === "ready" && <div className="diff code-file"><div className="code-head"><span className="mono">{state.dir}/AGENTS.md</span><span className="code-meta">{t("code.remote.instructionsLocalSource")}</span></div><pre data-testid="code-instructions-local-content">{state.file.content}</pre></div>}
    {state?.file?.state === "missing" && <p className="sub" data-testid="code-instructions-local-missing">{t("code.remote.instructionsMissing")}</p>}
    {state?.failed && <div className="banner err" role="alert" data-testid="code-instructions-local-error">{t("code.remote.instructionsLocalFailed")}</div>}
  </div>;
}

type SessionView = "changes" | "terminal" | "environment" | "pr" | "attempts";
export function RemoteCodeSession({ view }: { view?: SessionView } = {}) {
  const { params, entryKey } = useNav();
  return <OwnedCodeSession key={`${entryKey}:${params.get("id")}:${params.get("epoch")}`} id={params.get("id") ?? ""} epoch={params.get("epoch") ?? ""} initialView={view} />;
}

// The diff, terminal and PR routes without an id open the most recent producer session on that tab.
export function LatestCodeSession({ view, screen }: { view: SessionView; screen: string }) {
  const t = useT();
  const sessions = useQuery(() => api.code.list(), []);
  if (sessions.state === "error") return <div className="banner err" role="alert" data-testid={`screen-${screen}`}>{t("code.remote.unavailable")}<button className="btn secondary" onClick={sessions.reload}>{t("code.retry")}</button></div>;
  if (sessions.state !== "ready") return <div className="thinking" role="status" data-testid={`screen-${screen}`} data-state="loading" />;
  const latest = sessions.data[0];
  if (!latest) return <div data-testid={`screen-${screen}`} data-state="empty"><LiveEmpty /></div>;
  return <OwnedCodeSession key={latest.id} id={latest.id} epoch={latest.epoch} initialView={view} screen={screen} />;
}

function OwnedCodeSession({ id, epoch, initialView, screen }: { id: string; epoch: string; initialView?: SessionView; screen?: string }) {
  const t = useT(), { params, go } = useNav(), owns = useOwner();
  const snapshot = useQuery(() => api.code.snapshot(id, epoch), [id, epoch], e => e.type === "code.session.changed" && e.properties.sessionID === id && e.properties.epoch === epoch);
  const catalog = useQuery(() => api.code.models(), []);
  const [text, setText] = React.useState(params.get("draft") ?? ""), [model, setModel] = React.useState("");
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false), [view, setView] = React.useState<string>(initialView ?? "changes");
  const submitted = React.useRef<string | undefined>(params.get("submitted") ?? params.get("draft") ?? undefined);
  const data: CodeSnapshot | undefined = snapshot.state === "ready" && snapshot.data.session.id === id && snapshot.data.session.epoch === epoch ? snapshot.data : undefined;
  React.useEffect(() => {
    if (!data) return;
    setModel(data.session.modelSlug);
    if (data.session.delivery === "settled" && data.session.state === "completed" && !data.session.errorCode && submitted.current !== undefined) {
      const accepted = submitted.current; setText(v => v === accepted ? "" : v); submitted.current = undefined;
    }
  }, [data]);
  const mutate = async (action: () => Promise<unknown>) => {
    if (busy || !owns()) return; setBusy(true); setError(false);
    try { await action(); if (owns()) snapshot.reload(); }
    catch { if (owns()) setError(true); }
    finally { if (owns()) setBusy(false); }
  };
  const send = () => void mutate(async () => { const request = text; await api.code.prompt(id, { epoch, message: request }); if (owns()) submitted.current = request; });
  const asks = data?.permissions.filter(p => !p.decision) ?? [];
  const running = data?.session.delivery === "streaming" || data?.session.delivery === "admitting" || data?.session.state === "running" || asks.length > 0;
  const views = [t("code.session.changes"), t("code.session.terminal"), t("code.remote.environment"), t("code.remote.pr"), t("code.contract.attempts")];
  const keys = ["changes", "terminal", "environment", "pr", "attempts"];
  return <div className="code-api code-api-session" data-testid={screen ? `screen-${screen}` : undefined} data-view={view}>
    <div className="content-top"><span className="title">{data?.session.title || t("code.untitled")}</span><span className="badge" role="status">{running ? t("code.status.running") : data?.session.state === "interrupted" ? t("code.status.cancelled") : data?.session.state === "failed" || data?.session.errorCode ? t("code.status.failed") : t("code.status.ready")}</span><div className="spacer" />
      <button className="btn secondary" data-testid="code-reconnect" disabled={busy} onClick={() => snapshot.reload()}>{t("code.remote.reconnect")}</button>
      <button className="btn secondary" data-testid="code-stop" disabled={busy} onClick={() => void mutate(() => api.code.stop(id, epoch))}>{t("code.terminal.stop")}</button>
      <button className="btn secondary" onClick={() => go("code")}>{t("code.newTask")}</button>
    </div>
    {(error || snapshot.state === "error" || data?.session.errorCode) && <div className="banner err" role="alert">{t("code.remote.unavailable")}</div>}
    <div className="split">
      <div className="split-l">
        {data?.messages.map(m => <div key={m.id} className={m.role === "user" ? "msg-user" : "msg-bot"} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.text}</div>)}
        {asks.map(p => <div key={p.id} className="code-ask" data-tool={p.tool_name} role="alertdialog" aria-label={t("code.terminal.approvalRequired")}>
          <b>{t("code.terminal.approvalRequired")}</b><pre>{p.exact_action_preview ?? p.detail}</pre>
          {p.proposed_diff && <div className="diff"><div className="code-head">{p.path}</div><pre data-testid="code-proposed-diff">{p.proposed_diff}</pre></div>}
          <div className="ctx-bar"><button className="btn primary" data-testid="permission-allow-once" disabled={busy} onClick={() => void mutate(() => api.code.decide(id, p.id, epoch, "allow"))}>{t("code.terminal.allowOnce")}</button><button className="btn secondary" data-testid="permission-deny" disabled={busy} onClick={() => void mutate(() => api.code.decide(id, p.id, epoch, "deny"))}>{t("code.terminal.deny")}</button></div>
          {p.tool_name === "bash" && <LiveSessionGrant epoch={epoch} session={id} />}
        </div>)}
        <CodeComposer models={catalog.state === "ready" ? catalog.data.models : []} model={model} text={text} setText={setText} busy={busy || running} send={send} />
      </div>
      <div className="split-r">
        <div className="pane-head"><Segmented items={views} value={views[Math.max(0, keys.indexOf(view))]} onChange={v => setView(keys[views.indexOf(v)] ?? "changes")} /></div>
        {view === "environment" ? <SessionEnvironment epoch={epoch} runtime={data?.session.runtime} />
          : view === "pr" ? (data ? <><PrDraft key={data.session.id} session={data.session} diff={data.workspace?.state === "ready" ? data.workspace.diff : ""} />{data.session.runtime === "cloud" && <LivePrReview epoch={epoch} session={id} />}</> : null)
          : view === "attempts" ? <LiveAttempts epoch={epoch} session={id} />
          : view === "terminal" ? <pre className="term" data-testid="code-real-terminal">{data?.messages.flatMap(m => m.tools.filter(p => ["bash", "task", "read_file"].includes(p.tool_name)).map(p => `${JSON.stringify(p.arguments)}\n${p.result ?? ""}${p.result_omitted_chars ? `\n${t("code.terminal.truncated", { count: p.result_omitted_chars })}` : ""}`)).join("\n\n") || t("code.session.noCommands")}</pre>
          : <>{data?.workspace?.state === "refused" && <div className="banner warn" role="status" data-testid="code-workspace-refused" data-reason={data.workspace.reason}><span>{t(`code.workspace.refused.${data.workspace.reason}`)}</span></div>}
            {data?.workspace?.state === "ready" && (data.workspace.diff ? <LiveDiff session={data.session} diff={data.workspace.diff} reload={snapshot.reload} /> : <p className="sub" data-testid="code-live-diff-empty">{t("code.workspace.clean")}</p>)}
            {data?.permissions.filter(p => p.proposed_diff && p.decision === "allow").map(p => <div className="diff" key={p.id}><div className="code-head"><span>{p.path}</span></div><pre>{p.proposed_diff}</pre></div>)}
            {data?.messages.flatMap(m => m.tools.filter(p => p.tool_name === "read_file").map((p, i) => <div className="diff" key={m.id + i}><div className="code-head">{JSON.stringify(p.arguments)}</div><pre data-testid="code-real-file">{p.result}</pre></div>))}
            {!data?.workspace && !data?.permissions.some(p => p.proposed_diff && p.decision === "allow") && <div className="empty"><Icon name="diff" /><p>{t("code.session.noChanges")}</p></div>}</>}
      </div>
    </div>
  </div>;
}
