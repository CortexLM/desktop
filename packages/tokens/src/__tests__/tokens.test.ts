import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  colorTokens,
  cssVar,
  darkPalette,
  layout,
  layoutCssVariables,
  lightPalette,
  paperTokenContentHash,
  resolveColor,
  scaleTokens,
  scaleValues,
  THEMES,
  THEME_ATTRIBUTE,
} from '../index.ts';

const SRC = join(import.meta.dirname, '..');
const generatedCss = readFileSync(join(SRC, 'tokens.generated.css'), 'utf8');
const layoutCss = readFileSync(join(SRC, 'layout.css'), 'utf8');

/** `#RRGGBB` -> relative luminance per WCAG 2.1. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/**
 * Follows `var(--color-x)` alias values (`--color-success` is an alias of
 * `--color-green`) down to the literal hex a contrast check needs.
 */
function resolveHex(palette: Record<string, string>, name: string): string {
  let value = palette[name] ?? '';
  for (let hop = 0; hop < 4 && value.startsWith('var('); hop += 1) {
    const target = /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1];
    if (!target) break;
    value = palette[target] ?? '';
  }
  return value;
}

describe('generated Paper tokens', () => {
  it('carries the Paper token content hash so stale generations are detectable', () => {
    expect(paperTokenContentHash).toMatch(/^[0-9a-f]{8}$/);
    expect(generatedCss).toContain(paperTokenContentHash);
  });

  it('is marked generated so nobody hand-edits it', () => {
    expect(generatedCss).toContain('GENERATED FILE - DO NOT EDIT');
    expect(generatedCss).toContain('bun run paper:tokens');
  });

  it('defines every colour role in both themes', () => {
    const roles = Object.values(colorTokens);
    expect(roles.length).toBeGreaterThan(0);

    for (const role of roles) {
      expect(lightPalette, `light palette missing ${role}`).toHaveProperty(role);
      expect(darkPalette, `dark palette missing ${role}`).toHaveProperty(role);
    }
  });

  it('scopes the dark palette to the theme attribute the app toggles', () => {
    expect(generatedCss).toContain(`:root[${THEME_ATTRIBUTE}='dark']`);
    expect(generatedCss).toContain('color-scheme: light');
    expect(generatedCss).toContain('color-scheme: dark');
  });

  it('declares every light role in the :root block', () => {
    const rootBlock = generatedCss.slice(
      generatedCss.indexOf(':root {'),
      generatedCss.indexOf(`:root[${THEME_ATTRIBUTE}='dark']`),
    );
    for (const role of Object.values(colorTokens)) {
      expect(rootBlock, `:root missing ${role}`).toContain(`${role}:`);
    }
  });

  it('rewrites alias values into the collapsed namespace', () => {
    // Paper's dark aliases point at `--color-dark-green`; after the themes are
    // collapsed onto one property per role that name no longer exists, and an alias
    // left pointing at it would silently resolve to nothing.
    expect(generatedCss).not.toMatch(/var\(--color-dark-/);
    expect(darkPalette['--color-success']).toBe('var(--color-green)');
  });

  it('keeps a theme-invariant role at one value in both palettes', () => {
    // `--color-on-accent` has no dark counterpart in Paper: the warm white reads on
    // the copper accent in both themes. The generator must still define it under dark.
    expect(lightPalette['--color-on-accent']).toBe('#FFF9F2');
    expect(darkPalette['--color-on-accent']).toBe(lightPalette['--color-on-accent']);
  });

  it('exposes the type scale, spacing and radii as theme-neutral tokens', () => {
    expect(scaleTokens).toMatchObject({
      fontSans: '--font-sans',
      fontMono: '--font-mono',
      fontDisplay: '--font-display',
      textBody: '--text-body',
      radiusPill: '--radius-pill',
    });
    expect(scaleValues['--font-sans']).toBe('Inter');
    expect(scaleValues['--font-mono']).toBe('JetBrains Mono');
    expect(scaleValues['--font-display']).toBe('Source Serif 4');
    expect(scaleValues['--radius-pill']).toBe('999px');
  });

  it('sizes every font-size token in px, as the design specifies', () => {
    const fontSizes = Object.entries(scaleValues).filter(([name]) => name.startsWith('--text-'));
    expect(fontSizes.length).toBeGreaterThan(0);
    for (const [name, value] of fontSizes) {
      expect(value, `${name} must be px`).toMatch(/^\d+px$/);
    }
  });
});

describe('token accessors', () => {
  it('wraps a token name in var()', () => {
    expect(cssVar(colorTokens.colorGreen)).toBe('var(--color-green)');
    expect(cssVar(scaleTokens.textBody)).toBe('var(--text-body)');
  });

  it('resolves a role to the literal hex for each theme', () => {
    expect(resolveColor(colorTokens.colorBg, 'light')).toBe('#FAF8F4');
    expect(resolveColor(colorTokens.colorBg, 'dark')).toBe('#211F1C');
  });

  it('covers exactly the themes the design provides artboards for', () => {
    expect(THEMES).toEqual(['light', 'dark']);
  });
});

describe('text contrast', () => {
  /**
   * Measured floors for the pairings that carry real copy, recorded from the Concept 03
   * palette as it ships rather than from an aspiration. The point is regression control:
   * a token edit that darkens a surface or lightens a label has to fail here.
   *
   * `aa` marks the pairings that clear WCAG AA for body text (4.5:1). The recorded
   * shortfalls stay visible instead of being buried in a loosened global threshold:
   *
   *   light  --color-on-accent on --color-accent   4.25  send button / CTA label
   *   light  --color-warning on its tint           3.98  badge text on badge fill
   *   dark   --color-on-accent on --color-accent   2.69  icon-sized copper accent only
   */
  const expectations: Array<{
    theme: (typeof THEMES)[number];
    foreground: string;
    background: string;
    floor: number;
    aa: boolean;
  }> = [
    { theme: 'light', foreground: '--color-text', background: '--color-bg', floor: 15.8, aa: true },
    { theme: 'light', foreground: '--color-text', background: '--color-bg-sidebar', floor: 14.7, aa: true },
    { theme: 'light', foreground: '--color-text', background: '--color-surface', floor: 16.8, aa: true },
    { theme: 'light', foreground: '--color-text-muted', background: '--color-bg', floor: 5.0, aa: true },
    { theme: 'light', foreground: '--color-green', background: '--color-bg', floor: 9.4, aa: true },
    { theme: 'light', foreground: '--color-on-green', background: '--color-green', floor: 10.0, aa: true },
    { theme: 'light', foreground: '--color-green-on-tint', background: '--color-green-tint-16', floor: 7.2, aa: true },
    { theme: 'light', foreground: '--color-on-accent', background: '--color-accent', floor: 4.2, aa: false },
    { theme: 'dark', foreground: '--color-text', background: '--color-bg', floor: 13.6, aa: true },
    { theme: 'dark', foreground: '--color-text', background: '--color-bg-sidebar', floor: 14.7, aa: true },
    { theme: 'dark', foreground: '--color-text', background: '--color-surface', floor: 12.3, aa: true },
    { theme: 'dark', foreground: '--color-text-muted', background: '--color-bg', floor: 5.5, aa: true },
    { theme: 'dark', foreground: '--color-green', background: '--color-bg', floor: 4.6, aa: true },
    { theme: 'dark', foreground: '--color-on-green', background: '--color-green', floor: 4.6, aa: true },
    { theme: 'dark', foreground: '--color-green-on-tint', background: '--color-green-tint-16', floor: 4.6, aa: true },
    { theme: 'dark', foreground: '--color-on-accent', background: '--color-accent', floor: 2.6, aa: false },
  ];

  for (const { theme, foreground, background, floor, aa } of expectations) {
    const palette = theme === 'dark' ? darkPalette : lightPalette;

    it(`${theme}: ${foreground} on ${background} holds at ${floor}:1`, () => {
      const ratio = contrastRatio(resolveHex(palette, foreground), resolveHex(palette, background));
      expect(ratio).toBeGreaterThanOrEqual(floor);
      if (aa) expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('keeps primary body text at AAA on every surface it appears on', () => {
    for (const theme of THEMES) {
      const palette = theme === 'dark' ? darkPalette : lightPalette;
      for (const surface of ['--color-bg', '--color-bg-sidebar', '--color-surface'] as const) {
        const ratio = contrastRatio(resolveHex(palette, '--color-text'), resolveHex(palette, surface));
        expect(ratio, `${theme}: --color-text on ${surface}`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('keeps each status colour distinguishable from its own tint', () => {
    // Badges paint the status colour on its tint, so the pair has to stay legible even
    // where it falls short of AA for prose.
    for (const theme of THEMES) {
      const palette = theme === 'dark' ? darkPalette : lightPalette;
      for (const status of ['success', 'warning', 'error'] as const) {
        const ratio = contrastRatio(
          resolveHex(palette, `--color-${status}`),
          resolveHex(palette, `--color-${status}-tint`),
        );
        expect(ratio, `${theme}: --color-${status} on its tint`).toBeGreaterThanOrEqual(2.2);
      }
    }
  });
});

describe('layout dimensions', () => {
  it('splits the 1440px artboard into the sidebar and main panes exactly', () => {
    expect(layout.sidebar.width + layout.main.width).toBe(layout.viewport);
  });

  it('splits the session detail body into the timeline and workbench panes exactly', () => {
    expect(layout.sessionDetail.timeline + layout.sessionDetail.workbench).toBe(layout.main.width);
  });

  it('keeps layout.css in sync with layout.ts', () => {
    for (const [name, value] of Object.entries(layoutCssVariables)) {
      expect(layoutCss, `layout.css missing ${name}`).toContain(`${name}: ${value};`);
    }
  });

  it('declares no --layout-* property in CSS that layout.ts does not know about', () => {
    const declared = [...layoutCss.matchAll(/(--layout-[a-z-]+):/g)].map((match) => match[1]!);
    const known = new Set(Object.keys(layoutCssVariables));
    for (const name of declared) {
      expect(known.has(name), `${name} is in layout.css but not layoutCssVariables`).toBe(true);
    }
  });

  it('keeps the composer content width inside its shell', () => {
    expect(layout.composer.content).toBeLessThan(layout.composer.width);
  });

  it('keeps the sidebar content width inside the sidebar', () => {
    expect(layout.sidebar.content).toBeLessThan(layout.sidebar.width);
  });

  it('keeps the Bot computer rail inside the main pane', () => {
    expect(layout.bot.rail).toBeLessThan(layout.main.width);
  });
});
