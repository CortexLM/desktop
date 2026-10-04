// Screen registry. Each area module exports SCREENS: ScreenDef[]; a screen may declare
// variants (states). `#/<id>?v=<variant>` shows a variant; the gallery lists them all.
import * as React from "react";
import type { Mode } from "./kit/ui";

export type ScreenDef = {
  id: string;
  /** i18n key of the screen name */
  name: string;
  mode: Mode;
  /** i18n key of the gallery group */
  group: string;
  /** [variantId, i18n key, design variant id in /root/cortex-ui]; the first one is the default state */
  variants?: [string, string, string?][];
  /** Design route id when it differs from `id` (for the shot comparison). */
  design?: string;
  render: () => React.ReactNode;
};

const read = () => new URLSearchParams(location.hash.split("?")[1]).get("v") ?? "";
export function useVariant(def?: string): [string, (v: string) => void] {
  const [v, setV] = React.useState(read);
  React.useEffect(() => {
    const f = () => setV(read());
    addEventListener("hashchange", f); addEventListener("cortex-variant", f);
    return () => { removeEventListener("hashchange", f); removeEventListener("cortex-variant", f); };
  }, []);
  const set = (n: string) => {
    const [p, q] = location.hash.split("?"); const sp = new URLSearchParams(q);
    if (n) sp.set("v", n); else sp.delete("v");
    history.replaceState(null, "", `${p}?${sp}`); dispatchEvent(new Event("cortex-variant"));
  };
  return [v || def || "", set];
}

const mods = import.meta.glob("./screens/*/index.tsx", { eager: true }) as Record<string, { SCREENS?: ScreenDef[] }>;
export const SCREENS: ScreenDef[] = Object.keys(mods).sort().flatMap((k) => mods[k].SCREENS ?? []);
