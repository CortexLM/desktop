import * as React from "react";
import { RemoteSessionView } from "@cortex/schema";
import { api } from "../api";
import { useNav } from "../shell/nav";
import { onEvent } from "./live";
import { shared, cached, forget } from "./shared";

const KEY = "remote-sessions";

type State =
  | { state: "hidden" | "loading" | "error" }
  | { state: "ready"; data: RemoteSessionView[] };

export function useRemoteSessions(enabled = true) {
  const { route, params, entryKey } = useNav();
  const query = params.toString();
  const preview = route === "gallery" || params.has("preview") || params.has("shot");
  const [retry, reload] = React.useReducer((n: number) => n + 1, 0);
  const owner = React.useMemo(() => ({ route, query, entryKey, enabled, preview, retry }), [route, query, entryKey, enabled, preview, retry]);
  const [snapshot, setSnapshot] = React.useState<{ owner: object; value: State }>({
    owner, value: cached<RemoteSessionView[]>(KEY) ? { state: "ready", data: cached<RemoteSessionView[]>(KEY)! } : { state: "hidden" },
  });
  const retired = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!enabled || preview) return;
    let live = true, sequence = 0;
    const publish = (value: State) => {
      if (live) setSnapshot({ owner, value });
    };
    const refresh = async () => {
      const request = ++sequence;
      const current = () => live && request === sequence;
      try {
        const connection = await api.connection.get();
        if (!current()) return;
        if (connection.mode === "local" || !connection.signedIn) {
          publish({ state: "hidden" });
          return;
        }
        setSnapshot((old) => old.owner === owner && old.value.state === "ready"
          ? old : { owner, value: { state: "loading" } });
        const rows = RemoteSessionView.array().parse(await shared(KEY, () => api.remoteSessions.list()));
        if (!current()) return;
        const epoch = rows[0]?.epoch;
        if (rows.some((row) => row.epoch !== epoch || retired.current.has(row.epoch))
          || new Set(rows.map((row) => row.id)).size !== rows.length) {
          throw new Error("Invalid remote session list");
        }
        publish({ state: "ready", data: rows.sort((a, b) => b.time.updated - a.time.updated || a.id.localeCompare(b.id)) });
      } catch {
        if (current()) publish({ state: "error" });
      }
    };
    const off = onEvent((event) => {
      if (!live) return;
      if (event.type === "remote.session.removed") {
        // Main emits removals when clearing an owner; the entire epoch is retired.
        retired.current.add(event.properties.epoch);
        forget(KEY);
        ++sequence;
        setSnapshot((old) => old.owner === owner && old.value.state === "ready"
          ? { owner, value: { state: "ready", data: old.value.data.filter((row) => row.epoch !== event.properties.epoch) } }
          : { owner, value: { state: "hidden" } });
        void refresh();
      } else if (event.type === "remote.session.changed" && !retired.current.has(event.properties.epoch)) {
        void refresh();
      }
    });
    void refresh();
    return () => { live = false; ++sequence; off(); };
  }, [owner, enabled, preview]);

  // A route change re-keys owner; keep showing the last good list instead of flashing hidden/loading/error.
  const stale = cached<RemoteSessionView[]>(KEY);
  const value: State = !enabled || preview ? { state: "hidden" }
    : snapshot.owner === owner ? snapshot.value
    : snapshot.value.state === "ready" ? snapshot.value
    : stale ? { state: "ready", data: stale } : { state: "hidden" };
  return { ...value, reload };
}
