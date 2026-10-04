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
export const usePermissions = () => useQuery<Permission[]>(() => api.permissions.list(), [], (e) => e.type.startsWith("permission.") || e.type === "session.status" || e.type === "session.deleted");

/** Reconcile one session's stored snapshot with its live updates. */
export function useMessages(sessionID: string | undefined) {
  type Part = MessageWithParts["parts"][number];
  type Status = "idle" | "busy" | "retry" | "error";
  const [state, set] = React.useState<{ sessionID?: string; msgs: MessageWithParts[]; status: Status }>({ sessionID, msgs: [], status: "idle" });
  React.useEffect(() => {
    let live = true, status: Status = "idle";
    const records = new Map<string, { info?: MessageWithParts["info"]; parts: Map<string, Part> }>();
    const settled = new Set<string>();
    const record = (id: string) => {
      let row = records.get(id);
      if (!row) { row = { parts: new Map() }; records.set(id, row); }
      return row;
    };
    const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
    const publish = () => {
      if (!live) return;
      // Map values are replaced, never mutated after publication; arrays belong to this snapshot.
      const msgs = [...records].sort(([a], [b]) => order(a, b)).flatMap(([, row]) => row.info
        ? [{ info: row.info, parts: [...row.parts.values()].sort((a, b) => order(a.id, b.id)) }] : []);
      const last = msgs.at(-1)?.info;
      const finished = last?.role === "assistant" && last.time.completed !== undefined;
      set({ sessionID, msgs, status: finished && (status === "busy" || status === "retry") ? "idle" : status });
    };
    const putMessage = (info: MessageWithParts["info"], snapshot = false) => {
      if (info.sessionID !== sessionID) return;
      const row = record(info.id), old = row.info;
      if (old?.time.completed !== undefined && info.time.completed === undefined) return;
      if (snapshot && old && (old.time.completed !== undefined || info.time.completed === undefined)) return;
      row.info = info;
    };
    const putPart = (part: Part, snapshot = false) => {
      if (part.sessionID !== sessionID) return;
      const row = record(part.messageID), old = row.parts.get(part.id);
      const final = ((part.type === "text" || part.type === "reasoning") && part.text.length > 0)
        || (part.type === "tool" && (part.state.status === "completed" || part.state.status === "error"));
      if (old && settled.has(part.id) && (snapshot || !final)) return;
      if (old && snapshot && !final) return;
      row.parts.set(part.id, part);
      if (final) settled.add(part.id);
    };
    publish();
    if (!sessionID) return () => { live = false; };
    const off = onEvent((e) => {
      if (!live) return;
      switch (e.type) {
        case "session.deleted":
          if (e.properties.sessionID !== sessionID) return;
          live = false; records.clear(); settled.clear();
          set({ sessionID, msgs: [], status: "idle" });
          return;
        case "session.status":
          if (e.properties.sessionID !== sessionID) return;
          status = e.properties.status.type;
          break;
        case "message.updated":
          if (e.properties.message.sessionID !== sessionID) return;
          putMessage(e.properties.message);
          break;
        case "part.updated":
          if (e.properties.part.sessionID !== sessionID) return;
          putPart(e.properties.part);
          break;
        case "part.delta": {
          const d = e.properties;
          if (d.sessionID !== sessionID || settled.has(d.partID)) return;
          const row = record(d.messageID), old = row.parts.get(d.partID);
          if (old && old.type !== "text" && old.type !== "reasoning") return;
          // ponytail: pre-subscription tokens are absent from SQLite until the full part.updated closes this part.
          row.parts.set(d.partID, { ...old, id: d.partID, sessionID, messageID: d.messageID, type: d.field, text: (old?.text ?? "") + d.delta });
          break;
        }
        default: return;
      }
      publish();
    });
    api.sessions.messages(sessionID).then((msgs) => {
      if (!live) return;
      for (const message of msgs) {
        putMessage(message.info, true);
        for (const part of message.parts) putPart(part, true);
      }
      publish();
    }, () => {});
    return () => { live = false; off(); records.clear(); settled.clear(); };
  }, [sessionID]);
  return state.sessionID === sessionID ? { msgs: state.msgs, status: state.status } : { msgs: [], status: "idle" as const };
}
