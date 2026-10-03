# Saved local image viewing — in progress

Uncommitted implementation follows application `9ba8e59` / documentary `d390cce`.
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
their corrected sources. Independent image/preview reviews are active.
No Files CI or installed-native acceptance claimed.

Prior Activity proofs retain their own source/build authority. This slice supplies no
standalone file store, remote hydration, physical erasure or other-format support.
