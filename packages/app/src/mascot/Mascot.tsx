import * as React from "react";
import { iconBody } from "../icons/Icon";
import { useT } from "../i18n";
import { ACCESSORIES } from "./parts";
import "./mascot.css";

export type Shape = "round" | "drop" | "squircle" | "pill" | "triangle" | "hexagon" | "cloud" | "pebble";
export type Eyes = "commas" | "dots" | "ovals" | "pixels";
export type Mouth = "none" | "smile" | "o";
export type State = "idle" | "listening" | "thinking" | "working" | "talking" | "waiting" | "blocked" | "done" | "asleep";
export type MascotConfig = {
  name: string; shape: Shape; color: string; eyes: Eyes; mouth: Mouth;
  glasses?: string; hat?: string; extra?: string;
  symbol?: string;
};

export const STATES: { id: State; label: string; hint: string }[] = [
  { id: "idle", label: "mascot.state.idle", hint: "mascot.stateHint.idle" },
  { id: "listening", label: "mascot.state.listening", hint: "mascot.stateHint.listening" },
  { id: "thinking", label: "mascot.state.thinking", hint: "mascot.stateHint.thinking" },
  { id: "working", label: "mascot.state.working", hint: "mascot.stateHint.working" },
  { id: "talking", label: "mascot.state.talking", hint: "mascot.stateHint.talking" },
  { id: "waiting", label: "mascot.state.waiting", hint: "mascot.stateHint.waiting" },
  { id: "blocked", label: "mascot.state.blocked", hint: "mascot.stateHint.blocked" },
  { id: "done", label: "mascot.state.done", hint: "mascot.stateHint.done" },
  { id: "asleep", label: "mascot.state.asleep", hint: "mascot.stateHint.asleep" },
];

export const COLORS = [
  ["blue", "#1E7BFF"], ["orange", "#FF6A13"], ["teal", "#12B8A0"], ["red", "#F2263F"], ["pink", "#EE3A97"],
  ["violet", "#8448FF"], ["amber", "#FFAA00"], ["brown", "#93603A"], ["green", "#14B85A"], ["slate", "#5F6B7E"], ["ink", "#141414"],
] as const;

export type Anchors = {
  cx: number; eyeY: number; eyeDX: number; top: number; bottom: number; halfW: number; bellyY: number;
  eyeX: number; eyeDY: number; eyeE: number; hatX: number; hatY: number; hatW: number;
  span: (y: number) => [number, number];
  clip?: string;
  dark?: boolean;
};
type Base = Pick<Anchors, "cx" | "top" | "bottom" | "halfW" | "bellyY" | "eyeX" | "eyeY" | "eyeE" | "hatY">;
const RAW: Record<Shape, { d: string; a: Base }> = {
  round: { d: "M50 14a36 36 0 1 1 0 72a36 36 0 1 1 0-72z", a: { cx: 50, top: 14, bottom: 86, halfW: 35, bellyY: 66, eyeX: 64.8, eyeY: 33.5, eyeE: 72, hatY: 21 } },
  drop: { d: "M50 10C58 24 82 44 82 62a32 32 0 0 1-64 0C18 44 42 24 50 10z", a: { cx: 50, top: 10, bottom: 94, halfW: 30, bellyY: 76, eyeX: 61, eyeY: 43, eyeE: 70, hatY: 31 } },
  squircle: { d: "M50 16c26 0 34 6 34 34s-8 34-34 34-34-6-34-34 8-34 34-34z", a: { cx: 50, top: 16, bottom: 84, halfW: 33, bellyY: 66, eyeX: 63, eyeY: 34, eyeE: 68, hatY: 22.5 } },
  pill: { d: "M30 30h40a20 20 0 0 1 0 40H30a20 20 0 0 1 0-40z", a: { cx: 50, top: 30, bottom: 70, halfW: 38, bellyY: 60, eyeX: 63.6, eyeY: 41, eyeE: 47, hatY: 32 } },
  triangle: { d: "M43 18c3.5-6 10.5-6 14 0l29 52c3.5 6-.5 14-7.5 14H21.5c-7 0-11-8-7.5-14z", a: { cx: 50, top: 14, bottom: 84, halfW: 22, bellyY: 74, eyeX: 59, eyeY: 45, eyeE: 61, hatY: 33.5 } },
  hexagon: { d: "M44 13c4-2.3 8-2.3 12 0l24 14c4 2.3 6 5.7 6 10.4v25.2c0 4.7-2 8.1-6 10.4L56 87c-4 2.3-8 2.3-12 0L20 73c-4-2.3-6-5.7-6-10.4V37.4c0-4.7 2-8.1 6-10.4z", a: { cx: 50, top: 12, bottom: 88, halfW: 35, bellyY: 66, eyeX: 64, eyeY: 35, eyeE: 72, hatY: 23.5 } },
  cloud: { d: "M30 80c-11 0-18-8-18-17 0-8 5-14 12-16 0-12 9-21 21-21 7 0 13 3 17 9 2-1 5-2 8-2 10 0 17 8 17 18 0 1 0 2-.2 3C91 56 94 61 94 67c0 7-6 13-14 13z", a: { cx: 52, top: 26, bottom: 80, halfW: 36, bellyY: 70, eyeX: 62, eyeY: 46, eyeE: 56, hatY: 32 } },
  pebble: { d: "M24 30c8-12 28-18 44-12s22 22 18 38-18 30-38 30-32-14-32-28 0-18 8-28z", a: { cx: 52, top: 17, bottom: 86, halfW: 33, bellyY: 68, eyeX: 65, eyeY: 35, eyeE: 70, hatY: 23.5 } },
};

let ctx2d: CanvasRenderingContext2D | null | undefined;
const spanMemo = new Map<string, [number, number]>();
const spanOf = (shape: Shape, y: number): [number, number] => {
  const { d, a } = RAW[shape], yy = Math.round(y * 2) / 2, key = shape + yy;
  const hit = spanMemo.get(key); if (hit) return hit;
  if (ctx2d === undefined) ctx2d = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!ctx2d) return [a.cx - a.halfW, a.cx + a.halfW];
  const p = new Path2D(d); let l = -1, r = -1;
  for (let x = 0; x <= 100; x += 0.5) if (ctx2d.isPointInPath(p, x, yy)) { if (l < 0) l = x; r = x; }
  const out: [number, number] = l < 0 ? [a.cx, a.cx] : [l, r]; spanMemo.set(key, out); return out;
};
const SHAPES = Object.fromEntries(Object.entries(RAW).map(([k, { d, a }]) => {
  const span = (y: number) => spanOf(k as Shape, y), [l, r] = span(a.hatY);
  return [k, { d, a: { ...a, eyeDX: 0.105 * a.eyeE, eyeDY: 0.02 * a.eyeE, hatX: (l + r) / 2, hatW: (r - l) / 2 + 1.5, span } }];
})) as Record<Shape, { d: string; a: Anchors }>;
export const SHAPE_LIST = Object.keys(SHAPES) as Shape[];
export const anchorsOf = (s: Shape) => SHAPES[s].a;

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const ink = (hex: string) => (lum(hex) > 0.6 ? "#141414" : "#FFFFFF");
const tone = (hex: string) => (contrast(hex, "#171717") < 1.5 ? "dark" : contrast(hex, "#F9F9F9") < 1.5 ? "light" : undefined);
const isDark = () => typeof document !== "undefined" && document.documentElement.dataset.theme !== "light";
const onTheme = (f: () => void) => { const o = new MutationObserver(f); o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); return () => o.disconnect(); };
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const TILT = (25 * Math.PI) / 180, SN = Math.sin(TILT), CS = Math.cos(TILT);
function Eye({ kind, x, y, E, k, th, st, c }: { kind: Eyes; x: number; y: number; E: number; k: number; th: number; st: State; c: string }) {
  const s = (E / 80) * k, u = E * k;
  if (st === "asleep") return <path d={`M${x - 4.5 * s} ${y}q${4.5 * s} ${4 * s} ${9 * s} 0`} stroke={c} strokeWidth={3 * s * th} strokeLinecap="round" fill="none" />;
  if (st === "done") return <path d={`M${x - 4.5 * s} ${y + 2 * s}q${4.5 * s} ${-7 * s} ${9 * s} 0`} stroke={c} strokeWidth={3.2 * s * th} strokeLinecap="round" fill="none" />;
  if (st === "waiting") return <path d={`M${x - 4 * s} ${y}h${8 * s}`} stroke={c} strokeWidth={3.4 * s * th} strokeLinecap="round" />;
  if (st === "blocked") return <path d={`M${x - 3.5 * s} ${y - 3.5 * s}l${7 * s} ${7 * s}M${x + 3.5 * s} ${y - 3.5 * s}l${-7 * s} ${7 * s}`} stroke={c} strokeWidth={3 * s * th} strokeLinecap="round" />;
  const rot = `rotate(-25 ${x} ${y})`;
  switch (kind) {
    case "commas": { const h = 0.0725 * u; return <path d={`M${x - h * SN} ${y - h * CS}L${x + h * SN} ${y + h * CS}`} stroke={c} strokeWidth={0.085 * u * th} strokeLinecap="round" />; }
    case "dots": return <circle cx={x} cy={y} r={0.062 * u * Math.sqrt(th)} fill={c} />;
    case "ovals": return <ellipse cx={x} cy={y} rx={0.05 * u * th} ry={0.1 * u} fill={c} transform={rot} />;
    case "pixels": return <rect x={x - 0.055 * u} y={y - 0.075 * u} width={0.11 * u} height={0.15 * u} rx={0.015 * u} fill={c} transform={rot} />;
  }
}

type Pose = { tx: number; ty: number; r: number; sx: number; sy: number };
const readPose = (el: Element | null): Pose | null => {
  if (!el) return null;
  const cs = getComputedStyle(el), t = cs.translate === "none" ? [] : cs.translate.split(" ").map(parseFloat), sc = cs.scale === "none" ? [] : cs.scale.split(" ").map(parseFloat);
  return { tx: t[0] || 0, ty: t[1] || 0, r: cs.rotate === "none" ? 0 : parseFloat(cs.rotate) || 0, sx: sc[0] ?? 1, sy: sc[1] ?? sc[0] ?? 1 };
};
const EASE_OUT = "cubic-bezier(.3, .3, .25, 1)";

export type MascotProps = { cfg: MascotConfig; state?: State; size?: number; track?: boolean; interactive?: boolean; className?: string; title?: string };

export function Mascot({ cfg, state = "idle", size = 96, track = false, interactive = false, className = "", title }: MascotProps) {
  const t = useT();
  const label = t(STATES.find((x) => x.id === state)!.label);
  const { d, a: base } = SHAPES[cfg.shape];
  const fg = ink(cfg.color);
  const small = size < 28;
  const uid = "m" + React.useId().replace(/[^\w-]/g, "");
  const ref = React.useRef<SVGSVGElement>(null);
  const poseRef = React.useRef<SVGGElement>(null);
  const bodyRef = React.useRef<SVGGElement>(null);
  const [look, setLook] = React.useState<[number, number]>([0, 0]);
  const [blink, setBlink] = React.useState(false);
  const acc = (id?: string) => ACCESSORIES.find((x) => x.id === id);
  const hat = acc(cfg.hat), glasses = acc(cfg.glasses), extra = acc(cfg.extra);
  const dark = React.useSyncExternalStore(onTheme, isDark, () => true);

  const prevState = React.useRef(state), fromPose = React.useRef<Pose | null>(null);
  if (prevState.current !== state) { fromPose.current = readPose(bodyRef.current); prevState.current = state; }
  React.useLayoutEffect(() => {
    const f = fromPose.current, to = readPose(bodyRef.current); fromPose.current = null;
    if (!f || !to || reduced() || !poseRef.current?.animate) return;
    const dl = { tx: f.tx - to.tx, ty: f.ty - to.ty, r: f.r - to.r, sx: f.sx / (to.sx || 1), sy: f.sy / (to.sy || 1) };
    if (Math.abs(dl.tx) + Math.abs(dl.ty) + Math.abs(dl.r) + Math.abs(dl.sx - 1) + Math.abs(dl.sy - 1) < 0.01) return;
    poseRef.current.animate([{ translate: `${dl.tx}px ${dl.ty}px`, rotate: `${dl.r}deg`, scale: `${dl.sx} ${dl.sy}` }, { translate: "0px 0px", rotate: "0deg", scale: "1 1" }],
      { duration: 220, easing: EASE_OUT, composite: "add" });
  }, [state]);

  const poke = () => { if (!reduced()) poseRef.current?.animate([{ scale: "1" }, { scale: "1.12 .86" }, { scale: ".94 1.06" }, { scale: "1" }], { duration: 420, easing: "cubic-bezier(.24,1.34,.38,1)", composite: "add" }); };

  React.useEffect(() => {
    if (!["idle", "listening", "working", "talking"].includes(state) || reduced()) return;
    let t: number;
    const loop = () => { t = window.setTimeout(() => { setBlink(true); window.setTimeout(() => setBlink(false), 140); loop(); }, 2500 + Math.random() * 3500); };
    loop(); return () => clearTimeout(t);
  }, [state]);

  React.useEffect(() => {
    if (!track || !["idle", "listening"].includes(state)) { setLook([0, 0]); return; }
    const f = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect(); if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), k = Math.hypot(dx, dy) || 1, m = Math.min(1, k / 300);
      setLook([(dx / k) * m, (dy / k) * m]);
    };
    addEventListener("pointermove", f); return () => removeEventListener("pointermove", f);
  }, [track, state]);

  const E = base.eyeE;
  const a: Anchors = React.useMemo(() => {
    const o = { ...base, clip: `url(#${uid}s)`, dark };
    if (hat?.cover) o.eyeY = Math.max(o.eyeY, o.hatY + 4 + 0.125 * E + o.eyeDY);
    if (!glasses) return o;
    const dx = 0.14 * E, r = dx - 1, [l, rr] = base.span(base.eyeY);
    return { ...o, eyeDX: dx, eyeDY: 0, eyeX: Math.min(Math.max(base.eyeX, l + dx + r + 3), rr - dx - r - 3) };
  }, [base, glasses, hat, E, uid, dark]);
  const k = glasses ? 0.72 : 1, th = small ? 1.45 : 1;
  const reach = glasses ? 0.016 * E : 0.045 * E;
  const eyeLook: [number, number] = state === "thinking" ? [-0.3 * reach, -0.7 * reach] : state === "working" ? [0, 0.6 * reach] : [look[0] * reach, look[1] * reach * 0.8];
  const headTop = Math.min(a.top, hat?.top?.(a) ?? a.top);
  const hatted = headTop < a.top - 1;
  const cut = !!hat?.cover;
  const sym = cfg.symbol && !small ? iconBody(cfg.symbol) : "";
  const cy = (a.top + a.bottom) / 2;
  const mouthY = a.eyeY + 0.27 * E;

  const orbit = (front: boolean) => state === "thinking" && (
    <g className="m-orbit" data-front={front || undefined} transform={`translate(${a.hatX} ${headTop - (small ? 11 : 7)})`} style={{ ["--rx" as string]: `${small ? 16 : 13}px`, ["--ry" as string]: `${small ? 5 : 3.5}px` }}>
      {[0, 1, 2].map((i) => (
        <g key={i} className="m-ox" style={{ animationDelay: `${-1.2 * i}s` }}>
          <g className="m-oy" style={{ animationDelay: `${-1.2 * i - 0.9}s` }}>
            <circle r={small ? 5 : 2.6} fill={cfg.color} style={{ animationDelay: `${-1.2 * i}s` }} /></g></g>))}
    </g>);

  const alertY = hatted ? headTop - 9 : a.top + 2;
  const alertX = (() => { if (hatted) return a.cx + a.halfW - 2; let m = 0; for (let y = alertY - 9; y <= alertY + 9; y += 3) m = Math.max(m, a.span(y)[1]); return Math.max(a.cx + a.halfW - 2, m + 9.5); })();
  const zY = hatted ? headTop - 4 : a.top - 4;

  return (
    <svg ref={ref} className={"mascot " + className} data-state={state} data-tone={tone(cfg.color)} width={size} height={size} viewBox="-6 -10 112 112"
      role="img" aria-label={title ?? (cfg.name ? t("common.mascotLabel", { name: cfg.name, state: label }) : label)}
      onPointerDown={interactive ? poke : undefined} style={{ ["--c" as string]: cfg.color, overflow: "visible" }}>
      <defs>
        <clipPath id={uid + "s"}><path d={d} /></clipPath>
        {cut && <clipPath id={uid + "c"}><rect x="-20" y={a.hatY - 1} width="140" height="140" /></clipPath>}
      </defs>
      
      {state === "listening" && <g className="m-rings">{[0, 1].map((i) => <circle key={i} cx={a.cx} cy={cy} r={a.halfW + 6} fill="none" stroke={cfg.color} strokeWidth="2" style={{ animationDelay: `${i * 0.6}s` }} />)}</g>}
      {state === "done" && <g className="m-loops" style={{ transformOrigin: `${a.cx}px ${cy}px` }}>
        <ellipse cx={a.cx} cy={cy} rx={a.halfW + 14} ry="12" fill="none" stroke="#2fb24c" strokeWidth="2.5" transform={`rotate(-24 ${a.cx} ${cy})`} />
        <ellipse cx={a.cx} cy={cy} rx={a.halfW + 10} ry="10" fill="none" stroke="#8448ff" strokeWidth="2.5" transform={`rotate(28 ${a.cx} ${cy})`} />
      </g>}
      {orbit(false)}
      <g ref={poseRef} className="m-pose" style={{ transformOrigin: `${a.cx}px ${a.bottom}px` }}>
      <g ref={bodyRef} className="m-body" style={{ transformOrigin: `${a.cx}px ${a.bottom}px` }}>
        {[hat, glasses, extra].map((p) => p?.back && <g key={p.id + "b"} className="m-acc">{p.back(a, fg, cfg.color)}</g>)}
        <path className="m-shape" d={d} fill={cfg.color} clipPath={cut ? `url(#${uid}c)` : undefined} />
        {sym && <g className="m-sym" transform={`translate(${a.cx - 9} ${a.bellyY - 9}) scale(.75)`} fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".9" dangerouslySetInnerHTML={{ __html: sym.replaceAll("currentColor", fg) }} />}
        <g clipPath={`url(#${uid}s)`}>
          <g className="m-eyes" data-blink={blink || undefined} style={{ translate: `${eyeLook[0]}px ${eyeLook[1]}px`, transformOrigin: `${a.eyeX}px ${a.eyeY}px` }}>
            <Eye kind={cfg.eyes} x={a.eyeX - a.eyeDX} y={a.eyeY + a.eyeDY} E={E} k={k} th={th} st={state} c={fg} />
            <Eye kind={cfg.eyes} x={a.eyeX + a.eyeDX} y={a.eyeY - a.eyeDY} E={E} k={k} th={th} st={state} c={fg} />
          </g>
        </g>
        {(cfg.mouth !== "none" || state === "talking") && state !== "asleep" && (
          <g className="m-mouth">
            {cfg.mouth === "o" || state === "talking" ? <ellipse cx={a.eyeX} cy={mouthY} rx={small ? 7 : 3.2} ry={small ? 6 : 3.6} fill={fg} />
              : <path d={`M${a.eyeX - 5} ${mouthY - 2}q5 5 10 0`} stroke={fg} strokeWidth="2.8" strokeLinecap="round" fill="none" />}
          </g>)}
        {[hat, glasses, extra].map((p) => p && <g key={p.id} className="m-acc">{p.front(a, fg, cfg.color)}</g>)}
      </g>
      </g>
      
      {orbit(true)}
      {state === "working" && !small && <g className="m-sparks" stroke={cfg.color} strokeWidth="2.4" strokeLinecap="round">
        <path d={`M${a.cx + a.halfW + 4} ${a.top + 8}l6 -5`} /><path d={`M${a.cx + a.halfW + 7} ${a.top + 18}h8`} /><path d={`M${a.cx - a.halfW - 4} ${a.top + 8}l-6 -5`} />
      </g>}
      {small && state === "working" && <g className="m-spin" style={{ transformOrigin: `${a.cx}px ${cy}px` }}><circle cx={a.cx + a.halfW + 10} cy={cy} r="9" fill={cfg.color} /></g>}
      {small && state === "listening" && <circle cx={a.cx} cy={cy} r={a.halfW + 10} fill="none" stroke={cfg.color} strokeWidth="6" />}
      {state === "blocked" && <g className="m-alert"><circle cx={alertX} cy={alertY} r={small ? 10 : 8} fill="#F2263F" /><path d={`M${alertX} ${alertY - 4}v4.5`} stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /><circle cx={alertX} cy={alertY + 4} r="1.5" fill="#fff" /></g>}
      {state === "waiting" && !small && <g className="m-wait" fill={cfg.color}>{[0, 1, 2].map((i) => <circle key={i} cx={a.cx + a.halfW + 6 + i * 7} cy={hatted ? headTop - 2 : a.top + 2} r="2.2" style={{ animationDelay: `${i * 0.18}s` }} />)}</g>}
      {state === "asleep" && !small && <g className="m-z" fill="none" stroke="var(--t2, #888)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={`M${a.cx + a.halfW - 4} ${zY}h7l-7 8h7`} /><path d={`M${a.cx + a.halfW + 8} ${zY - 10}h5l-5 6h5`} style={{ animationDelay: ".8s" }} /></g>}
    </svg>
  );
}

export const DEFAULT_MASCOT: Omit<MascotConfig, "name"> = { shape: "round", color: "#8448FF", eyes: "commas", mouth: "none" };
