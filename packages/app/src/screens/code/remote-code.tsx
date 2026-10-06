import * as React from "react";
import type { CodeSnapshot, RemoteModel } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Icon, Segmented } from "../../kit/ui";
import { useNav, readHash } from "../../shell/nav";
import { useQuery } from "../../state/live";
import { useSendEnter } from "../../state/send-enter";

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
  const catalog = useQuery(() => api.code.models(), []), sessions = useQuery(() => api.code.list(), []);
  const owns = useOwner(catalog.state === "ready" ? catalog.data.epoch : "");
  const [runtime, setRuntime] = React.useState<"local" | "cloud">("local");
  const [model, setModel] = React.useState(""), [text, setText] = React.useState(""), [repo, setRepo] = React.useState("");
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(false);
  const retained = React.useRef<{ id: string; epoch: string; runtime: string; model: string; repo: string } | undefined>(undefined);
  const draft = React.useRef(text);
  const editText = (value: string) => { draft.current = value; setText(value); };
  const send = async () => {
    if (busy || catalog.state !== "ready") return;
    setBusy(true); setError(false);
    try {
      const stamp = `${runtime}:${model}:${repo}`;
      let session = retained.current;
      if (!session || session.epoch !== catalog.data.epoch || `${session.runtime}:${session.model}:${session.repo}` !== stamp) {
        const created = await api.code.create({ epoch: catalog.data.epoch, runtime, modelSlug: model, ...(runtime === "cloud" && repo.trim() ? { repo: repo.trim() } : {}) });
        if (!owns()) return;
        session = { id: created.id, epoch: created.epoch, runtime, model, repo }; retained.current = session;
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
    {runtime === "cloud" && <input className="input" aria-label={t("code.remote.repository")} placeholder={t("code.remote.repository")} value={repo} disabled={busy} onChange={e => setRepo(e.target.value)} />}
    <CodeComposer models={catalog.state === "ready" ? catalog.data.models : []} model={model} setModel={setModel} text={text} setText={editText} busy={busy} send={() => void send()} />
    {(catalog.state === "error" || sessions.state === "error" || error) && <div className="banner err" role="alert"><span>{t("code.remote.unavailable")}</span><button className="btn secondary" onClick={() => { catalog.reload(); sessions.reload(); }}>{t("code.retry")}</button></div>}
    {sessions.state === "ready" && <div className="tasks">{sessions.data.map(s => <button className="task" key={s.id} onClick={() => go("code-session", { source: "code-api", id: s.id, epoch: s.epoch })}><span className="grow"><b>{s.title || t("code.untitled")}</b><span className="sub">{t(s.runtime === "local" ? "code.remote.local" : "code.remote.cloud")}</span></span></button>)}</div>}
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
  const views = [t("code.session.changes"), t("code.session.terminal")];
  return <div className="code-api code-api-session">
    <div className="content-top"><span className="title">{data?.session.title || t("code.untitled")}</span><span className="badge" role="status">{running ? t("code.status.running") : data?.session.state === "failed" || data?.session.state === "interrupted" || data?.session.errorCode ? t("code.status.failed") : t("code.status.ready")}</span><div className="spacer" />
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
        <div className="pane-head"><Segmented items={views} value={views[view === "changes" ? 0 : 1]} onChange={v => setView(v === views[0] ? "changes" : "terminal")} /></div>
        {view === "terminal" ? <pre className="term" data-testid="code-real-terminal">{data?.messages.flatMap(m => m.tools.filter(p => ["bash", "task", "read_file"].includes(p.tool_name)).map(p => `${JSON.stringify(p.arguments)}\n${p.result ?? ""}${p.result_omitted_chars ? `\n${t("code.terminal.truncated", { count: p.result_omitted_chars })}` : ""}`)).join("\n\n") || t("code.session.noCommands")}</pre>
          : <>{data?.permissions.filter(p => p.proposed_diff && p.decision === "allow").map(p => <div className="diff" key={p.id}><div className="code-head"><span>{p.path}</span></div><pre>{p.proposed_diff}</pre></div>)}
            {data?.messages.flatMap(m => m.tools.filter(p => p.tool_name === "read_file").map((p, i) => <div className="diff" key={m.id + i}><div className="code-head">{JSON.stringify(p.arguments)}</div><pre data-testid="code-real-file">{p.result}</pre></div>))}
            {!data?.permissions.some(p => p.proposed_diff && p.decision === "allow") && <div className="empty"><Icon name="diff" /><p>{t("code.session.noChanges")}</p></div>}</>}
      </div>
    </div>
  </div>;
}
