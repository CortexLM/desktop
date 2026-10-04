// Shared pieces of the System lot: page header, mascot empty state, key caps, highlight, list keyboard nav.
import * as React from "react";
import { Mascot, DEFAULT_MASCOT, type MascotConfig, type State } from "../../mascot/Mascot";
import { useT, useI18n } from "../../i18n";
import { isPreview, useFixtures } from "../../preview";
import { useBots } from "../../state/live";
import type { SystemFx } from "./fixtures";
import "./system.css";

export const NB = "\u202f";
export const css = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;
export const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const useFx = () => useFixtures<SystemFx>("system");

/** Preview: the fixture bot (Nova). Live: the first bot, or the default look named "your Bot". */
export function useBotCfg(): MascotConfig {
  const t = useT();
  const fx = useFx();
  const bots = useBots();
  if (isPreview()) return { name: fx.bot?.name ?? "", ...DEFAULT_MASCOT };
  const b = bots.state === "ready" ? bots.data[0] : undefined;
  return b ? { name: b.name, ...(b.mascot as Omit<MascotConfig, "name">) } : { name: t("system.yourBot"), ...DEFAULT_MASCOT };
}

export function Top({ title, children }: { title?: string; children?: React.ReactNode }) {
  return <div className="content-top">{title && <span className="title">{title}</span>}<div className="spacer" />{children}</div>;
}

export function BotEmpty({ state = "idle", title, text, children }: { state?: State; title: string; text: React.ReactNode; children?: React.ReactNode }) {
  const bot = useBotCfg();
  return <div className="empty"><Mascot cfg={bot} state={state} size={88} track interactive /><h2>{title}</h2><p>{text}</p>{children}</div>;
}

export const Keys = ({ k }: { k: string[] }) => <span className="systeme-keys">{k.map((x, i) => <kbd key={i} className="systeme-kbd">{x}</kbd>)}</span>;

/** Highlights occurrences of q (accent- and case-insensitive). */
export function Hl({ text, q }: { text: string; q: string }) {
  const n = norm(q.trim());
  if (!n) return <>{text}</>;
  const lower = norm(text), out: React.ReactNode[] = [];
  let i = 0, j: number;
  while ((j = lower.indexOf(n, i)) !== -1) { out.push(text.slice(i, j), <mark key={j} className="systeme-mark">{text.slice(j, j + n.length)}</mark>); i = j + n.length; }
  out.push(text.slice(i));
  return <>{out}</>;
}

/** ↑ ↓ ↵ over a flat list; the active item stays in view. */
export function useListNav(count: number, onPick: (i: number) => void) {
  const [active, setActive] = React.useState(0);
  React.useEffect(() => setActive((a) => Math.min(a, Math.max(0, count - 1))), [count]);
  React.useEffect(() => { document.querySelector(`[data-nav-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!count) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % count); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + count) % count); }
    else if (e.key === "Enter") { e.preventDefault(); onPick(active); }
  };
  return { active, setActive, onKeyDown };
}

export const setTheme = (detail: "system" | "light" | "dark") => dispatchEvent(new CustomEvent("cortex-theme", { detail }));
export const currentThemePref = (): "system" | "light" | "dark" =>
  isPreview() ? (document.documentElement.dataset.theme === "light" ? "light" : "dark") : ((localStorage.getItem("cortex.theme") as "system" | "light" | "dark" | null) ?? "system");

/** Relative time of an epoch-ms timestamp, in the UI locale. */
export function useAgo() {
  const { locale } = useI18n();
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return (ms: number) => {
    const s = (ms - Date.now()) / 1000;
    for (const [u, n] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]] as const)
      if (Math.abs(s) >= n) return fmt.format(Math.round(s / n), u);
    return fmt.format(0, "minute");
  };
}
