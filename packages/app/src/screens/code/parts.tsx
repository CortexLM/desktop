// Shared pieces of the Cortex Code area: agent mascot, deltas, monograms, diff views, CI icons, live helpers.
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { Icon, Tip } from "../../kit/ui";
import { Mascot, DEFAULT_MASCOT, type State } from "../../mascot/Mascot";
import { useT, useI18n } from "../../i18n";
import { useNav } from "../../shell/nav";
import "./lot-code.css";

export const ix = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;

export function Agent({ state, size = 28 }: { state: State; size?: number }) {
  const t = useT();
  return <Mascot cfg={{ ...DEFAULT_MASCOT, name: t("code.agent"), symbol: "code" }} state={state} size={size} title={t("code.agent")} />;
}
export const Delta = ({ a, d }: { a: number; d: number }) => <span className="code-delta"><span className="code-plus">+{a}</span><span className="code-minus">−{d}</span></span>;
export function Av({ who, name, tone = 0, mark }: { who: string; name: string; tone?: number; mark?: "ok" | "wait" }) {
  return <Tip label={name}><span className="code-av" data-tone={tone % 4} tabIndex={0} role="img" aria-label={name}>{who}{mark && <i data-m={mark} />}</span></Tip>;
}
export const Badge = ({ k, children, spin }: { k: string; children: React.ReactNode; spin?: boolean }) => <span className={"badge " + (k || "code-mute")}>{spin && <span className="spin" />}{children}</span>;

/** Renders `code` spans written with backticks in fixture copy. */
export const rich = (s: string) => s.split("`").map((p, i) => (i % 2 ? <code key={i}>{p}</code> : p));

/* ---------- Diff: parse, unified, side by side ---------- */
export type DL = { k: "add" | "del" | "ctx" | "hunk" | "fold"; s: string; o?: number; n?: number; h?: string[] };
export function parse(src: string, hidden: string[][] = []): DL[] {
  let o = 0, n = 0, f = 0;
  return src.split("\n").map((l): DL => {
    if (l.startsWith("@@")) { const m = /-(\d+)(?:,\d+)? \+(\d+)/.exec(l); o = m ? +m[1] : 0; n = m ? +m[2] : 0; return { k: "hunk", s: l }; }
    if (l === "~") { const h = hidden[f++] ?? []; const d: DL = { k: "fold", s: "", o, n, h }; o += h.length; n += h.length; return d; }
    const s = l.slice(1);
    if (l[0] === "+") return { k: "add", s, n: n++ };
    if (l[0] === "-") return { k: "del", s, o: o++ };
    return { k: "ctx", s, o: o++, n: n++ };
  });
}
export const unfold = (ls: DL[]): DL[] => ls.flatMap((l) => l.k === "fold" ? l.h!.map((s, j) => ({ k: "ctx" as const, s, o: l.o! + j, n: l.n! + j })) : [l]);
const sign = (k: DL["k"]) => (k === "add" ? "+" : k === "del" ? "-" : "");

function FoldBtn({ l, onUnfold }: { l: DL; onUnfold?: () => void }) {
  const t = useT();
  return <button className="code-fold" onClick={onUnfold}><Icon name="expand" size={12} />{t("code.diff.unfold", { count: l.h!.length })}</button>;
}
type ViewProps = { lines: DL[]; extra?: (i: number) => React.ReactNode; onComment?: (i: number) => void; onUnfold?: () => void };
export function Unified({ lines, extra, onComment, onUnfold }: ViewProps) {
  const t = useT();
  return (
    <div className="code-dv" role="table" aria-label={t("code.diff.unifiedLabel")}>
      {lines.map((l, i) => (
        <React.Fragment key={i}>
          {l.k === "fold" ? <FoldBtn l={l} onUnfold={onUnfold} /> : (
            <div className="code-dl" data-k={l.k} role="row">
              {l.k === "hunk" ? <span className="code-hunk">{l.s}</span> : <>
                <span className="code-ln">{l.o ?? ""}</span><span className="code-ln">{l.n ?? ""}</span>
                <span className="code-sg">{sign(l.k)}</span><span className="code-src">{l.s || " "}</span>
                {onComment && <button className="code-addc" aria-label={t("code.diff.commentLine", { line: l.n ?? l.o ?? "" })} onClick={() => onComment(i)}><Icon name="plus" size={12} /></button>}
              </>}
            </div>
          )}
          {extra?.(i)}
        </React.Fragment>
      ))}
    </div>
  );
}
type Pair = { l?: DL; r?: DL; full?: DL; i: number };
function pairs(lines: DL[]): Pair[] {
  const out: Pair[] = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.k === "hunk" || l.k === "fold") { out.push({ full: l, i }); i++; continue; }
    if (l.k === "ctx") { out.push({ l, r: l, i }); i++; continue; }
    const dels: number[] = [], adds: number[] = [];
    while (lines[i]?.k === "del") dels.push(i++);
    while (lines[i]?.k === "add") adds.push(i++);
    for (let j = 0; j < Math.max(dels.length, adds.length); j++) out.push({ l: lines[dels[j]], r: lines[adds[j]], i: adds[j] ?? dels[j] });
  }
  return out;
}
export function Split({ lines, extra, onComment, onUnfold }: ViewProps) {
  const t = useT();
  const half = (d: DL | undefined, side: "o" | "n") => (
    <div className="code-half" data-k={d ? (d.k === "ctx" ? "ctx" : d.k) : "empty"}>
      <span className="code-ln">{d ? (side === "o" ? d.o : d.n) ?? "" : ""}</span><span className="code-sg">{d ? sign(d.k) : ""}</span><span className="code-src">{d?.s || " "}</span>
    </div>
  );
  return (
    <div className="code-dv code-split" role="table" aria-label={t("code.diff.splitLabel")}>
      {pairs(lines).map((p) => (
        <React.Fragment key={p.i + (p.full ? "f" : "")}>
          {p.full ? (p.full.k === "fold" ? <FoldBtn l={p.full} onUnfold={onUnfold} /> : <div className="code-dl" data-k="hunk"><span className="code-hunk">{p.full.s}</span></div>) : (
            <div className="code-sr" role="row">{half(p.l, "o")}{half(p.r, "n")}
              {onComment && <button className="code-addc" aria-label={t("code.diff.commentLine", { line: p.r?.n ?? p.l?.o ?? "" })} onClick={() => onComment(p.i)}><Icon name="plus" size={12} /></button>}
            </div>
          )}
          {extra?.(p.i)}
        </React.Fragment>
      ))}
    </div>
  );
}

export type CS = "wait" | "run" | "ok" | "err" | "skip" | "ask";
export function CiIcon({ s }: { s: CS }) {
  if (s === "run") return <span className="code-ci" data-s="run"><span className="spin" /></span>;
  return <span className="code-ci" data-s={s}><Icon name={s === "ok" ? "check-circle" : s === "err" ? "x-circle" : s === "ask" ? "shield-check" : "history"} size={16} /></span>;
}

/** Honest live state for screens with no engine backing yet (design copy of the empty task list). */
export function LiveEmpty() {
  const t = useT();
  const { go } = useNav();
  return (
    <div className="empty">
      <Agent state="idle" size={72} />
      <h2>{t("code.tasks.emptyTitle")}</h2>
      <p>{t("code.tasks.emptyBody")}</p>
      <div className="code-row-gap"><button className="btn primary" onClick={() => go("code")}><Icon name="compose" size={16} />{t("code.newTask")}</button></div>
    </div>
  );
}

/* ---------- Live helpers ---------- */
export const basename = (p?: string) => (p ? p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p : "");

export function useAgo() {
  const { locale } = useI18n();
  return React.useCallback((ts: number) => {
    const f = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const s = Math.round((ts - Date.now()) / 1000);
    for (const [u, n] of [["day", 86400], ["hour", 3600], ["minute", 60]] as const) if (Math.abs(s) >= n) return f.format(Math.round(s / n), u);
    return f.format(0, "minute");
  }, [locale]);
}

/** Context chip (repository, branch, environment, model) opening a single-choice menu. */
export type ChipItem = { value: string; label: string; hint?: string };
export function ChipMenu({ icon, label, ariaLabel, value, items, onChange, disabled, testId, className = "ctx", side = "bottom", align = "start" }: {
  icon?: string; label: string; ariaLabel: string; value: string; items: ChipItem[]; onChange(v: string): void; disabled?: boolean; testId?: string;
  className?: string; side?: "top" | "bottom"; align?: "start" | "end";
}) {
  return <Menu.Root>
    <Menu.Trigger className={className} type="button" data-testid={testId} aria-label={`${ariaLabel}: ${label}`} disabled={disabled}>{icon && <Icon name={icon} size={16} />}<span className="code-ell">{label}</span><Icon name="chevron-down" size={12} /></Menu.Trigger>
    <Menu.Portal><Menu.Positioner sideOffset={6} side={side} align={align}><Menu.Popup className="popup code-chip-pop">
      <Menu.RadioGroup value={value} onValueChange={(v) => onChange(v as string)}>
        {items.map((i) => <Menu.RadioItem key={i.value} value={i.value} closeOnClick className="mitem code-chip-item">
          <span className="code-grow"><span className="code-ell">{i.label}</span>{i.hint && <span className="sub">{i.hint}</span>}</span>
          <Menu.RadioItemIndicator><Icon name="check" /></Menu.RadioItemIndicator>
        </Menu.RadioItem>)}
      </Menu.RadioGroup>
    </Menu.Popup></Menu.Positioner></Menu.Portal>
  </Menu.Root>;
}

/** Puts a test id on the input of the shared composer (the composer has no prop for it). */
export function TestIdComposer({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { ref.current?.querySelector("input")?.setAttribute("data-testid", id); });
  return <div ref={ref} style={{ display: "contents" }}>{children}</div>;
}
