// App updates over Electron's built-in autoUpdater (Squirrel.Mac / Squirrel.Windows) against one configurable feed.
// The renderer only sees a plain state object and three commands; the feed URL never crosses the bridge.
// ponytail: Linux has no autoUpdater backend, so it reports `unsupported`; add AppImage/deb updates when Linux ships.
import { EventEmitter } from "node:events";

import type { UpdateError, UpdateState } from "@cortex/schema";
export type { UpdateError, UpdateState };

export interface Squirrel extends EventEmitter {
  setFeedURL(options: { url: string }): void;
  checkForUpdates(): void;
  quitAndInstall(): void;
}

/** https feeds only; plain http is accepted for loopback test feeds. No credentials, query or fragment. */
export function feedURL(raw: string | undefined, platform: NodeJS.Platform, version: string): string | UpdateError {
  if (!raw) return "not_configured";
  let u: URL;
  try { u = new URL(raw); } catch { return "feed_invalid"; }
  const loopback = u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]";
  if (u.username || u.password || u.search || u.hash || !(u.protocol === "https:" || (u.protocol === "http:" && loopback))) return "feed_invalid";
  // Squirrel.Mac GETs this exact URL: 204 = up to date, 200 JSON {url,name,notes} = update. Versioning the path lets a
  // static feed answer per installed version. Squirrel.Windows reads RELEASES under the feed root instead.
  return platform === "darwin" ? `${u.origin}${u.pathname.replace(/\/$/, "")}/${platform}/${encodeURIComponent(version)}` : u.href;
}

export function createUpdater(opts: { squirrel?: Squirrel; platform: NodeJS.Platform; version: string; feed: string | undefined; now?: () => Date }) {
  const events = new EventEmitter();
  const current = opts.version;
  let s: UpdateState = { state: "idle", current };
  const set = (next: UpdateState) => { s = next; events.emit("state", s); };
  const supported = !!opts.squirrel && (opts.platform === "darwin" || opts.platform === "win32");
  let url = supported ? feedURL(opts.feed, opts.platform, current) : "unsupported";
  // Squirrel.Mac throws here when the running app has no code signature.
  if (!["unsupported", "not_configured", "feed_invalid"].includes(url)) try { opts.squirrel!.setFeedURL({ url }); } catch { url = "not_signed"; }
  const configured = !["unsupported", "not_configured", "feed_invalid", "not_signed"].includes(url);
  if (configured) {
    const q = opts.squirrel!;
    q.on("checking-for-update", () => set({ state: "checking", current }));
    q.on("update-not-available", () => set({ state: "up-to-date", current, checkedAt: (opts.now?.() ?? new Date()).toISOString() }));
    // Squirrel downloads as soon as an update is found: "available" is immediately followed by "downloading".
    q.on("update-available", () => { set({ state: "available", current }); set({ state: "downloading", current }); });
    q.on("update-downloaded", (_e: unknown, notes: unknown, name: unknown) => set({ state: "ready", current, version: typeof name === "string" && name ? name : "", notes: typeof notes === "string" ? notes : "" }));
    q.on("error", () => set({ state: "error", current, code: "check_failed" }));
  }
  return {
    on: (f: (s: UpdateState) => void) => { events.on("state", f); return () => void events.off("state", f); },
    status: (): UpdateState => (configured || s.state !== "idle" ? s : { state: "error", current, code: url as UpdateError }),
    check() {
      if (!configured) { set({ state: "error", current, code: url as UpdateError }); return s; }
      if (s.state === "checking" || s.state === "downloading" || s.state === "ready") return s;
      set({ state: "checking", current });
      try { opts.squirrel!.checkForUpdates(); } catch { set({ state: "error", current, code: "check_failed" }); }
      return s;
    },
    install() { if (s.state === "ready") opts.squirrel!.quitAndInstall(); return s.state === "ready"; },
  };
}
