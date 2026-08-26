/*
 * GENERATED FILE - DO NOT EDIT.
 *
 * Source: Paper file "IDE New 01" design tokens.
 * Paper token content hash: 6ac7b87c
 * Regenerate with: bun run paper:tokens
 */

export const paperTokenContentHash = "6ac7b87c" as const;

/** Theme-neutral custom properties whose value flips with `[data-theme]`. */
export const colorTokens = {
  "colorBg": "--color-bg",
  "colorBorder": "--color-border",
  "colorBorderStrong": "--color-border-strong",
  "colorError": "--color-error",
  "colorErrorTint": "--color-error-tint",
  "colorInset": "--color-inset",
  "colorOnPrimary": "--color-on-primary",
  "colorPanel": "--color-panel",
  "colorPrimary": "--color-primary",
  "colorPrimaryTint": "--color-primary-tint",
  "colorSuccess": "--color-success",
  "colorSuccessTint": "--color-success-tint",
  "colorText": "--color-text",
  "colorTextFaint": "--color-text-faint",
  "colorTextMuted": "--color-text-muted",
  "colorWarning": "--color-warning",
  "colorWarningTint": "--color-warning-tint"
} as const;

/** Custom properties that are identical in both themes. */
export const scaleTokens = {
  "fontMono": "--font-mono",
  "fontSans": "--font-sans",
  "fontWeightMedium": "--font-weight-medium",
  "fontWeightRegular": "--font-weight-regular",
  "fontWeightSemibold": "--font-weight-semibold",
  "radiusFull": "--radius-full",
  "radiusMd": "--radius-md",
  "radiusSm": "--radius-sm",
  "spacing1": "--spacing-1",
  "spacing2": "--spacing-2",
  "spacing3": "--spacing-3",
  "spacing4": "--spacing-4",
  "spacing6": "--spacing-6",
  "spacing8": "--spacing-8",
  "text2xs": "--text-2xs",
  "textBase": "--text-base",
  "textLg": "--text-lg",
  "textMd": "--text-md",
  "textSm": "--text-sm",
  "textXl": "--text-xl",
  "textXs": "--text-xs",
  "trackingTight": "--tracking-tight",
  "trackingWide": "--tracking-wide"
} as const;

export const lightPalette = {
  "--color-bg": "#FCFCFC",
  "--color-panel": "#F8F8F8",
  "--color-inset": "#F0F0F0",
  "--color-border": "#E8E8E8",
  "--color-border-strong": "#E3E3E3",
  "--color-text": "#1A1A1A",
  "--color-text-muted": "#7A7A7A",
  "--color-text-faint": "#A8A8A8",
  "--color-primary": "#3078FC",
  "--color-primary-tint": "#E8F0FC",
  "--color-on-primary": "#FFFFFF",
  "--color-success": "#1F8A58",
  "--color-success-tint": "#E2F2EA",
  "--color-warning": "#F08C2E",
  "--color-warning-tint": "#FDF0E0",
  "--color-error": "#D4524A",
  "--color-error-tint": "#FBE9E8"
} as const;

export const darkPalette = {
  "--color-bg": "#141414",
  "--color-panel": "#191919",
  "--color-inset": "#202020",
  "--color-border": "#2C2C2C",
  "--color-border-strong": "#343434",
  "--color-text": "#F5F5F5",
  "--color-text-muted": "#9A9A9A",
  "--color-text-faint": "#6B6B6B",
  "--color-primary": "#5C96FF",
  "--color-primary-tint": "#1B2B4A",
  "--color-on-primary": "#FFFFFF",
  "--color-success": "#3CC98A",
  "--color-success-tint": "#1D3A2C",
  "--color-warning": "#F5A04C",
  "--color-warning-tint": "#3D2B16",
  "--color-error": "#E5665E",
  "--color-error-tint": "#3D1F1D"
} as const;

export const scaleValues = {
  "--font-sans": "Inter",
  "--font-mono": "JetBrains Mono",
  "--text-xs": "12px",
  "--text-sm": "13px",
  "--text-base": "14px",
  "--text-md": "16px",
  "--text-lg": "20px",
  "--text-xl": "24px",
  "--text-2xs": "11px",
  "--font-weight-regular": "400",
  "--font-weight-medium": "500",
  "--font-weight-semibold": "600",
  "--tracking-tight": "-0.01em",
  "--tracking-wide": "0.06em",
  "--spacing-1": "4px",
  "--spacing-2": "8px",
  "--spacing-3": "12px",
  "--spacing-4": "16px",
  "--spacing-6": "24px",
  "--spacing-8": "32px",
  "--radius-sm": "6px",
  "--radius-md": "10px",
  "--radius-full": "999px"
} as const;

export type ColorToken = (typeof colorTokens)[keyof typeof colorTokens];
export type ScaleToken = (typeof scaleTokens)[keyof typeof scaleTokens];
export type Theme = 'light' | 'dark';

/** `var(--color-primary)` for a checked token name. */
export function cssVar(token: ColorToken | ScaleToken): string {
  return `var(${token})`;
}

/** Resolve a colour token to its literal hex for a theme, for canvas and native surfaces. */
export function resolveColor(token: ColorToken, theme: Theme): string {
  const palette = theme === 'dark' ? darkPalette : lightPalette;
  return palette[token as keyof typeof palette];
}
