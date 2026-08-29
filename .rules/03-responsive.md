# 03 — Responsive layout and theming

## 3.1 The three widths

Every screen must be usable and legible at **390**, **768**, and **1440** CSS
pixels wide. Those are not arbitrary: 390 is a phone, 768 is a tablet or a
narrow window, 1440 is the Paper artboard width and the desktop default.

"Usable" means: nothing is clipped, nothing overlaps, no horizontal scrollbar on
the page, every interactive target stays reachable, and text does not shrink
below the smallest type token. A screen that only works at 1440 is not finished.

Current state of the tree, stated plainly so you do not mistake it for a
precedent: the app is desktop-first. `--layout-viewport` is `1440px`, there is a
`--breakpoint-desktop: 1440px` token, and `packages/app/src` contains no width
media queries at all. Narrow layouts are work still to be done — when you touch a
screen, bring it up to the three widths rather than adding one more
1440-only layout.

**Bad** — a fixed artboard width, so 390 and 768 both scroll sideways:

```css
/* packages/app/src/screens/sessions/sessions.css */
.cx-sessions {
  width: 1120px;
  display: grid;
  grid-template-columns: 360px 360px 360px;
}
```

**Good** — the desktop measurement is a maximum, and the grid collapses:

```css
.cx-sessions {
  width: 100%;
  max-width: var(--layout-list-content);
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
```

## 3.2 Breakpoints come from tokens

Structural dimensions live in `packages/tokens/src/layout.ts`, which is the
hand-maintained source of truth mirrored into `layout.css` (a test checks the two
stay in sync in both directions). Colour, type, spacing and radii come from Paper
via `bun run paper:sync` and land in `tokens.generated.*` — never hand-edit those.

If you need a breakpoint that does not exist yet, add it to `layout.ts` and
mirror it into `layout.css`. Do not scatter magic numbers.

**Bad** — three different opinions about where "tablet" starts:

```css
@media (max-width: 767px)  { … }   /* one file */
@media (max-width: 760px)  { … }   /* another file */
@media (min-width: 769px)  { … }   /* a third */
```

**Good** — one definition, referenced everywhere:

```ts
// packages/tokens/src/layout.ts
export const layout = {
  viewport: 1440,
  /** Responsive breakpoints. Mobile-first: these are min-widths. */
  breakpoint: {
    /** Phone baseline (390px artboard). Below this we do not design. */
    mobile: 390,
    /** Tablet / narrow window. */
    tablet: 768,
    /** Paper artboard width; the desktop layout. */
    desktop: 1440,
  },
  …
} as const;
```

```css
/* packages/app/src/screens/sessions/sessions.css */
@media (min-width: 768px) { /* --breakpoint-tablet */ … }
```

CSS cannot read a custom property inside a media query, so the pixel value is
repeated in the `@media` condition — always with the token name in a trailing
comment so a grep for `--breakpoint-tablet` finds every use site.

## 3.3 Dark and light are both first-class

The theme is applied by `data-theme` on the document
(`packages/ui/src/theme/theme-provider.tsx`), with `system` following
`prefers-color-scheme`. The preference persists under the `cortex.theme` key and
the toggle lives in the sidebar footer. Palettes are `lightPalette` and
`darkPalette` in `packages/tokens/src/tokens.generated.ts`, exposed as CSS custom
properties and re-bound to semantic roles in `semantic.css`.

Check both themes before you open the PR. "It looked fine on my machine" usually
means "I only saw one theme".

## 3.4 No raw hex that fights the theme

A literal colour is frozen at one theme. In the other theme it is either
invisible or a bright rectangle. Use the semantic role, which is already defined
per theme: `--color-text`, `--color-text-muted`, `--color-text-faint`,
`--color-bg`, `--color-bg-sidebar`, `--color-surface`, `--color-panel`,
`--color-border`, `--color-border-strong`, `--color-primary`, `--color-on-primary`,
`--color-error`.

**Bad** — real hardcoded values in the tree; white text on a light background,
and a hand-picked "near-token" green that drifts from the palette:

```css
/* packages/app/src/shell/title-bar.css */
.cx-title-bar__label { color: #ffffff; }

/* packages/app/src/screens/auth/auth.css */
.cx-auth__panel { background: #1f4944; color: #f8f5ea; }
```

**Good**:

```css
.cx-title-bar__label { color: var(--color-text); }

.cx-auth__panel {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
```

**Bad** — a shadow whose alpha is baked against the light background:

```css
box-shadow: 0 1px 2px #1f1d1a0a;
```

**Good** — a token that both palettes define:

```css
box-shadow: var(--shadow-card);
```

Narrow, documented exceptions — do not widen them without a reviewer agreeing:

1. **Official third-party brand marks.** A Slack or Google Drive logo has fixed
   brand colours. Keep those literals inside the SVG components
   (`packages/app/src/screens/chat/brand-logos.tsx`,
   `packages/app/src/shell/provider-marks.tsx`) and nowhere else.
2. **Terminal fallbacks.** `xterm` needs concrete colours; the code reads the CSS
   variables first and only falls back to a literal when they are missing
   (`packages/app/src/screens/session/shell-view.tsx`). Keep the read-first order.

Everything else with a `#` in `packages/app/src` is a bug waiting for a theme
switch.

## 3.5 Density, motion, and hit targets

- Spacing comes from the `--space-*` scale; type from the `--text-*` scale. No
  arbitrary `padding: 13px`.
- Interactive controls keep their token heights (`--layout-button`,
  `--layout-field`) at every width. Do not shrink a control below 32px of touch
  target to make a narrow layout fit — reflow instead.
- Respect `prefers-reduced-motion`; `theme.css` already has the media query, so
  put transitions where it can suppress them.
- Never rely on hover alone to reveal an action. At 390 there is no hover.
