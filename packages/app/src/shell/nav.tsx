import * as React from "react";
import type { Mode } from "../kit/ui";

export type Route = string;
export type Nav = { go: (r: Route, params?: Record<string, string>) => void; route: Route; mode: Mode; params: URLSearchParams };
export const NavCtx = React.createContext<Nav>({ go: () => {}, route: "home", mode: "Cortex", params: new URLSearchParams() });
export const useNav = () => React.useContext(NavCtx);

// ponytail: Electron supplies Navigation; remove this narrow type when lib.dom declares it.
export const navigation = (window as unknown as { navigation: EventTarget & { canGoBack: boolean; canGoForward: boolean } }).navigation;

export function go(route: Route, params?: Record<string, string>) {
  const sp = readHash().params;
  for (const k of [...sp.keys()]) if (!["theme", "shot", "preview"].includes(k)) sp.delete(k);
  for (const [k, v] of Object.entries(params ?? {})) sp.set(k, v);
  const q = sp.toString();
  location.hash = `#/${route}${q ? "?" + q : ""}`;
}

export function readHash() {
  const [path, q] = location.hash.replace(/^#\/?/, "").split("?");
  const p = new URLSearchParams(q);
  return { route: path || "home", theme: (p.get("theme") as "light" | "dark" | null) ?? null, shot: p.has("shot"), params: p };
}
