import * as React from "react";
import { createTranslator, resolveLocale, type Locale, type T } from "@cortex/i18n";
import { viteCatalogs } from "@cortex/i18n/vite";

const KEY = "cortex.locale";
const initial = (): Locale => resolveLocale([localStorage.getItem(KEY) ?? "", ...navigator.languages]);
const I18nCtx = React.createContext<{ t: T; locale: Locale; setLocale: (l: Locale) => void }>({ t: createTranslator("en", viteCatalogs), locale: "en", setLocale: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, set] = React.useState<Locale>(initial);
  const t = React.useMemo(() => createTranslator(locale, viteCatalogs), [locale]);
  React.useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const setLocale = (l: Locale) => { localStorage.setItem(KEY, l); set(l); };
  return <I18nCtx.Provider value={{ t, locale, setLocale }}>{children}</I18nCtx.Provider>;
}
export const useI18n = () => React.useContext(I18nCtx);
export const useT = () => React.useContext(I18nCtx).t;
