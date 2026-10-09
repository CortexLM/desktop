// Home and conversation: live engine path plus the preview transcript.
import * as React from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import type { MessageWithParts, Part, ToolPart, FilePart, PromptPartInput } from "@cortex/schema";
import { Gel, Icon, IconBtn, Pop, MItem, MSep, useToast } from "../../kit/ui";
import { Composer, startPreviewChat, previewChatStart, type ComposerAttachment } from "../../components/composer";
import { Mascot } from "../../mascot/Mascot";
import { api } from "../../api";
import { useMessages, usePermissions, useProjects, useQuery } from "../../state/live";
import { toolName, toolTitle } from "../../state/tool-label";
import { navigation, readHash, useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview, useFixtures, usePreviewBot } from "../../preview";
import { Actions, Att, BotRow, Paras, css, useBotCfg, useFx } from "./shared";
import { ModelComposer, useModels, type ComposerLeaveGuard, type SendOptions } from "./model-composer";
import { readRaster } from "../files/raster";
import { isTextMime } from "../files/text-data";
import { RemoteBoundary } from "./remote-chat";

const KNOWN_ERRORS = ["model_no_image_input", "model_no_pdf_input", "context_window_exceeded", "model_not_found", "provider_key_missing", "provider_auth_failed",
  "provider_rate_limited", "provider_error", "provider_disabled", "provider_unsupported", "session_busy", "aborted", "tool_failed", "permission_rejected",
  "permission_denied", "catalog_unavailable", "network"];
const errKey = (code?: string) => (code && KNOWN_ERRORS.includes(code) ? code : "generic");
const PROVIDER_ERRORS = ["provider_key_missing", "provider_auth_failed", "provider_disabled", "provider_unsupported", "model_not_found"];
const toParts = (text: string, atts: ComposerAttachment[]): PromptPartInput[] =>
  [{ type: "text", text }, ...atts.map((a): PromptPartInput => ({ type: "file", mime: a.mime, filename: a.name, url: a.dataUrl }))];

function NoProvider() {
  const t = useT();
  const { go } = useNav();
  return <div className="banner info chat-banner chat-live-banner" role="status">
    <Icon name="info" /><span>{t("chat.noProvider.title")}</span><span className="grow">{t("chat.noProvider.body")}</span>
    <button className="btn secondary" onClick={() => go("providers")}>{t("composer.addProvider")}</button>
  </div>;
}

function ErrorCard({ code, onRetry }: { code?: string; onRetry?: () => void }) {
  const t = useT();
  const { go } = useNav();
  const k = errKey(code);
  return <div className="chat-err" role="alert">
    <Icon name="alert-triangle" />
    <div className="chat-grow"><b>{code === "not_found" ? t("shell.notFound.title") : t(`chat.err.${k}.title`)}</b><span>{code === "not_found" ? t("shell.notFound.body") : t(`chat.err.${k}.body`)}</span></div>
    {code && PROVIDER_ERRORS.includes(code)
      ? <button className="btn secondary" onClick={() => go("providers")}>{t("composer.addProvider")}</button>
      : onRetry && <button className="btn secondary" onClick={onRetry}><Icon name="refresh" size={16} />{t("common.retry")}</button>}
  </div>;
}

export function Home() {
  const { params, entryKey } = useNav();
  if (params.has("id")) return <Chat />;
  if (isPreview() || params.has("project")) return <LocalHome />;
  return <RemoteBoundary key={entryKey} local={<LocalHome />} />;
}

function LocalHome() {
  const t = useT();
  const fx = useFx();
  const { go, params } = useNav();
  const toast = useToast();
  const models = useModels();
  const [noModel, setNoModel] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [previewModel, setPreviewModel] = React.useState(t("composer.model.fast"));
  const preview = isPreview();
  const projectID = params.get("project") ?? undefined;
  const sessionID = React.useRef<string | null>(null);
  const pending = React.useRef(false);
  const owner = React.useRef(false);
  React.useLayoutEffect(() => { owner.current = true; return () => { owner.current = false; }; }, []);
  const send = async (text: string, atts: ComposerAttachment[], o: SendOptions) => {
    if (!owner.current || pending.current) return false;
    pending.current = true; setSending(true);
    try {
      if (!sessionID.current) {
        const s = await api.sessions.create({ kind: "chat", model: o.model, projectID });
        if (!owner.current) return false;
        sessionID.current = s.id;
      }
      if (!owner.current) return false;
      await api.sessions.prompt(sessionID.current, { parts: toParts(text, atts), model: o.model, reasoning: o.reasoning, expectedProjectID: projectID ?? null });
      if (!owner.current) return false;
      go("home", { id: sessionID.current });
      return true;
    } catch (e) {
      const k = errKey((e as { code?: string })?.code);
      if (owner.current) toast.add({ title: t(`chat.err.${k}.title`), description: t(`chat.err.${k}.body`), data: { icon: "alert-triangle" } });
      return false;
    } finally { pending.current = false; if (owner.current) setSending(false); }
  };
  return <div className="home">
    <h1>{t("chat.home.title")}</h1>
    {!preview && (noModel || models.state === "error") && <NoProvider />}
    {preview ? <Composer placeholder={t("composer.placeholder")} onSend={(text, _, model) => startPreviewChat("chat", text, model)} onModelChange={setPreviewModel} />
      : <ModelComposer placeholder={t("composer.placeholder")} live={models} busy={sending} onStop={() => { if (sessionID.current) void api.sessions.abort(sessionID.current); }} onNoModel={() => setNoModel(true)} onSend={send} />}
    {preview && <div className="suggestions">
      {(fx.home.suggestions as string[][]).map(([g, s], i) => <button key={s} className="suggestion" style={css({ "--i": i })} onClick={() => startPreviewChat("chat", s, previewModel)}><Gel name={g} size={16} />{s}</button>)}
    </div>}
  </div>;
}

export function Chat() {
  const { params, go, entryKey } = useNav();
  const id = params.get("id");
  React.useEffect(() => { if (!id && !isPreview()) go("home", undefined, null, true); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isPreview() && params.has("source")) return <RemoteBoundary key={entryKey} explicit />;
  if (id) return <LiveChat key={id} id={id} />;
  const start = previewChatStart();
  return isPreview() ? <PreviewChat start={start} /> : null;
}

function PreviewChat({ start }: { start: ReturnType<typeof previewChatStart> }) {
  const t = useT();
  const { go } = useNav();
  const fx = useFx().chat;
  const projects = useFixtures<{ projects: { name: string }[] }>("shell").projects;
  const toast = useToast();
  const bot = useBotCfg();
  const previewBot = usePreviewBot();
  const [title, setTitle] = React.useState<string>(start?.text ?? fx.title);
  const [editing, setEditing] = React.useState<"title" | "project" | null>(null);
  const [project, setProject] = React.useState(start ? "" : projects[0]?.name ?? "");
  const [pinned, setPinned] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);
  const [msgs, setMsgs] = React.useState<{ who: "u" | "b"; text: string; code?: boolean; model?: string; prompt?: string }[]>(start ? [{ who: "u", text: start.text }] : [
    { who: "u", text: fx.q }, { who: "b", text: (fx.reply as string[]).join("\n"), code: true },
  ]);
  // ponytail: preview-only responses; live conversations use the engine stream below.
  const [queue, setQueue] = React.useState<{ text: string; model: string; replace?: number }[]>(start ? [start] : []);
  const typing = queue.length > 0;
  const next = queue[0];
  const end = React.useRef<HTMLDivElement>(null);
  const copy = async (text: string, label = t("chat.toast.answerCopied")) => {
    try { await navigator.clipboard.writeText(text); toast.add({ title: label, data: { icon: "copy" } }); }
    catch { toast.add({ title: t("chat.preview.copyFailed"), description: t("chat.preview.copyManually"), data: { icon: "copy" } }); }
  };
  React.useEffect(() => { end.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "end" }); }, [msgs, typing]);
  React.useEffect(() => {
    if (!next) return;
    const timer = window.setTimeout(() => {
      const reply = { who: "b" as const, text: t("chat.preview.reply", { text: next.text, model: next.model }), prompt: next.text, model: next.model };
      setMsgs((m) => next.replace === undefined ? [...m, reply] : m.map((old, i) => i === next.replace ? reply : old));
      setQueue((q) => q.slice(1));
    }, 1400);
    return () => clearTimeout(timer);
  }, [next, t]);
  const send = (text: string, _: ComposerAttachment[], model: string) => {
    setDeleted(false); setMsgs((m) => [...m, { who: "u", text }]); setQueue((q) => [...q, { text, model }]);
  };
  return <>
    <div className="content-top">
      {editing ? <form style={{ display: "flex", flex: 1, minWidth: 0, gap: 4 }} onSubmit={(e) => {
        e.preventDefault(); const value = String(new FormData(e.currentTarget).get("value") ?? "").trim();
        if (editing === "title" && !value) return;
        if (editing === "title") setTitle(value); else { setProject(value); toast.add({ title: t("chat.preview.projectChanged"), description: value || t("chat.preview.noProject") }); }
        setEditing(null);
      }}>{editing === "title" ? <input className="input" name="value" defaultValue={title} aria-label={t("chat.preview.titleLabel")} required autoFocus style={{ flex: 1, minWidth: 0 }} /> : <select className="input" name="value" aria-label={t("chat.preview.project")} defaultValue={project} autoFocus style={{ flex: 1, minWidth: 0 }}><option value="">{t("chat.preview.noProject")}</option>{projects.map((p) => <option key={p.name}>{p.name}</option>)}</select>}<button className="btn secondary" type="submit">{t("common.save")}</button><IconBtn type="button" icon="close" label={t("common.cancel")} onClick={() => setEditing(null)} /></form>
        : <span className="title" title={title} aria-label={title} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>}
      {pinned && <span title={t("chat.preview.pinned")} aria-label={t("chat.history.pinned")}><Icon name="pin" /></span>}
      <Pop trigger={<button className="ibtn" aria-label={t("chat.options")}><Icon name="chevron-down" size={12} /></button>}>
        <MItem icon="edit" onClick={() => setEditing("title")}>{t("chat.menu.rename")}</MItem><MItem icon="pin" onClick={() => setPinned((p) => !p)}>{t(pinned ? "chat.menu.unpin" : "chat.menu.pin")}</MItem><MItem icon="folder" onClick={() => setEditing("project")}>{t("chat.menu.move")}</MItem><MSep />
        <MItem icon="trash" danger onClick={() => {
          const saved = msgs; setQueue([]); setMsgs([]); setDeleted(true);
          toast.add({ title: t("chat.preview.deleted"), data: { undo: true, icon: "trash", onUndo: () => { setMsgs((current) => [...saved, ...current]); setDeleted(false); } } });
        }}>{t("chat.menu.delete")}</MItem>
      </Pop>
      <div className="spacer" /><IconBtn icon="compose" label={t("chat.newChat")} kbd="⌘N" onClick={() => go("home")} />
    </div>
    <div className="thread"><div className="thread-inner">
      {msgs.map((m, i) => m.who === "u"
        ? <div key={i} className="msg-user" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.text}</div>
        : <div key={i} className="msg-bot-row"><Mascot cfg={bot} state={previewBot?.live.on === false ? "asleep" : "idle"} size={22} /><div className="msg-bot" style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
            {m.text.split("\n").map((p, j) => <p key={j}>{p}</p>)}
            {m.code && <><h4>{fx.h}</h4><div className="code"><div className="code-head"><span>{fx.file}</span><IconBtn icon="copy" label={t("chat.preview.copyPlanning")} onClick={() => copy(fx.csv, t("chat.preview.planningCopied"))} /></div><pre>{fx.csv}</pre></div></>}
            <div className="msg-actions">
              <IconBtn icon="copy" label={t("chat.act.copy")} onClick={() => copy(m.text, t("chat.toast.answerCopied"))} />
              <IconBtn icon="refresh" label={t("chat.act.regen")} onClick={() => setQueue((q) => [...q, { text: m.prompt ?? msgs.slice(0, i).findLast((x) => x.who === "u")?.text ?? title, model: m.model ?? start?.model ?? t("composer.model.fast"), replace: i }])} /><IconBtn icon="share" label={t("chat.act.share")} onClick={() => copy(`${title}\n\n${m.text}`, t("chat.preview.shareCopied"))} />
            </div>
          </div></div>)}
      {deleted && <p role="status">{t("chat.preview.deleted")}</p>}
      {typing && <div className="msg-bot-row" role="status"><Mascot cfg={bot} state="thinking" size={22} /><span className="msg-bot thinking">{t("chat.preview.thinking")}{queue.length > 1 && ` ${t("chat.preview.queued", { count: queue.length })}`}</span></div>}
      <div ref={end} />
    </div></div>
    <div className="dock">{typing && <button className="btn secondary" onClick={() => { setQueue([]); toast.add({ title: t("chat.preview.stopped"), description: t("chat.preview.messagesKept") }); }}>{t("chat.preview.stop")}</button>}<Composer placeholder={t("chat.reply")} initialModel={start?.model} onSend={send} /><span className="hint">{t(start ? "chat.preview.hint" : "chat.hint")}</span></div>
  </>;
}

const textOf = (m: MessageWithParts) => m.parts.filter((p): p is Extract<Part, { type: "text" }> => p.type === "text").map((p) => p.text).join("\n");

function FileThumb({ p, onOpen, blocked }: { p: FilePart; onOpen?: () => void; blocked?: boolean }) {
  const t = useT();
  const { mime, data, url } = p;
  const raster = React.useMemo(() => readRaster({ mime, data, url }), [mime, data, url]);
  const [image, setImage] = React.useState<{ raster: typeof raster; src: string; ready: boolean } | null>(null);
  React.useEffect(() => {
    if (!raster.ok) { setImage(null); return; }
    const src = URL.createObjectURL(new Blob([raster.value.bytes], { type: raster.value.mime }));
    setImage({ raster, src, ready: false });
    return () => URL.revokeObjectURL(src);
  }, [raster]);
  if (isTextMime(mime) && onOpen) return <button type="button" className="chat-att chat-text-open" aria-label={t("files.upload.open", { name: p.filename ?? t("chat.att.file") })} onPointerDown={(e) => { if (blocked) e.preventDefault(); }} onClick={onOpen}>
    <span className="chat-att-ic" aria-hidden><Icon name="file-code" /></span><span className="chat-att-txt"><span className="ttl">{p.filename ?? t("chat.att.file")}</span><span className="sub">{t(mime.toLowerCase() === "text/markdown" ? "files.text.markdownSource" : "files.text.plainText")}</span></span>
  </button>;
  if (!image || image.raster !== raster || !raster.ok) return <Att name={p.filename ?? t("chat.att.file")} meta={p.mime} />;
  const thumbnail = <img className="chat-thumb" src={image.src} alt={p.filename ?? t("chat.att.image")} onLoad={() => setImage((current) => current?.src === image.src && !current.ready ? { ...current, ready: true } : current)} onError={() => { URL.revokeObjectURL(image.src); setImage((current) => current?.src === image.src ? null : current); }} />;
  return onOpen ? <button type="button" className="chat-thumb-open" disabled={!image.ready} aria-label={t("files.upload.open", { name: p.filename ?? t("chat.att.image") })} onPointerDown={(e) => { if (blocked) e.preventDefault(); }} onClick={onOpen}>{thumbnail}</button> : thumbnail;
}

function LiveReasoning({ text, live, secs }: { text: string; live: boolean; secs?: number }) {
  const t = useT();
  const bot = useBotCfg();
  const steps = text.split("\n").map((s) => s.trim()).filter(Boolean);
  return <Collapsible.Root className="chat-reason" defaultOpen={live} data-testid="reasoning-block">
    <Collapsible.Trigger className="chat-reason-t">
      {live ? <span className="thinking">{t("chat.thinkingName", { name: bot.name })}</span> : secs !== undefined ? <span>{t("chat.thoughtFor", { secs })}</span> : <span>{t("chat.thought")}</span>}
      <Icon name="chevron-right" size={12} className="chat-chev" />
    </Collapsible.Trigger>
    <Collapsible.Panel className="chat-reason-p"><ol>{steps.map((s, i) => <li key={i} style={css({ "--i": i })} data-last={(live && i === steps.length - 1) || undefined}>{s}</li>)}</ol></Collapsible.Panel>
  </Collapsible.Root>;
}

function ToolBlock({ p }: { p: ToolPart }) {
  const t = useT();
  const s = p.state;
  const title = toolTitle(t, p);
  const done = s.status === "completed";
  return <div className="chat-tool" data-done={done || undefined}>
    <span className="li-ic"><Icon name={s.status === "error" ? "alert-triangle" : "terminal"} /></span>
    <div className="chat-grow"><div className="chat-tool-h">
      {s.status === "pending" || s.status === "running" ? <span className="thinking">{title}</span> : <span>{title}</span>}
      {done ? <span className="badge ok"><Icon name="check" size={12} />{t("chat.tool.ok")}</span> : s.status === "error" ? <span className="badge err">{t("chat.tool.failed")}</span> : <span className="spin" />}
    </div><div className="chat-tool-sub">{toolName(t, p.tool)}</div></div>
  </div>;
}

function PermissionCard({ id, tool, input }: { id: string; tool: string; input: string }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const reply = (r: "once" | "always" | "reject") => { setBusy(true); api.permissions.reply(id, r).catch(() => setBusy(false)); };
  return <div className="banner warn" role="alertdialog" aria-label={t("chat.perm.title", { tool: toolName(t, tool) })} style={{ margin: 0, flexWrap: "wrap" }}>
    <Icon name="shield-check" /><span>{t("chat.perm.title", { tool: toolName(t, tool) })}</span>
    <span className="grow mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{input}</span>
    <button className="btn secondary" disabled={busy} onClick={() => reply("reject")}>{t("chat.perm.deny")}</button>
    <button className="btn secondary" disabled={busy} onClick={() => reply("always")}>{t("chat.perm.always")}</button>
    <button className="btn primary" disabled={busy} onClick={() => reply("once")}>{t("chat.perm.once")}</button>
  </div>;
}

function LiveChat({ id }: { id: string }) {
  const t = useT();
  const { go, params, route } = useNav();
  const toast = useToast();
  const session = useQuery(() => api.sessions.get(id), [id], (e) => e.type === "session.updated" && e.properties.session.id === id
    || e.type === "session.deleted" && e.properties.sessionID === id || e.type === "project.deleted");
  const projects = useProjects();
  const { msgs, status } = useMessages(id);
  const perms = usePermissions();
  const models = useModels();
  const [noModel, setNoModel] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [projectDraft, setProjectDraft] = React.useState<{ value: string } | null>(null);
  const [projectBusy, setProjectBusy] = React.useState(false);
  const projectWrite = React.useRef(false);
  const renameWrite = React.useRef(false);
  const [renameBusy, setRenameBusy] = React.useState(false);
  const composer = React.useRef<ComposerLeaveGuard>(null);
  const opening = React.useRef(false);
  const [leaving, setLeaving] = React.useState(false);
  const [sendError, setSendError] = React.useState<string>();
  const atChat = React.useCallback(() => {
    const hash = readHash();
    return ["home", "chat"].includes(hash.route) && !hash.params.has("preview") && !hash.params.has("shot") && hash.params.getAll("id").length === 1 && hash.params.get("id") === id;
  }, [id]);
  React.useLayoutEffect(() => {
    const sync = () => { if (opening.current && atChat()) { opening.current = false; setLeaving(false); composer.current?.resume(); } };
    navigation.addEventListener("currententrychange", sync);
    return () => navigation.removeEventListener("currententrychange", sync);
  }, [atChat]);
  const owner = React.useRef(false);
  React.useLayoutEffect(() => { owner.current = true; return () => { owner.current = false; }; }, []);
  const end = React.useRef<HTMLDivElement>(null);
  const last = msgs[msgs.length - 1];
  const open = !!last && last.info.role === "assistant" && !last.info.time.completed && !last.info.error;
  const busy = status === "busy" || status === "retry" || open || (!!last && last.info.role === "user" && status !== "error");
  const asks = perms.state === "ready" ? perms.data.filter((p) => p.sessionID === id) : [];
  const attachmentBlocked = busy || renaming || renameBusy || !!projectDraft || projectBusy;
  const attachment = (p: FilePart, m: MessageWithParts) => {
    const valid = ["home", "chat"].includes(route) && !params.has("preview") && !params.has("shot") && params.getAll("id").length === 1
      && session.state === "ready" && session.data.id === id && session.data.kind === "chat"
      && m.info.sessionID === id && p.sessionID === id && p.messageID === m.info.id
      && /^ses_[0-9a-f]{32,}$/.test(id) && /^msg_[0-9a-f]{32,}$/.test(m.info.id) && /^prt_[0-9a-f]{32,}$/.test(p.id);
    return <FileThumb key={p.id} p={p} blocked={attachmentBlocked} onOpen={valid ? () => {
      if (!owner.current || opening.current || !atChat()) return;
      if (attachmentBlocked || projectWrite.current || renameWrite.current || !composer.current?.tryLeave()) {
        toast.add({ title: t("files.image.finishDraft"), data: { icon: "info" } }); return;
      }
      opening.current = true; setLeaving(true);
      try { go(isTextMime(p.mime) ? "file-code" : "file-image", { session: id, message: m.info.id, part: p.id }); }
      catch { opening.current = false; setLeaving(false); composer.current?.resume(); }
    } : undefined} />;
  };
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, asks.length]);
  const title = session.state === "ready" ? session.data.title || t("chat.untitled") : "";
  const prompt = (parts: PromptPartInput[], o?: SendOptions) => {
    setSendError(undefined);
    return opening.current ? Promise.resolve(false) : api.sessions.prompt(id, { parts, model: o?.model, reasoning: o?.reasoning, ...(session.state === "ready" && !session.data.parentID ? { expectedProjectID: session.data.projectID ?? null } : {}) }).then(() => true, (e: { code?: string }) => {
      if (owner.current) setSendError(errKey(e?.code));
      return false;
    });
  };
  const retry = (before: number) => {
    const u = msgs.slice(0, before).reverse().find((m) => m.info.role === "user");
    if (u) void prompt(u.parts.filter((p): p is Extract<Part, { type: "text" | "file" }> => p.type === "text" || p.type === "file"));
  };
  const remove = () => {
    if (opening.current) return;
    let undone = false;
    toast.add({ title: t("chat.toast.deleted"), description: title, data: { undo: true, icon: "trash", onUndo: () => { undone = true; go("home", { id }); } },
      onClose: () => { if (!undone) api.sessions.delete(id).catch(() => { if (readHash().route === "home") go("home", { id }); toast.add({ title: t("chat.err.generic.title"), data: { icon: "alert-triangle" } }); }); } });
    go("home");
  };
  const movable = session.state === "ready" && session.data.kind === "chat" && !session.data.parentID;
  const projectMissing = !!projectDraft?.value && projects.state === "ready" && !projects.data.some((p) => p.id === projectDraft.value);
  const move = async () => {
    if (!owner.current || opening.current || projectWrite.current || !projectDraft || !movable || projects.state !== "ready" || projectMissing) return;
    const submitted = projectDraft;
    projectWrite.current = true; setProjectBusy(true);
    try {
      await api.sessions.update(id, { projectID: submitted.value || null });
      if (owner.current) { session.reload(); setProjectDraft((current) => current === submitted ? null : current); }
    } catch (e) {
      const k = errKey((e as { code?: string })?.code);
      if (owner.current) toast.add({ title: t(`chat.err.${k}.title`), description: k === "session_busy" ? t(`chat.err.${k}.body`) : undefined, data: { icon: "alert-triangle" } });
    } finally { projectWrite.current = false; if (owner.current) setProjectBusy(false); }
  };
  return <>
    <div className="content-top" inert={leaving}>
      {projectDraft ? <form style={{ display: "flex", flex: 1, minWidth: 0, gap: 4 }} aria-busy={projectBusy || projects.state === "loading"} onSubmit={(e) => { e.preventDefault(); void move(); }}>
        <select className="input" name="value" aria-label={t("chat.preview.project")} value={projectDraft.value} onChange={(e) => setProjectDraft({ value: e.target.value })} disabled={!movable || projects.state !== "ready"} autoFocus style={{ flex: 1, minWidth: 0 }}>
          <option value="">{t("chat.preview.noProject")}</option>
          {projectDraft.value && (projects.state !== "ready" || projectMissing) && <option value={projectDraft.value} disabled>{t(projectMissing ? "system.project.missingTitle" : "system.variant.loading")}</option>}
          {projects.state === "ready" && projects.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn secondary" type="submit" disabled={projectBusy || !movable || projects.state !== "ready" || projectMissing}>{t("common.save")}</button>
        <IconBtn type="button" icon="close" label={t("common.cancel")} onClick={() => setProjectDraft(null)} />
      </form> : renaming
        ? <input className="input pg-rename" autoFocus defaultValue={title} aria-label={t("chat.history.newName")} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(false); }}
          onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== title) { renameWrite.current = true; setRenameBusy(true); api.sessions.update(id, { title: v }).then(session.reload, () => {}).finally(() => { renameWrite.current = false; if (owner.current) setRenameBusy(false); }); } setRenaming(false); }} />
        : <span className="title">{title}</span>}
      <Pop trigger={<button className="ibtn" aria-label={t("chat.options")}><Icon name="chevron-down" size={12} /></button>}>
        <MItem icon="edit" onClick={() => { if (!opening.current && !renameWrite.current) { setProjectDraft(null); setRenaming(true); } }}>{t("chat.menu.rename")}</MItem>
        {movable && <MItem icon="folder" onClick={() => { if (!opening.current) { setRenaming(false); setProjectDraft({ value: session.data.projectID ?? "" }); projects.reload(); } }}>{t("chat.menu.move")}</MItem>}<MSep />
        <MItem icon="trash" danger onClick={remove}>{t("chat.menu.delete")}</MItem>
      </Pop>
    </div>
    <div className="thread"><div className="thread-inner">
      {session.state === "error" && <ErrorCard code={session.code === "not_found" ? "not_found" : "network"} />}
      {projectDraft && projects.state === "loading" && <div className="thinking" role="status">{t("system.variant.loading")}</div>}
      {projectDraft && projects.state === "error" && <ErrorCard code="network" onRetry={projects.reload} />}
      {sendError && !msgs.some((m) => m.info.error && errKey(m.info.error.code) === sendError) && <ErrorCard code={sendError} />}
      {msgs.map((m, mi) => {
        if (m.info.role === "user") {
          const files = m.parts.filter((p): p is FilePart => p.type === "file");
          const text = textOf(m);
          return <div key={m.info.id} className="chat-ucol">{files.length > 0 && <div className="chat-ufiles">{files.map((p) => attachment(p, m))}</div>}{text && <div className="msg-user msg-user-live">{text}</div>}</div>;
        }
        const isLast = mi === msgs.length - 1;
        const streaming = isLast && busy;
        const secs = m.info.time.completed ? Math.max(1, Math.round((m.info.time.completed - m.info.time.created) / 1000)) : undefined;
        const visible = m.parts.filter((p) => p.type === "text" || p.type === "reasoning" || p.type === "tool" || p.type === "file");
        const lastText = [...visible].reverse().find((p) => p.type === "text");
        return <BotRow key={m.info.id} st={m.info.error ? "blocked" : streaming ? (lastText ? "talking" : "thinking") : "idle"}>
          {visible.length === 0 && streaming && <span className="thinking">{t("chat.thinking")}</span>}
          {visible.map((p) => {
            if (p.type === "reasoning") return <LiveReasoning key={p.id} text={p.text} live={streaming && p === visible[visible.length - 1]} secs={secs} />;
            if (p.type === "tool") return <ToolBlock key={p.id} p={p} />;
            if (p.type === "file") return attachment(p, m);
            if (p.type === "text") return <Paras key={p.id} text={p.text} caret={streaming && p === lastText} testId="assistant-text" />;
            return null;
          })}
          {m.info.error && m.info.error.code !== "aborted" && <ErrorCard code={m.info.error.code} onRetry={() => retry(mi)} />}
          {m.info.error?.code === "aborted" && <div className="chat-note"><Icon name="stop" size={12} />{t("chat.stopped")}</div>}
          {!streaming && !m.info.error && <Actions text={textOf(m)} regen={() => retry(mi)} />}
        </BotRow>;
      })}
      {last?.info.role === "user" && busy && <BotRow st="thinking"><span className="thinking">{t("chat.thinking")}</span></BotRow>}
      {asks.map((p) => <PermissionCard key={p.id} id={p.id} tool={p.tool} input={p.input} />)}
      <div ref={end} />
    </div></div>
    <div className="dock">
      {(noModel || models.state === "error") && <NoProvider />}
      <ModelComposer leaveGuard={composer} placeholder={t("chat.reply")} live={models} busy={busy} onStop={() => api.sessions.abort(id).catch(() => {})} onNoModel={() => setNoModel(true)} onSend={(text, atts, o) => prompt(toParts(text, atts), o)} />
      <span className="hint">{t("chat.hint")}</span>
    </div>
  </>;
}
