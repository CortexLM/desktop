// Preview mode: the design gallery renders every screen state with fixture content.
// Fixtures are translatable catalogs: packages/i18n/locales/<locale>/fixtures/<area>.json. They are only loaded in preview
// (gallery iframes, `?preview` routes, Help → Design gallery). Live routes never read them;
// in preview the title bar shows the state picker.
import * as React from "react";
import { useI18n } from "./i18n";
import { DEFAULT_MASCOT, type MascotConfig, type State } from "./mascot/Mascot";

export const isPreview = () => /[?&](preview|shot)\b/.test(location.hash);

export type PreviewBotLive = { on: boolean; state: State; doing: string };
type PreviewBot = {
  cfg: MascotConfig;
  save: (cfg: MascotConfig) => void;
  live: PreviewBotLive;
  setLive: (patch: Partial<PreviewBotLive>) => void;
  draft: MascotConfig | null;
  setDraft: React.Dispatch<React.SetStateAction<MascotConfig | null>>;
};
const PreviewBotCtx = React.createContext<PreviewBot | null>(null);

/** Null outside preview, even while a preview tree is being unmounted. */
export function usePreviewBot() {
  const bot = React.useContext(PreviewBotCtx);
  return isPreview() ? bot : null;
}

function PreviewBotProvider({ locale, children }: { locale: string | null; children: React.ReactNode }) {
  const initial = React.useMemo<Pick<PreviewBot, "cfg" | "live" | "draft"> | null>(() => {
    if (!locale) return null;
    const fx = cache.get(`bots:${locale}`) as { main: { name: string; doing: string } };
    return { cfg: { ...DEFAULT_MASCOT, name: fx.main.name }, live: { on: true, state: "working", doing: fx.main.doing }, draft: null };
  }, [locale]);
  const [state, setState] = React.useState({ initial, data: initial });
  // Reset before descendants render, without replacing the provider or remounting the shell.
  if (state.initial !== initial) setState({ initial, data: initial });
  const save = React.useCallback((cfg: MascotConfig) => setState((old) => old.initial === initial && old.data ? { ...old, data: { ...old.data, cfg, draft: null } } : old), [initial]);
  const setLive = React.useCallback((patch: Partial<PreviewBotLive>) => setState((old) => old.initial === initial && old.data ? { ...old, data: { ...old.data, live: { ...old.data.live, ...patch } } } : old), [initial]);
  const setDraft = React.useCallback<PreviewBot["setDraft"]>((draft) => setState((old) => old.initial === initial && old.data ? { ...old, data: { ...old.data, draft: typeof draft === "function" ? draft(old.data.draft) : draft } } : old), [initial]);
  // ponytail: one preview visit/locale; add preview-only persistence if reload retention is required.
  return <PreviewBotCtx.Provider value={state.data ? { ...state.data, save, setLive, setDraft } : null}>{children}</PreviewBotCtx.Provider>;
}

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
  const preview = isPreview();
  const [loaded, setLoaded] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!preview || loaded === locale) return;
    const areas = [...new Set(Object.keys(loaders).map((k) => k.split("/").pop()!.slice(0, -5)))];
    Promise.all(areas.map((a) => load(a, locale))).then(() => setLoaded(locale));
  }, [preview, locale, loaded]);
  return <PreviewBotProvider locale={preview && loaded === locale ? locale : null}>{!preview || loaded === locale ? children : null}</PreviewBotProvider>;
}

/** Synchronous read of an area's fixtures (call only inside preview; PreviewGate preloads). */
export function useFixtures<T>(area: string): T {
  const { locale } = useI18n();
  return (cache.get(`${area}:${locale}`) ?? cache.get(`${area}:en`) ?? {}) as T;
}
