// Signed-in Chat feature screens on the trunk routes (closed table in @cortex/schema chat-features). Each keeps its own
// layout and root testID. Gaps the trunk does not expose as a route are stated in place, never faked.
import * as React from "react";
import type { ChatFeatureCall } from "@cortex/schema";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Icon } from "../../kit/ui";
import { useQuery } from "../../state/live";
import { ImagesTool, ResearchTool, SearchTool, TempTool } from "./tools-live";

type Conversation = { id: string; title: string; last_message_at: string; message_count: number };
type Message = { id: string; role: string; text: string; finish_reason?: string; citations?: { url?: string; title?: string }[]; generated_images?: { url?: string; prompt?: string }[] };
type Share = { id: string; slug: string; url_path: string; conversation_id: string; created_at: string };

function useFeature<T>(epoch: string, op: ChatFeatureCall["op"] | "", params: Record<string, string> = {}, q?: string) {
  const key = JSON.stringify([epoch, op, params, q]);
  return useQuery(async () => epoch && op ? (await api.code.chatFeature({ epoch, op, params, ...(q === undefined ? {} : { q }) })).data as T : undefined, [key]);
}

export function LiveChatFeature({ feature, local }: { feature: string; local: React.ReactNode }) {
  const connection = useQuery(() => api.connection.get(), []);
  const catalog = useQuery(() => api.code.models(), []);
  if (connection.state !== "ready") return null;
  if (connection.data.mode === "local" || !connection.data.signedIn) return <div data-testid={`screen-${feature}`} data-state="local">{local}</div>;
  return <Frame feature={feature} epoch={catalog.state === "ready" ? catalog.data.epoch : ""} failed={catalog.state === "error"} />;
}

const TOOLS: Record<string, (p: { epoch: string }) => React.ReactNode> = { "search-results": SearchTool, "deep-research": ResearchTool, "image-gen": ImagesTool, "temp-chat": TempTool };

function Frame({ feature, epoch, failed }: { feature: string; epoch: string; failed: boolean }) {
  const t = useT();
  const Tool = TOOLS[feature];
  if (Tool) return <div className="chat-tool-root" data-testid={`screen-${feature}`} data-state={failed ? "error" : epoch ? "ready" : "loading"}>
    {failed ? <><div className="content-top"><span className="title">{t(`chat.screen.${feature}`)}</span></div><div className="empty"><h2>{t("chat.err.generic.title")}</h2><p>{t("chat.remote.unavailable")}</p></div></> : <Tool epoch={epoch} />}
  </div>;
  const body = feature === "share" ? <ShareLive epoch={epoch} /> : feature === "canvas" ? <CanvasLive epoch={epoch} /> : feature === "voice" ? <VoiceLive epoch={epoch} /> : <StatesLive epoch={epoch} />;
  return <div className={`chat-feature chat-feature-${feature}`} data-testid={`screen-${feature}`} data-state={failed ? "error" : epoch ? "ready" : "loading"}>
    <div className="content-top"><span className="title">{t(`chat.screen.${feature}`)}</span></div>
    {failed ? <div className="banner err" role="alert">{t("chat.remote.unavailable")}</div> : <div className="page">{body}</div>}
  </div>;
}

function Picker({ epoch, value, onChange }: { epoch: string; value: string; onChange(v: string): void }) {
  const t = useT();
  const list = useFeature<{ items: Conversation[] }>(epoch, "conversations");
  const items = React.useMemo(() => list.state === "ready" ? list.data?.items ?? [] : [], [list]);
  React.useEffect(() => { if (!value && items[0]) onChange(items[0].id); }, [value, items, onChange]);
  if (list.state === "error") return <div className="banner err" role="alert">{t("chat.remote.unavailable")}</div>;
  if (list.state === "ready" && !items.length) return <p className="sub" data-testid="chat-live-no-conversation">{t("chat.live.noConversation")}</p>;
  return <select className="input" data-testid="chat-live-conversation" aria-label={t("chat.live.conversation")} value={value} onChange={e => onChange(e.target.value)}>
    {items.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
  </select>;
}

function Messages({ epoch, id, render }: { epoch: string; id: string; render(items: Message[]): React.ReactNode }) {
  const t = useT();
  const m = useFeature<{ items: Message[] }>(epoch, id ? "messages" : "", { conversation: id });
  if (m.state === "error") return <div className="banner err" role="alert">{t("chat.remote.unavailable")}</div>;
  return m.state === "ready" && m.data ? <>{render(m.data.items)}</> : <p className="thinking" role="status">{t("chat.live.loading")}</p>;
}

function StatesLive({ epoch }: { epoch: string }) {
  const [id, setID] = React.useState("");
  return <div className="chat-col"><Picker epoch={epoch} value={id} onChange={setID} />
    {id && <Messages epoch={epoch} id={id} render={items => items.map(m => <div key={m.id} className={m.role === "user" ? "msg-user" : "msg-bot"} data-testid="chat-live-message" data-finish={m.finish_reason}>{m.text}
      {m.citations?.length ? <div className="sub">{m.citations.map((c, i) => <a key={i} href={c.url} target="_blank" rel="noreferrer">[{i + 1}] {c.title}</a>)}</div> : null}
      {m.finish_reason && m.finish_reason !== "stop" && <span className="badge" role="status">{m.finish_reason}</span>}</div>)} />}
  </div>;
}

function ShareLive({ epoch }: { epoch: string }) {
  const t = useT();
  const [id, setID] = React.useState(""), [busy, setBusy] = React.useState(false), [failed, setFailed] = React.useState(false);
  const shares = useFeature<{ items: Share[] }>(epoch, "shares");
  const run = async (call: () => Promise<unknown>) => { setBusy(true); setFailed(false); try { await call(); shares.reload(); } catch { setFailed(true); } finally { setBusy(false); } };
  return <div className="chat-share-live">
    <div className="ctx-bar"><Picker epoch={epoch} value={id} onChange={setID} />
      <button className="btn primary" data-testid="chat-share-create" disabled={busy || !id} onClick={() => void run(() => api.code.chatFeature({ epoch, op: "share.create", params: { conversation: id } }))}><Icon name="link" size={16} />{t("chat.live.shareCreate")}</button></div>
    {failed && <div className="banner err" role="alert">{t("chat.remote.unavailable")}</div>}
    <div className="list" data-testid="chat-share-list">{shares.state === "ready" && shares.data?.items.map(s => <div className="li" key={s.id} data-testid="chat-share-row">
      <span className="li-ic"><Icon name="link" /></span><span className="grow"><div className="ttl mono">{s.url_path}</div><div className="sub">{new Date(s.created_at).toLocaleString()}</div></span>
      <button className="btn secondary" disabled={busy} onClick={() => void run(() => api.code.chatFeature({ epoch, op: "share.revoke", params: { share: s.id } }))}>{t("chat.live.shareRevoke")}</button></div>)}
      {shares.state === "ready" && !shares.data?.items.length && <p className="sub">{t("chat.live.noShares")}</p>}</div>
  </div>;
}

function CanvasLive({ epoch }: { epoch: string }) {
  const t = useT();
  const [id, setID] = React.useState(""), [pick, setPick] = React.useState("");
  const list = useFeature<{ items: { id: string; title: string }[] }>(epoch, id ? "canvases" : "", { conversation: id });
  const canvas = useFeature<{ title: string; content: string }>(epoch, id && pick ? "canvas" : "", { conversation: id, canvas: pick });
  const items = list.state === "ready" ? list.data?.items ?? [] : [];
  return <div className="split chat-canvas-live">
    <div className="split-l"><Picker epoch={epoch} value={id} onChange={v => { setID(v); setPick(""); }} />
      <div className="list">{items.map(c => <button key={c.id} className="li" aria-pressed={pick === c.id} onClick={() => setPick(c.id)}><Icon name="file" /><span className="grow ttl">{c.title}</span></button>)}
        {list.state === "ready" && !items.length && <p className="sub" data-testid="chat-canvas-empty">{t("chat.live.noCanvas")}</p>}</div></div>
    <div className="split-r"><article className="fichiers-a4" data-testid="chat-canvas-doc">{canvas.state === "ready" && canvas.data ? <><h2>{canvas.data.title}</h2><pre style={{ whiteSpace: "pre-wrap" }}>{canvas.data.content}</pre></> : <p className="sub">{t("chat.live.pickCanvas")}</p>}</article></div>
  </div>;
}




function VoiceLive({ epoch }: { epoch: string }) {
  const t = useT();
  const caps = useFeature<{ stt: boolean; tts: boolean; live: boolean }>(epoch, "audio.capabilities");
  const prefs = useFeature<{ voice: string | null; language: string | null; voices: string[] }>(epoch, "live.preferences");
  const row = (k: string, on?: boolean) => <div className="li" key={k} data-testid={`chat-voice-${k}`} data-on={on ? "true" : "false"}><span className="grow ttl">{t(`chat.live.voice.${k}`)}</span><span className="badge">{on ? t("chat.live.on") : t("chat.live.off")}</span></div>;
  return <div className="chat-voice-live" style={{ display: "grid", placeItems: "center", gap: 16 }}>
    <div className="voice-orb" aria-hidden style={{ width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, var(--accent, #7c5cff), transparent 70%)" }} />
    <div className="list" style={{ width: "min(420px, 100%)" }}>{caps.state === "ready" && caps.data && [row("stt", caps.data.stt), row("tts", caps.data.tts), row("live", caps.data.live)]}
      {prefs.state === "ready" && prefs.data && <div className="li"><span className="grow ttl">{t("chat.live.voice.voice")}</span><span className="sub">{prefs.data.voice ?? prefs.data.voices[0] ?? ""}</span></div>}</div>
    <p className="code-hint" data-testid="chat-voice-gap">{t("chat.live.voiceGap")}</p>
  </div>;
}

