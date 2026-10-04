# Projects wrapping — bounded source review
**APPROVE four-rule correction: ready for correction CI. No blocking source finding.**
Base: `8e3fd795b699c8ff07357544421d00f34dc2823c`; follow-up remains uncommitted in this review.
Read-only review; only this report written. No build, test, network or Mac execution.

## Correction
- Production: four CSS rule changes, exactly `+4/-2` across two files; tests separately add43 lines/two cases.
- `system.css:111`: `overflow-wrap:anywhere` fixes unbroken Project card names/headings/instructions; existing `white-space:pre-wrap` remains.
- `system.css:131`: preview text `flex:1; min-width:0; overflow-wrap:anywhere` resolves the flex minimum-content overflow.
- `kit/styles.css:291`: `.card .body2` inherits wrapping into Library titles/descriptions; Library is its current source consumer, including previews.
- Fourth rule, `kit/styles.css:267`: existing `.toast .t-body` gains `min-width:0; overflow-wrap:anywhere`; text can shrink/wrap inside the fixed-width flex toast instead of escaping right.
- No JS, copy, schemas, input limits, truncation, hiding or new UI. Empty strings, missing/error states and typed contracts are unchanged.
- Long Library text may grow vertically inside existing `.page` scrolling. No measured tile-shrink defect justifies extra `flex-shrink:0`.
- Short-text preview pixels remain unverified; existing font/animation/gradient detector warnings are outside these wrapping-only changes and warrant no automatic edits.

## Retained regression evidence
- Original baseline: two failed theme cases, eight errors, no retries/flakes. Both use real960×640 Electron creation with accepted48/4000-character inputs.
- Per theme: preview588/436px, heading910/348px, overview instructions44880/491px; Instructions48620/506px. Three soft failures plus one hard capture failure.
- First three-rule correction (`targeted.json`): three existing cases pass; both long-input cases still fail only hard capture overflow at31/396. Earlier Project fit assertions now pass.
- Inspected light failure PNG: Project text wraps; the48-W “Project created” toast description visibly escapes its right edge. Fourth rule addresses that retained defect directly.
- Both retained runs stop at capture396 before grid/Library399/402. Separate scratch measurements are not attributed to these runs.
- Current test matches archived baseline bytes and recorded SHA; existing363-line prefix—including hard capture overflow polarity/negative tests/cleanup—remains identical to8e3.
- `expect.soft` still fails tests; no catch, inversion, default-overflow weakening or assertion removal. Font-ready internal-width and viewport checks plus API integrity are meaningful regressions.
- Combined selectors establish horizontal containment, not every text node's presence or complete vertical readability; current text/API assertions complement that bounded claim.
- Four-rule runtime, five Project cases, expected118-case suite, native confirmation and short-text pixel acceptance remain coordinator-owned; no final-run result claimed.
- Keep original8e3 package/proofs and failed attempts intact; follow-up receipts/commit stay separate. G2/G3 remain external.

## SHA-256 (reviewed bytes; evidence paths below relative to `/tmp/opencode/projects-wrap/`)
- `packages/app/src/screens/system/system.css`: `f82f52986d0148715b3b596afde15018852a9e4821dac918237e249fb2f8ecbd`
- Current `packages/app/src/kit/styles.css` (four rules): `1f728575e54ab195b0efa61c80043b5300264c98ff0210934c475f183c893be1`; earlier three-rule bytes: `f2e79e57e1a8a6d7c31ed49085048b4e896f64b53bf2a0bc8f9b4a564b9700e6`
- `tests/e2e/projects.spec.ts` = archived `projects.spec.ts`: `899a1ae786d68645117d4bd0c9d6d1be413850a3b5bc3f2ab195f9abe319eef3`
- `baseline.json`: `7677801020cd18e9b5f9dab336d15e54f7aed4d663a7546f783895d40a6a0fce`; `baseline.log`: `bdb2fcfba78cb44adadbc1ede56db840e9c8cb5033186c70725fc46d6b34c6f7`
- `targeted.json`: `9983b5ec2d0595b8317e08ac3d9fffd55342e93320b95717a9902fc7ee1793c5`; `targeted.log`: `6ae895dbc5f1a9f21c9acdc0f4cd921a91a74d570994dca9bc2e1f0b72423f1c`
- `targeted-artifacts/projects-Projects-keep-acc-04d25-ble-at-minimum-size-—-light/test-failed-1.png`: `8ab50b51bc3ab3ff77c67f0b9b8429b2ba9cdad55daf620f94057340513d3deb`
- `test-source.json`: `69d6ddf4efe0fcfd017a631ada8fabeb169bdf3ddb85a19a74cac9220d8bf303`
