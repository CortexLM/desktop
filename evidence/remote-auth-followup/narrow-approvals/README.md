# Narrow Code approval descriptions — source ready

## Change

- `packages/app/src/screens/code/lot-code.tsx:878`: `SetApprovals` first list gains `code-approval-defaults` only.
- `packages/app/src/screens/code/lot-code.css:342–343`: two rules inside the existing `@media (max-width: 1200px)` block: column layout/2px gap for the scoped `.grow`, normal wrapping for its `.sub`.
- `tests/e2e/responsive.spec.ts:9–53`: four bounded cases: 960×640 and 1024×686, light/dark. Each checks exactly two expected rows, text Range geometry below titles/within allocated text boxes/clear of controls, then real Tab traversal from Usage to model selector and approval switch.

The added class has no styles above 1200px. No wide selector changes. The prior in-memory diagnostic measured exact unchanged 1440 geometry (`/tmp/opencode/narrow-preview-findings/scoped-diagnostic.json`); the built source patch has not yet been verified.

## Negative baseline — executed before application source edits

Against existing unmodified `ffc118a` dist via `cortex://app`, real Electron under isolated Xvfb:

| New test | Outcome |
| --- | --- |
| 960×640 light | Expected failure: below-title, text-box fit, model-description/control overlap |
| 960×640 dark | Same expected failures |
| 1024×686 light | Expected failure: both descriptions join titles |
| 1024×686 dark | Same expected failures |

**4/4 failed for the intended geometry assertions; no keyboard-focus/reachability failures.** Soft geometry assertions let each test reach both Tab checks. Test process exited 1; no retries. All four failure screenshots inspected.

Only the new test existed in source when this baseline ran. `baseline-provenance.json` pins original app CSS/TSX, current test, dist HTML/JS/CSS and Electron main/preload hashes. Every pinned application source/dist hash still matched immediately before the application patch. Dist hashes were checked again afterward and remain identical. The test source hash remains identical to the tested baseline.

Command (environment `NODE_ENV=test`, `TMPDIR=/tmp/opencode/narrow-approvals-fix/temp`, `CORTEX_RENDERER_URL` unset):

```bash
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/opencode/narrow-approvals-fix/baseline.json \
xvfb-run -a -s '-screen 0 1600x1000x24' \
node node_modules/@playwright/test/cli.js test tests/e2e/responsive.spec.ts \
  --grep 'Code approval descriptions stay clear of controls' \
  --workers=1 --retries=0 --reporter=list,json \
  --output=/tmp/opencode/narrow-approvals-fix/baseline-artifacts
```

## Checks after source patch

- Targeted ESLint passed: `packages/app/src/screens/code/lot-code.tsx`, `tests/e2e/responsive.spec.ts`.
- `git diff --check` passed.
- Mechanical design detector ran once: three existing warnings at CSS lines 119, 154, 185, outside the changed rules; none in added rules.
- No build, broad suite, CI query, Mac action or commit. Existing dist preserved for coordinator's installed verification.

## Evidence

- `baseline.json`, `baseline.log`, `baseline-exit-code.txt`: raw negative run.
- `baseline-summary.json`: exact per-case expected failures and attachment metadata.
- `baseline-provenance.json`: baseline source/dist/test fingerprints.
- `baseline-1.png` … `baseline-4.png`: inspected baseline screenshots, respectively 960 light/dark, 1024 light/dark.
- `baseline-1-geometry.json` … `baseline-4-geometry.json`: original text Range measurements.
- `targeted-lint.log`, `design-detector.json`: scoped post-edit checks.

## Handoff

**Ready for coordinator-authorized build and positive run.** Re-run the four targeted tests with a new output/report path after rebuilding. No post-fix runtime success, native acceptance or packaged acceptance claimed yet. Coordinator owns docs and later build/native verification.

Coordinator follow-up: renderer rebuilt; `fixed.json` records **4/4 passes**, zero retries.
[Source review](source-review.md) approves the scoped correction. Subsequent test-only change
retains successful screenshots as CI artifacts as well as failure captures. Matching full
dependency-batch CI, packaged/native proof remain pending.
