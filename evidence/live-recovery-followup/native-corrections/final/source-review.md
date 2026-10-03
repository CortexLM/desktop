# Terminal / diff viewport — bounded source review

**One P2 blocker: unequal-length diff cards can clip the shorter card's header. Terminal height correction and equal-length diff scrolling are otherwise supported by the reviewed source.**

Scope: the two CSS rules in `packages/app/src/kit/styles.css`, `tests/e2e/terminal-copy.spec.ts`, `tests/e2e/code-diff-scroll.spec.ts`, supplied handoff and retained negative geometry. Existing Code markup/header metrics were read only to resolve those CSS rules. No runtime/tests/build/Mac/CI, repository edits or delegation. Only this report written.

## P2 — Proportional flex shrink collapses short diffs below their headers

**Exact lines:** `packages/app/src/kit/styles.css:393,401-403`; missing asymmetric coverage at `tests/e2e/code-diff-scroll.spec.ts:10-13`.

`.split-r` remains a column flex container. Its direct `.diff` children retain default `flex: 0 1 auto`, `overflow: hidden`, and no positive minimum height. The new `min-height: 0` bounds their parent, so negative space is distributed in proportion to each card's content-sized flex basis. A short card next to a long card can shrink below its own 32px header. The new internal grid cannot enlarge that flex allocation: its fixed-height header overflows the undersized card and is clipped by `.diff { overflow: hidden }`.

**Reliable source-derived reproduction:** produce two real write results at 960×640, first one line, second 161 lines. With the existing 32px header, 20px code line, 16px pre padding and 2px border, their intrinsic heights are approximately 70px and 3270px. A 535px right pane leaves approximately 459px for the two cards after its 48px toolbar and bottom margins. Proportional shrink gives the short card approximately 11px, below the 32px header; its header/body become clipped. This is a common small-edit-plus-large-edit case, not a many-card overflow limit.

**Minimum fix:** reserve a scoped minimum card height sufficient for the header plus a usable scrolling body. With the current fixed metrics, `.split-r > .diff { min-height: 70px; }` preserves one code line plus padding and header while letting the long card shrink. Verify against the mixed one-line/161-line case; keep the grid rule scoped to direct right-pane diffs. No global `.diff` layout rewrite is required.

**Test gap:** the new test uses the same 161-line `content` for both files (`code-diff-scroll.spec.ts:10-13`). Equal bases split the available height evenly, so both headers fit and this failure is invisible. Add an unequal-size pair and assert both header rectangles remain fully visible/hit-testable; wheel-scroll the long body. This review has not executed the reproduction.

## Bounded passes

- **Terminal:** `styles.css:393` removes the grid item's content-height floor; `.term` already has `flex: 1` and `overflow: auto` (`:403,408`). No new colors, column widths, padding or typography. The retained 960-light baseline records a 58,964px client height with no scroll range and an offscreen French tail; the rule addresses that ancestor sizing cause.
- **Diff body:** `styles.css:402` targets only direct `.split-r` cards and gives the pre a `minmax(0, 1fr)` track while retaining the existing header. `.diff pre` remains the intended `overflow: auto` scroll owner. The retained wheel diagnostic shows why parent min-height alone was insufficient: a bounded card still contained a full-height, non-scrolling pre.
- **Short frozen single-card layout:** the rule adds no flex growth or explicit overall height. A short standalone preview card can keep its intrinsic header/pre height. Source review cannot attest pixel equality; the unequal-card shrink finding above is the concrete layout exception.
- **Terminal regression:** multiline real bash output preserves the existing exact raw-output, literal-lookalike, metadata, persisted-history and model-replay assertions (`terminal-copy.spec.ts:48-80`). The six size/theme cases verify actual clipping bounds and hit-testable French tail text. Programmatic terminal scrolling proves the bounded native scroll box; it is not represented here as independent wheel-input evidence.
- **Diff regression:** real approved writes and exact disk-content checks (`code-diff-scroll.spec.ts:24-41`), real mouse wheel movement (`:53-57`), tail/header viewport checks plus tail hit test (`:58-65`), both themes at 960/1440. No fabricated DOM or injected CSS in the committed test. Header and body remain separate grid tracks for the equal-size case.
- Soft terminal geometry assertions still fail the run; existing localization/replay assertions were not weakened. Earlier negative evidence and coordinator's in-progress rebuilt runs remain separate; no post-fix runtime claim is made here.

## Reviewed SHA-256

```text
2901fa56bc043aaaf6fb9a7fa39215069f791fbe511b2d1b63b19eb0e1d4496a  packages/app/src/kit/styles.css
09fcd77172f157f4d53d14801a7a154107c0ae90dda394366516747e10a04931  tests/e2e/terminal-copy.spec.ts
b9101563601ce47689ac68f019e7f1cbe56ab863b56ef61844fd475c8c059ee8  tests/e2e/code-diff-scroll.spec.ts
```

## Closure review — asymmetric-card P2 resolved

**Bounded source approval. This supersedes the earlier blocking disposition. No additional blocker found in the scoped follow-up.**

- `packages/app/src/kit/styles.css:403-404` reserves the existing 32px header, one 20px code line, 16px padding and 2px borders with `min-height: 70px`. Proportional flex shrink can no longer collapse the short card below its header/body minimum. The internal grid still delegates long-body scrolling to the pre.
- `styles.css:402` adds parent scrolling only when a direct diff exists. If combined card minimums exceed the viewport, cards remain reachable instead of overflowing an inaccessible parent. Terminal-only panes do not match. No new growth rule stretches a short standalone frozen-preview card.
- `tests/e2e/code-diff-scroll.spec.ts:10-13,36-41` now creates one one-line and two 161-line files through real approved writes and verifies exact disk contents. `:53-76` checks every header's containment/hit test, the short line's visibility, real wheel movement for each long body and visible/hit-testable tails. These assert usable geometry rather than merely matching the CSS constant.
- Inspected `asymmetric-baseline.json`: the strengthened test fails on `diff-short.txt` header containment/hit testing; its attached geometry records a 6.515625px card with a 32px header. This establishes the previous defect independently of the correction. The current test covers three mixed cards; larger combined-minimum overflow is source-reviewed only.

Terminal test hash unchanged. No runtime checks, builds, Mac/CI actions, source edits or commits performed; coordinator owns final rebuilt verification.

Closure-reviewed SHA-256:

```text
8f2caecacb1574f931e2113be8bd7cfef039fc0105a776ef5a66bc6e867cd730  packages/app/src/kit/styles.css
09fcd77172f157f4d53d14801a7a154107c0ae90dda394366516747e10a04931  tests/e2e/terminal-copy.spec.ts
e8c0fbad81b573db713031e6c3f769f55f493b08564b48721435479e0f877cd8  tests/e2e/code-diff-scroll.spec.ts
```
