import * as React from "react";
import type { RuntimeSettings } from "@cortex/schema";
import { api } from "../api";
import { isPreview } from "../preview";
import { navigation, readHash, useNav } from "../shell/nav";
import { onEvent, type Load } from "./live";

const LEGACY_MEMORY = "cortex.pref.privacy.memory";
let bootstrapPromise: Promise<RuntimeSettings> | undefined;
export const hasLegacyMemoryPause = () => localStorage.getItem(LEGACY_MEMORY) === "false";
const liveRoute = () => !isPreview() && readHash().route !== "gallery";

function bootstrap() {
  // Shared only while importing; the engine's existing value wins atomically.
  return bootstrapPromise ??= api.settings.update({ memoryEnabled: false, initializeOnly: true }).finally(() => { bootstrapPromise = undefined; });
}

/** Authoritative settings, scoped to this mounted live owner. */
export function useRuntimeSettings(enabled = true) {
  const { params, route } = useNav();
  const permitted = enabled && !params.has("preview") && !params.has("shot") && route !== "gallery";
  const active = permitted && liveRoute();
  const [load, setLoad] = React.useState<Load<RuntimeSettings>>({ state: "loading" });
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<boolean | null>(null);
  const owner = React.useRef<{ seq: number; pending: boolean; refresh: boolean } | null>(null);
  const reload = React.useCallback(() => {
    const request = owner.current;
    if (!request || !liveRoute()) return;
    if (request.pending) { request.refresh = true; return; }
    const seq = ++request.seq, legacy = localStorage.getItem(LEGACY_MEMORY);
    setLoad((current) => current.state === "ready" ? current : { state: "loading" });
    (legacy === "false" ? bootstrap() : api.settings.get()).then((data) => {
      if (owner.current !== request || request.seq !== seq || !liveRoute()) return;
      if (legacy === "false" && localStorage.getItem(LEGACY_MEMORY) === legacy) localStorage.removeItem(LEGACY_MEMORY);
      setLoad({ state: "ready", data });
    }, () => {
      if (owner.current === request && request.seq === seq && liveRoute()) setLoad({ state: "error", code: "internal" });
    });
  }, []);
  React.useLayoutEffect(() => {
    let live: boolean | undefined;
    const sync = () => {
      const next = liveRoute();
      if (next === live) return;
      live = next; owner.current = null;
      // Preserve the outgoing tree until commit; reset UI only on live re-entry.
      if (!next) return;
      setLoad({ state: "loading" }); setBusy(false); setFailed(null);
      if (permitted) { owner.current = { seq: 0, pending: false, refresh: false }; reload(); }
    };
    const off = permitted ? onEvent((event) => { if (event.type === "settings.changed") reload(); }) : undefined;
    navigation.addEventListener("currententrychange", sync);
    sync();
    return () => { owner.current = null; off?.(); navigation.removeEventListener("currententrychange", sync); };
  }, [permitted, reload]);
  const update = (memoryEnabled: boolean) => {
    const request = owner.current;
    if (!request || !liveRoute() || request.pending || load.state !== "ready") return;
    request.pending = true;
    const seq = ++request.seq;
    setBusy(true); setFailed(null);
    api.settings.update({ memoryEnabled }).then((data) => {
      if (owner.current === request && request.seq === seq && liveRoute()) setLoad({ state: "ready", data });
    }, () => {
      if (owner.current === request && request.seq === seq && liveRoute()) setFailed(memoryEnabled);
    }).finally(() => {
      request.pending = false;
      if (owner.current !== request || !liveRoute()) return;
      setBusy(false);
      if (request.refresh) { request.refresh = false; reload(); }
    });
  };
  return { ...(active ? load : { state: "loading" as const }), busy, saveError: failed !== null, reload, update, retry: () => { if (failed !== null) update(failed); else reload(); } };
}
