// Preview mode: the design gallery renders every screen state with fixture content.
// Fixtures are translatable catalogs: packages/i18n/locales/<locale>/fixtures/<area>.json. They are only loaded in preview
// (gallery iframes, `?preview` routes, Help → Design gallery). Live routes never read them;
// in preview the title bar shows the state picker.
import * as React from "react";
import { useI18n } from "./i18n";

export const isPreview = () => /[?&](preview|shot)\b/.test(location.hash);

type FixtureModule = { default: Record<string, unknown> };
const loaders = import.meta.glob(["../../i18n/locales/*/fixtures/*.json", "!../../i18n/locales/*/fixtures/*.source.json"]) as Record<string, () => Promise<FixtureModule>>;
const file = (locale: string, area: string) => `../../i18n/locales/${locale}/fixtures/${area}.json`;

const cache = new Map<string, Record<string, unknown>>();
async function load(area: string, locale: string) {
  const key = `${area}:${locale}`;
  if (cache.has(key)) return cache.get(key)!;
  const pick = loaders[file(locale, area)] ?? loaders[file("en", area)];
  const data = pick ? (await pick()).default : {};
  cache.set(key, data);
  return data;
}

/** Preloads every fixture module for the active locale before a preview screen renders. */
export function PreviewGate({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  const [preview, setPreview] = React.useState(isPreview);
  const [loaded, setLoaded] = React.useState<string | null>(null);
  React.useEffect(() => { const f = () => setPreview(isPreview()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  React.useEffect(() => {
    if (!preview || loaded === locale) return;
    const areas = [...new Set(Object.keys(loaders).map((k) => k.split("/").pop()!.slice(0, -5)))];
    Promise.all(areas.map((a) => load(a, locale))).then(() => setLoaded(locale));
  }, [preview, locale, loaded]);
  return !preview || loaded === locale ? <>{children}</> : null;
}

/** Synchronous read of an area's fixtures (call only inside preview; PreviewGate preloads). */
export function useFixtures<T>(area: string): T {
  const { locale } = useI18n();
  return (cache.get(`${area}:${locale}`) ?? cache.get(`${area}:en`) ?? {}) as T;
}
