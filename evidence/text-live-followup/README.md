# Saved local text — implementation in progress

The next Files slice wires saved Chat UTF-8 plain text and Markdown source into the
existing `file-code` route. Existing session/history IPC supplies exact records; no
new store, engine route or dependency is introduced. Markdown remains escaped source.

The [contract](contract.md) and [independent contract review](contract-review.md) define
byte/row limits, truthful metadata, draft-preserving Open, source ownership, Copy and
original-byte Download. Earlier image acceptance remains bound to `d20a012` and the
documentary closure `f2c1bc8`; its existing distribution is the negative-test baseline.

Text source and production build are complete; local runtime and preview checks pass
their recorded scopes. Matching text CI and installed-native acceptance remain pending.

Initial checks pass: **295 units plus one optional skip**, lint/types and i18n
(72 files, 2,292 used keys, 3,460 English keys, zero findings). Seventeen decoder cases
join the unchanged eighteen raster cases. [Boundary review](boundary-review.md) approves
the shared byte/name primitives and narrow Chat Open change. [Copy review](copy-review.md)
adds22 keys in each of eight locales, preserving earlier values; native-speaker review
remains outside that source-level check. Executed runtime results follow below.

[Viewer source review](viewer-review.md) approves tuple lifetime and action fencing.
The first image-only-build baseline executes all nine new cases: seven stop at missing
text behavior, two at a collector clipboard snapshot with no available MIME types.
The original source/results remain retained. After filtering empty-format clipboard items,
both rerun cases fail on missing recovery/history reads, completing nine missing-behavior
negatives. The new production build is frozen at524 inputs/482 renderer inputs/90 members;
all **nine text cases plus eleven image regressions pass** against those exact bytes in
84.550 seconds, without retries or skips. Full Electron regression passes **152/152**
with426 registered state visits in1000.318 seconds, one worker, zero retries/skips/flaky
outcomes or runner errors.
Linux package member binding passes; smoke succeeds under
Xvfb. The first smoke invocation omitted DISPLAY and failed before a window; that setup
failure remains retained separately.
[E2E source review](e2e-review.md) approves the corrected test source and preserves its
selective runtime scope. Linux CI now explicitly uses one worker for shared native
clipboard/focus; the unchanged macOS default is also one. Configuration is not a passing run.
[Visual-source review](visual-source-review.md) confirms the supplied light/dark frame,
type and gutter references without expanding the plain-text feature scope.
[Independent preview audit](compare/README.md) accepts13 captures/12 references/one Ask
gap; all25 originals reviewed. Four Code main interiors are pixel-exact to the frozen
reference, six Image content regions to the prior image delivery. Whole-frame residuals
remain recorded; live text has no formal golden in that preview comparison.

[Owner readback at23:23 UTC](owner-readback/REPORT.md) records G2's new VNC/media-decoder
hardening delivery. Its schema reconciliation, G3 successor and exact five-state import
permission remain pending; those remote contracts do not block this local viewer.
