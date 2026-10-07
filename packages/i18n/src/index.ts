// Catalog-driven i18n. English is the source; every user-facing string is a key in
// packages/i18n/locales/<locale>/<namespace>.json and is read through `t`.
export const SOURCE_LOCALE = "en";
export const LOCALES = ["en", "fr", "es", "de", "ja", "zh-Hans", "pt-BR", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export type Catalog = Record<string, string>;
export type Vars = Record<string, string | number>;

/** Flattens `{ ns: { key: value } }` per locale into `ns.key` entries. */
export type CatalogSource = (locale: Locale) => Record<string, Record<string, string>>;

export function flatten(namespaces: Record<string, Record<string, string>>): Catalog {
  const out: Catalog = {};
  for (const [ns, entries] of Object.entries(namespaces)) for (const [k, v] of Object.entries(entries)) out[`${ns}.${k}`] = v;
  return out;
}

export function resolveLocale(wanted: readonly string[]): Locale {
  for (const w of wanted) {
    const exact = LOCALES.find((l) => l.toLowerCase() === w.toLowerCase());
    if (exact) return exact;
    if (/^zh/i.test(w)) return "zh-Hans";
    if (/^pt/i.test(w)) return "pt-BR";
    const base = LOCALES.find((l) => l === w.split("-")[0]);
    if (base) return base;
  }
  return SOURCE_LOCALE;
}

const english = (w: string) => /^en(?:-|$)/i.test(w);
const supported = (w: string) => english(w) || resolveLocale([w]) !== SOURCE_LOCALE;
/** An explicit choice (Settings, then CORTEX_LOCALE) wins, then the first supported system language, else English. */
export function preferredLocale(explicit: string, system: readonly string[]): Locale {
  if (explicit && supported(explicit)) return resolveLocale([explicit]);
  return resolveLocale(system);
}

export function createTranslator(locale: Locale, load: CatalogSource) {
  const source = flatten(load(SOURCE_LOCALE));
  const cat = locale === SOURCE_LOCALE ? source : { ...source, ...flatten(load(locale)) };
  const plural = new Intl.PluralRules(locale);
  return function t(key: string, vars?: Vars): string {
    let msg = cat[key];
    if (vars && typeof vars.count === "number") msg = cat[`${key}_${plural.select(vars.count)}`] ?? cat[`${key}_other`] ?? msg;
    if (msg === undefined) {
      return key;
    }
    return vars ? msg.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : msg;
  };
}
export type T = ReturnType<typeof createTranslator>;
