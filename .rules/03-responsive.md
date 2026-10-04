# 03 — Window sizes and theming

## 3.1 Window sizes

The app is desktop-only. The window opens at 1440×900 with a minimum of **960×640**
(`packages/desktop/src/main.ts`). Every screen must be usable from 960×640 up to a large
display: nothing clipped, no horizontal page scroll, every control reachable, the sidebar
hideable (⌘B) and focus mode (⌘\) working.

The gallery and `scripts/compare-shots.mjs` render at 1440×900; that is the comparison
size, not the only supported size. Check 960 wide when you change layout.

**Bad** — a fixed width wider than the minimum window:

```css
.tasks { width: 1120px; }
```

**Good**:

```css
.tasks { width: 100%; max-width: 1120px; }
```

## 3.2 Dark and light are both first-class

Theme is `light`, `dark` or `system` (rail toggle; stored in `localStorage` key
`cortex.theme`; applied as `data-theme` on `<html>`). Every screen you touch must be
checked in both — the gallery renders both side by side (`#/gallery`).

## 3.3 Use the theme variables, not raw hex

Colours, radii, durations and easings are CSS custom properties defined in
`packages/app/src/kit/styles.css` (`--t1`, `--t2`, `--card`, `--line`, `--red`,
`--r-card`, `--ease-out`, …), with light and dark values. Screen CSS uses them.

**Bad**:

```css
.chat-err { color: #e5484d; border-color: #e6e6e6; }
```

**Good**:

```css
.chat-err { color: var(--red); border-color: var(--line); }
```

Screen stylesheets still carry some raw hex (e.g. `screens/files/files.css`,
`screens/work/work.css`). That is debt, not precedent: replace it when you touch the rule.

## 3.4 Motion, hit targets, input

- Respect `prefers-reduced-motion` (the shell skips view transitions when it is set).
- Hover-only affordances need a `@media (hover: none)` fallback.
- Interactive elements have an accessible name; icon buttons use `IconBtn` with `label`.
- Shell shortcuts while typing are limited to Command/Ctrl K, N, B and Backslash: command
  palette, new conversation, sidebar and focus mode. Layout toggles preserve the draft;
  New intentionally starts a fresh composer. Other shortcuts leave text editing alone.
