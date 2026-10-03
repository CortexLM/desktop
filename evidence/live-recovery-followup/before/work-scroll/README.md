# Work font-ready initial-scroll correction

## Changed files

- `packages/app/src/screens/work/home.tsx`: preserves initial next-frame scroll; bottom-target variants (`done`, `blocked`, `failed`) receive one font-ready animation-frame correction. Approval keeps its existing 260px target. Pending work cancels on unmount/variant change and transcript wheel, pointer, touch or keyboard intent. Native scroll/anchoring remain enabled; no ongoing auto-scroll.
- `tests/e2e/work-scroll.spec.ts`: two Electron tests, light/dark, each with cold fonts, warm-font remount, user-wheel cancellation, variant cancellation and unmount steps. Numeric metrics attach as JSON.

Immediate scrolling retained: it shows the completed transcript during slow font loading rather than leaving users at its beginning. The correction schedules only once through the native `document.fonts.ready`; listeners do not prevent input or modify native scrolling. Conservatively, any pointer/key input in the transcript cancels the pending correction.

## Baseline evidence

Before editing application source, all 35 existing `packages/app/dist` asset hashes matched the reviewed `6d96535` / `f9aca44` run. No build performed.

Actual `cortex://app/fonts/*.woff2` request interception works in Electron. Tests hold the original two font responses, delegate to `route.continue()`, leave font bytes/CSS/FontFaceSet intact. An observational `scrollTop` wrapper delegates to the native setter unchanged, records initial metrics and releases responses during that initial layout frame. Scale 2 set via CDP matches the comparison's device scale; native window 1360×840 matches the comparison app frame. This is a controlled font-arrival-order regression, not a recreation of every historical timing detail.

Final pre-fix first-frame run:

```
NODE_ENV=test PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/opencode/work-scroll-fix/baseline-first-frame.json xvfb-run -a bunx playwright test tests/e2e/work-scroll.spec.ts --workers=1 --reporter=line,json --output=/tmp/opencode/work-scroll-fix/baseline-first-frame-results
```

**Both tests fail solely at the exact zero-gap assertion**, reporting the historical 1px offset:

| Theme | Before: top / height / viewport / gap | After fonts: top / height / viewport / gap |
| --- | --- | --- |
| light | 409 / 1068 / 659 / 0 | 391 / 1051 / 659 / **1** |
| dark | 409 / 1068 / 659 / 0 | 391 / 1051 / 659 / **1** |

Both baseline tests continue through their soft failure. Warm fonts yield gap 0. User wheel preserves top 229 while fonts reflow (gap 163 afterwards); variant navigation stays top 0; leaving the task produces no error. JSON report retains metrics and failure artifacts.

An earlier initial test version held fonts until several later frames at scale 1: **2 passed** (`baseline.log`). It did not reproduce the race. Bounded diagnostics established scale 2 and early font arrival as necessary for this local reproduction; no tolerance changed. `font-timing-probe.json` and `first-frame-probe.json` retain the investigation. Final tests keep `gap === 0`.

After the baseline run, the variant step was strengthened to use the actual state picker (replace-state path), and the wheel step gained a further post-readiness scroll assertion. Those two test edits have static checks only pending integration.

## Checks completed

- Targeted ESLint for both owned files: pass.
- `bun run typecheck`: pass; final log `typecheck-final.log`.
- `git diff --check` for owned files: pass.
- Original report/captures untouched. No shared nav/theme/CSS/cards/Chat edits; no build, Mac, CI, documentation or git-history edits.

## Integration checks pending

Coordinator must build after all scopes integrate, then run:

```
NODE_ENV=test xvfb-run -a bunx playwright test tests/e2e/work-scroll.spec.ts --workers=1
```

Expected corrected cold-font bottom: top 392, height 1051, viewport 659, gap **0**; exact gap assertion remains the gate. Run normal integrated checks/CI and desktop packaging checks at coordinator scope. No corrected-renderer runtime pass claimed here.
