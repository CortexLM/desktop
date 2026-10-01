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
  "system": '<mask id="sysm"><rect width="24" height="24" fill="#fff"/><circle cx="18" cy="16" r="5.2" fill="#000"/></mask><g mask="url(#sysm)"><rect x="2.5" y="3.5" width="19" height="13" rx="3.5"/><path d="M9 20.5h6M12 16.5v4"/></g><path d="M18 13.2a2.8 2.8 0 1 0 2.8 2.8 2.2 2.2 0 0 1-2.8-2.8z" fill="currentColor" stroke="none"/>',
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
