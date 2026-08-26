import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { isServer } from 'solid-js/web';

export type Theme = 'light' | 'dark';
/** What the user chose. `system` defers to the OS, which is not itself a theme. */
export type ThemePreference = Theme | 'system';

const THEME_ATTRIBUTE = 'data-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export interface ThemeContextValue {
  /** The theme actually being rendered, with `system` already resolved. */
  theme: Accessor<Theme>;
  /** What the user chose, which may be `system`. */
  preference: Accessor<ThemePreference>;
  setPreference: (preference: ThemePreference) => void;
  /** Cycles light -> dark -> light. Used by the sun toggle in the sidebar user row. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>();

export interface ThemeProviderProps {
  children: JSX.Element;
  /** Starting preference. Defaults to following the OS. */
  initial?: ThemePreference;
  /**
   * Persists the preference across launches. Omitted in tests and in Storybook, where a
   * leaked preference would make runs depend on each other.
   */
  storage?: {
    read: () => ThemePreference | null;
    write: (preference: ThemePreference) => void;
  };
  /**
   * Element the theme attribute is written to. Defaults to `<html>`, which is what the
   * generated CSS scopes the dark palette to (`:root[data-theme='dark']`).
   */
  target?: () => HTMLElement | null;
}

function readSystemTheme(): Theme {
  // Electron's renderer always has matchMedia, but the provider also renders under SSR in
  // tests, where it does not.
  if (isServer || typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function ThemeProvider(props: ThemeProviderProps): JSX.Element {
  const [preference, setPreferenceSignal] = createSignal<ThemePreference>(
    props.storage?.read() ?? props.initial ?? 'system',
  );
  const [systemTheme, setSystemTheme] = createSignal<Theme>(readSystemTheme());

  // The OS theme can change while the app is open, and a `system` preference has to follow
  // it rather than freeze at whatever it was on launch.
  createEffect(() => {
    if (isServer || typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    onCleanup(() => query.removeEventListener('change', onChange));
  });

  const theme = createMemo<Theme>(() => {
    const chosen = preference();
    return chosen === 'system' ? systemTheme() : chosen;
  });

  const setPreference = (next: ThemePreference) => {
    setPreferenceSignal(next);
    props.storage?.write(next);
  };

  createEffect(() => {
    const element = props.target?.() ?? (isServer ? null : document.documentElement);
    if (!element) return;
    element.setAttribute(THEME_ATTRIBUTE, theme());
  });

  const value: ThemeContextValue = {
    theme,
    preference,
    setPreference,
    // Toggling resolves `system` first, so the first press flips away from whatever the OS
    // is showing rather than appearing to do nothing.
    toggle: () => setPreference(theme() === 'dark' ? 'light' : 'dark'),
  };

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return context;
}

export { THEME_ATTRIBUTE };
