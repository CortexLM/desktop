# Reduced-motion source review

Verdict: accept the proposed one-line port; no source-level blocker found.

## Equivalence

- `/root/cortex-ui/src/styles.css:58` uses `transition-duration: 0s !important`.
- `packages/app/src/kit/styles.css:58` still uses `1ms` at review time. Replacing only that transition value makes this rule identical to the explicit live-reference fix.
- Keep `animation-duration: 1ms !important`, `animation-iteration-count: 1 !important`, the thinking/shimmer exceptions, and the separate view-transition rule at line 59 intact.
- Font declarations, theme tokens, inherited body color, opacity rules remain byte-for-byte outside this substitution (`styles.css:2–7,19–50`). No font/color/opacity workaround is necessary.

## Callback risk

- Targeted search across `packages/app/src` found no `transitionend`, `transitioncancel`, `animationend`, or equivalent React handlers.
- `kit/ui.tsx:64–74` waits on explicit Web Animations promises; reduced motion bypasses that path before animation creation.
- `shell/shell.tsx:44–46` bypasses the view-transition promise path under reduced motion. Read for dependency review only.
- Zero-duration CSS transitions therefore remove no identified app-source completion signal. Library lifecycle behavior was not exercised; an actual menu open/dismiss assertion provides useful coverage.
- Existing transition delays are unchanged; the port promises zero transition duration, not removal of every animation/delay.

## Recommended bounded regression

1. Two live Home cases in `tests/e2e/chrome.spec.ts`: light and dark. Emulate reduced motion before reloading; verify the active theme and media query.
2. Await `document.fonts.ready`. Assert the heading is visible, has opacity `1`, matches the body's computed color/font family, and Geist is loaded. Read real computed styles; inject no replacement CSS or animation-disabling helper.
3. Assert computed transition durations are `0s` on a transitioning control and `.composer::before`; assert the Home heading retains `0.001s` animation duration and iteration count `1`. The duration check fails against the original `1ms` rule even when the color symptom is timing-sensitive.
4. Open then dismiss one existing popup; assert it disappears and focus returns to its trigger. This checks zero-transition cleanup without a broader navigation audit.

Source-only review: eight relevant reads/searches; no builds/tests, runtime verification, source/test edits, or delegation. Only this report written. The 80 draft captures are coordinator-supplied evidence, not independently reproduced. Frozen `7b388e2d9674` approval remains unchanged; Code/Automations approval and overall remote/design acceptance remain pending.
