const raw = import.meta.glob("./svg/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const ZOOM = 20 / 17, K = 1.5 / 1.75 / ZOOM;
const LIB: Record<string, string> = {};
for (const [p, s] of Object.entries(raw)) {
  const name = p.slice(6, -4);
  const inner = s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
    .replace(/stroke-width="([\d.]+)"/g, (_, w) => `stroke-width="${(+w * K).toFixed(3)}"`);
  LIB[name] = `<g transform="translate(12 12) scale(${ZOOM}) translate(-12 -12)" stroke-width="${(1.75 * K).toFixed(3)}">${inner}</g>`;
}
const HAND: Record<string, string> = {
  "sidebar-left": '<rect x="2" y="3" width="20" height="18" rx="5"/><path d="M9 3v18"/><path d="M15.75 9.5 13.25 12l2.5 2.5"/>',
  "sidebar-right": '<rect x="2" y="3" width="20" height="18" rx="5"/><path d="M15 3v18"/>',
  "more-dots": '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  "system": '<path d="M12.5 3.5H6A3.5 3.5 0 0 0 2.5 7v6A3.5 3.5 0 0 0 6 16.5h12.5A3.5 3.5 0 0 0 22 13v-2M9 20.5h6M12 16.5v4"/><path class="system-moon" d="M18 2.7a2.8 2.8 0 1 0 2.8 2.8 2.2 2.2 0 0 1-2.8-2.8z" fill="currentColor" stroke="none"/><g class="system-sun"><circle cx="18" cy="5.5" r="1.6"/><path d="M18 1.5v.6M18 8.9v.6M14 5.5h.6M21.4 5.5h.6M15.2 2.7l.4.4M20.4 7.9l.4.4M15.2 8.3l.4-.4M20.4 3.1l.4-.4"/></g>',
};
export type IconName = string;
export function Icon({ name, size = 16, className, style }: { name: IconName; size?: number; className?: string; style?: React.CSSProperties }) {
  const body = HAND[name] ?? LIB[name];
  if (!body) { if (import.meta.env.DEV) console.warn("missing icon:", name); return <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" aria-hidden><rect x="4" y="4" width="16" height="16" rx="5" /></svg>; }
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden dangerouslySetInnerHTML={{ __html: body }} />;
}
export const Gel = ({ name, size = 16 }: { name: string; size?: number }) => (
  <span className="gel" style={{ width: size, height: size, backgroundImage: `url(/gel/${name}.png)`, borderRadius: Math.round(size * 0.28) }} aria-hidden />
);
export const iconBody = (name: string) => HAND[name] ?? LIB[name] ?? "";
