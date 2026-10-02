// Design gallery: every screen and state, light and dark, rendered live in iframes of the app itself.
import * as React from "react";
import { SCREENS } from "../registry";
import { useT } from "../i18n";

export function Gallery() {
  const t = useT();
  const [theme, setTheme] = React.useState<"dark" | "light" | "both">("both");
  const gallery = React.useRef<HTMLDivElement>(null);
  const themes = theme === "both" ? ["dark", "light"] : [theme];
  React.useEffect(() => { document.documentElement.dataset.theme = "dark"; }, []);
  React.useEffect(() => {
    // Native lazy loading eagerly starts same-document previews in Electron.
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const frame = entry.target as HTMLIFrameElement;
        const url = entry.isIntersecting ? new URL(frame.dataset.src!, location.href).href : "about:blank";
        // Replacing avoids adding iframe visits to the window's Back/Forward history.
        if (frame.contentWindow && frame.contentWindow.location.href !== url) frame.contentWindow.location.replace(url);
      }
    }, { root: gallery.current });
    gallery.current!.querySelectorAll("iframe").forEach((frame) => observer.observe(frame));
    return () => observer.disconnect();
  }, [theme]);
  // Read by scripts/compare-shots.mjs to map each state to its design screenshot.
  (window as unknown as { __screens: unknown }).__screens = SCREENS.map((s) => ({ id: s.id, design: s.design, variants: s.variants }));
  const items = SCREENS.flatMap((s) => (s.variants ?? [["", ""]]).map(([v, vl]) => ({ s, v, vl })));
  return (
    <div className="gal" ref={gallery}>
      <div className="gal-head">
        <div className="gal-title">{t("gallery.title")}</div>
        <div className="spacer" /><a className="chip" href="#/home">{t("gallery.openApp")}</a>
        {(["both", "dark", "light"] as const).map((x) => (
          <button key={x} className="chip" data-pressed={theme === x || undefined} onClick={() => setTheme(x)}>{t(`gallery.theme.${x}`)}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(560px, 1fr))", gap: 24 }}>
        {items.flatMap(({ s, v, vl }) => themes.map((th) => (
          <a key={s.id + v + th} data-gallery-item={`${s.id}${v ? "~" + v : ""}-${th}`} href={`#/${s.id}?theme=${th}&preview${v ? "&v=" + v : ""}`} style={{ color: "inherit", textDecoration: "none" }}>
            <div style={{ position: "relative", aspectRatio: "16/10", borderRadius: 14, overflow: "hidden", boxShadow: "0 0 0 1px #ffffff1a" }}>
              <iframe inert tabIndex={-1} data-src={`#/${s.id}?theme=${th}&shot${v ? "&v=" + v : ""}`} title={t(s.name)}
                style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 900, border: 0, transformOrigin: "0 0", scale: "var(--k)", pointerEvents: "none" }}
                ref={(el) => { if (el) el.style.setProperty("--k", String(el.parentElement!.clientWidth / 1440)); }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 12 }}><span style={{ fontWeight: 500 }}>{t(s.name)}{vl ? " · " + t(vl) : ""}</span><span style={{ color: "#888" }}>{t(s.group)} · {t(`gallery.theme.${th}`)}</span></div>
          </a>
        )))}
      </div>
    </div>
  );
}
