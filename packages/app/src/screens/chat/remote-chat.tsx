import * as React from "react";
import {
  RemoteFile, RemoteHistoryWindow, RemoteMessageView, RemoteSessionView,
  type RemoteModel, type RemotePart, type RemoteUploadInput,
} from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Icon, IconBtn } from "../../kit/ui";
import { onEvent } from "../../state/live";
import { useSendEnter } from "../../state/send-enter";
import { navigation, readHash, useNav } from "../../shell/nav";
import { Att, BotRow, Paras } from "./shared";
import type { ComposerLeaveGuard } from "./model-composer";

type Effort = "low" | "medium" | "high";
type Draft = { text: string; files: File[]; oneOff: string };
type Submitted = { draft: Draft; attachmentIDs: string[]; id: string; epoch: string };
const emptyDraft = (): Draft => ({ text: "", files: [], oneOff: "" });
const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
// ponytail: one renderer-local handoff; persistent drafts need engine-owned storage.
let draftHandoff: {
  entryKey: string; id: string; epoch: string; draft: Draft; clear(): void;
} | undefined;

// A mounted outgoing screen is not necessarily the current navigation owner.
function useRemoteOwner() {
  const { route, params, entryKey } = useNav();
  const query = params.toString();
  const live = React.useRef(false), version = React.useRef(0);
  const [revision, setRevision] = React.useState(0);
  const current = React.useCallback(() => {
    const hash = readHash();
    return live.current && hash.entryKey === entryKey && hash.route === route
      && hash.params.toString() === query && !hash.params.has("preview") && !hash.params.has("shot");
  }, [entryKey, route, query]);
  React.useLayoutEffect(() => {
    live.current = true;
    const generation = version;
    const changed = () => {
      version.current++;
      if (current()) setRevision(version.current);
    };
    navigation.addEventListener("currententrychange", changed);
    return () => {
      live.current = false; generation.current++;
      navigation.removeEventListener("currententrychange", changed);
    };
  }, [current]);
  const capture = React.useCallback(() => {
    const n = version.current;
    return () => n === version.current && current();
  }, [current]);
  return { current, capture, revision };
}

export function RemoteBoundary({ local, explicit = false }: { local?: React.ReactNode; explicit?: boolean }) {
  const t = useT();
  const { params, go } = useNav();
  const { capture, current, revision } = useRemoteOwner();
  const [attempt, retry] = React.useReducer((n: number) => n + 1, 0);
  const [state, setState] = React.useState<"loading" | "local" | "remote" | "signed-out" | "error">("loading");
  const valid = !explicit || params.getAll("source").length === 1 && params.get("source") === "remote"
    && params.getAll("epoch").length === 1 && !!params.get("epoch")
    && params.getAll("id").length === 1 && !!params.get("id") && !params.has("project");
  React.useEffect(() => {
    const owns = capture();
    if (!valid || !owns()) return;
    api.connection.get().then((connection) => {
      if (!owns()) return;
      setState(connection.mode === "local" ? explicit ? "error" : "local" : connection.signedIn ? "remote" : "signed-out");
    }, () => { if (owns()) setState("error"); });
  }, [capture, revision, attempt, explicit, valid]);
  if (!valid) return <div className="chat-err" role="alert">{t("chat.remote.invalidOwner")}</div>;
  if (state === "local") return local;
  if (state === "remote") return <RemoteChat id={explicit ? params.get("id")! : undefined} epoch={explicit ? params.get("epoch")! : undefined} />;
  return <div className="home">
    <h1>{t("chat.home.title")}</h1>
    <div className="banner info chat-live-banner" role={state === "error" ? "alert" : "status"}>
      <span>{t(state === "loading" ? "system.variant.loading" : state === "signed-out" ? "chat.remote.signInRequired" : "chat.remote.unavailable")}</span>
      {state === "signed-out" && <button className="btn primary" onClick={() => { if (current()) go("login"); }}>{t("chat.remote.signIn")}</button>}
      {state === "error" && <button className="btn secondary" onClick={() => { if (current()) retry(); }}>{t("common.retry")}</button>}
    </div>
  </div>;
}

function RemotePartView({ part, assistant }: { part: RemotePart; assistant: boolean }) {
  const t = useT();
  if (part.type === "text") return <Paras text={part.text} testId={assistant ? "assistant-text" : undefined} />;
  if (part.type === "reasoning") return <details className="chat-reason">
    <summary className="chat-reason-t">{t("chat.thought")}{part.durationMs !== undefined && <span>{t("chat.remote.duration", { ms: part.durationMs })}</span>}</summary>
    <div className="chat-reason-p" style={{ whiteSpace: "pre-wrap" }}>{part.text}</div>
  </details>;
  if (part.type === "file") return <Att name={part.file.filename} meta={t("chat.remote.fileMetadata", { mime: part.file.contentType, bytes: part.file.byteSize })} />;
  if (part.type === "tool") return <div className="chat-tool">
    <Icon name="terminal" /><span>{t(`chat.remote.tool.${part.status}`)}</span>
    {part.durationMs !== undefined && <span>{t("chat.remote.duration", { ms: part.durationMs })}</span>}
  </div>;
  if (part.type === "unsupported") return <div className="chat-note" role="status">
    {t(`chat.remote.unsupported.${part.kind}`)} {part.blocking && t("chat.remote.blocking")}
  </div>;
  if (part.type === "disclosure") return <div className="banner info" role={part.blocking ? "alert" : "status"} style={{ whiteSpace: "pre-wrap" }}>
    <span>{part.text}</span>{part.blocking && <span>{t("chat.remote.blocking")}</span>}
  </div>;
  return <div className="banner warn" role="alert" style={{ display: "block", whiteSpace: "pre-wrap" }}>
    <b>{t(`chat.remote.safety.${part.severity}`)}</b><p>{part.text}</p>
    <p>{part.referral.name}</p><p>{part.referral.contact}</p><p>{part.referral.note}</p>
  </div>;
}

function RemoteChat({ id, epoch }: { id?: string; epoch?: string }) {
  const t = useT();
  const { go } = useNav();
  const owner = useRemoteOwner();
  const { capture, current, revision } = owner;
  const enter = useSendEnter();
  const [session, setSession] = React.useState<RemoteSessionView | null>(null);
  const record = React.useRef<RemoteSessionView | null>(null);
  const binding = React.useRef(epoch);
  const removed = React.useRef(false);
  const [models, setModels] = React.useState<RemoteModel[]>([]);
  const [model, setModel] = React.useState("");
  const [effort, setEffort] = React.useState<Effort>("medium");
  const [messages, setMessages] = React.useState<RemoteMessageView[]>([]);
  const [history, setHistory] = React.useState<RemoteHistoryWindow | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const pending = React.useRef(false);
  const detaching = React.useRef(false);
  const [detachBusy, setDetachBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const draftRef = React.useRef(draft);
  const submitted = React.useRef<Submitted | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const locked = React.useRef(false);
  const [leaving, setLeaving] = React.useState(false);
  const sequence = React.useRef(0);
  const refresh = React.useRef<() => void>(() => {});
  const [attempt, retry] = React.useReducer((n: number) => n + 1, 0);
  const end = React.useRef<HTMLDivElement>(null);
  const mutate = (next: Draft) => {
    if (!current() || !loaded || locked.current || pending.current || removed.current) return;
    draftRef.current = next; setDraft(next);
  };
  const matches = (value: RemoteSessionView, target: string, expected: string) =>
    value.source === "remote" && value.scope === "process" && value.id === target && value.epoch === expected;
  const fail = (): never => { throw new Error("Remote ownership mismatch"); };

  React.useEffect(() => {
    const owns = capture();
    let active = true;
    const reads = sequence;
    const valid = () => active && owns() && !removed.current;
    pending.current = false; setBusy(false);
    detaching.current = false; setDetachBusy(false);
    locked.current = false; setLeaving(false);
    const read = async () => {
      const target = record.current?.id ?? id, expected = binding.current;
      if (!target || !expected || !valid()) return;
      const n = ++sequence.current;
      try {
        const [raw, rows] = await Promise.all([api.remoteSessions.get(target), api.remoteSessions.messages(target)]);
        if (!valid() || n !== sequence.current) return;
        const value = RemoteSessionView.parse(raw);
        const parsed = rows.map((row) => RemoteMessageView.parse(row));
        if (!matches(value, target, expected) || parsed.some((row) => row.sessionID !== target)) fail();
        const handoff = draftHandoff;
        if (handoff?.entryKey === readHash().entryKey && handoff.id === target && handoff.epoch === expected) {
          draftRef.current = handoff.draft;
          setDraft(handoff.draft);
          handoff.clear();
        }
        record.current = value; setSession(value); setMessages(parsed); setLoaded(true);
      } catch {
        if (valid() && n === sequence.current) { setLoaded(false); setError("unavailable"); }
      }
    };
    refresh.current = () => { void read(); };
    // Subscribe before either catalogue or transcript snapshots.
    const off = onEvent((event) => {
      if (!active || !owns() || !event.type.startsWith("remote.session.")) return;
      if (event.type !== "remote.session.changed" && event.type !== "remote.session.removed") return;
      if (event.properties.epoch !== binding.current) return;
      if (event.type === "remote.session.removed") {
        // Current main clears the entire binding on origin/account invalidation.
        removed.current = true; sequence.current++;
        record.current = null; setSession(null); setMessages([]); setHistory(null);
        setModels([]); setLoaded(false); setError("invalidOwner");
        return;
      }
      if (event.properties.sessionID === (record.current?.id ?? id)) void read();
    });
    void (async () => {
      try {
        const catalog = await api.remoteSessions.models();
        if (!valid()) return;
        if (binding.current && binding.current !== catalog.epoch) fail();
        binding.current = catalog.epoch;
        setModels(catalog.models);
        if (id || record.current) await read();
        else { setLoaded(true); setError(""); }
      } catch { if (valid()) { setLoaded(false); setError("unavailable"); } }
    })();
    return () => { active = false; reads.current++; off(); };
  }, [capture, revision, attempt, id]);

  React.useEffect(() => {
    if (current()) end.current?.scrollIntoView({ block: "end" });
  }, [messages, history, current]);

  const base = models.find((item) => item.slug === (session?.modelSlug ?? model));
  const effective = models.find((item) => item.slug === (draft.oneOff || session?.modelSlug || model));
  const historyImages = messages.some((message) => message.parts.some((part) => part.type === "file"))
    || !!history?.items.some((message) => message.attachments?.some((file) => file.content_type.startsWith("image/")));
  const deliveryBusy = !!session && !["ready", "settled"].includes(session.state);
  const modelValid = !!base && !!effective && (!session || base.reasoning !== true || session.effort !== undefined);
  const fileBlocked = draft.files.length > 0 && effective?.vision !== true;
  const instructions = enter.value === null ? t("common.sendEnterUnavailable") : enter.value ? t("system.settings.t.general.enterDesc") : t("common.sendEnterOff");
  const leaveGuard: ComposerLeaveGuard = {
    tryLeave: () => {
      if (!current() || locked.current || pending.current || detaching.current || draftRef.current.text.length || draftRef.current.files.length || draftRef.current.oneOff || deliveryBusy) return false;
      locked.current = true; setLeaving(true); return true;
    },
    resume: () => { if (current()) { locked.current = false; setLeaving(false); } },
  };
  const newChat = () => {
    if (!leaveGuard.tryLeave()) { if (current()) setError("finishDraft"); return; }
    try { go("home"); } catch { leaveGuard.resume(); }
  };

  const newChatWithDraft = async () => {
    const owns = capture(), original = record.current, next = draftRef.current;
    if (!owns() || removed.current || locked.current || pending.current || detaching.current
      || !loaded || deliveryBusy || !historyImages || !original || original.epoch !== binding.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const fresh = RemoteSessionView.parse(await api.remoteSessions.create({
        epoch: original.epoch, modelSlug: original.modelSlug,
        ...(original.effort === undefined ? {} : { effort: original.effort }),
      }));
      if (!owns() || removed.current) return;
      if (!matches(fresh, fresh.id, original.epoch) || fresh.id === original.id
        || fresh.modelSlug !== original.modelSlug || fresh.effort !== original.effort
        || fresh.conversationID !== undefined || fresh.state !== "ready") fail();
      draftHandoff?.clear();
      go("chat", { source: "remote", epoch: fresh.epoch, id: fresh.id });
      const destination = readHash();
      if (destination.route !== "chat" || destination.params.get("source") !== "remote"
        || destination.params.get("id") !== fresh.id || destination.params.get("epoch") !== fresh.epoch) fail();
      // Navigation commits later. Keep the outgoing draft intact until the new
      // owner accepts it; any subsequent navigation cancels this transfer.
      const handoff = {
        entryKey: destination.entryKey, id: fresh.id, epoch: fresh.epoch, draft: next,
        clear() {
          navigation.removeEventListener("currententrychange", handoff.clear);
          off();
          if (draftHandoff === handoff) draftHandoff = undefined;
        },
      };
      const off = onEvent((event) => {
        if (event.type === "remote.session.removed" && event.properties.epoch === handoff.epoch) handoff.clear();
      });
      draftHandoff = handoff;
      navigation.addEventListener("currententrychange", handoff.clear);
    } catch {
      if (owns() && !removed.current) setError("unavailable");
    } finally {
      if (owns()) { pending.current = false; setBusy(false); }
    }
  };

  const validateAdmission = async (messageID: string, original: Submitted, owns: () => boolean) => {
    const [raw, rows] = await Promise.all([api.remoteSessions.get(original.id), api.remoteSessions.messages(original.id)]);
    if (!owns() || removed.current) return false;
    const value = RemoteSessionView.parse(raw);
    const parsed = rows.map((row) => RemoteMessageView.parse(row));
    if (!matches(value, original.id, original.epoch) || !value.conversationID || parsed.some((row) => row.sessionID !== original.id)) fail();
    const index = parsed.findIndex((row) => row.id === messageID && row.role === "user");
    const user = parsed[index], assistant = parsed[index + 1];
    if (!user || assistant?.role !== "assistant" || !assistant.remoteID) fail();
    const text = user.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
    const files = user.parts.flatMap((part) => part.type === "file" ? [part.file.id] : []);
    if (text !== original.draft.text.trim() || files.length !== original.attachmentIDs.length
      || files.some((file, i) => file !== original.attachmentIDs[i])) fail();
    if (submitted.current === original && draftRef.current === original.draft) {
      const next = emptyDraft(); draftRef.current = next; setDraft(next); submitted.current = null;
    }
    refresh.current();
    return true;
  };

  const send = async () => {
    const owns = capture();
    if (!owns() || removed.current || locked.current || pending.current || detaching.current || !loaded || deliveryBusy) return;
    if (!modelValid) { setError("modelUnavailable"); return; }
    if (historyImages) { setError("historyImages"); return; }
    if (fileBlocked) { setError("imageUnsupported"); return; }
    const originalDraft = draftRef.current;
    if (!originalDraft.text.trim() && !originalDraft.files.length) return;
    if ([...originalDraft.text.trim()].length > 50000 || originalDraft.text.length > 100000 || originalDraft.files.length > 20) {
      setError("invalidDraft"); return;
    }
    pending.current = true; setBusy(true); setError("");
    try {
      let target = record.current;
      const expected = binding.current;
      if (!expected || !base || !effective) fail();
      if (!target) {
        const raw = await api.remoteSessions.create({
          epoch: expected!, modelSlug: base!.slug, ...(base!.reasoning === true ? { effort } : {}),
        });
        if (!owns() || removed.current) return;
        target = RemoteSessionView.parse(raw);
        if (target.source !== "remote" || target.scope !== "process" || target.epoch !== expected
          || !target.id || target.modelSlug !== base!.slug
          || target.effort !== (base!.reasoning === true ? effort : undefined)) fail();
        record.current = target; setSession(target);
      }
      if (!matches(target, target.id, expected!)) fail();
      const attachmentIDs: string[] = [];
      for (const file of originalDraft.files) {
        if (!owns() || removed.current) return;
        if (!imageTypes.includes(file.type) || !file.size || file.size > 8 * 1024 * 1024 || !file.name.trim() || file.name.trim().length > 1024) fail();
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result), comma = result.indexOf(",");
            if (comma < 0) reject(new Error("Invalid file encoding"));
            else resolve(result.slice(comma + 1));
          };
          reader.onerror = () => reject(reader.error);
          reader.onabort = () => reject(new Error("File read aborted"));
          reader.readAsDataURL(file);
        });
        if (!owns() || removed.current) return;
        const uploaded = RemoteFile.parse(await api.remoteSessions.upload(target.id, {
          filename: file.name, mime: file.type as RemoteUploadInput["mime"], data,
          ...(originalDraft.oneOff ? { oneOffModelSlug: originalDraft.oneOff } : {}),
        }));
        if (!owns() || removed.current) return;
        if (uploaded.conversationID !== target.conversationID || uploaded.contentType !== file.type || uploaded.byteSize !== file.size) fail();
        attachmentIDs.push(uploaded.id);
      }
      const original: Submitted = { draft: originalDraft, attachmentIDs, id: target.id, epoch: expected! };
      submitted.current = original;
      const result = await api.remoteSessions.prompt(target.id, {
        message: originalDraft.text.trim(), attachmentIDs,
        ...(originalDraft.oneOff ? { oneOffModelSlug: originalDraft.oneOff } : {}),
      });
      if (!owns() || removed.current) return;
      if (await validateAdmission(result.messageID, original, owns) && !id && owns()) {
        go("chat", { source: "remote", epoch: expected!, id: target.id });
      }
    } catch {
      if (owns() && !removed.current) { setError("refused"); refresh.current(); }
    } finally {
      if (owns()) { pending.current = false; setBusy(false); }
    }
  };

  const recover = async (action: "detach" | "resume" | "history") => {
    const owns = capture(), target = record.current;
    if (!owns() || removed.current || !target || locked.current || detaching.current) return;
    if (action === "detach") {
      if (!["admitting", "streaming"].includes(target.state)) return;
      detaching.current = true; setDetachBusy(true);
      try {
        const value = RemoteSessionView.parse(await api.remoteSessions.detach(target.id));
        if (!owns() || removed.current) return;
        if (!matches(value, target.id, target.epoch)) fail();
        refresh.current();
      } catch {
        if (owns() && !removed.current) { setError("unavailable"); refresh.current(); }
      } finally {
        if (owns()) { detaching.current = false; setDetachBusy(false); }
      }
      return;
    }
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      if (action === "history") {
        const value = RemoteHistoryWindow.parse(await api.remoteSessions.history(target.id));
        if (!owns() || removed.current) return;
        if (value.conversationID !== target.conversationID || value.modelSlug !== target.modelSlug) fail();
        setHistory(value);
      } else {
        const original = submitted.current;
        const result = await api.remoteSessions.resume(target.id);
        if (!owns() || removed.current) return;
        if (original) {
          if (await validateAdmission(result.messageID, original, owns) && !id && owns() && !removed.current
            && !draftRef.current.text && !draftRef.current.files.length && !draftRef.current.oneOff) {
            go("chat", { source: "remote", epoch: original.epoch, id: original.id });
            return;
          }
        } else {
          const value = RemoteSessionView.parse(await api.remoteSessions.get(target.id));
          if (!owns() || removed.current) return;
          if (!matches(value, target.id, target.epoch) || value.conversationID !== target.conversationID) fail();
        }
      }
      if (owns() && !removed.current) refresh.current();
    } catch { if (owns() && !removed.current) { setError("unavailable"); refresh.current(); } }
    finally { if (owns()) { pending.current = false; setBusy(false); } }
  };

  const composer = <div className="chat-box remote-chat" inert={leaving}>
    {session && <p className="chat-note">{t("chat.remote.recorded", {
      model: session.modelSlug,
      effort: session.effort ? t(`chat.remote.effort.${session.effort}`) : t(base?.reasoning === false ? "chat.remote.notApplicable" : "chat.remote.unknown"),
    })}</p>}
    {draft.files.length > 0 && <div className="chat-attach">{draft.files.map((file, i) =>
      <Att key={i} name={file.name} meta={t("chat.remote.fileMetadata", { mime: file.type, bytes: file.size })}
        onRemove={busy ? undefined : () => mutate({ ...draftRef.current, files: draftRef.current.files.filter((_, index) => index !== i) })} />)}</div>}
    <form className="composer" aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <input ref={fileInput} hidden type="file" multiple accept={imageTypes.join(",")} data-testid="attach-input" disabled={busy || leaving}
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])]; event.currentTarget.value = "";
          if (!current() || pending.current || locked.current || removed.current) return;
          if (draftRef.current.files.length + files.length > 20 || files.some((file) => !imageTypes.includes(file.type) || !file.size || file.size > 8 * 1024 * 1024 || !file.name.trim() || file.name.trim().length > 1024)) {
            setError("invalidFiles"); return;
          }
          mutate({ ...draftRef.current, files: [...draftRef.current.files, ...files] });
        }} />
      <IconBtn type="button" icon="paperclip" label={t("composer.addFiles")} disabled={busy || leaving || !loaded || effective?.vision !== true}
        onClick={() => { if (current() && !pending.current && !locked.current) fileInput.current?.click(); }} />
      <textarea rows={1} {...enter.field} value={draft.text} maxLength={100000} disabled={busy || leaving || !loaded}
        placeholder={t("chat.reply")} aria-label={t("chat.reply")} aria-description={instructions} data-testid="composer-input"
        onChange={(event) => mutate({ ...draftRef.current, text: event.target.value })} />
      <button className="send" type="submit" aria-label={t("composer.send")} data-testid="composer-send"
        disabled={busy || leaving || !loaded || deliveryBusy || !modelValid || historyImages || fileBlocked || !draft.text.trim() && !draft.files.length}>
        <Icon name="arrow-up" />
      </button>
    </form>
    {enter.value === null && <p role="status">{instructions}</p>}
    <details>
      <summary>{t("chat.remote.options")}</summary>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 180, overflow: "auto" }}>
        <label>{t(session ? "chat.remote.oneOff" : "chat.remote.model")}
          <select className="input" aria-label={t(session ? "chat.remote.oneOff" : "chat.remote.model")} value={session ? draft.oneOff : model} disabled={busy || leaving || !loaded}
            onChange={(event) => {
              if (!current() || pending.current || locked.current || removed.current) return;
              if (session) mutate({ ...draftRef.current, oneOff: event.target.value });
              else setModel(event.target.value);
            }}>
            <option value="">{t(session ? "chat.remote.useRecorded" : "chat.remote.chooseModel")}</option>
            {models.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
        {!session && base?.reasoning === true && <label>{t("chat.remote.effortLabel")}
          <select className="input" aria-label={t("chat.remote.effortLabel")} value={effort} disabled={busy || leaving} onChange={(event) => {
            const value = event.target.value;
            if (current() && !pending.current && !locked.current && (value === "low" || value === "medium" || value === "high")) setEffort(value);
          }}>{(["low", "medium", "high"] as const).map((value) => <option key={value} value={value}>{t(`chat.remote.effort.${value}`)}</option>)}</select>
        </label>}
        {effective && <p className="chat-note">{t("chat.remote.capabilities", {
          vision: t(`chat.remote.capability.${effective.vision}`),
          reasoning: t(`chat.remote.capability.${effective.reasoning}`),
          tools: t(`chat.remote.capability.${effective.tools}`),
        })}</p>}
        {draft.oneOff && <p className="chat-note">{t("chat.remote.oneOffNote")}</p>}
      </div>
    </details>
    {historyImages && <>
      <p role="status">{t("chat.remote.historyImages")}</p>
      <button className="btn secondary" type="button"
        disabled={busy || leaving || detachBusy || !loaded || deliveryBusy}
        onClick={() => void newChatWithDraft()}>{t("chat.remote.newChatWithDraft")}</button>
    </>}
    {fileBlocked && <p role="status">{t("chat.remote.imageUnsupported")}</p>}
    {loaded && !modelValid && <p role="status">{t("chat.remote.modelUnavailable")}</p>}
  </div>;

  return <>
    <div className="content-top" inert={leaving}>
      <span className="title">{session?.title || t("chat.untitled")}</span><div className="spacer" />
      <IconBtn icon="compose" label={t("chat.newChat")} onClick={newChat} />
    </div>
    <div className="thread remote-chat"><div className="thread-inner" style={{ overflowWrap: "anywhere" }}>
      <div className="banner info" role="status" style={{ display: "block" }}>
        <b>{t("chat.remote.limited")}</b><p>{t("chat.remote.limitedBody")}</p>
        {history && <p>{t("chat.remote.returnedCount", { count: history.items.length })}</p>}
      </div>
      {!loaded && !error && <p role="status">{t("system.variant.loading")}</p>}
      {error && <div className="chat-err" role="alert">
        <span>{t(`chat.remote.${error}`)}</span>
        {!removed.current && <button className="btn secondary" disabled={busy} onClick={() => {
          if (!current() || pending.current) return;
          setError(""); retry();
        }}>{t("common.retry")}</button>}
      </div>}
      {session && <div className="chat-note" style={{ flexWrap: "wrap" }}>
        <span role="status">{t(`chat.remote.state.${session.state}`)}</span>
        {["admitting", "streaming"].includes(session.state) && <button className="btn secondary" disabled={detachBusy} onClick={() => void recover("detach")}>{t("chat.remote.detach")}</button>}
        {["detached", "uncertain"].includes(session.state) && <button className="btn secondary" disabled={busy || detachBusy} onClick={() => void recover("resume")}>{t("chat.remote.resume")}</button>}
        {session.conversationID && !["admitting", "streaming"].includes(session.state) && <button className="btn secondary" disabled={busy || detachBusy} onClick={() => void recover("history")}>{t("chat.remote.loadHistory")}</button>}
      </div>}
      {history && <section aria-label={t("chat.remote.knownHistory")}>
        <h3>{t("chat.remote.knownHistory")}</h3>
        {history.items.map((message) => <article key={message.id}>
          <b>{t(`chat.remote.role.${message.role}`)}</b>
          <div style={{ whiteSpace: "pre-wrap" }}>{message.text}</div>
          {message.attachments?.map((file) => <Att key={file.file_id} name={file.filename}
            meta={t("chat.remote.fileMetadata", { mime: file.content_type, bytes: file.byte_size })} />)}
        </article>)}
      </section>}
      {messages.length > 0 && <h3>{t("chat.remote.liveProjection")}</h3>}
      {messages.map((message) => {
        const content = <>
          {message.parts.map((part) => <RemotePartView key={part.id} part={part} assistant={message.role === "assistant"} />)}
          {message.partial && <p className="chat-note">{t("chat.remote.partial")}</p>}
          {message.errorCode && <p className="chat-err" role="alert">{t("chat.remote.deliveryError")}</p>}
          {message.finishReason && <p className="chat-note">{t(`chat.remote.finish.${message.finishReason}`)}</p>}
        </>;
        return message.role === "user"
          ? <div className="chat-ucol" key={message.id}><div className="msg-user msg-user-live">{content}</div></div>
          : <BotRow key={message.id}>{content}</BotRow>;
      })}
      <div ref={end} />
    </div></div>
    <div className="dock">{composer}<span className="hint" style={{ color: "var(--t2)" }}>{t("chat.remote.detachNote")}</span></div>
  </>;
}
