// Cortex Code home (new task) and session workbench.
import * as React from "react";
import type { MessageWithParts, ToolPart, Permission, PermissionReply } from "@cortex/schema";
import { Icon, IconBtn, Pop, MItem, Segmented, useToast } from "../../kit/ui";
import { Composer } from "../../components/composer";
import { useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview, useFixtures } from "../../preview";
import { api } from "../../api";
import { useSessions, useMessages, usePermissions, useQuery } from "../../state/live";
import { toolName, toolTitle } from "../../state/tool-label";
import { TestIdComposer, basename, pickModel, useAgo } from "./parts";
import type { CodeFx } from "./fixtures";

const STATUS: Record<string, string> = { run: "code.status.running", wait: "code.status.toReview", ok: "code.status.done", err: "code.status.failed" };

/* =====================================================================
   Home
   ===================================================================== */
export function CodeHome() { return isPreview() ? <HomePreview /> : <HomeLive />; }

function HomePreview() {
  const t = useT();
  const { go } = useNav();
  const fx = useFixtures<CodeFx>("code").home;
  const [repo, setRepo] = React.useState(fx.repos[0]);
  const [branch, setBranch] = React.useState(fx.branches[0]);
  const [env, setEnv] = React.useState<"cloud" | "local">("cloud");
  return (<>
    <div className="content-top"><div className="spacer" /><IconBtn icon="compose" label={t("code.newTask")} kbd="⌘N" /></div>
    <div className="home">
      <h1>{t("code.home.title")}</h1>
      <TestIdComposer id="code-composer-input"><Composer placeholder={t("code.home.placeholder")} models={[t("code.model.fast"), t("code.model.thinking")]} onSend={() => go("code-session")} /></TestIdComposer>
      <div className="ctx-bar">
        <Pop trigger={<button className="ctx"><Icon name="folder-code" size={16} />{repo}<Icon name="chevron-down" size={12} /></button>}>
          {fx.repos.map((r) => <MItem key={r} icon="folder-code" onClick={() => setRepo(r)}>{r}</MItem>)}
        </Pop>
        <Pop trigger={<button className="ctx"><Icon name="git-branch" size={16} />{branch}<Icon name="chevron-down" size={12} /></button>}>
          {fx.branches.map((b) => <MItem key={b} icon="git-branch" onClick={() => setBranch(b)}>{b}</MItem>)}
        </Pop>
        <Pop trigger={<button className="ctx"><Icon name={env === "cloud" ? "cpu" : "terminal"} size={16} />{env === "cloud" ? fx.envCloudShort : fx.envLocalShort}<Icon name="chevron-down" size={12} /></button>}>
          <MItem icon="cpu" onClick={() => setEnv("cloud")}>{fx.envCloud}</MItem><MItem icon="terminal" onClick={() => setEnv("local")}>{fx.envLocal}</MItem>
        </Pop>
      </div>
      <div className="tasks">
        <div className="h3" style={{ padding: "0 4px" }}>{t("code.home.recent")}</div>
        {fx.tasks.map(([title, sub, b], i) => (
          <button key={title} className="task" style={{ ["--i" as string]: i }} onClick={() => go("code-session")}>
            <span className="grow"><span className="ttl">{title}</span><span className="sub">{sub}</span></span><span className={"badge " + b}>{b === "run" && <span className="spin" />}{t(STATUS[b])}</span>
          </button>
        ))}
      </div>
    </div>
  </>);
}

function HomeLive() {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const ago = useAgo();
  const sessions = useSessions("code");
  const [dir, setDir] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const pick = window.cortex?.pickDirectory;
  const choose = async () => { const d = await pick?.().catch(() => null); if (d) setDir(d); return d ?? null; };
  const send = async (text: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const directory = dir ?? (pick ? await choose() : null);
      if (pick && !directory) return;
      const model = await pickModel();
      if (!model) { toast.add({ title: t("code.home.noModelTitle"), description: t("code.home.noModelBody"), data: { icon: "alert-triangle" } }); return; }
      const s = await api.sessions.create({ kind: "code", directory: directory ?? undefined, agent: "build", model });
      await api.sessions.prompt(s.id, { parts: [{ type: "text", text }] });
      go("code-session", { id: s.id });
    } catch {
      toast.add({ title: t("code.home.startFailed"), data: { icon: "x-circle" } });
    } finally { setBusy(false); }
  };
  const list = sessions.state === "ready" ? sessions.data.slice(0, 6) : [];
  return (<>
    <div className="content-top"><div className="spacer" /><IconBtn icon="compose" label={t("code.newTask")} kbd="⌘N" onClick={() => setDir(null)} /></div>
    <div className="home">
      <h1>{t("code.home.title")}</h1>
      <TestIdComposer id="code-composer-input"><Composer placeholder={t("code.home.placeholder")} models={[t("code.model.fast"), t("code.model.thinking")]} onSend={(x) => void send(x)} disabled={busy} /></TestIdComposer>
      {pick && (
        <div className="ctx-bar">
          <button className="ctx" data-testid="code-pick-folder" onClick={() => void choose()} title={dir ?? undefined}><Icon name="folder-code" size={16} />{dir ? basename(dir) : t("code.home.pickFolder")}<Icon name="chevron-down" size={12} /></button>
        </div>
      )}
      {list.length > 0 && (
        <div className="tasks">
          <div className="h3" style={{ padding: "0 4px" }}>{t("code.home.recent")}</div>
          {list.map((s, i) => (
            <button key={s.id} className="task" style={{ ["--i" as string]: i }} onClick={() => go("code-session", { id: s.id })}>
              <span className="grow"><span className="ttl">{s.title || t("code.untitled")}</span><span className="sub">{[basename(s.directory), ago(s.time.updated)].filter(Boolean).join(" · ")}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  </>);
}

/* =====================================================================
   Session
   ===================================================================== */
export function CodeSession() { return isPreview() ? <SessionPreview /> : <SessionLive />; }

const diffClass = (l: string) => (l[0] === "+" ? "add" : l[0] === "-" ? "del" : l.startsWith("@@") ? "hunk" : "");

function SessionPreview() {
  const t = useT();
  const toast = useToast();
  const fx = useFixtures<CodeFx>("code").session;
  const views = [t("code.session.changes"), t("code.session.terminal")];
  const [view, setView] = React.useState(views[0]);
  const [steps, setSteps] = React.useState(3);
  React.useEffect(() => { if (steps < 5) { const tm = setTimeout(() => setSteps(steps + 1), 1600); return () => clearTimeout(tm); } }, [steps]);
  return (<>
    <div className="content-top">
      <span className="title">{fx.title}</span>
      <span className="badge run" style={{ marginLeft: 8 }}>{steps < 5 && <span className="spin" />}{steps < 5 ? t("code.status.running") : t("code.status.ready")}</span>
      <div className="spacer" />
      <button className="btn secondary" style={{ height: 28 }}><Icon name="terminal" size={16} />{t("code.session.openTerminal")}</button>
      <button className="btn primary" style={{ height: 28 }} disabled={steps < 5} onClick={() => toast.add({ title: t("code.session.prCreated"), description: fx.prRef, data: { icon: "pull-request" } })}><Icon name="pull-request" size={16} />{t("code.createPr")}</button>
    </div>
    <div className="split">
      <div className="split-l">
        <div className="msg-user" style={{ alignSelf: "flex-start", maxWidth: "100%" }}>{fx.prompt}</div>
        <div className="steps-log">
          {fx.log.slice(0, steps).map(([ic, s], i) => (
            <div key={s} className="log" data-last={i === steps - 1 && steps < 5 || undefined}><Icon name={ic} size={16} /><span>{s}</span></div>
          ))}
          {steps < 5 && <div className="log shimmer"><Icon name="loader" size={16} className="spinning" /><span>{fx.running}</span></div>}
        </div>
        {steps >= 5 && <div className="msg-bot">{fx.answer} <b>{fx.answerBold}</b></div>}
        <div style={{ flex: 1 }} />
        <TestIdComposer id="code-composer-input"><Composer placeholder={t("code.session.placeholder")} models={[t("code.model.fast"), t("code.model.thinking")]} /></TestIdComposer>
      </div>
      <div className="split-r">
        <div className="pane-head"><Segmented items={views} value={view} onChange={setView} /><div className="spacer" /><span className="mono" style={{ color: "color-mix(in srgb, var(--green) 65%, var(--t1))" }}>+3</span><span className="mono" style={{ color: "var(--red)", marginLeft: 6 }}>−2</span></div>
        {view === views[0] ? (
          <div className="diff" key="d">
            <div className="code-head"><Icon name="file-code" size={16} /><span style={{ marginLeft: 6 }}>{fx.file}</span><IconBtn icon="copy" label={t("code.copyPath")} /></div>
            <pre>{fx.diff.split("\n").map((l, i) => <div key={i} className={diffClass(l)}>{l || " "}</div>)}</pre>
          </div>
        ) : <pre className="term" key="t">{fx.terminal}</pre>}
      </div>
    </div>
  </>);
}

const TOOL_ICON: Record<string, string> = { read: "search", grep: "search", glob: "search", list: "folder", bash: "terminal", edit: "edit", write: "edit", webfetch: "globe", task: "agent", todowrite: "check-circle", skill: "sparkle-free" };
type Input = { path?: string; command?: string; oldString?: string; newString?: string; content?: string; pattern?: string; url?: string; description?: string };
const inputOf = (p: ToolPart) => ((p.state.input ?? {}) as Input);
/** Diff lines for an edit/write call, built from the tool input. */
const toolDiff = (p: ToolPart) => {
  const i = inputOf(p);
  if (p.tool === "write") return (i.content ?? "").split("\n").map((l) => "+" + l);
  return [...(i.oldString ?? "").split("\n").map((l) => "-" + l), ...(i.newString ?? "").split("\n").map((l) => "+" + l)];
};

function PermissionAsk({ p }: { p: Permission }) {
  const t = useT();
  const [sent, setSent] = React.useState(false);
  const reply = (r: PermissionReply) => { setSent(true); api.permissions.reply(p.id, r).catch(() => setSent(false)); };
  return (
    <div className="code-ask" role="alertdialog" aria-label={t("code.terminal.approvalRequired")}>
      <div className="code-ask-h"><Icon name="shield-check" size={16} /><span>{t("code.terminal.wantsToRun")} <code>{p.pattern}</code></span></div>
      <p>{t("code.session.askBody", { tool: toolName(t, p.tool) })}</p>
      <div className="code-row-gap">
        <button className="btn primary code-h28" data-testid="permission-allow-once" disabled={sent} onClick={() => reply("once")}>{t("code.terminal.allowOnce")}</button>
        <button className="btn secondary code-h28" data-testid="permission-always" disabled={sent} onClick={() => reply("always")}>{t("code.terminal.allowAlways")}</button>
        <button className="btn secondary code-h28 code-danger" data-testid="permission-deny" disabled={sent} onClick={() => reply("reject")}>{t("code.terminal.deny")}</button>
      </div>
    </div>
  );
}

function SessionLive() {
  const t = useT();
  const toast = useToast();
  const { params, go } = useNav();
  const id = params.get("id") ?? undefined;
  const session = useQuery(() => (id ? api.sessions.get(id) : Promise.reject({ code: "not_found" })), [id], (e) => e.type === "session.updated");
  const { msgs, status } = useMessages(id);
  const perms = usePermissions();
  const asks = perms.state === "ready" ? perms.data.filter((p) => p.sessionID === id) : [];
  const views = [t("code.session.changes"), t("code.session.terminal")];
  const [view, setView] = React.useState(views[0]);
  const tools = msgs.flatMap((m) => m.parts.filter((p): p is ToolPart => p.type === "tool"));
  const edits = tools.filter((p) => (p.tool === "edit" || p.tool === "write") && p.state.status === "completed");
  const runs = tools.filter((p) => p.tool === "bash" && p.state.input);
  const adds = edits.reduce((n, p) => n + toolDiff(p).filter((l) => l[0] === "+").length, 0);
  const dels = edits.reduce((n, p) => n + toolDiff(p).filter((l) => l[0] === "-").length, 0);
  const busy = status === "busy" || status === "retry";
  const lastError = [...msgs].reverse().find((m) => m.info.role === "assistant")?.info.error;
  if (!id || session.state === "error") return <div className="empty"><h2>{t("code.session.missingTitle")}</h2><p>{t("code.session.missingBody")}</p><button className="btn primary" onClick={() => go("code")}><Icon name="compose" size={16} />{t("code.newTask")}</button></div>;
  const send = (text: string) => { api.sessions.prompt(id, { parts: [{ type: "text", text }] }).catch(() => toast.add({ title: t("code.session.sendFailed"), data: { icon: "x-circle" } })); };
  const row = (m: MessageWithParts) => m.parts.map((p) => {
    if (p.type === "text" && p.text && !p.synthetic) return m.info.role === "user"
      ? <div key={p.id} className="msg-user" style={{ alignSelf: "flex-start", maxWidth: "100%", whiteSpace: "pre-wrap" }}>{p.text}</div>
      : <div key={p.id} className="msg-bot" style={{ whiteSpace: "pre-wrap" }}>{p.text}</div>;
    if (p.type !== "tool") return null;
    const running = p.state.status === "pending" || p.state.status === "running";
    return (
      <div key={p.id} className="steps-log">
        <div className={"log" + (running ? " shimmer" : "")} data-last={running || undefined}>
          <Icon name={running ? "loader" : p.state.status === "error" ? "x-circle" : TOOL_ICON[p.tool] ?? "code"} size={16} className={running ? "spinning" : undefined} />
          <span className="code-ell">{toolTitle(t, p)}</span>
        </div>
      </div>
    );
  });
  return (<>
    <div className="content-top">
      <span className="title">{session.state === "ready" ? session.data.title || t("code.untitled") : ""}</span>
      <span className={"badge " + (busy ? "run" : status === "error" ? "err" : "ok")} style={{ marginLeft: 8 }}>{busy && <span className="spin" />}{busy ? t("code.status.running") : status === "error" ? t("code.status.failed") : t("code.status.ready")}</span>
      <div className="spacer" />
      {busy && <button className="btn secondary" style={{ height: 28 }} data-testid="code-stop" onClick={() => void api.sessions.abort(id).catch(() => {})}><Icon name="stop" size={16} />{t("code.terminal.stop")}</button>}
    </div>
    <div className="split">
      <div className="split-l">
        {msgs.map(row)}
        {asks.map((p) => <PermissionAsk key={p.id} p={p} />)}
        {lastError && !busy && <div className="banner err code-banner"><Icon name="x-circle" size={16} /><span>{t("code.session.errorTitle")}</span><span className="grow">{t("code.session.errorBody")}</span></div>}
        <div style={{ flex: 1 }} />
        <TestIdComposer id="code-composer-input"><Composer placeholder={t("code.session.placeholder")} models={[t("code.model.fast"), t("code.model.thinking")]} onSend={send} disabled={busy} /></TestIdComposer>
      </div>
      <div className="split-r">
        <div className="pane-head"><Segmented items={views} value={view} onChange={setView} /><div className="spacer" />{edits.length > 0 && <><span className="mono" style={{ color: "color-mix(in srgb, var(--green) 65%, var(--t1))" }}>+{adds}</span><span className="mono" style={{ color: "var(--red)", marginLeft: 6 }}>−{dels}</span></>}</div>
        {view === views[0] ? (
          edits.length ? edits.map((p) => (
            <div className="diff" key={p.id}>
              <div className="code-head"><Icon name="file-code" size={16} /><span style={{ marginLeft: 6 }}>{toolTitle(t, p)}</span><IconBtn icon="copy" label={t("code.copyPath")} onClick={() => void navigator.clipboard?.writeText(inputOf(p).path ?? "")} /></div>
              <pre>{toolDiff(p).map((l, i) => <div key={i} className={diffClass(l)}>{l || " "}</div>)}</pre>
            </div>
          )) : <div className="empty"><Icon name="diff" size={20} /><p>{t("code.session.noChanges")}</p></div>
        ) : runs.length ? (
          <pre className="term" key="t">{runs.map((p) => `$ ${inputOf(p).command}\n${p.state.status === "completed" ? p.state.output : p.state.status === "error" ? t("chat.err.tool_failed.body") : ""}`).join("\n\n")}</pre>
        ) : <div className="empty"><Icon name="terminal" size={20} /><p>{t("code.session.noCommands")}</p></div>}
      </div>
    </div>
  </>);
}
