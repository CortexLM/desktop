# Narrow Code approval descriptions — independent review

**Bounded approval. No concrete blocker in the three-line application change or four added regressions.**

- `packages/app/src/screens/code/lot-code.tsx:878` adds only the scoped class to the two preview-default rows. DOM order, translated labels, model menu, switch semantics and handlers remain unchanged. The separate live approval rules surface is unaffected.
- `packages/app/src/screens/code/lot-code.css:341-343` uses the existing 1200px media query. The text container becomes a column with a 2px gap; normal description whitespace permits wrapping within its allocated width. Existing `.li .grow { flex: 1; min-width: 0 }` remains effective; the switch retains its nonshrinking width. Rows have no fixed height, so additional translated lines can increase their height rather than overlap the neighboring control.
- No new font/color/token values, fixed text width, copy, focus target or visual reordering. Above 1200px the added class has no matching rule; the scoped change introduces no wide-layout styling. Built 1440px rendering and all-locale fit are not claimed by this source review.
- `tests/e2e/responsive.spec.ts:9-53` verifies exactly the affected two rows, complete English descriptions, Range placement below titles, allocated-box fit and separation from controls at 960×640/1024×686 in both themes. Actual Tab traversal preserves Usage → model selector → approval switch; each control must be fully in view and actionable. Soft geometry assertions still fail the case while allowing keyboard checks to run.
- Inspected retained negative summary: four intended geometry failures on the prior build. Inspected `/tmp/opencode/narrow-approvals-fix/fixed.json`: four expected passes, zero unexpected/skipped/flaky, retries disabled. This later supplied result supersedes the worker report's earlier pending-build wording; no execution was duplicated here. Prior in-memory wide geometry and installed `ffc118a` evidence are separate from acceptance of this new delta.

Source/diff and supplied result review only. No tests, build, Mac/CI, repository edits or commit. Only this report written; no delegation.

## Reviewed SHA-256

```text
c60639ed760972d48291bd0afcdbb601ca8cc0a7b831655dfca7194fdd4a0e7c  packages/app/src/screens/code/lot-code.tsx
dd0c1bb34e70c558058451e381ed9a4ccd8a87208315f3ff949e13d7db660f00  packages/app/src/screens/code/lot-code.css
9b245ec1cde3bf1b6f3918f719f26c5e1f26135ffacf1fbc023735d49b2695d8  tests/e2e/responsive.spec.ts
```
