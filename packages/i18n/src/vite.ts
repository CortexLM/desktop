// Catalog loader for Vite-built hosts (the renderer).
import type { CatalogSource } from "./index";

const files = import.meta.glob(["../locales/*/*.json", "!../locales/*/*.source.json"], { eager: true, import: "default" }) as Record<string, Record<string, string>>;
const byLocale: Record<string, Record<string, Record<string, string>>> = {};
for (const [path, entries] of Object.entries(files)) {
  const [, loc, ns] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/) ?? [];
  if (loc && ns) (byLocale[loc] ??= {})[ns] = entries;
}
export const viteCatalogs: CatalogSource = (locale) => byLocale[locale] ?? {};
