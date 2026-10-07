import * as React from "react";
import { CodeSessionPatch, type CodeFileView, type CodeSessionView, type CodeSnapshot, type RemoteModel } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Icon, Segmented } from "../../kit/ui";
import { useNav, readHash } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { useSendEnter } from "../../state/send-enter";
import { splitRows } from "./split-rows";

function useOwner(epoch = "") {
  const { entryKey, params } = useNav();
  const id = params.get("id"), routeEpoch = params.get("epoch");
  const token = React.useMemo(() => ({ entryKey, epoch, id, routeEpoch }), [entryKey, epoch, id, routeEpoch]);
  const current = React.useRef(token);
  const mounted = React.useRef(true);
  React.useLayoutEffect(() => { current.current = token; mounted.current = true; return () => { mounted.current = false; }; }, [token]);
  return () => { const route = readHash(); return mounted.current && current.current === token && route.entryKey === entryKey && route.params.get("id") === id && route.params.get("epoch") === routeEpoch; };
}

export function CodeConnection({ local }: { local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []);
  if (connection.state === "ready" && connection.data.mode !== "local" && connection.data.signedIn) return <RemoteCodeHome />;
  return local;
}

function CodeComposer({ models, model, setModel, text, setText, busy, send }: {
  models: RemoteModel[]; model: string; setModel(value: string): void; text: string; setText(value: string): void; busy: boolean; send(): void;
}) {
  const t = useT(), enter = useSendEnter();
  return <form onSubmit={e => { e.preventDefault(); if (!busy && text.trim() && model) send(); }}>
    <textarea className="input" data-testid="code-composer-input" aria-label={t("code.home.placeholder")} placeholder={t("code.home.placeholder")} value={text} onChange={e => setText(e.target.value)} {...enter.field} />
    <div className="ctx-bar">
      <select className="input" aria-label={t("code.remote.model")} value={model} disabled={busy} onChange={e => setModel(e.target.value)}>
        <option value="">{t("code.remote.chooseModel")}</option>{models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}
      </select>
      <button className="btn primary" data-testid="code-api-send" disabled={busy || !text.trim() || !model} type="submit">{t("code.remote.send")}</button>
    </div>
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
  // No farm: cloud is refused before any request; the draft stays and nothing falls back to this computer.
  const cloudRefused = runtime === "cloud" && capabilities.state === "ready" && !capabilities.data.cloud.available;
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
  return <div className="home code-api">
    <h1>{t("code.home.title")}</h1>
    <div className="ctx-bar" role="group" aria-label={t("code.remote.execution")}>
      <button className="btn secondary" data-testid="code-mode-local" aria-pressed={runtime === "local"} disabled={busy} onClick={() => setRuntime("local")}>{t("code.remote.local")}</button>
      <button className="btn secondary" data-testid="code-mode-cloud" aria-pressed={runtime === "cloud"} disabled={busy} onClick={() => setRuntime("cloud")}>{t("code.remote.cloud")}</button>
    </div>
    <p>{t(runtime === "local" ? "code.remote.localBody" : "code.remote.cloudBody")}</p>
    {cloudRefused && <div className="banner warn" role="status" data-testid="code-cloud-unavailable" data-reason={capabilities.state === "ready" ? capabilities.data.cloud.reason : undefined}><span>{t("code.workspace.refused.code_compute_not_configured")}</span></div>}
    {runtime === "cloud" && catalog.state === "ready" && <WorkspacePicker epoch={catalog.data.epoch} repo={repo} setRepo={v => { setRepo(v); setBranch(""); }} branch={branch} setBranch={setBranch} busy={busy} />}
    <CodeComposer models={catalog.state === "ready" ? catalog.data.models : []} model={model} setModel={setModel} text={text} setText={editText} busy={busy || cloudRefused} send={() => void send()} />
    {(catalog.state === "error" || sessions.state === "error" || error) && <div className="banner err" role="alert"><span>{t("code.remote.unavailable")}</span><button className="btn secondary" onClick={() => { catalog.reload(); sessions.reload(); }}>{t("code.retry")}</button></div>}
    {sessions.state === "ready" && <TaskFilter value={filter} onChange={setFilter} />}
    {sessions.state === "ready" && sessions.data.length > 0 && !sessions.data.some(s => matches(filter, s.state)) && <div className="empty" data-testid="code-tasks-no-match"><p>{t("code.tasks.noMatchTitle")}</p><button className="btn secondary" onClick={() => setFilter("all")}>{t("code.tasks.clearFilters")}</button></div>}
    {sessions.state === "ready" && <div className="tasks" data-testid="code-task-list">{sessions.data.filter(s => matches(filter, s.state)).map(s => <button className="task" key={s.id} data-testid="code-task" data-state={s.state} onClick={() => go("code-session", { source: "code-api", id: s.id, epoch: s.epoch })}><span className="grow"><b>{s.title || t("code.untitled")}</b><span className="sub">{t(s.runtime === "local" ? "code.remote.local" : "code.remote.cloud")}</span></span></button>)}</div>}
  </div>;
}

// Task list status filter over the producer session states.
type StatusFilter = "all" | "running" | "done" | "failed" | "cancelled";
const STATUS_OF: Partial<Record<CodeSessionView["state"], StatusFilter>> = { running: "running", connecting: "running", connected: "running", waiting: "running", permission_blocked: "running", completed: "done", failed: "failed", interrupted: "cancelled" };
const matches = (filter: StatusFilter, state: CodeSessionView["state"]) => filter === "all" || STATUS_OF[state] === filter;
const FILTER_LABEL: Record<StatusFilter, string> = { all: "code.tasks.filter.all", running: "code.tasks.filter.running", done: "code.status.done", failed: "code.tasks.filter.failed", cancelled: "code.status.cancelled" };
function TaskFilter({ value, onChange }: { value: StatusFilter; onChange(v: StatusFilter): void }) {
  const t = useT();
  return <div className="ctx-bar" role="group" aria-label={t("code.tasks.filterLabel")} data-testid="code-task-filter">
    {(Object.keys(FILTER_LABEL) as StatusFilter[]).map(f => <button key={f} className="btn secondary" data-testid={`code-task-filter-${f}`} aria-pressed={value === f} onClick={() => onChange(f)}>{t(FILTER_LABEL[f])}</button>)}
  </div>;
}

// Cloud workspace pickers over the producer's repositories and a repo's branches. A typed repository stays possible when
// the producer lists none (GitHub not connected and no earlier session); refusals are shown, never replaced by fixtures.
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
function WorkspacePicker({ epoch, repo, setRepo, branch, setBranch, busy }: { epoch: string; repo: string; setRepo(v: string): void; branch: string; setBranch(v: string): void; busy: boolean }) {
  const t = useT();
  const repos = useQuery(() => api.code.repositories(epoch), [epoch]);
  const valid = REPO.test(repo.trim());
  const branches = useQuery(() => valid ? api.code.branches(epoch, repo.trim()) : Promise.resolve(undefined), [epoch, valid ? repo.trim() : ""]);
  const listed = repos.state === "ready" ? repos.data.items : [];
  return <div className="code-pickers" data-testid="code-workspace-picker" data-github={repos.state === "ready" ? repos.data.githubState : repos.state}>
    {listed.length > 0
      ? <select className="input" data-testid="code-repo-picker" aria-label={t("code.remote.repository")} value={repo} disabled={busy} onChange={e => setRepo(e.target.value)}>
          <option value="">{t("code.remote.repoChoose")}</option>
          {listed.map(r => <option key={r.fullName} value={r.fullName}>{r.fullName}</option>)}
        </select>
      : <input className="input" data-testid="code-repo-input" aria-label={t("code.remote.repository")} placeholder={t("code.remote.repository")} value={repo} disabled={busy} onChange={e => setRepo(e.target.value)} />}
    {repos.state === "ready" && !repos.data.githubConnected && <p className="sub" role="status" data-testid="code-github-state">{t("code.remote.githubNotConnected")}</p>}
    {(repos.state === "error" || (repos.state === "ready" && repos.data.githubError)) && <div className="banner err" role="alert" data-testid="code-repos-error"><span>{t("code.remote.reposFailed")}</span><button className="btn secondary" onClick={() => repos.reload()}>{t("code.retry")}</button></div>}
    {valid && branches.state === "ready" && branches.data && branches.data.items.length > 0 && <select className="input" data-testid="code-branch-picker" aria-label={t("code.remote.prBranch")} value={branch} disabled={busy} onChange={e => setBranch(e.target.value)}>
      <option value="">{t("code.remote.branchDefault")}</option>
      {branches.data.items.map(b => <option key={b} value={b}>{b}</option>)}
    </select>}
    {valid && (branches.state === "error" || (branches.state === "ready" && branches.data?.githubError)) && <div className="banner err" role="alert" data-testid="code-branches-error"><span>{t("code.remote.branchesFailed")}</span><button className="btn secondary" onClick={() => branches.reload()}>{t("code.retry")}</button></div>}
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
    <p className="code-hint" data-testid="code-pr-no-open">{t("code.remote.prNoOpen")}</p>
  </form>;
}

// Code settings against the signed-in producer; anything else keeps the local section.
export function RemoteCodeSettings({ section, local }: { section: string; local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []);
  if (connection.state !== "ready") return null;
  if (connection.data.mode === "local" || !connection.data.signedIn || !["usage", "instructions", "approvals"].includes(section)) return local;
  return <RemoteSettingsBody section={section} local={local} />;
}

function RemoteSettingsBody({ section, local }: { section: string; local: React.ReactNode }) {
  const t = useT();
  const catalog = useQuery(() => api.code.models(), []);
  if (catalog.state === "error") return <div className="banner err" role="alert">{t("code.remote.unavailable")}</div>;
  if (catalog.state !== "ready") return null;
  const epoch = catalog.data.epoch;
  return section === "usage" ? <RemoteUsage epoch={epoch} /> : section === "instructions" ? <RemoteInstructions epoch={epoch} /> : <><RemoteDefaultModel epoch={epoch} /><p className="code-hint" data-testid="code-approvals-local-scope">{t("code.remote.approvalsLocalScope")}</p>{local}</>;
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
    <label className="li"><span className="grow"><span className="ttl">{t("code.settings.defaultModel")}</span><span className="sub">{t("code.settings.defaultModelSub")}</span></span>
      <select className="input" data-testid="code-default-model" disabled={saving} value={settings.data.defaultModel ?? ""} onChange={e => { if (e.target.value) void choose(e.target.value); }}>
        <option value="">{t("code.remote.chooseModel")}</option>{settings.data.models.map(m => <option key={m.ref} value={m.ref}>{m.name}</option>)}
      </select></label>
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
    <select className="input" data-testid="code-instructions-session" aria-label={t("code.remote.instructionsSession")} value={id} onChange={e => setID(e.target.value)}>
      <option value="">{t("code.remote.instructionsSession")}</option>{sessions.data.map(s => <option key={s.id} value={s.id}>{s.title || t("code.untitled")} · {t(s.runtime === "local" ? "code.remote.local" : "code.remote.cloud")}</option>)}
    </select>
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

export function RemoteCodeSession() {
  const { params, entryKey } = useNav();
  return <OwnedCodeSession key={`${entryKey}:${params.get("id")}:${params.get("epoch")}`} />;
}

function OwnedCodeSession() {
  const t = useT(), { params, go } = useNav(), owns = useOwner();
  const id = params.get("id") ?? "", epoch = params.get("epoch") ?? "";
  const snapshot = useQuery(() => api.code.snapshot(id, epoch), [id, epoch], e => e.type === "code.session.changed" && e.properties.sessionID === id && e.properties.epoch === epoch);
  const catalog = useQuery(() => api.code.models(), []);
  const [text, setText] = React.useState(params.get("draft") ?? ""), [model, setModel] = React.useState("");
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false), [view, setView] = React.useState("changes");
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
  const views = [t("code.session.changes"), t("code.session.terminal"), t("code.remote.environment"), t("code.remote.pr")];
  const keys = ["changes", "terminal", "environment", "pr"];
  return <div className="code-api code-api-session">
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
        </div>)}
        <CodeComposer models={catalog.state === "ready" ? catalog.data.models : []} model={model} setModel={() => {}} text={text} setText={setText} busy={busy || running} send={send} />
      </div>
      <div className="split-r">
        <div className="pane-head"><Segmented items={views} value={views[Math.max(0, keys.indexOf(view))]} onChange={v => setView(keys[views.indexOf(v)] ?? "changes")} /></div>
        {view === "environment" ? <SessionEnvironment epoch={epoch} runtime={data?.session.runtime} />
          : view === "pr" ? (data ? <PrDraft key={data.session.id} session={data.session} diff={data.workspace?.state === "ready" ? data.workspace.diff : ""} /> : null)
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
