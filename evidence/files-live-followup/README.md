# Saved local image viewing — scoped delivery

Application `d20a012fbb774aa9b348fe1913f85d3476430098` is pushed;
[CI 37153526225](https://github.com/CortexLM/desktop/actions/runs/37153526225) passes all three jobs.
Documentary closure `f2c1bc8` preserves all 520 application inputs and passes
[CI 37160709132](https://github.com/CortexLM/desktop/actions/runs/37160709132).
[Later commit binding](production/application-pin.json) verifies all 520 tested inputs;
original dirty-base `d390cce` execution receipts remain unchanged.
The existing Files image route reads saved local Chat attachments, using existing IPC,
strict static-raster preflight and native decoding. Exact-ID Open protects Chat drafts;
zoom/Fit/download operate on actual image bytes. [Contract](contract.md),
[independent corrections](contract-review.md), [source assessment](source-assessment.md).

Eight new Electron cases fail against the unchanged 90-member `9ba8e59` production
distribution in 53.744 seconds. Original test `e28ddaec…` and per-case reports remain in
`baseline/`. Failures stop at missing Open/live-view/read/decode or unsafe-thumbnail
refusal; later lifecycle/race/download assertions were not reached.

Initial rebuilt target: six passes/two collector failures. The supposed corrupt PNG
decodes successfully in Chromium; an independent probe supplies a structurally admissible
30-byte WebP that genuinely fails native decode. The no-model setup incorrectly expected
provider PATCH to publish a refresh event; reload now occurs before entering the new draft.
Original failed results remain retained. Pan and restarted-provider assertions are stronger.

Independent review found three application regressions, reproduced before their fixes:
pending rename re-entry, same-tuple owner replacement on shell changes and an unbounded
filename header hiding the image. Minimal guards/memoization/scroll bounds correct them.
A separate source review removes quadratic unbounded filename suffix matching; its
200,000-space regression joins the existing eighteen raster unit cases.

The corrected **eleven Electron cases pass**, including real downloaded-byte equality,
provider-disabled restart, dirty/read/refused/submitting draft preservation, stale owners,
both-theme 5,000-character filename access and eight-locale metadata geometry. Lint/types/
i18n, **278 units plus one optional skip**, and Linux package/smoke pass. Current build:
520 inputs, 90 members, renderer `087587293bfb7c2ccf85176cece73982ae75db48318e1c381270caa5196a0d73`.
Full regression passes **143 cases / 426 render visits**, zero retries/skips/flaky outcomes,
in 303.294 seconds. It executes the final eleven-case test source (`a7bd52db…`).
Final [test-source review](e2e-accepted.md), [viewer review](viewer-accepted.md),
[Chat guard review](chat-accepted.md) and [raster review](raster-accepted.md) approve
their corrected sources. [Independent local image review](electron-local/README.md)
accepts 195 candidate and 21 historical images, including 14 primary Files full-size views
and 13 failure originals. [Frozen preview review](compare/README.md) accepts eight
comparisons with one explicit Ask gap; uploaded/selected Chat previews are outside that run.
The matching [Mac package](../mac/d20a012/package-review.md) is independently admitted:
91 ASAR files/92 blocks, 90 members, 520 inputs; Mac/Linux ASAR bytes match.
[CI image review](ci-d20a012/README.md) accepts 391 images/28 primary full-size Files views:
143 cases/426 visits per OS, 278 units plus one optional skip. Sixteen Memory and sixteen
auth-locale frames match Activity exactly; other image drift retains measured bounds.
Installed-native evidence retains a separate [Save diagnostic](../mac/d20a012/save-diagnostic/README.md), which
records real dialog behavior, a failed cancellation assumption and explicit recovery.
The subsequent [first bounded native run](../mac/d20a012/initial-native/README.md) fails
before capture on a one-pixel filename Range overrun; nine cleanup checks pass. A
[pixel diagnostic](../mac/d20a012/filename-diagnostic/README.md) finds byte-identical
normal/unclipped originals, resolving that exact measurement concern without an app change.
The [corrected collector](../mac/d20a012/native/README.md) records four passing native
Fit/zoom captures, then fails in its AppleScript Save step. A
[manual native supplement](../mac/d20a012/manual-download/README.md) completes that pending
download with all393 original bytes and metadata. Failed automation/unreached assertions
remain explicit. Device restored and released. [Independent native review](../mac/d20a012/native-audit/README.md)
accepts the bounded composite: four native views plus the original-byte manual supplement.
The manual GUI sequence is coordinator-attested; no durable Save-dialog image or
fully successful automated collector is claimed.

[External readback at 21:28:51 UTC](owner-readback/REPORT.md) finds no new backend/SDK
handoff or exact five-state import permission. Those gates do not block this local slice.
[Documentary review](documentary-review.md) verifies these scoped claims and current links;
its recorded source pins precede the final native-composite disposition.
The [committed-closure review](committed-closure-review.md) found two stale status entries:
the overview wording is corrected; the native composite summary is explicitly retained
as a pre-review snapshot, with final acceptance in its independent audit.

Prior Activity proofs retain their own source/build authority. This slice supplies no
standalone file store, remote hydration, physical erasure or other-format support.
