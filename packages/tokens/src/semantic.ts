/**
 * Typed mirror of semantic.css.
 *
 * These roles are not in Paper's token set; the design expresses them as hex literals
 * inside component styles. `paperSource` records the Paper node each value was read from
 * so the pairing can be re-verified against `design/paper/jsx/`.
 */

export const semanticTokens = {
  colorSurfaceRaised: '--color-surface-raised',
  colorHover: '--color-hover',
  colorPrimaryHover: '--color-primary-hover',
  colorErrorHover: '--color-error-hover',
  colorToastBg: '--color-toast-bg',
  colorToastText: '--color-toast-text',
  colorToastAccent: '--color-toast-accent',
  shadowRaised: '--shadow-raised',
  shadowMenu: '--shadow-menu',
  shadowToast: '--shadow-toast',
  opacityDisabled: '--opacity-disabled',
} as const;

export type SemanticToken = (typeof semanticTokens)[keyof typeof semanticTokens];

/** Values per theme. A role absent from `dark` is theme-invariant by design. */
export const semanticValues = {
  light: {
    '--color-surface-raised': '#ffffff',
    '--color-hover': '#f3f3f3',
    '--color-primary-hover': '#2264dd',
    '--color-error-hover': '#b8433c',
    '--color-toast-bg': '#1f1f1f',
    '--color-toast-text': '#f5f5f5',
    '--color-toast-accent': '#3cc98a',
    '--shadow-raised': '0 1px 3px #0000000a',
    '--shadow-menu': '0 4px 16px #00000014',
    '--shadow-toast': '0 4px 12px #00000026',
    '--opacity-disabled': '0.4',
  },
  dark: {
    '--color-surface-raised': '#191919',
    '--color-hover': '#202020',
  },
} as const;

/**
 * Where each role came from in the Paper file, and whether it varies by theme.
 * `jsx` names the archive under `design/paper/jsx/` that the literal appears in.
 */
export const semanticProvenance: Record<
  SemanticToken,
  { paperNodes: string[]; jsx: string[]; themed: boolean }
> = {
  '--color-surface-raised': {
    paperNodes: ['CW-0', 'KW-0', 'EH-0', 'JB-0', 'GZ-0'],
    jsx: ['composer', 'session-card', 'tabs-toast-menu'],
    themed: true,
  },
  '--color-hover': { paperNodes: ['DY-0', 'KE-0'], jsx: ['nav-item'], themed: true },
  '--color-primary-hover': {
    paperNodes: ['BC-0', 'MW-0'],
    jsx: ['button-primary'],
    themed: false,
  },
  '--color-error-hover': {
    paperNodes: ['CC-0', 'LZ-0'],
    jsx: ['button-destructive'],
    themed: false,
  },
  '--color-toast-bg': { paperNodes: ['GT-0'], jsx: ['tabs-toast-menu'], themed: false },
  '--color-toast-text': { paperNodes: ['GT-0'], jsx: ['tabs-toast-menu'], themed: false },
  '--color-toast-accent': { paperNodes: ['GT-0'], jsx: ['tabs-toast-menu'], themed: false },
  '--shadow-raised': { paperNodes: ['CW-0'], jsx: ['composer'], themed: false },
  '--shadow-menu': { paperNodes: ['GZ-0'], jsx: ['tabs-toast-menu'], themed: false },
  '--shadow-toast': { paperNodes: ['GT-0'], jsx: ['tabs-toast-menu'], themed: false },
  '--opacity-disabled': {
    paperNodes: ['BL-0', 'CL-0'],
    jsx: ['button-primary', 'button-destructive'],
    themed: false,
  },
};
