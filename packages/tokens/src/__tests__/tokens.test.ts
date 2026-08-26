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

  it('maps the light inset surface onto the dark elevated surface', () => {
    // Paper names the same role differently per theme; the generator aliases them so
    // components only ever reference `--color-inset`.
    expect(lightPalette['--color-inset']).toBe('#F0F0F0');
    expect(darkPalette['--color-inset']).toBe('#202020');
  });

  it('keeps a theme-invariant role at one value in both palettes', () => {
    // `--color-on-primary` has no dark counterpart in Paper: white reads on the accent
    // in both themes. The generator must still define it under dark.
    expect(lightPalette['--color-on-primary']).toBe('#FFFFFF');
    expect(darkPalette['--color-on-primary']).toBe(lightPalette['--color-on-primary']);
  });

  it('exposes the type scale, spacing and radii as theme-neutral tokens', () => {
    expect(scaleTokens).toMatchObject({
      fontSans: '--font-sans',
      fontMono: '--font-mono',
      textBase: '--text-base',
      radiusFull: '--radius-full',
    });
    expect(scaleValues['--font-sans']).toBe('Inter');
    expect(scaleValues['--font-mono']).toBe('JetBrains Mono');
    expect(scaleValues['--radius-full']).toBe('999px');
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
    expect(cssVar(colorTokens.colorPrimary)).toBe('var(--color-primary)');
    expect(cssVar(scaleTokens.textBase)).toBe('var(--text-base)');
  });

  it('resolves a role to the literal hex for each theme', () => {
    expect(resolveColor(colorTokens.colorBg, 'light')).toBe('#FCFCFC');
    expect(resolveColor(colorTokens.colorBg, 'dark')).toBe('#141414');
  });

  it('covers exactly the themes the design provides artboards for', () => {
    expect(THEMES).toEqual(['light', 'dark']);
  });
});

describe('text contrast', () => {
  /**
   * Measured floors for the pairings that carry real copy, recorded from the palette as
   * the design ships it rather than from an aspiration. The point is regression control:
   * a token edit that darkens a surface or lightens a label has to fail here.
   *
   * `aa` marks the pairings that clear WCAG AA for body text (4.5:1). The rest are
   * recorded as known shortfalls so they stay visible instead of being buried in a
   * loosened global threshold:
   *
   *   light  --color-text-muted on --color-bg        4.18  secondary label, just under AA
   *   light  --color-on-primary on --color-primary   4.02  white on the accent fill
   *   dark   --color-on-primary on --color-primary   2.89  weakest pairing in the palette
   *   light  --color-text-faint on --color-bg        2.32  placeholder only, never prose
   *   dark   --color-text-faint on --color-bg        3.46  placeholder only, never prose
   */
  const expectations: Array<{
    theme: (typeof THEMES)[number];
    foreground: string;
    background: string;
    floor: number;
    aa: boolean;
  }> = [
    { theme: 'light', foreground: '--color-text', background: '--color-bg', floor: 16.9, aa: true },
    { theme: 'light', foreground: '--color-text', background: '--color-panel', floor: 16.3, aa: true },
    { theme: 'light', foreground: '--color-text', background: '--color-inset', floor: 15.2, aa: true },
    { theme: 'light', foreground: '--color-text-muted', background: '--color-bg', floor: 4.1, aa: false },
    { theme: 'light', foreground: '--color-text-faint', background: '--color-bg', floor: 2.3, aa: false },
    { theme: 'light', foreground: '--color-on-primary', background: '--color-primary', floor: 4.0, aa: false },
    { theme: 'dark', foreground: '--color-text', background: '--color-bg', floor: 16.8, aa: true },
    { theme: 'dark', foreground: '--color-text', background: '--color-panel', floor: 16.1, aa: true },
    { theme: 'dark', foreground: '--color-text', background: '--color-inset', floor: 14.9, aa: true },
    { theme: 'dark', foreground: '--color-text-muted', background: '--color-bg', floor: 6.5, aa: true },
    { theme: 'dark', foreground: '--color-text-faint', background: '--color-bg', floor: 3.4, aa: false },
    { theme: 'dark', foreground: '--color-on-primary', background: '--color-primary', floor: 2.8, aa: false },
  ];

  for (const { theme, foreground, background, floor, aa } of expectations) {
    const palette = theme === 'dark' ? darkPalette : lightPalette;

    it(`${theme}: ${foreground} on ${background} holds at ${floor}:1`, () => {
      const ratio = contrastRatio(
        palette[foreground as keyof typeof palette],
        palette[background as keyof typeof palette],
      );
      expect(ratio).toBeGreaterThanOrEqual(floor);
      if (aa) expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('keeps primary body text at AAA on every surface it appears on', () => {
    for (const theme of THEMES) {
      const palette = theme === 'dark' ? darkPalette : lightPalette;
      for (const surface of ['--color-bg', '--color-panel', '--color-inset'] as const) {
        const ratio = contrastRatio(
          palette['--color-text' as keyof typeof palette],
          palette[surface as keyof typeof palette],
        );
        expect(ratio, `${theme}: --color-text on ${surface}`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('keeps each status colour distinguishable from its own tint', () => {
    // Badges paint the status colour on its tint, so the pair has to stay legible even
    // where it falls short of AA for prose.
    for (const theme of THEMES) {
      const palette = theme === 'dark' ? darkPalette : lightPalette;
      for (const status of ['success', 'warning', 'error', 'primary'] as const) {
        const ratio = contrastRatio(
          palette[`--color-${status}` as keyof typeof palette],
          palette[`--color-${status}-tint` as keyof typeof palette],
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
});
