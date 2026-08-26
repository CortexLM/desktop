/**
 * Typed mirror of semantic.css.
 *
 * Two groups, mirroring the stylesheet:
 *
 *   - `semanticValues`: roles OWNED by the semantic layer — literals Concept 03
 *     expresses inside component styles rather than as Paper tokens. A role absent
 *     from `dark` is theme-invariant by design.
 *   - `semanticAliases`: the legacy-vocabulary bridge. Each maps an old role name
 *     onto the `var()` of the C3 token that plays the same part, so components
 *     written against the previous design keep rendering in the new palette while
 *     screens are restyled one by one.
 *
 * Kept honest by packages/tokens/src/__tests__/semantic.test.ts, which checks both
 * groups against the stylesheet text.
 */

export const semanticTokens = {
  colorTextFaint: '--color-text-faint',
  colorBorderStrong: '--color-border-strong',
  colorToastBg: '--color-toast-bg',
  colorToastText: '--color-toast-text',
  colorToastAccent: '--color-toast-accent',
  colorErrorHover: '--color-error-hover',
  shadowRaised: '--shadow-raised',
  shadowMenu: '--shadow-menu',
  shadowToast: '--shadow-toast',
  shadowSegment: '--shadow-segment',
  opacityDisabled: '--opacity-disabled',
} as const;

export type SemanticToken = (typeof semanticTokens)[keyof typeof semanticTokens];

/** Values per theme. A role absent from `dark` is theme-invariant by design. */
export const semanticValues = {
  light: {
    '--color-text-faint': '#a19b90',
    '--color-border-strong': '#d8d3c8',
    '--color-toast-bg': '#26231f',
    '--color-toast-text': '#f2efe9',
    '--color-toast-accent': '#47a79e',
    '--color-error-hover': '#8e3628',
    '--shadow-raised': '0 1px 3px #2418000f',
    '--shadow-menu': '0 4px 16px #24180014',
    '--shadow-toast': '0 4px 12px #24180026',
    '--shadow-segment': '0 1px 2px #24180014',
    '--opacity-disabled': '0.4',
  },
  dark: {
    '--color-text-faint': '#6c675e',
    '--color-border-strong': '#46423a',
    '--color-error-hover': '#e89b85',
  },
} as const;

/**
 * Legacy name -> the C3 token that plays the same part.
 *
 * Every entry must appear verbatim in semantic.css. Remove an entry only once
 * nothing references its name any more.
 */
export const semanticAliases = {
  '--color-panel': 'var(--color-bg-sidebar)',
  '--color-surface-raised': 'var(--color-surface)',
  '--color-inset': 'var(--color-active)',
  '--color-primary': 'var(--color-green)',
  '--color-primary-hover': 'var(--color-green-hover)',
  '--color-primary-tint': 'var(--color-green-tint-8)',
  '--color-on-primary': 'var(--color-on-green)',
  '--text-2xs': '11px',
  '--text-xs': '12px',
  '--text-sm': 'var(--text-caption)',
  '--text-base': '14px',
  '--text-md': '16px',
  '--text-xl': 'var(--text-title)',
  '--spacing-1': 'var(--space-1)',
  '--spacing-2': 'var(--space-2)',
  '--spacing-3': 'var(--space-3)',
  '--spacing-4': 'var(--space-4)',
  '--spacing-5': 'var(--space-5)',
  '--spacing-6': 'var(--space-6)',
  '--spacing-8': 'var(--space-8)',
  '--radius-md': 'var(--radius-btn)',
  '--radius-lg': 'var(--radius-card)',
  '--radius-full': 'var(--radius-pill)',
} as const;

export type SemanticAlias = keyof typeof semanticAliases;
