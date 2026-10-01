import * as React from "react";
import type { Mode } from "../kit/ui";

export type Route = string;
export type Nav = { go: (r: Route, params?: Record<string, string>) => void; route: Route; mode: Mode; params: URLSearchParams };
export const NavCtx = React.createContext<Nav>({ go: () => {}, route: "home", mode: "Cortex", params: new URLSearchParams() });
export const useNav = () => React.useContext(NavCtx);

export function readHash() {
  const [path, q] = location.hash.replace(/^#\/?/, "").split("?");
  const p = new URLSearchParams(q);
  return { route: path || "home", theme: (p.get("theme") as "light" | "dark" | null) ?? null, shot: p.has("shot"), params: p };
}
