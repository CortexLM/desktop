// Live engine state for the renderer: one SSE subscription, small caches refreshed on events.
import * as React from "react";
import type { Event, Session, Bot, MessageWithParts, Permission } from "@cortex/schema";
import { api } from "../api";

type Listener = (e: Event) => void;
const listeners = new Set<Listener>();
let unsub: (() => void) | null = null;
export function onEvent(l: Listener) {
  listeners.add(l);
  if (!unsub) unsub = api.subscribe((e) => listeners.forEach((f) => f(e)), { onError: () => {} });
  return () => { listeners.delete(l); };
}

export type Load<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "error"; code: string };

/** Fetches `load()` and refetches whenever an event matching `when` arrives. */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[], when?: (e: Event) => boolean): Load<T> & { reload: () => void } {
  const [s, set] = React.useState<Load<T>>({ state: "loading" });
  const seq = React.useRef(0);
  const run = React.useCallback(() => {
    const n = ++seq.current;
    load().then((data) => n === seq.current && set({ state: "ready", data }), (err: { code?: string }) => n === seq.current && set({ state: "error", code: err?.code ?? "internal" }));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { run(); }, [run]);
  React.useEffect(() => (when ? onEvent((e) => { if (when(e)) run(); }) : undefined), [run]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...s, reload: run };
}

export const useSessions = (kind?: Session["kind"]) =>
  useQuery(() => api.sessions.list(kind ? { kind } : {}), [kind], (e) => e.type.startsWith("session."));
export const useBots = () => useQuery<Bot[]>(() => api.bots.list(), [], () => false);
export const usePermissions = () => useQuery<Permission[]>(() => api.permissions.list(), [], (e) => e.type.startsWith("permission."));

/** Messages of one session with streaming deltas applied in place. */
export function useMessages(sessionID: string | undefined) {
  const [msgs, setMsgs] = React.useState<MessageWithParts[]>([]);
  const [status, setStatus] = React.useState<"idle" | "busy" | "retry" | "error">("idle");
  React.useEffect(() => {
    if (!sessionID) { setMsgs([]); return; }
    let live = true;
    api.sessions.messages(sessionID).then((m) => live && setMsgs(m), () => {});
    const off = onEvent((e) => {
      if (!("properties" in e)) return;
      const p = e.properties as Record<string, unknown>;
      if (e.type === "session.status" && p.sessionID === sessionID) setStatus((p.status as { type: typeof status }).type);
      if (e.type === "message.updated") {
        const info = p.message as MessageWithParts["info"]; if (info.sessionID !== sessionID) return;
        setMsgs((ms) => ms.some((m) => m.info.id === info.id) ? ms.map((m) => (m.info.id === info.id ? { ...m, info } : m)) : [...ms, { info, parts: [] }]);
      }
      if (e.type === "part.updated") {
        const part = p.part as MessageWithParts["parts"][number]; if (part.sessionID !== sessionID) return;
        setMsgs((ms) => ms.map((m) => m.info.id !== part.messageID ? m : { ...m, parts: m.parts.some((x) => x.id === part.id) ? m.parts.map((x) => (x.id === part.id ? part : x)) : [...m.parts, part] }));
      }
      if (e.type === "part.delta") {
        const d = p as { sessionID: string; messageID: string; partID: string; field: "text" | "reasoning"; delta: string };
        if (d.sessionID !== sessionID) return;
        setMsgs((ms) => ms.map((m) => {
          if (m.info.id !== d.messageID) return m;
          const has = m.parts.find((x) => x.id === d.partID);
          const type = d.field === "reasoning" ? "reasoning" : "text";
          const parts = has
            ? m.parts.map((x) => (x.id === d.partID && "text" in x ? { ...x, text: x.text + d.delta } : x))
            : [...m.parts, { id: d.partID, sessionID, messageID: d.messageID, type, text: d.delta } as MessageWithParts["parts"][number]];
          return { ...m, parts };
        }));
      }
    });
    return () => { live = false; off(); };
  }, [sessionID]);
  return { msgs, status };
}
