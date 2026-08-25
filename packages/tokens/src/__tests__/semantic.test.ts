import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { darkPalette } from '../tokens.generated.ts';
import { semanticProvenance, semanticTokens, semanticValues } from '../semantic.ts';

const SRC = join(import.meta.dirname, '..');
const JSX_DIR = join(SRC, '../../../design/paper/jsx');

const semanticCss = readFileSync(join(SRC, 'semantic.css'), 'utf8');
const themeCss = readFileSync(join(SRC, 'theme.css'), 'utf8');

function readJsx(name: string): string {
  return readFileSync(join(JSX_DIR, `${name}.jsx`), 'utf8');
}

describe('semantic token layer', () => {
  it('declares every role in semantic.css', () => {
    for (const token of Object.values(semanticTokens)) {
      expect(semanticCss, `semantic.css missing ${token}`).toContain(`${token}:`);
    }
  });

  it('declares no CSS property that semantic.ts does not know about', () => {
    const declared = [...semanticCss.matchAll(/^\s+(--[a-z-]+):/gm)].map((match) => match[1]!);
    const known = new Set<string>(Object.values(semanticTokens));
    for (const name of new Set(declared)) {
      expect(known.has(name), `${name} is in semantic.css but not semanticTokens`).toBe(true);
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

  it('overrides exactly the roles marked themed, and no others', () => {
    const themed = Object.entries(semanticProvenance)
      .filter(([, meta]) => meta.themed)
      .map(([token]) => token)
      .sort();
    expect(Object.keys(semanticValues.dark).sort()).toEqual(themed);
  });

  it('records provenance for every role', () => {
    for (const token of Object.values(semanticTokens)) {
      const meta = semanticProvenance[token];
      expect(meta, `no provenance for ${token}`).toBeDefined();
      expect(meta.paperNodes.length).toBeGreaterThan(0);
      expect(meta.jsx.length).toBeGreaterThan(0);
    }
  });
});

describe('semantic values match the archived Paper JSX', () => {
  // The point of the archive is that these pairings stay checkable without a live Paper
  // connection. If a design change lands, `bun run paper:jsx` re-archives and this fails.
  const literals: Array<{ token: keyof typeof semanticValues.light; jsx: string; literal: string }> = [
    { token: '--color-primary-hover', jsx: 'button-primary', literal: '#2264DD' },
    { token: '--color-error-hover', jsx: 'button-destructive', literal: '#B8433C' },
    { token: '--color-hover', jsx: 'nav-item', literal: '#F3F3F3' },
    { token: '--color-surface-raised', jsx: 'composer', literal: '#FFFFFF' },
    { token: '--color-toast-bg', jsx: 'tabs-toast-menu', literal: '#1F1F1F' },
    { token: '--color-toast-text', jsx: 'tabs-toast-menu', literal: '#F5F5F5' },
    { token: '--color-toast-accent', jsx: 'tabs-toast-menu', literal: '#3CC98A' },
  ];

  for (const { token, jsx, literal } of literals) {
    it(`${token} is the ${literal} literal used in ${jsx}`, () => {
      expect(readJsx(jsx)).toContain(literal);
      expect(semanticValues.light[token].toLowerCase()).toBe(literal.toLowerCase());
    });
  }

  it('ties the dark raised surface to the panel value the dark kit uses', () => {
    // The dark composer paints --color-dark-panel where light paints #FFFFFF, so the
    // raised role must resolve to the same value the dark palette gives panel.
    expect(semanticValues.dark['--color-surface-raised'].toLowerCase()).toBe(
      darkPalette['--color-panel'].toLowerCase(),
    );
  });

  it('ties the dark hover surface to the elevated value the dark kit uses', () => {
    // Dark collapses hover onto the elevated surface, which the generator exposes as
    // --color-inset. Light keeps them distinct.
    expect(semanticValues.dark['--color-hover'].toLowerCase()).toBe(
      darkPalette['--color-inset'].toLowerCase(),
    );
  });

  it('records disabled fills as an opacity drop, as the button kit does', () => {
    expect(readJsx('button-primary')).toContain("opacity: '0.4'");
    expect(semanticValues.light['--opacity-disabled']).toBe('0.4');
  });
});

describe('theme.css entry point', () => {
  it('imports the three token layers in dependency order', () => {
    const order = ['tokens.generated.css', 'semantic.css', 'layout.css'].map((file) =>
      themeCss.indexOf(file),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
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
