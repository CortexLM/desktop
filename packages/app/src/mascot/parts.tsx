import type { Anchors } from "./Mascot";
export type Slot = "glasses" | "hat" | "extra";
export type Accessory = {
  id: string; label: string; slot: Slot;
  back?: (a: Anchors, ink: string, color: string) => React.ReactNode; front: (a: Anchors, ink: string, color: string) => React.ReactNode;
  cover?: boolean;
  top?: (a: Anchors) => number;
};
export const SLOT_LABEL: Record<Slot, string> = { glasses: "mascot.slot.glasses", hat: "mascot.slot.hat", extra: "mascot.slot.extra" };

const INK = "#141414", WHITE = "#FFFFFF", GOLD = "#FFB000", PINK = "#FF5C8A";

const hsl = (hex: string) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100, y: 0.299 * r + 0.587 * g + 0.114 * b };
};
const hex = (h: number, s: number, l: number) => {
  s /= 100; l /= 100; const k = (n: number) => (n + h / 30) % 12, A = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - A * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
};
const lum = (c: string) => { const n = parseInt(c.slice(1, 7), 16); const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (x: string, y: string) => { const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m); return (p + 0.05) / (q + 0.05); };
const BG = (a: Anchors) => (a.dark ? "#1B1B1B" : "#F2F2F2");
const comp = (c: string, dl = 0, dark = false) => {
  const { h, s, l } = hsl(c), d = dark ? Math.abs(dl) : dl;
  return s < 25 ? hex(40, 100, 50 + d) : hex((h + 180) % 360, Math.max(s, 70), Math.min(Math.max(l, 45), 58) + d);
};
const shade = (c: string, a: Anchors) => comp(c, -12, a.dark);
const neutral = (c: string, a: Anchors) => [INK, "#E9E9E9", "#5E5E5E"].find((n) => ratio(n, BG(a)) >= 3 && ratio(n, c) >= 1.5) ?? comp(c, 0, a.dark);
const near = (c: string, ref: string) => Math.abs(hsl(c).h - hsl(ref).h) < 20 && hsl(c).s > 60;

const lens = (a: Anchors) => Math.min(9.5, a.eyeDX - 1);
const eyes = (a: Anchors) => [a.eyeX - a.eyeDX, a.eyeX + a.eyeDX] as const;
const brow = (a: Anchors) => a.eyeY - a.eyeDY - 0.125 * a.eyeE;

const temples = (a: Anchors, r: number, stroke: string) => { const [l, rr] = a.span(a.eyeY - 2); return (
  <path d={`M${a.eyeX - a.eyeDX - r} ${a.eyeY - 1}L${l + 1.5} ${a.eyeY - 2}M${a.eyeX + a.eyeDX + r} ${a.eyeY - 1}L${rr - 1.5} ${a.eyeY - 2}`} stroke={stroke} strokeWidth="2.5" strokeLinecap="round" fill="none" />); };
const glint = (x: number, y: number, r: number) => <path d={`M${x - r * 0.45} ${y - r * 0.05}l${r * 0.35} ${-r * 0.4}`} stroke={WHITE} strokeWidth="2" strokeLinecap="round" opacity=".75" />;

const star = (x: number, y: number, R: number) => {
  const p = Array.from({ length: 10 }, (_, i) => { const t = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R; return `${(x + r * Math.cos(t)).toFixed(2)} ${(y + r * Math.sin(t)).toFixed(2)}`; });
  return `M${p.join("L")}Z`;
};

export const ACCESSORIES: Accessory[] = [
  { id: "round", label: "mascot.accessory.round", slot: "glasses", front: (a, ink) => { const r = lens(a); return <g fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round">
    {eyes(a).map((x) => <circle key={x} cx={x} cy={a.eyeY} r={r} />)}
    <path d={`M${a.eyeX - a.eyeDX + r} ${a.eyeY - 1}q${a.eyeDX - r} -3 ${2 * (a.eyeDX - r)} 0`} />{temples(a, r, ink)}</g>; } },
  { id: "square", label: "mascot.accessory.square", slot: "glasses", front: (a, ink) => { const r = lens(a); return <g fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round">
    {eyes(a).map((x) => <rect key={x} x={x - r} y={a.eyeY - r + 1.5} width={2 * r} height={2 * r - 3} rx="3" />)}
    <path d={`M${a.eyeX - a.eyeDX + r} ${a.eyeY - 1}H${a.eyeX + a.eyeDX - r}`} />{temples(a, r, ink)}</g>; } },
  { id: "aviator", label: "mascot.accessory.aviator", slot: "glasses", front: (a, ink) => { const r = lens(a) + 0.5, y = a.eyeY; return <g stroke={ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {eyes(a).map((x, i) => { const o = i ? 1 : -1; return <path key={x} fill={ink} fillOpacity=".18" d={`M${x - o * (r - 1)} ${y - r + 2.5}H${x + o * r}Q${x + o * (r + 0.5)} ${y + r} ${x} ${y + r - 0.5}Q${x - o * r} ${y + r - 1} ${x - o * (r - 1)} ${y - r + 2.5}Z`} />; })}
    <path fill="none" d={`M${a.eyeX - a.eyeDX + r - 1} ${y - r + 2.5}H${a.eyeX + a.eyeDX - r + 1}M${a.eyeX - 2.5} ${y - 2}h5`} />{temples(a, r, ink)}</g>; } },
  { id: "sunglasses", label: "mascot.accessory.sunglasses", slot: "glasses", front: (a, _ink, color) => { const r = lens(a) + 0.5, f = hsl(color).y < 0.25 ? "#4A4A4A" : INK; return <g>
    {eyes(a).map((x) => <rect key={x} x={x - r} y={a.eyeY - r + 1.5} width={2 * r} height={2 * r - 3} rx={r - 1.5} fill={INK} stroke={f} strokeWidth="2.5" />)}
    <path d={`M${a.eyeX - a.eyeDX + r} ${a.eyeY - 2}H${a.eyeX + a.eyeDX - r}`} stroke={f} strokeWidth="2.5" />{temples(a, r, f)}
    {eyes(a).map((x) => <g key={x}>{glint(x, a.eyeY - 1, r)}</g>)}</g>; } },
  { id: "monocle", label: "mascot.accessory.monocle", slot: "glasses", front: (a, ink) => { const r = lens(a) + 0.5, x = a.eyeX + a.eyeDX; return <g fill="none" stroke={ink} strokeLinecap="round">
    <circle cx={x} cy={a.eyeY} r={r} strokeWidth="2.5" fill={ink} fillOpacity=".12" />
    <path d={`M${x + r * 0.6} ${a.eyeY + r * 0.8}Q${x + r + 2} ${a.eyeY + 14} ${x + r - 1} ${a.eyeY + 22}`} strokeWidth="1.6" strokeDasharray="0.1 3.2" /></g>; } },
  { id: "visor", label: "mascot.accessory.visor", slot: "glasses", front: (a, _ink, color) => { const w = a.eyeDX + lens(a) + 2, x = a.eyeX, [L, R] = a.span(a.eyeY), f = hsl(color).y < 0.25 ? "#4A4A4A" : INK; return <g>
    <path d={`M${x - w} ${a.eyeY}H${L + 1.5}M${x + w} ${a.eyeY}H${R - 1.5}`} stroke={f} strokeWidth="3" strokeLinecap="round" />
    <rect x={x - w} y={a.eyeY - 7} width={2 * w} height="14" rx="7" fill={INK} stroke={f} strokeWidth="2" />
    <path d={`M${x - w + 6} ${a.eyeY - 2.5}h${w * 0.55}`} stroke={WHITE} strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
    <path d={`M${x + w * 0.25} ${a.eyeY + 2.5}h${w * 0.4}`} stroke={comp(color)} strokeWidth="2.2" strokeLinecap="round" /></g>; } },

  { id: "cap", label: "mascot.accessory.cap", slot: "hat", cover: true, top: (a) => a.hatY - a.hatW * 0.72 - 3, front: (a, _ink, color) => { const x = a.hatX, w = a.hatW, y = a.hatY, h = w * 0.72; return <g>
    <path d={`M${x + w * 0.2} ${y - 2}H${x + w + 9}a3 3 0 0 1 0 6H${x + w * 0.2}z`} fill={shade(color, a)} />
    <path d={`M${x - w} ${y + 1.5}A${w} ${h} 0 0 1 ${x + w} ${y + 1.5}Q${x} ${y - 1} ${x - w} ${y + 1.5}z`} fill={comp(color)} />
    <circle cx={x} cy={y - h + 1.5} r="2.4" fill={shade(color, a)} /></g>; } },
  { id: "beanie", label: "mascot.accessory.beanie", slot: "hat", cover: true, top: (a) => a.hatY - (a.hatW + 1) * 0.85 - 6, front: (a, _ink, color) => { const x = a.hatX, w = a.hatW + 1, y = a.hatY + 1, h = w * 0.85; return <g>
    <path d={`M${x - w + 1} ${y}A${w - 1} ${h} 0 0 1 ${x + w - 1} ${y}z`} fill={comp(color)} />
    <rect x={x - w - 1} y={y - 3.5} width={2 * w + 2} height="8" rx="4" fill={shade(color, a)} />
    <circle cx={x} cy={y - h - 1} r="5" fill={shade(color, a)} /></g>; } },
  { id: "crown", label: "mascot.accessory.crown", slot: "hat", cover: true, top: (a) => a.hatY - Math.min(16, a.hatW * 0.8) - 5, front: (a, _ink, color) => {
    const x = a.hatX, w = a.hatW - 1, y = a.hatY + 1.5, ch = Math.min(16, a.hatW * 0.8), x0 = x - w, x1 = x + w, f = near(color, GOLD) ? neutral(color, a) : GOLD;
    return <g fill={f} stroke={f} strokeWidth="2.5" strokeLinejoin="round">
      <path d={`M${x0} ${y}V${y - ch + 3}L${x0 + w / 2} ${y - ch * 0.45}L${x} ${y - ch}L${x1 - w / 2} ${y - ch * 0.45}L${x1} ${y - ch + 3}V${y}z`} />
      {[x0, x, x1].map((p, i) => <circle key={p} cx={p} cy={i === 1 ? y - ch - 1.5 : y - ch + 1.5} r="1.8" />)}
      <circle cx={x} cy={y - 4} r="2.4" fill={f === GOLD ? comp(color) : comp(GOLD)} stroke="none" /></g>; } },
  { id: "top-hat", label: "mascot.accessory.top-hat", slot: "hat", cover: true, top: (a) => a.hatY - Math.min(a.hatW * 1.05, 22) - 3, front: (a, _ink, color) => {
    const x = a.hatX, w = a.hatW, y = a.hatY + 1, cw = Math.max(w * 0.62, 9), ch = Math.min(w * 1.05, 22), f = neutral(color, a); return <g>
    <rect x={x - cw} y={y - ch - 2} width={2 * cw} height={ch} rx="2.5" fill={f} />
    <rect x={x - cw} y={y - 8} width={2 * cw} height="4.5" fill={comp(color, 0, a.dark)} />
    <rect x={x - w - 2} y={y - 3.5} width={2 * w + 4} height="5" rx="2.5" fill={f} /></g>; } },
  { id: "antenna", label: "mascot.accessory.antenna", slot: "hat", top: (a) => a.top - 19, back: (a, _ink, color) => <path d={`M${a.hatX} ${a.hatY}V${a.top - 11}`} stroke={neutral(color, a)} strokeWidth="3" strokeLinecap="round" />,
    front: (a, _ink, color) => <circle cx={a.hatX} cy={a.top - 14} r="4.5" fill={comp(color, 0, a.dark)} /> },
  { id: "headphones", label: "mascot.accessory.headphones", slot: "hat", top: (a) => a.top - 13,
    back: (a, _ink, color) => { const y = (a.hatY + a.bellyY) / 2 - 8, [L, R] = a.span(y + 8); return <path d={`M${L} ${y}C${L} ${a.top - 17} ${R} ${a.top - 17} ${R} ${y}`} stroke={neutral(color, a)} strokeWidth="4" fill="none" strokeLinecap="round" />; },
    front: (a, _ink, color) => { const y = (a.hatY + a.bellyY) / 2; return <g>{a.span(y).map((x) => <g key={x}>
      <rect x={x - 5} y={y - 10} width="10" height="19" rx="5" fill={neutral(color, a)} />
      <rect x={x - 2} y={y - 6} width="4" height="11" rx="2" fill={comp(color)} /></g>)}</g>; } },
  { id: "headband", label: "mascot.accessory.headband", slot: "hat", front: (a, _ink, color) => { const y = Math.max(a.top + 5, Math.min(a.hatY, brow(a) - 0.05 * a.eyeE - 4)), x = a.span(y)[1]; return <g fill={comp(color)}>
    <path d={`M${x - 1} ${y}l9 -6a2.5 2.5 0 0 1 3 3.5l-6 6.5zM${x - 1} ${y + 1}l10 4a2.5 2.5 0 0 1 -1 4.5l-10 -2z`} />
    <rect x="-10" y={y - 3.5} width="120" height="7" clipPath={a.clip} />
    <circle cx={x} cy={y} r="3.6" fill={shade(color, a)} /></g>; } },

  { id: "cheeks", label: "mascot.accessory.cheeks", slot: "extra", front: (a) => <g fill={PINK} opacity=".55">{[-1, 1].map((o) => <ellipse key={o} cx={a.eyeX + o * (a.eyeDX + 4)} cy={a.eyeY + 0.17 * a.eyeE} rx="4.5" ry="2.8" />)}</g> },
  { id: "bow-tie", label: "mascot.accessory.bow-tie", slot: "extra", front: (a, _ink, color) => { const y = a.bottom - 5, [l, r] = a.span(y), x = (l + r) / 2, f = comp(color); return <g fill={f} stroke={f} strokeWidth="2" strokeLinejoin="round">
    <path d={`M${x} ${y}L${x - 10} ${y - 6}V${y + 6}zM${x} ${y}L${x + 10} ${y - 6}V${y + 6}z`} />
    <rect x={x - 3} y={y - 3.5} width="6" height="7" rx="2" fill={comp(color, -12)} stroke="none" /></g>; } },
  { id: "scarf", label: "mascot.accessory.scarf", slot: "extra", front: (a, _ink, color) => { const y = a.bellyY, [l, r] = a.span(y), x = l + (r - l) * 0.68; return <g>
    <path d={`M${x} ${y}l3 15a2 2 0 0 0 2.3 1.6l4.5 -0.9a2 2 0 0 0 1.5 -2.4l-3.3 -13.3z`} fill={shade(color, a)} />
    <path d={`M-10 ${y - 5}Q50 ${y + 1} 110 ${y - 5}v8Q50 ${y + 9} -10 ${y + 3}z`} fill={comp(color)} clipPath={a.clip} /></g>; } },
  { id: "pencil", label: "mascot.accessory.pencil", slot: "extra", back: (a, _ink, color) => { const y = a.hatY + 2, x = a.span(y + 6)[1] - 3, f = near(color, GOLD) ? "#12B8A0" : GOLD; return <g transform={`rotate(-38 ${x} ${y})`}>
    <rect x={x - 12} y={y - 3.2} width="20" height="6.4" fill={f} />
    <path d={`M${x + 8} ${y - 3.2}L${x + 15} ${y}L${x + 8} ${y + 3.2}z`} fill="#F2D3A8" />
    <path d={`M${x + 12.6} ${y - 1.1}L${x + 15} ${y}L${x + 12.6} ${y + 1.1}z`} fill={INK} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
    <rect x={x - 17} y={y - 3.2} width="6" height="6.4" rx="2.5" fill={PINK} /><rect x={x - 12.5} y={y - 3.2} width="2" height="6.4" fill="#BFC3C9" /></g>; },
    front: () => null },
  { id: "star", label: "mascot.accessory.star", slot: "extra", front: (a, _ink, color) => { const f = near(color, GOLD) ? WHITE : GOLD; return <path d={star(a.span(a.bellyY)[1] - 13, a.bellyY - 1, 6.5)} fill={f} stroke={f} strokeWidth="2" strokeLinejoin="round" />; } },
  { id: "moustache", label: "mascot.accessory.moustache", slot: "extra", front: (a, ink) => { const y = a.eyeY + 0.16 * a.eyeE; return <g fill={ink}>{[-1, 1].map((o) =>
    <path key={o} d={`M${a.eyeX} ${y - 1}c${o * -3} -3 ${o * 6} -4.5 ${o * 9.5} -1c${o * 1.6} 1.6 ${o * 3.6} 1.6 ${o * 4.8} 0c${o * 0} 4.4 ${o * -6.5} 7.2 ${o * -14.3} 3z`} />)}</g>; } },
];
