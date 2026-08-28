/**
 * Design tokens for Cortex Code.
 *
 * The colour, type, spacing and radius tokens are generated from the Paper file that owns
 * the design (`bun run paper:tokens`). Structural dimensions live in `layout.ts` because
 * Paper does not model frame geometry as tokens.
 */

export {
  colorTokens,
  darkPalette,
  lightPalette,
  paperTokenContentHash,
  resolveColor,
  scaleTokens,
  scaleValues,
  cssVar,
  type ColorToken,
  type ScaleToken,
  type Theme,
} from './tokens.generated.ts';

export { layout, layoutCssVariables, type Layout, type LayoutCssVariable } from './layout.ts';

export {
  semanticAliases,
  semanticTokens,
  semanticValues,
  type SemanticAlias,
  type SemanticToken,
} from './semantic.ts';

/** Attribute the theme is switched with; also the selector the dark palette is scoped to. */
export const THEME_ATTRIBUTE = 'data-theme';

/** Themes the design provides an artboard for. Every screen exists in both. */
export const THEMES = ['light', 'dark'] as const;
