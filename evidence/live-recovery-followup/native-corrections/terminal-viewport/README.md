# Code terminal and diff viewport corrections

## Delivered

- `packages/app/src/kit/styles.css:393`: add only `min-height: 0` to `.split-r`.
  The grid item can now shrink below its content height, allowing the terminal's
  existing `overflow: auto` to own scrolling. Column widths, spacing and colors are
  unchanged.
- Follow-up authorized diff correction, same file: add
  `.split-r > .diff { display: grid; grid-template-rows: auto minmax(0, 1fr); }`.
  The header keeps its existing 32 px row; the pre's existing `overflow: auto` owns
  scrolling in the shrinkable second row. Short cards keep intrinsic height, multiple
  cards retain their existing flex shrink allocation. Global `.diff` callers outside
  `.split-r` retain their original layout.
- `tests/e2e/terminal-copy.spec.ts`: replace single-line 50,017-character stdout with
  equally long multiline stdout from the real bash command. Preserve all existing
  localized exit, literal-lookalike, truncation metadata, persistence, live tool
  serialization and model replay assertions.
- Extend that same test after reload/replay: 960×640, 1024×640, 1440×900, light/dark.
  Scroll the real terminal; require bounded client height, positive scroll range and
  the exact final French annotation's text range inside the pane and hit-testable.
  Six screenshots and geometry attachments accompany the assertions. No fabricated
  terminal DOM, new test case or framework.
- `tests/e2e/code-diff-scroll.spec.ts`: one new real-engine test, based on the retained
  write probe. Two real permission-approved writes produce two exact 161-line files.
  At 960×640 and 1440×900 in both themes, mouse-wheel input must move each pre, expose
  `+DIFF END` inside its clipping rectangle/hit test, and keep both headers visible.
  Four screenshots accompany the run. No mocked engine, fabricated DOM or injected CSS.

## Negative reproduction before CSS edit

One targeted Electron run under Node `v22.23.3` and Xvfb; no retries or rebuild.
Real engine/permissions/bash; controlled local inference selects the commands.

Result: expected failure in all six new geometry assertions. The prior localization,
persistence and replay steps passed. Every size/theme reported:

```text
clientHeight = scrollHeight = 58964
scrollTop = 0
tail.top = 59083
bounded = scrollable = markerVisible = false
```

Evidence under `/tmp/opencode/terminal-viewport/`:

- `baseline.json`: complete Playwright result and geometry attachments.
- `baseline-manifest.json`: command, timestamps and pre-edit source/build hashes.
- `baseline-artifacts/`: six captures plus retained failure trace.
- `terminal-copy-fr-{960,1024,1440}-{light,dark}-viewport.json`: decoded geometry.
- `baseline-contact-sheet.png`: inspected six-state overview. Terminal extends beyond
  the clipped frame; final annotation and composer lie below the visible area.
- `dist-unchanged.json`: desktop entry and built renderer CSS hashes still match the
  baseline; this worker did not rebuild.

## Shared diff-pane negative evidence and authorized follow-up

An isolated real-engine `write` tool produced a 161-line file. A mouse-wheel probe at
960×640 compared the old build with a diagnostic in-memory `.split-r { min-height: 0; }`
override. This is diagnostic evidence, not a rebuilt-source acceptance run.

- Before: `.split-r` 3,332 px; diff tail y=3,389, unreachable.
- Override: `.split-r` 535 px; `.diff` 471 px; its pre remains 3,236 px. `.diff` retains
  `overflow: hidden`. Wheel scrolling leaves all relevant `scrollTop` values at zero;
  the same tail remains unreachable.
- The earlier programmatic probe can move the hidden-overflow diff box to its tail;
  that does **not** establish user scrollability. The separate wheel probe preserves
  the negative finding.
- Evidence: `diff-probe.json` (programmatic diagnostic), `diff-wheel-probe.json`,
  `diff-probe.mjs`, `diff-before.png`, `diff-min-height.png` (wheel captures).
- The coordinator subsequently authorized the scoped grid rule above and the new
  real-write regression. Positive verification remains pending rebuild. Chat canvas
  already overrides `.split-r` with `min-height: 0` in `chat.css`.

The regression's intended negative assertion is:

```ts
await page.mouse.wheel(0, 10000);
await expect.poll(() => pre.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
await expect(tail).toBeInViewport({ ratio: 1 });
await expect(diff.locator(".code-head")).toBeInViewport({ ratio: 1 });
```

The retained old-build wheel probe reports `pre.scrollTop === 0`, tail y=3,389 and
`tailVisible === false` before and after the min-height-only override. The new test
has not been run against the stale build; that negative evidence remains preserved.

## Checks and integration limit

- Scoped ESLint and `git diff --check`: pass (`static-checks.json`).
- After the authorized diff addition, targeted ESLint passed for both owned test
  files (`diff-scoped-lint.json`). No further runtime run was performed.
- Mechanical design detector: 15 existing warnings, none at the changed line;
  retained in `design-detector.log`. Incumbent frozen design takes precedence.
- Only the three assigned repository files were edited. No commit, build, full suite,
  Mac launch or CI run.
- Post-fix terminal/diff acceptance is pending the coordinator's renderer rebuild and
  targeted run; no passing UI claim is made from the old build.

Targeted command after that rebuild:

```sh
NODE_ENV=test TMPDIR=/tmp/opencode PATH="/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH" xvfb-run -a -s '-screen 0 1920x1080x24' /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/@playwright/test/cli.js test tests/e2e/terminal-copy.spec.ts tests/e2e/code-diff-scroll.spec.ts --workers=1 --retries=0 --reporter=json --output=/tmp/opencode/terminal-viewport/fixed-artifacts
```

## Asymmetric-card correction after independent P2 review

This section supersedes the earlier equal-card fixture and two-rule acceptance scope.
The coordinator reported a rebuilt 26-case target pass. Independent review then found
that proportional flex shrink could clip a short diff beside a long one; the equal
161-line cards did not cover that case.

### New negative run

Before editing CSS again, the existing test was strengthened to use three real writes:
one one-line file followed by two 161-line files. All three exact disk contents passed.
On the current built two-rule fix at 960×640/light, the first new header assertion
failed directly:

```text
diff-short.txt card.height = 6.515625
header.height = 32
card.bottom = 154.515625; header.bottom = 181
withinCard = false; hitTest = false
```

- One targeted run, no retries, exit 1. Only the first mixed-card case was reached;
  the failure stops before wheel checks and other size/theme cases.
- `/tmp/opencode/terminal-viewport/asymmetric-baseline.json`: direct failed assertion.
- `asymmetric-baseline-manifest.json`: run command, time, source and built-asset hashes.
- `diff-header-960-light-0-negative.json`: decoded measurements.
- `asymmetric-baseline-artifacts/`: failure screenshot and trace. Screenshot inspected:
  the first diff is a thin empty strip; both long diffs retain their headers.
- Earlier baseline, wheel-probe and coordinator target receipts were not overwritten.

### Minimal scoped correction

```css
.split-r:has(> .diff) { overflow: auto; }
/* Header (32px), one code line (20px), pre padding (16px), borders (2px). */
.split-r > .diff { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 70px; }
```

The 70 px minimum comes from existing border-box metrics, not a new maximum or growth
policy. It preserves a short card's normal intrinsic size while preventing it from
collapsing under proportional shrink. The diff-bearing parent scrolls when combined
card minimums exceed its available height; terminal and canvas panes do not match that
selector. Diff bodies keep their independent scroll boxes and existing header track.
Single short frozen-preview cards acquire no forced height beyond their current
header/one-line minimum.

The one existing diff test now checks mixed card sizes, all header clipping/hit tests,
the short line's visibility, plus actual wheel movement and visible tails for both
long files, at 960/1440 in both themes. It attaches header geometry. No new test case
or runtime CSS injection was added.

### Checks and handoff

- Targeted ESLint and scoped diff whitespace checks passed after the correction.
  `asymmetric-static-checks.json` records results and confirms built desktop/CSS hashes
  were unchanged since the negative run.
- Only `packages/app/src/kit/styles.css` and `tests/e2e/code-diff-scroll.spec.ts` changed
  in this follow-up. The terminal test remains as delivered previously.
- No build, positive rerun, full suite, Mac, CI or commit was performed by this worker.
  Coordinator owns the next rebuild and targeted command above. Combined-minimum
  overflow fallback is source-reviewed; the bounded runtime regression covers three
  mixed cards, not an unbounded file-count sweep.
