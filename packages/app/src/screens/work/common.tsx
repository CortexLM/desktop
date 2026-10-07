// Pieces shared by the Work and Bots areas.
import * as React from "react";
import { Tabs } from "@base-ui/react/tabs";
import type { Bot, Session } from "@cortex/schema";
import { Icon } from "../../kit/ui";
import { Mascot, DEFAULT_MASCOT, type MascotConfig, type State } from "../../mascot/Mascot";
import { useNav } from "../../shell/nav";
import { isPreview, useFixtures, usePreviewBot } from "../../preview";
import { useBots, onEvent } from "../../state/live";
import { toConfig } from "../bots/mascot-io";
import { useI18n } from "../../i18n";
import type { WorkBotView } from "@cortex/schema";
import "./work.css";

export const NB = "\u202f";
export const css = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;

/** Navigation that sets the target variant (otherwise the current one would leak through the URL). */
export function useGo() {
  const { go } = useNav();
  return (id: string, v = "", p: Record<string, string> = {}) => go(id, v ? { ...p, v } : p);
}

export type TeamBot = { cfg: MascotConfig; role: string; state: State; doing: string; lead?: string };
export type BotsFx = { main: { name: string; doing: string }; team: TeamBot[] };

/** The main Bot: the fixture Nova in preview, the first engine Bot in live mode (null when there is none). */
export function useMainBot(): { cfg: MascotConfig; bot?: Bot; doing: string; ready: boolean } | null {
  const previewBot = usePreviewBot();
  const { t } = useI18n();
  const bots = useBots();
  if (isPreview()) return previewBot ? { cfg: previewBot.cfg, doing: previewBot.live.on ? previewBot.live.doing : t("bots.paused"), ready: true } : null;
  if (bots.state !== "ready") return bots.state === "loading" ? { cfg: { name: "", ...DEFAULT_MASCOT }, doing: "", ready: false } : null;
  const b = bots.data[0];
  return b ? { cfg: toConfig(b), bot: b, doing: "", ready: true } : null;
}

/** Live status of sessions, keyed by id, fed by the event bus. */
export function useStatuses() {
  const [s, set] = React.useState<Record<string, "idle" | "busy" | "retry" | "error">>({});
  React.useEffect(() => onEvent((e) => {
    if (e.type === "session.status") set((m) => ({ ...m, [e.properties.sessionID]: e.properties.status.type }));
  }), []);
  return s;
}
export const stateOf = (status: string | undefined, asking: boolean): State => (asking ? "waiting" : status === "busy" || status === "retry" ? "working" : status === "error" ? "blocked" : "idle");

export function useDate() {
  const { locale } = useI18n();
  return React.useMemo(() => ({
    time: (n: number) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(n),
    day: (n: number) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(n),
    short: (n: number) => new Intl.DateTimeFormat(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(n),
    date: (n: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(n),
  }), [locale]);
}

/** Mascot colour of a signed-in Bot look (WorkBotView.look). */
const LOOK: Record<string, string> = { meadow: "#14B85A", teal: "#12B8A0", terracotta: "#FF6A13", amber: "#FFAA00", plum: "#8448FF", slate: "#5F6B7E" };
export const LOOKS = Object.keys(LOOK) as WorkBotView["look"][];
export const lookMascot = (bot: { name: string; look?: string }): MascotConfig => ({ ...DEFAULT_MASCOT, name: bot.name, color: LOOK[bot.look ?? ""] ?? DEFAULT_MASCOT.color });

/** Five-field cron written by the routine editor, as a frequency + time. Anything else is "custom". */
export function parseCron(expr: string): { kind: "daily" | "weekdays" | "monday" | "every30" | "custom"; time: string } {
  const e = expr.trim().replace(/\s+/g, " ");
  if (e === "*/30 * * * *") return { kind: "every30", time: "08:00" };
  const m = e.match(/^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|1)$/);
  if (!m || +m[1] > 59 || +m[2] > 23) return { kind: "custom", time: "08:00" };
  return { kind: m[3] === "*" ? "daily" : m[3] === "1-5" ? "weekdays" : "monday", time: `${m[2].padStart(2, "0")}:${m[1].padStart(2, "0")}` };
}
export function toCron(kind: string, time: string, custom: string) {
  const [h, m] = time.split(":").map(Number);
  return kind === "every30" ? "*/30 * * * *" : kind === "custom" ? custom.trim() : `${m} ${h} * * ${kind === "daily" ? "*" : kind === "weekdays" ? "1-5" : "1"}`;
}
export function useCronLabel() {
  const t = useI18n().t;
  return (expr: string) => {
    const { kind, time } = parseCron(expr);
    return kind === "every30" ? t("work.sched.every30") : kind === "custom" ? t("work.sched.custom") : kind === "daily" ? t("work.sched.dailyAt", { time }) : kind === "weekdays" ? t("work.sched.weekdaysAt", { time }) : t("work.sched.mondayAt", { time });
  };
}
/** "5 min ago"-style label for an ISO timestamp. */
export function useAgo() {
  const { locale } = useI18n();
  return React.useCallback((iso: string) => {
    const s = (Date.parse(iso) - Date.now()) / 1000, f = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
    if (Number.isNaN(s)) return "";
    const a = Math.abs(s);
    return a < 60 ? f.format(0, "minute") : a < 3600 ? f.format(Math.round(s / 60), "minute") : a < 86400 ? f.format(Math.round(s / 3600), "hour") : f.format(Math.round(s / 86400), "day");
  }, [locale]);
}

/** Single-choice chips (radiogroup) replacing native selects. */
export function Choice<V extends string>({ label, value, options, onChange, disabled, testId }: { label: string; value: V; options: [V, React.ReactNode][]; onChange: (v: V) => void; disabled?: boolean; testId?: string }) {
  return <div className="field"><span style={{ fontWeight: 500 }}>{label}</span><div className="travail-opts" role="radiogroup" aria-label={label} data-testid={testId}>
    {options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={value === v} data-value={v} className="travail-opt" disabled={disabled} onClick={() => onChange(v)}>{l}</button>)}
  </div></div>;
}

export function Top({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="content-top"><span className="title">{title}</span><div className="spacer" />{children}</div>;
}
export function Empty({ cfg, state = "idle", title, text, children }: { cfg?: MascotConfig; state?: State; title: string; text: React.ReactNode; children?: React.ReactNode }) {
  const main = useMainBot();
  return <div className="empty travail-empty"><Mascot cfg={cfg ?? main?.cfg ?? { name: "", ...DEFAULT_MASCOT }} state={state} size={88} track interactive /><h2>{title}</h2><p>{text}</p>{children}</div>;
}
export function TabBar({ items, value, onChange, label }: { items: [string, string, number?][]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Tabs.Root value={value} onValueChange={(v) => onChange(v as string)}>
      <Tabs.List className="travail-tabs" aria-label={label}>
        {items.map(([id, l, n]) => <Tabs.Tab key={id} value={id} className="travail-tab">{l}{!!n && <span className="travail-n">{n}</span>}</Tabs.Tab>)}
        <Tabs.Indicator className="travail-tab-ind" />
      </Tabs.List>
    </Tabs.Root>
  );
}
export const Mono = ({ t, size = "" }: { t: string; size?: "" | "sm" | "lg" }) => <span className={"travail-mono " + size} aria-hidden>{t}</span>;
/** Accessible checkbox (button role=checkbox) for "Always allow" rules. */
export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return <button type="button" role="checkbox" aria-checked={checked} className="travail-always" onClick={() => onChange(!checked)}><span className="travail-check" data-checked={checked || undefined}>{checked && <Icon name="check" size={16} />}</span>{children}</button>;
}

/** Face of a Bot by name: the main Bot or a team member from the fixtures (preview), or a live Bot. */
export function BotFace({ name, size = 20, state, bots }: { name: string; size?: number; state?: State; bots?: Bot[] }) {
  const fx = useFixtures<BotsFx>("bots");
  const previewBot = usePreviewBot();
  const main = useMainBot();
  const live = bots?.find((b) => b.name === name || b.id === name);
  if (live) return <Mascot cfg={toConfig(live)} state={state ?? "idle"} size={size} />;
  const tm = isPreview() ? fx.team?.find((b) => b.cfg.name === name) : undefined;
  if (!tm || name === fx.main?.name || name === previewBot?.cfg.name) return <Mascot cfg={main?.cfg ?? { name, ...DEFAULT_MASCOT }} state={previewBot && !previewBot.live.on ? "asleep" : state ?? previewBot?.live.state ?? "working"} size={size} />;
  return <Mascot cfg={tm.cfg} state={state ?? tm.state} size={size} />;
}

export const sessionsOf = (ss: Session[], botID?: string) => ss.filter((s) => s.kind === "bot" && (!botID || s.botID === botID) && !s.parentID);
