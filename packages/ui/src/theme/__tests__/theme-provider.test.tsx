import { render } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_ATTRIBUTE, ThemeProvider, useTheme, type ThemePreference } from '../theme-provider.tsx';

/**
 * Drives `prefers-color-scheme` so the `system` preference can be exercised. jsdom has
 * matchMedia but always reports no match, which would make every system test look light.
 */
function stubMatchMedia(dark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const query = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  );

  return {
    /** Simulates the OS theme changing while the app is open. */
    change(nextDark: boolean) {
      query.matches = nextDark;
      for (const listener of listeners) {
        listener({ matches: nextDark } as MediaQueryListEvent);
      }
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

interface RenderOptions {
  initial?: ThemePreference;
  storage?: { read: () => ThemePreference | null; write: (preference: ThemePreference) => void };
}

/** Reads the context out so assertions can drive it directly. */
function renderWithTheme(props: RenderOptions) {
  let api!: ReturnType<typeof useTheme>;

  const Probe = () => {
    api = useTheme();
    return <span data-testid="theme">{api.theme()}</span>;
  };

  const result = render(() => (
    <ThemeProvider initial={props.initial} storage={props.storage}>
      <Probe />
    </ThemeProvider>
  ));

  return { ...result, api: () => api };
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    vi.unstubAllGlobals();
  });

  it('writes the theme onto the element the dark palette is scoped to', () => {
    // The generated CSS scopes dark to :root[data-theme='dark'], so the attribute has to
    // land on <html> or the palette never applies.
    stubMatchMedia(false);
    renderWithTheme({ initial: 'dark' });

    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('follows the OS when the preference is system', () => {
    stubMatchMedia(true);
    const { getByTestId } = renderWithTheme({ initial: 'system' });

    expect(getByTestId('theme')).toHaveTextContent('dark');
  });

  it('defaults to light when the platform cannot report a preference', () => {
    // Not every host has matchMedia; guessing dark would flash a dark shell on a light OS.
    vi.stubGlobal('matchMedia', undefined);
    const { getByTestId } = renderWithTheme({ initial: 'system' });

    expect(getByTestId('theme')).toHaveTextContent('light');
  });

  it('tracks the OS changing while the app is open', () => {
    // A `system` preference that froze at launch would strand the user in the wrong theme
    // until restart.
    const media = stubMatchMedia(false);
    const { getByTestId } = renderWithTheme({ initial: 'system' });

    expect(getByTestId('theme')).toHaveTextContent('light');
    media.change(true);
    expect(getByTestId('theme')).toHaveTextContent('dark');
  });

  it('ignores the OS once the user picks a theme', () => {
    const media = stubMatchMedia(false);
    const { getByTestId, api } = renderWithTheme({ initial: 'system' });

    api().setPreference('light');
    media.change(true);

    expect(getByTestId('theme')).toHaveTextContent('light');
  });

  it('resolves system before toggling, so the first press visibly flips', () => {
    // Toggling from `system` while the OS is dark has to go to light. Flipping the
    // preference string instead would land on dark again and look like nothing happened.
    stubMatchMedia(true);
    const { getByTestId, api } = renderWithTheme({ initial: 'system' });

    expect(getByTestId('theme')).toHaveTextContent('dark');
    api().toggle();
    expect(getByTestId('theme')).toHaveTextContent('light');
  });

  it('toggles back and forth', () => {
    stubMatchMedia(false);
    const { getByTestId, api } = renderWithTheme({ initial: 'light' });

    api().toggle();
    expect(getByTestId('theme')).toHaveTextContent('dark');
    api().toggle();
    expect(getByTestId('theme')).toHaveTextContent('light');
  });

  it('reads the stored preference in preference to the initial one', () => {
    stubMatchMedia(false);
    const storage = { read: () => 'dark' as ThemePreference, write: vi.fn() };
    const { getByTestId } = renderWithTheme({ initial: 'light', storage });

    expect(getByTestId('theme')).toHaveTextContent('dark');
  });

  it('persists a change so it survives a relaunch', () => {
    stubMatchMedia(false);
    const write = vi.fn();
    const { api } = renderWithTheme({ initial: 'light', storage: { read: () => null, write } });

    api().setPreference('dark');
    expect(write).toHaveBeenCalledWith('dark');
  });

  it('keeps the preference and the resolved theme distinct', () => {
    // The settings screen shows what the user chose; everything else needs the resolved
    // value. Collapsing them would make `system` unrepresentable in the UI.
    stubMatchMedia(true);
    const { api } = renderWithTheme({ initial: 'system' });

    expect(api().preference()).toBe('system');
    expect(api().theme()).toBe('dark');
  });

  it('drops its media listener on unmount', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderWithTheme({ initial: 'system' });

    expect(media.listenerCount).toBe(1);
    unmount();
    expect(media.listenerCount).toBe(0);
  });

  it('fails loudly when used outside a provider', () => {
    // A silent default would let a component render unthemed and look like a CSS bug.
    const Orphan = () => {
      useTheme();
      return null;
    };

    expect(() => render(() => <Orphan />)).toThrow(/must be used inside a ThemeProvider/);
  });
});
