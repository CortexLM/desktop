import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app.tsx';

/**
 * Dark mode reaches every product, and the product stylesheets go through the tokens.
 *
 * Code and Bot rendered a light canvas in dark mode because their surfaces were
 * written as literals from the light palette rather than as `var(--color-*)`:
 * the mascot desktop was `#1a1815`/`#faf8f4`, an "ink" mascot swatch was
 * `#211f1c` on a `#2a2724` row, and the Shell tab's terminal fell back to
 * `#ffffff`. None of those could follow `data-theme` because none of them read
 * it.
 */

const APP_SRC = join(import.meta.dirname, '..');

/**
 * Colour literals that are deliberately fixed in both themes.
 *
 * Each is a mark rather than a surface: white on the red close button, the modal
 * scrim, and the brand lockup, which is cream on Cortex green wherever it
 * appears. Anything else has to be a token, which is what makes this an
 * allowlist and not a skip list — a new literal on any screen fails until
 * someone writes down why it is not themed.
 */
const FIXED_BRAND_COLOURS = [
  'shell/title-bar.css:color:#ffffff',
  'overlays/overlay.css:background:rgb(0 0 0 / 24%)',
];

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Every `background` / `color` declaration that is not a token or a keyword. */
function untokenisedColours(file: string): string[] {
  const relative = file.slice(APP_SRC.length + 1);
  const declarations = readFileSync(file, 'utf8').matchAll(
    /(?<property>background|background-color|color)\s*:\s*(?<value>[^;{}]+);/g,
  );

  const found: string[] = [];
  for (const declaration of declarations) {
    const value = declaration.groups!.value.trim();
    // `color-mix(in srgb, var(--color-text) 28%, transparent)` is a token with
    // an alpha applied, so it still follows the theme.
    if (value.includes('var(--')) continue;
    if (/^(none|inherit|transparent|currentcolor|unset|initial|revert)$/i.test(value)) continue;
    found.push(`${relative}:${declaration.groups!.property}:${value}`);
  }
  return found;
}

describe('product stylesheets are token-driven', () => {
  it('leaves no hardcoded colour outside the fixed brand marks', () => {
    const found = stylesheets(APP_SRC).flatMap(untokenisedColours).sort();
    expect(found).toEqual([...FIXED_BRAND_COLOURS].sort());
  });

  it('themes the mascot desktop and keeps pebble identity on CSS variables', () => {
    const css = readFileSync(join(APP_SRC, 'screens/chat/product-pages.css'), 'utf8');
    const mark = readFileSync(join(APP_SRC, 'screens/bot/mascot-mark.css'), 'utf8');
    const rule = (selector: string) =>
      css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)));

    expect(rule('.cx-vnc {')).toContain('background: var(--color-surface)');
    expect(rule('.cx-vnc {')).toContain('color: var(--color-text-muted)');
    expect(css).not.toContain('cx-mascot-swatch');
    expect(mark).toContain('fill: var(--mascot-body)');
    expect(mark).toContain("[data-theme='dark']");
    expect(mark).toContain('--mascot-look-dark');
    expect(mark).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('the theme attribute covers Code and Bot', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    globalThis.localStorage?.clear();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  // A route per product surface the bug report named. The Chat root is included
  // as the control: it already followed the theme, so a failure there would mean
  // the harness is wrong rather than the route.
  const routes = [
    ['Chat', '/'],
    ['Code home', '/code'],
    ['Code sessions', '/code/sessions'],
    ['Code runtimes', '/code/runtimes'],
    ['Code tickets', '/code/tickets'],
    ['Bot home', '/bot'],
    ['Bot create', '/bot/new'],
  ] as const;

  for (const [name, path] of routes) {
    it(`renders ${name} under the dark palette`, async () => {
      globalThis.localStorage?.setItem('cortex.theme', 'dark');

      const { container } = render(() => <App initialPath={path} />);

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      // The screen has to be *inside* the element the palette is scoped to.
      // `:root[data-theme='dark']` styles nothing in a portal or an iframe, which
      // is the shape of the bug where one product stays light while the shell
      // switches.
      const screenRoot = container.querySelector('.cx-root');
      expect(screenRoot).not.toBeNull();
      expect(screenRoot!.closest('[data-theme]')).toBe(document.documentElement);
    });
  }

  it('follows a switch back to light without reloading', async () => {
    globalThis.localStorage?.setItem('cortex.theme', 'dark');
    render(() => <App initialPath="/bot" />);

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    toggle.click();

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });
});
