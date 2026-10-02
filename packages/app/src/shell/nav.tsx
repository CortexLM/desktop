import * as React from "react";
import type { Mode } from "../kit/ui";

export type Route = string;
export type Nav = { go: typeof go; route: Route; mode: Mode; params: URLSearchParams };
export const NavCtx = React.createContext<Nav>({ go: () => {}, route: "home", mode: "Cortex", params: new URLSearchParams() });
export const useNav = () => React.useContext(NavCtx);

// ponytail: Electron supplies Navigation; remove this narrow type when lib.dom declares it.
export const navigation = (window as unknown as { navigation: EventTarget & { canGoBack: boolean; canGoForward: boolean; currentEntry: { key: string } } }).navigation;

export function go(route: Route, params?: Record<string, string>, conversation: { text: string; model: string } | null = null) {
  const sp = readHash().params;
  for (const k of [...sp.keys()]) if (!["theme", "shot", "preview"].includes(k)) sp.delete(k);
  for (const [k, v] of Object.entries(params ?? {})) sp.set(k, v);
  const q = sp.toString();
  const hash = `#/${route}${q ? "?" + q : ""}`;
  const preview = sp.has("preview") || sp.has("shot");
  const state = preview ? { cortexChat: conversation } : null;
  // Personal and fixture conversations can share a URL; history still needs distinct identities.
  if (hash === location.hash && !conversation && !history.state?.cortexChat && !["home", "code"].includes(route)) history.replaceState(state, "", hash);
  else history.pushState(state, "", hash);
  dispatchEvent(new Event("cortex-variant"));
}

export function readHash(): { route: Route; theme: "light" | "dark" | "system" | null; shot: boolean; params: URLSearchParams } {
  const [path, q] = location.hash.replace(/^#\/?/, "").split("?");
  const p = new URLSearchParams(q);
  const theme = p.get("theme");
  return { route: path || "home", theme: theme === "light" || theme === "dark" || theme === "system" ? theme : null, shot: p.has("shot"), params: p };
}
