// Home and conversation (design "home", "chat"): live engine path plus the preview transcript.
import * as React from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import type { MessageWithParts, Part, ToolPart, FilePart, PromptPartInput } from "@cortex/schema";
import { Gel, Icon, IconBtn, Pop, MItem, MSep, useToast } from "../../kit/ui";
import { Composer, type ComposerAttachment } from "../../components/composer";
import { Mascot } from "../../mascot/Mascot";
import { api } from "../../api";
import { useMessages, usePermissions, useQuery } from "../../state/live";
import { useNav } from "../../shell/nav";
import { useT } from "../../i18n";
import { isPreview } from "../../preview";
import { Actions, Att, BotRow, Paras, css, useBotCfg, useCopy, useFx } from "./shared";
import { ModelComposer, useModels, type SendOptions } from "./model-composer";

const KNOWN_ERRORS = ["model_no_image_input", "model_no_pdf_input", "context_window_exceeded", "model_not_found", "provider_key_missing", "provider_auth_failed",
  "provider_rate_limited", "provider_error", "provider_disabled", "provider_unsupported", "session_busy", "aborted", "tool_failed", "permission_rejected",
  "permission_denied", "catalog_unavailable", "network"];
/** Maps an engine error code to Cortex copy. Raw messages and vendor names never reach the screen. */
const errKey = (code?: string) => (code && KNOWN_ERRORS.includes(code) ? code : "generic");
const PROVIDER_ERRORS = ["provider_key_missing", "provider_auth_failed", "provider_disabled", "provider_unsupported", "model_not_found"];

const toParts = (text: string, atts: ComposerAttachment[]): PromptPartInput[] =>
  [{ type: "text", text }, ...atts.map((a): PromptPartInput => ({ type: "file", mime: a.mime, filename: a.name, url: a.dataUrl }))];

function NoProvider() {
  const t = useT();
  const { go } = useNav();
  return (
    <div className="banner info chat-banner chat-live-banner" role="status">
      <Icon name="info" /><span>{t("chat.noProvider.title")}</span><span className="grow">{t("chat.noProvider.body")}</span>
      <button className="btn secondary" onClick={() => go("settings", { section: "providers" })}>{t("chat.noProvider.cta")}</button>
    </div>
  );
}

function ErrorCard({ code, onRetry }: { code?: string; onRetry?: () => void }) {
  const t = useT();
  const { go } = useNav();
  const k = errKey(code);
  return (
    <div className="chat-err" role="alert">
      <Icon name="alert-triangle" />
      <div className="chat-grow"><b>{t(`chat.err.${k}.title`)}</b><span>{t(`chat.err.${k}.body`)}</span></div>
      {code && PROVIDER_ERRORS.includes(code)
        ? <button className="btn secondary" onClick={() => go("settings", { section: "providers" })}>{t("chat.noProvider.cta")}</button>
        : onRetry && <button className="btn secondary" onClick={onRetry}><Icon name="refresh" size={16} />{t("common.retry")}</button>}
    </div>
  );
}

/* ---------------------------------------------------------------- Home */
export function Home() {
  const t = useT();
  const fx = useFx();
  const { go } = useNav();
  const toast = useToast();
  const models = useModels();
  const [noModel, setNoModel] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const preview = isPreview();
  const send = async (text: string, atts: ComposerAttachment[], o: SendOptions) => {
    setSending(true);
    try {
      const s = await api.sessions.create({ kind: "chat", model: o.model });
      await api.sessions.prompt(s.id, { parts: toParts(text, atts), model: o.model, reasoning: o.reasoning });
      go("chat", { id: s.id });
    } catch (e) {
      const k = errKey((e as { code?: string })?.code);
      toast.add({ title: t(`chat.err.${k}.title`), description: t(`chat.err.${k}.body`), data: { icon: "alert-triangle" } });
    } finally { setSending(false); }
  };
  return (<>
    <div className="content-top"><div className="spacer" /><IconBtn icon="refresh" label={t("chat.refresh")} /><IconBtn icon="compose" label={t("chat.newChat")} kbd="⌘N" onClick={() => go("home")} /></div>
    <div className="home">
      <h1>{t("chat.home.title")}</h1>
      {!preview && (noModel || models.state === "error") && <NoProvider />}
      {preview ? <Composer placeholder={t("composer.placeholder")} onSend={() => go("chat")} />
        : <ModelComposer placeholder={t("composer.placeholder")} live={models} busy={sending} onNoModel={() => setNoModel(true)} onSend={send} />}
      {preview && <div className="suggestions">
        {(fx.home.suggestions as string[][]).map(([g, s], i) => <button key={s} className="suggestion" style={css({ "--i": i })} onClick={() => go("chat")}><Gel name={g} size={20} />{s}</button>)}
      </div>}
    </div>
  </>);
}

/* ---------------------------------------------------------------- Chat */
export function Chat() {
  const { params, go } = useNav();
  const id = params.get("id");
  React.useEffect(() => { if (!id && !isPreview()) go("home"); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (id) return <LiveChat key={id} id={id} />;
  return isPreview() ? <PreviewChat /> : null;
}

function PreviewChat() {
  const t = useT();
  const fx = useFx().chat;
  const toast = useToast();
  const bot = useBotCfg();
  const [msgs, setMsgs] = React.useState<{ who: "u" | "b"; text: string; code?: boolean }[]>([
    { who: "u", text: fx.q },
    { who: "b", text: (fx.reply as string[]).join("\n"), code: true },
  ]);
  const [typing, setTyping] = React.useState(false);
  const [talking, setTalking] = React.useState(-1);
  const end = React.useRef<HTMLDivElement>(null);
  const copy = useCopy();
  React.useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing]);
  const send = (text: string) => {
    setMsgs((m) => [...m, { who: "u", text }]); setTyping(true);
    setTimeout(() => { setTyping(false); setTalking(msgs.length + 1); setTimeout(() => setTalking(-1), 1800); setMsgs((m) => [...m, { who: "b", text: fx.ack }]); }, 1400);
  };
  return (<>
    <div className="content-top">
      <span className="title">{fx.title}</span>
      <Pop trigger={<button className="ibtn" aria-label={t("chat.options")}><Icon name="chevron-down" size={12} /></button>}>
        <MItem icon="edit">{t("chat.menu.rename")}</MItem><MItem icon="pin">{t("chat.menu.pin")}</MItem><MItem icon="folder">{t("chat.menu.move")}</MItem><MSep />
        <MItem icon="trash" danger onClick={() => toast.add({ title: t("chat.toast.deleted"), description: fx.title, data: { undo: true, icon: "trash" } })}>{t("chat.menu.delete")}</MItem>
      </Pop>
      <div className="spacer" /><IconBtn icon="compose" label={t("chat.newChat")} kbd="⌘N" />
    </div>
    <div className="thread"><div className="thread-inner">
      {msgs.map((m, i) => m.who === "u"
        ? <div key={i} className="msg-user">{m.text}</div>
        : <div key={i} className="msg-bot-row"><Mascot cfg={bot} state={talking === i ? "talking" : "asleep"} size={22} /><div className="msg-bot" style={{ flex: 1, minWidth: 0 }}>
            {m.text.split("\n").map((p, j) => <p key={j}>{p}</p>)}
            {m.code && <>
              <h4>{fx.h}</h4>
              <div className="code"><div className="code-head"><span>{fx.file}</span><IconBtn icon="copy" label={t("chat.act.copy")} onClick={() => copy(fx.csv)} /></div><pre>{fx.csv}</pre></div>
            </>}
            <div className="msg-actions">
              <IconBtn icon="copy" label={t("chat.act.copy")} onClick={() => copy(m.text, t("chat.toast.answerCopied"))} />
              <IconBtn icon="refresh" label={t("chat.act.regen")} /><IconBtn icon="share" label={t("chat.act.share")} />
            </div>
          </div></div>)}
      {typing && <div className="msg-bot-row"><Mascot cfg={bot} state="thinking" size={22} /><span className="msg-bot thinking">{t("chat.thinkingName", { name: bot.name })}</span></div>}
      <div ref={end} />
    </div></div>
    <div className="dock"><Composer placeholder={t("chat.reply")} onSend={send} /><span className="hint">{t("chat.hint")}</span></div>
  </>);
}

const textOf = (m: MessageWithParts) => m.parts.filter((p): p is Extract<Part, { type: "text" }> => p.type === "text").map((p) => p.text).join("\n");

function FileThumb({ p }: { p: FilePart }) {
  const t = useT();
  const src = p.url ?? (p.data ? `data:${p.mime};base64,${p.data}` : undefined);
  if (p.mime.startsWith("image/") && src) return <img className="chat-thumb" src={src} alt={p.filename ?? t("chat.att.image")} />;
  return <Att name={p.filename ?? t("chat.att.file")} meta={p.mime} />;
}

function LiveReasoning({ text, live, secs }: { text: string; live: boolean; secs?: number }) {
  const t = useT();
  const bot = useBotCfg();
  const steps = text.split("\n").map((s) => s.trim()).filter(Boolean);
  return (
    <Collapsible.Root className="chat-reason" defaultOpen={live} data-testid="reasoning-block">
      <Collapsible.Trigger className="chat-reason-t">
        {live ? <span className="thinking">{t("chat.thinkingName", { name: bot.name })}</span> : secs !== undefined ? <span>{t("chat.thoughtFor", { secs })}</span> : <span>{t("chat.thought")}</span>}
        <Icon name="chevron-right" size={12} className="chat-chev" />
      </Collapsible.Trigger>
      <Collapsible.Panel className="chat-reason-p">
        <ol>{steps.map((s, i) => <li key={i} style={css({ "--i": i })} data-last={(live && i === steps.length - 1) || undefined}>{s}</li>)}</ol>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function ToolBlock({ p }: { p: ToolPart }) {
  const t = useT();
  const s = p.state;
  const title = ("title" in s && s.title) || p.tool;
  const done = s.status === "completed";
  return (
    <div className="chat-tool" data-done={done || undefined}>
      <span className="li-ic"><Icon name={s.status === "error" ? "alert-triangle" : "terminal"} /></span>
      <div className="chat-grow">
        <div className="chat-tool-h">
          {s.status === "pending" || s.status === "running" ? <span className="thinking">{title}</span> : <span>{title}</span>}
          {done ? <span className="badge ok"><Icon name="check" size={12} />{t("chat.tool.ok")}</span>
            : s.status === "error" ? <span className="badge err">{t("chat.tool.failed")}</span>
            : <span className="spin" />}
        </div>
        <div className="chat-tool-sub">{p.tool}</div>
      </div>
    </div>
  );
}

function PermissionCard({ id, tool, input }: { id: string; tool: string; input: string }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const reply = (r: "once" | "always" | "reject") => { setBusy(true); api.permissions.reply(id, r).catch(() => setBusy(false)); };
  return (
    <div className="banner warn" role="alertdialog" aria-label={t("chat.perm.title", { tool })} style={{ margin: 0, flexWrap: "wrap" }}>
      <Icon name="shield-check" />
      <span>{t("chat.perm.title", { tool })}</span>
      <span className="grow mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{input}</span>
      <button className="btn secondary" disabled={busy} onClick={() => reply("reject")}>{t("chat.perm.deny")}</button>
      <button className="btn secondary" disabled={busy} onClick={() => reply("always")}>{t("chat.perm.always")}</button>
      <button className="btn primary" disabled={busy} onClick={() => reply("once")}>{t("chat.perm.once")}</button>
    </div>
  );
}

function LiveChat({ id }: { id: string }) {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const session = useQuery(() => api.sessions.get(id), [id], (e) => e.type === "session.updated");
  const { msgs, status } = useMessages(id);
  const perms = usePermissions();
  const models = useModels();
  const [noModel, setNoModel] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);
  const last = msgs[msgs.length - 1];
  const open = !!last && last.info.role === "assistant" && !last.info.time.completed && !last.info.error;
  const busy = status === "busy" || status === "retry" || open || (!!last && last.info.role === "user" && status !== "error");
  const asks = perms.state === "ready" ? perms.data.filter((p) => p.sessionID === id) : [];
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, asks.length]);

  const title = session.state === "ready" ? session.data.title || t("chat.untitled") : "";
  const prompt = (parts: PromptPartInput[], o?: SendOptions) =>
    api.sessions.prompt(id, { parts, model: o?.model, reasoning: o?.reasoning }).catch((e: { code?: string }) => {
      const k = errKey(e?.code);
      toast.add({ title: t(`chat.err.${k}.title`), description: t(`chat.err.${k}.body`), data: { icon: "alert-triangle" } });
    });
  const retry = () => {
    const u = [...msgs].reverse().find((m) => m.info.role === "user");
    if (u) prompt([{ type: "text", text: textOf(u) }]);
  };
  const remove = () => {
    let undone = false;
    toast.add({ title: t("chat.toast.deleted"), description: title, data: { undo: true, icon: "trash", onUndo: () => { undone = true; go("chat", { id }); } },
      onClose: () => { if (!undone) api.sessions.delete(id).catch(() => {}); } });
    go("home");
  };

  return (<>
    <div className="content-top">
      {renaming
        ? <input className="input pg-rename" autoFocus defaultValue={title} aria-label={t("chat.history.newName")}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(false); }}
            onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== title) api.sessions.update(id, { title: v }).then(session.reload, () => {}); setRenaming(false); }} />
        : <span className="title">{title}</span>}
      <Pop trigger={<button className="ibtn" aria-label={t("chat.options")}><Icon name="chevron-down" size={12} /></button>}>
        <MItem icon="edit" onClick={() => setRenaming(true)}>{t("chat.menu.rename")}</MItem><MSep />
        <MItem icon="trash" danger onClick={remove}>{t("chat.menu.delete")}</MItem>
      </Pop>
      <div className="spacer" /><IconBtn icon="compose" label={t("chat.newChat")} kbd="⌘N" onClick={() => go("home")} />
    </div>
    <div className="thread"><div className="thread-inner">
      {session.state === "error" && <ErrorCard code={session.code === "not_found" ? undefined : "network"} />}
      {msgs.map((m, mi) => {
        if (m.info.role === "user") {
          const files = m.parts.filter((p): p is FilePart => p.type === "file");
          const text = textOf(m);
          return (
            <div key={m.info.id} className="chat-ucol">
              {files.length > 0 && <div className="chat-ufiles">{files.map((p) => <FileThumb key={p.id} p={p} />)}</div>}
              {text && <div className="msg-user">{text}</div>}
            </div>
          );
        }
        const isLast = mi === msgs.length - 1;
        const streaming = isLast && busy;
        const secs = m.info.time.completed ? Math.max(1, Math.round((m.info.time.completed - m.info.time.created) / 1000)) : undefined;
        const visible = m.parts.filter((p) => p.type === "text" || p.type === "reasoning" || p.type === "tool" || p.type === "file");
        const lastText = [...visible].reverse().find((p) => p.type === "text");
        return (
          <BotRow key={m.info.id} st={m.info.error ? "blocked" : streaming ? (lastText ? "talking" : "thinking") : "idle"}>
            {visible.length === 0 && streaming && <span className="thinking">{t("chat.thinking")}</span>}
            {visible.map((p) => {
              if (p.type === "reasoning") return <LiveReasoning key={p.id} text={p.text} live={streaming && p === visible[visible.length - 1]} secs={secs} />;
              if (p.type === "tool") return <ToolBlock key={p.id} p={p} />;
              if (p.type === "file") return <FileThumb key={p.id} p={p} />;
              if (p.type === "text") return <Paras key={p.id} text={p.text} caret={streaming && p === lastText} testId="assistant-text" />;
              return null;
            })}
            {m.info.error && m.info.error.code !== "aborted" && <ErrorCard code={m.info.error.code} onRetry={retry} />}
            {m.info.error?.code === "aborted" && <div className="chat-note"><Icon name="stop" size={12} />{t("chat.stopped")}</div>}
            {!streaming && !m.info.error && <Actions text={textOf(m)} regen={retry} />}
          </BotRow>
        );
      })}
      {last?.info.role === "user" && busy && <BotRow st="thinking"><span className="thinking">{t("chat.thinking")}</span></BotRow>}
      {asks.map((p) => <PermissionCard key={p.id} id={p.id} tool={p.tool} input={p.input} />)}
      <div ref={end} />
    </div></div>
    <div className="dock">
      {(noModel || models.state === "error") && <NoProvider />}
      <ModelComposer placeholder={t("chat.reply")} live={models} busy={busy} onStop={() => api.sessions.abort(id).catch(() => {})} onNoModel={() => setNoModel(true)}
        onSend={(text, atts, o) => prompt(toParts(text, atts), o)} />
      <span className="hint">{t("chat.hint")}</span>
    </div>
  </>);
}
