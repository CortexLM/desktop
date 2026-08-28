/**
 * Turns the Paper token set into the artefacts `@cortex-ide/tokens` ships.
 *
 * Paper stores both themes in one flat namespace: a light token `--color-panel` and its
 * dark counterpart `--color-dark-panel`. The app wants one theme-neutral custom property
 * whose value changes with the theme, so this collapses the pairs into a single role and
 * emits the dark values under a `[data-theme='dark']` selector.
 */

import type { PaperToken } from './types.ts';

const DARK_PREFIX = '--color-dark-';
const COLOR_PREFIX = '--color-';

/**
 * Roles whose light and dark tokens were named differently in Paper. Light calls the
 * hover/chip surface `inset`; dark calls the same role `elevated`.
 */
const DARK_ROLE_ALIASES: Record<string, string> = {
  inset: 'elevated',
};

export interface GeneratedTokens {
  css: string;
  ts: string;
  /** Theme-neutral role name -> light value. */
  light: Record<string, string>;
  /** Theme-neutral role name -> dark value. */
  dark: Record<string, string>;
  /** Tokens that are identical in both themes (type scale, spacing, radii, fonts). */
  neutral: Record<string, string>;
  contentHash: string;
}

interface Grouped {
  lightColors: Map<string, PaperToken>;
  darkColors: Map<string, PaperToken>;
  neutral: PaperToken[];
}

function group(tokens: PaperToken[]): Grouped {
  const lightColors = new Map<string, PaperToken>();
  const darkColors = new Map<string, PaperToken>();
  const neutral: PaperToken[] = [];

  for (const token of tokens) {
    if (token.type !== 'color') {
      neutral.push(token);
      continue;
    }
    if (token.name.startsWith(DARK_PREFIX)) {
      darkColors.set(token.name.slice(DARK_PREFIX.length), token);
    } else if (token.name.startsWith(COLOR_PREFIX)) {
      lightColors.set(token.name.slice(COLOR_PREFIX.length), token);
    } else {
      neutral.push(token);
    }
  }

  return { lightColors, darkColors, neutral };
}

function resolveDark(role: string, grouped: Grouped): PaperToken | undefined {
  const direct = grouped.darkColors.get(role);
  if (direct) return direct;
  const alias = DARK_ROLE_ALIASES[role];
  return alias ? grouped.darkColors.get(alias) : undefined;
}

function tsIdentifier(name: string): string {
  return name.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Rewrites alias values for the collapsed namespace.
 *
 * Paper's dark aliases point at dark tokens by their Paper names —
 * `--color-success` (dark) is `var(--color-dark-green)`. After the themes are
 * collapsed onto one property per role, `--color-dark-green` no longer exists;
 * the alias must point at the role (`--color-green`), whose value the
 * `[data-theme='dark']` block already flips.
 */
function collapseAliases(value: string): string {
  return value.replaceAll('var(--color-dark-', 'var(--color-');
}

function declarations(entries: Array<[string, string, string | undefined]>, indent: string): string {
  return entries
    .map(([name, value, description]) =>
      description ? `${indent}${name}: ${value}; /* ${description} */` : `${indent}${name}: ${value};`,
    )
    .join('\n');
}

export function generateTokens(tokens: PaperToken[], contentHash: string): GeneratedTokens {
  const grouped = group(tokens);

  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  const neutral: Record<string, string> = {};

  const lightDeclarations: Array<[string, string, string | undefined]> = [];
  const darkDeclarations: Array<[string, string, string | undefined]> = [];
  const neutralDeclarations: Array<[string, string, string | undefined]> = [];
  const unpairedDarkRoles: string[] = [];

  for (const [role, token] of grouped.lightColors) {
    const property = `${COLOR_PREFIX}${role}`;
    const lightValue = collapseAliases(token.value);
    light[property] = lightValue;
    lightDeclarations.push([property, lightValue, token.description]);

    const darkToken = resolveDark(role, grouped);
    // A role with no dark counterpart is theme-invariant by design (`--color-on-primary`
    // is white on both). Emitting the light value keeps the property defined either way.
    const darkValue = collapseAliases(darkToken?.value ?? token.value);
    dark[property] = darkValue;
    if (darkToken) darkDeclarations.push([property, darkValue, darkToken.description]);
  }

  const claimedDarkRoles = new Set<string>();
  for (const role of grouped.lightColors.keys()) {
    claimedDarkRoles.add(role);
    const alias = DARK_ROLE_ALIASES[role];
    if (alias) claimedDarkRoles.add(alias);
  }
  for (const role of grouped.darkColors.keys()) {
    if (!claimedDarkRoles.has(role)) unpairedDarkRoles.push(role);
  }

  for (const token of grouped.neutral) {
    neutral[token.name] = token.value;
    neutralDeclarations.push([token.name, token.value, token.description]);
  }

  const banner = [
    '/*',
    ' * GENERATED FILE - DO NOT EDIT.',
    ' *',
    ' * Source: Paper file "Cortex FF1 v1" design tokens (Concept 03).',
    ` * Paper token content hash: ${contentHash}`,
    ' * Regenerate with: bun run paper:tokens',
    ' */',
  ].join('\n');

  const warning =
    unpairedDarkRoles.length > 0
      ? `\n/* Dark-only roles with no light counterpart: ${unpairedDarkRoles.join(', ')} */\n`
      : '';

  const css = `${banner}
${warning}
:root {
  color-scheme: light;

${declarations(neutralDeclarations, '  ')}

${declarations(lightDeclarations, '  ')}
}

:root[data-theme='dark'] {
  color-scheme: dark;

${declarations(darkDeclarations, '  ')}
}
`;

  const colorRoles = Object.keys(light).sort();
  const neutralNames = Object.keys(neutral).sort();

  const ts = `${banner}

export const paperTokenContentHash = ${JSON.stringify(contentHash)} as const;

/** Theme-neutral custom properties whose value flips with \`[data-theme]\`. */
export const colorTokens = ${JSON.stringify(
    Object.fromEntries(colorRoles.map((name) => [tsIdentifier(name), name])),
    null,
    2,
  )} as const;

/** Custom properties that are identical in both themes. */
export const scaleTokens = ${JSON.stringify(
    Object.fromEntries(neutralNames.map((name) => [tsIdentifier(name), name])),
    null,
    2,
  )} as const;

export const lightPalette = ${JSON.stringify(light, null, 2)} as const;

export const darkPalette = ${JSON.stringify(dark, null, 2)} as const;

export const scaleValues = ${JSON.stringify(neutral, null, 2)} as const;

export type ColorToken = (typeof colorTokens)[keyof typeof colorTokens];
export type ScaleToken = (typeof scaleTokens)[keyof typeof scaleTokens];
export type Theme = 'light' | 'dark';

/** \`var(--color-primary)\` for a checked token name. */
export function cssVar(token: ColorToken | ScaleToken): string {
  return \`var(\${token})\`;
}

/** Resolve a colour token to its literal hex for a theme, for canvas and native surfaces. */
export function resolveColor(token: ColorToken, theme: Theme): string {
  const palette = theme === 'dark' ? darkPalette : lightPalette;
  return palette[token as keyof typeof palette];
}
`;

  return { css, ts, light, dark, neutral, contentHash };
}
