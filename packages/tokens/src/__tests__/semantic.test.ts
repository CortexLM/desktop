import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { lightPalette, scaleValues } from '../tokens.generated.ts';
import { semanticAliases, semanticTokens, semanticValues } from '../semantic.ts';

const SRC = join(import.meta.dirname, '..');

const semanticCss = readFileSync(join(SRC, 'semantic.css'), 'utf8');
const themeCss = readFileSync(join(SRC, 'theme.css'), 'utf8');
const fontsCss = readFileSync(join(SRC, 'fonts.css'), 'utf8');

describe('semantic token layer', () => {
  it('declares every owned role in semantic.css', () => {
    for (const token of Object.values(semanticTokens)) {
      expect(semanticCss, `semantic.css missing ${token}`).toContain(`${token}:`);
    }
  });

  it('declares every legacy alias in semantic.css, with the mirrored target', () => {
    for (const [name, target] of Object.entries(semanticAliases)) {
      expect(semanticCss, `semantic.css alias ${name}`).toContain(`${name}: ${target};`);
    }
  });

  it('declares no CSS property that semantic.ts does not know about', () => {
    const declared = [...semanticCss.matchAll(/^\s+(--[a-z0-9-]+):/gm)].map((match) => match[1]!);
    const known = new Set<string>([
      ...Object.values(semanticTokens),
      ...Object.keys(semanticAliases),
    ]);
    for (const name of new Set(declared)) {
      expect(known.has(name), `${name} is in semantic.css but not semantic.ts`).toBe(true);
    }
  });

  it('agrees with semantic.css on every light value', () => {
    for (const [token, value] of Object.entries(semanticValues.light)) {
      expect(semanticCss, `semantic.css light ${token}`).toContain(`${token}: ${value};`);
    }
  });

  it('agrees with semantic.css on every dark override', () => {
    const darkBlock = semanticCss.slice(semanticCss.indexOf(":root[data-theme='dark']"));
    for (const [token, value] of Object.entries(semanticValues.dark)) {
      expect(darkBlock, `semantic.css dark ${token}`).toContain(`${token}: ${value};`);
    }
  });

  it('only overrides owned roles in the dark block', () => {
    // An alias overridden per theme would silently fork the bridge from the palette:
    // the C3 token it points at already flips with the theme.
    const darkBlock = semanticCss.slice(semanticCss.indexOf(":root[data-theme='dark']"));
    const declared = [...darkBlock.matchAll(/^\s+(--[a-z0-9-]+):/gm)].map((match) => match[1]!);
    for (const name of declared) {
      expect(name in semanticValues.dark, `${name} overridden in dark but not owned`).toBe(true);
    }
  });

  it('points every var() alias at a token the palette or scale actually defines', () => {
    const defined = new Set<string>([
      ...Object.keys(lightPalette),
      ...Object.keys(scaleValues),
      ...Object.values(semanticTokens),
    ]);
    for (const [name, target] of Object.entries(semanticAliases)) {
      const match = /^var\((--[a-z0-9-]+)\)$/.exec(target);
      if (!match) continue; // literal alias (px value)
      expect(defined.has(match[1]!), `${name} -> ${target} targets an undefined token`).toBe(true);
    }
  });
});

describe('theme.css entry point', () => {
  it('imports the token layers in dependency order, fonts first', () => {
    const order = ['fonts.css', 'tokens.generated.css', 'semantic.css', 'layout.css'].map((file) =>
      themeCss.indexOf(file),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('builds a serif stack for the Concept 03 display face', () => {
    expect(themeCss).toContain('--font-serif-stack');
    expect(themeCss).toContain("'Source Serif 4'");
  });

  it('matches the font smoothing Paper renders its canvas with', () => {
    // A pixel comparison is sensitive to glyph weight; these three declarations are what
    // Paper emits on every exported node.
    expect(themeCss).toContain('-webkit-font-smoothing: antialiased');
    expect(themeCss).toContain('-moz-osx-font-smoothing: grayscale');
    expect(themeCss).toContain('font-synthesis: none');
  });

  it('shows a focus ring for keyboard navigation only', () => {
    // The design draws no focus state, so the ring is scoped to :focus-visible to keep
    // pointer interaction pixel-identical without stranding keyboard users.
    expect(themeCss).toContain(':focus-visible');
    expect(themeCss).toMatch(/:focus\s*\{\s*outline: none;/);
  });

  it('honours prefers-reduced-motion', () => {
    expect(themeCss).toContain('prefers-reduced-motion: reduce');
  });
});

describe('bundled fonts', () => {
  it('ships Source Serif 4 as a variable face covering the display weights', () => {
    // The greeting is 600; conversation prose is 400. One variable file covers both.
    expect(fontsCss).toContain("font-family: 'Source Serif 4'");
    expect(fontsCss).toContain('font-weight: 400 600');
    expect(fontsCss).toContain('source-serif-4-latin.woff2');
  });

  it('blocks rather than swaps: the file is bundled, not fetched', () => {
    expect(fontsCss).toContain('font-display: block');
    expect(fontsCss).not.toContain('https://');
  });
});
