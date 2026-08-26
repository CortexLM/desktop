/*
 * GENERATED FILE - DO NOT EDIT.
 *
 * Source: Paper file "Cortex FF1 v1" design tokens (Concept 03).
 * Paper token content hash: 0866c3ed
 * Regenerate with: bun run paper:tokens
 */

export const paperTokenContentHash = "0866c3ed" as const;

/** Theme-neutral custom properties whose value flips with `[data-theme]`. */
export const colorTokens = {
  "colorAccent": "--color-accent",
  "colorActive": "--color-active",
  "colorBg": "--color-bg",
  "colorBgSidebar": "--color-bg-sidebar",
  "colorBorder": "--color-border",
  "colorDiffAdd": "--color-diff-add",
  "colorDiffRemove": "--color-diff-remove",
  "colorError": "--color-error",
  "colorErrorTint": "--color-error-tint",
  "colorGreen": "--color-green",
  "colorGreenHover": "--color-green-hover",
  "colorGreenOnTint": "--color-green-on-tint",
  "colorGreenTint16": "--color-green-tint-16",
  "colorGreenTint8": "--color-green-tint-8",
  "colorHover": "--color-hover",
  "colorOnAccent": "--color-on-accent",
  "colorOnGreen": "--color-on-green",
  "colorSuccess": "--color-success",
  "colorSuccessTint": "--color-success-tint",
  "colorSurface": "--color-surface",
  "colorText": "--color-text",
  "colorTextMuted": "--color-text-muted",
  "colorWarning": "--color-warning",
  "colorWarningTint": "--color-warning-tint"
} as const;

/** Custom properties that are identical in both themes. */
export const scaleTokens = {
  "breakpointDesktop": "--breakpoint-desktop",
  "containerComposer": "--container-composer",
  "containerContentMax": "--container-content-max",
  "containerRail": "--container-rail",
  "containerReading": "--container-reading",
  "containerSidebar": "--container-sidebar",
  "fontDisplay": "--font-display",
  "fontMono": "--font-mono",
  "fontSans": "--font-sans",
  "fontSerif": "--font-serif",
  "fontWeightBold": "--font-weight-bold",
  "fontWeightMedium": "--font-weight-medium",
  "fontWeightRegular": "--font-weight-regular",
  "fontWeightSemibold": "--font-weight-semibold",
  "leadingBody": "--leading-body",
  "leadingCaption": "--leading-caption",
  "leadingGreeting": "--leading-greeting",
  "leadingHero": "--leading-hero",
  "leadingHeroXl": "--leading-hero-xl",
  "leadingTitle": "--leading-title",
  "radiusBtn": "--radius-btn",
  "radiusCard": "--radius-card",
  "radiusComposer": "--radius-composer",
  "radiusPill": "--radius-pill",
  "radiusSm": "--radius-sm",
  "space1": "--space-1",
  "space10": "--space-10",
  "space12": "--space-12",
  "space16": "--space-16",
  "space2": "--space-2",
  "space24": "--space-24",
  "space3": "--space-3",
  "space30": "--space-30",
  "space4": "--space-4",
  "space5": "--space-5",
  "space6": "--space-6",
  "space8": "--space-8",
  "textBody": "--text-body",
  "textCaption": "--text-caption",
  "textGreeting": "--text-greeting",
  "textHero": "--text-hero",
  "textHeroXl": "--text-hero-xl",
  "textLg": "--text-lg",
  "textTitle": "--text-title",
  "trackingNormal": "--tracking-normal",
  "trackingTight": "--tracking-tight",
  "trackingWide": "--tracking-wide"
} as const;

export const lightPalette = {
  "--color-bg": "#FAF8F4",
  "--color-bg-sidebar": "#F3F0EA",
  "--color-surface": "#FFFFFF",
  "--color-border": "#E5E1D8",
  "--color-text": "#1F1D1A",
  "--color-text-muted": "#6E6A62",
  "--color-accent": "#B4622D",
  "--color-on-accent": "#FFF9F2",
  "--color-green": "#1F4945",
  "--color-green-hover": "#183936",
  "--color-green-tint-8": "#E8EAE6",
  "--color-green-tint-16": "#D7DCD8",
  "--color-green-on-tint": "#1F4945",
  "--color-on-green": "#FFFFFF",
  "--color-hover": "#2418000D",
  "--color-active": "#24180017",
  "--color-success": "var(--color-green)",
  "--color-success-tint": "var(--color-green-tint-16)",
  "--color-warning": "#9C6A1D",
  "--color-warning-tint": "#F5ECD8",
  "--color-error": "#A8402F",
  "--color-error-tint": "#F6E5DF",
  "--color-diff-add": "#E2EDE4",
  "--color-diff-remove": "#F7E8E1"
} as const;

export const darkPalette = {
  "--color-bg": "#211F1C",
  "--color-bg-sidebar": "#1A1815",
  "--color-surface": "#2A2724",
  "--color-border": "#3A362F",
  "--color-text": "#EDEAE3",
  "--color-text-muted": "#9B968C",
  "--color-accent": "#CE8B57",
  "--color-on-accent": "#FFF9F2",
  "--color-green": "#3F958C",
  "--color-green-hover": "#48ABA0",
  "--color-green-tint-8": "#232825",
  "--color-green-tint-16": "#26322E",
  "--color-green-on-tint": "#47A79E",
  "--color-on-green": "#211F1C",
  "--color-hover": "#EDEAE30F",
  "--color-active": "#EDEAE31C",
  "--color-success": "var(--color-green)",
  "--color-success-tint": "var(--color-green-tint-16)",
  "--color-warning": "#D9A855",
  "--color-warning-tint": "#37301C",
  "--color-error": "#E08268",
  "--color-error-tint": "#3B241E",
  "--color-diff-add": "#26332B",
  "--color-diff-remove": "#392620"
} as const;

export const scaleValues = {
  "--font-display": "Source Serif 4",
  "--font-sans": "Inter",
  "--font-mono": "JetBrains Mono",
  "--font-serif": "Source Serif 4",
  "--text-caption": "13px",
  "--text-body": "15px",
  "--text-lg": "18px",
  "--text-title": "24px",
  "--text-greeting": "32px",
  "--text-hero": "48px",
  "--text-hero-xl": "64px",
  "--font-weight-regular": "400",
  "--font-weight-medium": "500",
  "--font-weight-semibold": "600",
  "--font-weight-bold": "700",
  "--tracking-tight": "-0.02em",
  "--tracking-normal": "0em",
  "--tracking-wide": "0.08em",
  "--leading-caption": "18px",
  "--leading-body": "24px",
  "--leading-title": "30px",
  "--leading-greeting": "40px",
  "--leading-hero": "54px",
  "--leading-hero-xl": "70px",
  "--breakpoint-desktop": "1440px",
  "--container-rail": "64px",
  "--container-sidebar": "260px",
  "--container-reading": "700px",
  "--container-composer": "720px",
  "--container-content-max": "1120px",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "20px",
  "--space-6": "24px",
  "--space-8": "32px",
  "--space-10": "40px",
  "--space-12": "48px",
  "--space-16": "64px",
  "--space-24": "96px",
  "--space-30": "120px",
  "--radius-sm": "8px",
  "--radius-btn": "10px",
  "--radius-card": "16px",
  "--radius-composer": "24px",
  "--radius-pill": "999px"
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
