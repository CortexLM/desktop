import { afterEach, describe, expect, it } from 'vitest';

import { darkPalette, lightPalette } from '@cortex-ide/tokens';

import { followTheme, themeFromTokens } from '../shell-view.tsx';

/**
 * The Shell tab's terminal owns its palette, so it is the one Code surface that
 * can sit out a theme change — and it did, twice over. Its fallbacks were
 * `#ffffff` / `#1a1a1a` whatever the theme, and it read them once, when the
 * emulator was constructed.
 *
 * jsdom loads no stylesheet, so every `--color-*` lookup here comes back empty
 * and the fallback path is the one under test. That is the same path a real
 * renderer takes on the frame before the token sheet has applied.
 */

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('themeFromTokens', () => {
  it('falls back to the dark palette under a dark document, never to white', () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    const palette = themeFromTokens();

    expect(palette.background).toBe(darkPalette['--color-surface']);
    expect(palette.foreground).toBe(darkPalette['--color-text']);
    expect(palette.cursor).toBe(darkPalette['--color-green']);
    expect(palette.background.toLowerCase()).not.toBe('#ffffff');
  });

  it('falls back to the light palette under a light document', () => {
    document.documentElement.setAttribute('data-theme', 'light');

    expect(themeFromTokens().background).toBe(lightPalette['--color-surface']);
  });

  it('treats a document with no theme attribute as light', () => {
    expect(themeFromTokens().foreground).toBe(lightPalette['--color-text']);
  });
});

describe('followTheme', () => {
  it('re-themes a live terminal when the document switches to dark', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const terminal = { options: { theme: themeFromTokens() } };
    const stop = followTheme(terminal);

    document.documentElement.setAttribute('data-theme', 'dark');
    // MutationObserver callbacks are delivered as microtasks.
    await Promise.resolve();

    expect(terminal.options.theme?.background).toBe(darkPalette['--color-surface']);
    stop();
  });

  it('stops re-theming once the tab is torn down', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const terminal = { options: { theme: themeFromTokens() } };

    followTheme(terminal)();
    document.documentElement.setAttribute('data-theme', 'dark');
    await Promise.resolve();

    expect(terminal.options.theme?.background).toBe(lightPalette['--color-surface']);
  });
});
