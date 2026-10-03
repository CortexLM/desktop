# Preview departure fix — integration handoff

**Baseline native-transition regression reproduces the crash. Owned source changes are ready; one `App.tsx` integration line remains required and was not written outside ownership. No corrected build/runtime pass claimed.**

## Required coordinator integration

In `packages/app/src/App.tsx`, replace:

```tsx
<PreviewGate>
```

with:

```tsx
<PreviewGate preview={h.params.has("preview") || h.params.has("shot")}>
```

Patch also retained at `/tmp/opencode/preview-departure-fix/app-snapshot.patch`. This couples provider lifetime to the same committed route snapshot passed to `<Shell hash={h}>`. Without this line, the owned changes alone are not a complete fix: a parent rerender can still clear the provider based on the new global URL.

## Owned changes

- `packages/app/src/preview.tsx`: `usePreviewBot` reads the mounted provider, rather than nulling it whenever `location.hash` moves ahead of the rendered route. `PreviewGate` accepts an explicit committed `preview` prop; provider reset and locale/visit lifetime remain its existing responsibility. On the live commit it synchronously resets to null before rendering live children.
- `packages/app/src/screens/work/home.tsx`: Work's preview/live choice and active variant use `useNav().params`, the outgoing mounted route snapshot. Preview mascot config comes from its preview provider directly, avoiding the live/global-URL branch in `useMainBot`. Initial-font-ready scroll code is unchanged; no CSS, cards, shared navigation or theme changes.
- `tests/e2e/navigation.spec.ts`: one appended regression holds the **real native ViewTransition update callback**, with browser-owned promises. It departs from Work Done `?shot` to live `#/code` through same-document `location.hash`, checks the outgoing DOM/draft/Done widget before commit, then checks live Code and absence of fixture sidebar content. It verifies actual engine Bot/session lists remain empty. Failure screenshot and page-error JSON attach.

The test observes the outgoing same-document tree; it is not a mock ViewTransition. While the native callback is held, painting is suspended, so its shell-only rerender uses the real sidebar button's DOM `click()` rather than waiting for Playwright visibility/actionability.

## Root cause / bounded callsite review

App intentionally defers route commit through a view transition. The global hash already points to live Code while the Work preview remains mounted. `useVariant`'s hash listener rerenders the outgoing preview; global `useMainBot()` and `usePreviewBot()` reinterpret that mounted tree as live. Baseline crashes first on `useMainBot()!.cfg`; the installed Mac manifest caught the parallel `usePreviewBot()` null destructuring path. Both share the same identity mismatch.

`BotPagePreview` also non-null-dereferences `usePreviewBot` (`screens/bots/bot.tsx:177–178`). Fixing provider/hook lifetime addresses that context hazard centrally. Other callsites in shell, chat helpers, Bot Studio and Work helpers use optional context or explicit mode branches. This bounded inspection does not claim all existing global `isPreview()` reads were migrated. Outgoing Work's route/variant/config uses are the required direct dependents corrected here.

No optional-null fallback added; no fixture engine seeding; no persistence widened. Source snapshot and served/build receipts are in `source-build-receipt.json`; source-to-build attestation is not claimed.

## Negative evidence

Current existing built app used; **no build performed**. Full suite running elsewhere was not disturbed: custom JSON/output paths and `--workers=1` used.

```sh
NODE_ENV=test PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/opencode/preview-departure-fix/baseline-direct.json xvfb-run -a bunx playwright test tests/e2e/navigation.spec.ts --grep 'Work preview departure' --workers=1 --reporter=line,json --output=/tmp/opencode/preview-departure-fix/baseline-direct-results
```

Result: **1 failed**, expected empty page-error list, received:

```
Cannot read properties of null (reading 'cfg')
```

`baseline-direct.log`, `baseline-direct.json`, failure PNG/trace retained. Screenshot inspected: blank application surface after crash. Earlier diagnostic test iteration timed out clicking the disappeared sidebar and also logged the native held-callback timeout; it is retained separately as `baseline.log` / `baseline.json`, not presented as a second product cause.

Native installed manifest remains untouched at `/tmp/opencode/native-terminal-b0e6d78-ready/manifest.json`; its `Cannot destructure property 'live' ... as it is null` and timeout stay historical negative evidence.

## Checks / next steps

- Targeted ESLint: pass.
- `bun run typecheck`: pass (`typecheck-final.log`).
- Owned `git diff --check`: pass.
- Existing `navigation.spec.ts` outgoing Work restoration test remains unchanged.
- No App/shared-nav writes, builds, Mac use, commits or pushes performed.

Coordinator: apply the App line, then build once all scopes integrate. Run the new native regression, the existing pending-Work restoration case, `work-scroll.spec.ts`, and `bot-safety.spec.ts` preview lifetime tests. Verify no fixture content or data appears after live commit; preserve prior Work pixel/scroll evidence as earlier revision-scoped records. Corrected renderer behavior and final zero-offset pixels remain unverified in this pass.
