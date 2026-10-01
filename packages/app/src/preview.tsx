// Preview mode: the design gallery renders every screen state with fixture content.
// Fixtures are translatable catalogs: packages/i18n/locales/<locale>/fixtures/<area>.json. They are only loaded in preview
// (gallery iframes, `?preview` routes, Help → Design gallery). Live routes never read them,
// and the title bar shows a "Preview" badge whenever they are on screen.
import * as React from "react";
import { useI18n } from "./i18n";

export const isPreview = () => /[?&](preview|shot)\b/.test(location.hash);

type FixtureModule = { default: Record<string, unknown> };
const loaders = import.meta.glob("../../i18n/locales/*/fixtures/*.json") as Record<string, () => Promise<FixtureModule>>;
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
  const [ready, setReady] = React.useState(!isPreview());
  React.useEffect(() => {
    if (!isPreview()) return;
    const areas = [...new Set(Object.keys(loaders).map((k) => k.split("/").pop()!.slice(0, -5)))];
    Promise.all(areas.map((a) => load(a, locale))).then(() => setReady(true));
  }, [locale]);
  return ready ? <>{children}</> : null;
}

/** Synchronous read of an area's fixtures (call only inside preview; PreviewGate preloads). */
export function useFixtures<T>(area: string): T {
  const { locale } = useI18n();
  return (cache.get(`${area}:${locale}`) ?? cache.get(`${area}:en`) ?? {}) as T;
}
