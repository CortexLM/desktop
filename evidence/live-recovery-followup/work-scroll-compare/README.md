# Cortex Work Done — scoped post-fix pixel verification

**Both captured Done themes settle at the exact bottom. The previously displaced transcript region now matches the frozen reference byte-for-byte without translation.** This is numerical post-fix evidence, not independent approval of this executor's source change or whole-app acceptance.

## Results

| State | Historical raw score | New mismatched pixels | New raw percentage | Two-decimal score | Bottom gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| `work-task~done-dark` | 0.42% | **13** | **0.0002507716049382716%** | 0.00% | **0 CSS px** |
| `work-task~done-light` | 0.45% | **235** | **0.004533179012345679%** | 0.00% | **0 CSS px** |

Pixelmatch color threshold remains **0.15**. Rounded 0.00% does **not** mean pixel-identical frames; no residual waiver or acceptance threshold added.

Both themes, before and after screenshot:

- `scrollTop = 392`, `scrollHeight = 1051`, `clientHeight = 659`.
- `document.fonts.status = "loaded"`.
- Thread inner top **−258 CSS px**, steps top **275**, recap top **563**; composer top **797**. These agree with the settled frozen geometry measured in the earlier bounded diagnostic.
- Unshifted image rectangle **`[1110,510,2440,1490]`**: **1,303,400 byte-identical pixels** per theme; zero exact differences and zero Pixelmatch mismatches. This is the same region that previously needed a −2 image-pixel translation.

All six full-resolution app/reference/diff PNGs inspected. Transcript/card/composer alignment is visually consistent; remaining colored diff pixels lie outside the checked transcript region. Dark's thirteen threshold mismatches sit in the sidebar mascot bounds `[238,395,266,409]`. Light retains small shell/title/navigation/progress-label differences; their precise causes were not re-investigated. No whole-frame exact-parity claim.

## Capture scope and method

- **Two navigations, two app frames, two frozen reference copies, two diff images**: six PNGs, **2880×1800**, two comparisons, zero gaps within this two-state scope.
- Existing `http://127.0.0.1:5309/`, no build or server modification. Captured **2026-10-03T01:45:54.756Z–01:46:03.100Z**.
- Browser viewport **1440×900**, scale **2**, `fr-FR` / French catalog. Date **`2026-10-02T12:09:00.000Z`**, **UTC**, timers **real**. Normal font-ready/image-ready wait plus 1100ms settle; no forced scroll, font hold, CSS mutation or normalized screenshot.
- Scoped manual capture `capture.mjs` uses the repository comparator's unchanged `readReference` and `trackAssets` helpers. It checks only the accepted Work source and the assets actually served; it does not run or disable the full comparator's working-tree fingerprint guard. Concurrent integration therefore cannot masquerade as a source-attested build.
- Frozen root: `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674`. Its 106-file source fingerprint, manifest, metadata and 410 reference-image hashes verified before/after. Captured references are exactly `work-task~termine-dark.png` and `work-task~termine-light.png` from that manifest.
- All six new PNG hashes, byte sizes and dimensions rechecked. The six corresponding historical PNG hashes also rechecked unchanged.

## Provenance pins

| Item | SHA-256 |
| --- | --- |
| Accepted `packages/app/src/screens/work/home.tsx`, checked before/after; snapshot retained | `f20599c58871783afba2024f88aa8902b2e9f355baeb6af35f2a473a70e056d6` |
| Served `/assets/index-C_HRHk6M.js` | `6422ab129f0223ba155a7b18c616a9e2b266b33a0895f205f186a3abc1e7dc41` |
| Served `/assets/index-Bo4UCD38.css` | `66b5535728e44c658157393b4350e21624c56597d27ed3a5887aaf6b50a2fca5` |
| **19 served assets**, ledger fingerprint; all bytes re-fetched/rechecked after capture | `a98dce1277e2c85cd916da4815a85bdfccee4dd404f82da863bf46895a0d01aa` |
| Frozen source | `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768` |
| New `report.json` | `ee8d46f39b3c904b39b39ff97fb750c1fa5088ab762926cb356ff3be6d51e223` |
| New `provenance.json` | `d6327879f10eac6706a0751db8e9391242005db69a57781ab81041b4942ac425` |
| Original full-run report, preserved | `75451933436da845d7b57b06be97e6341a5019f8ac63c34a9860fcb24376414c` |

All per-image hashes and reference manifest records are in `report.json`; the 19 asset hashes/sizes are in `provenance.json`. Work source hash stability is established. No initial-build source manifest was used; current whole-tree source equivalence or source-to-build attestation is **not** claimed. The repository HEAD was still `6d96535`, but this served integrated renderer differs from that commit. Per coordinator, this build predates the ongoing memory-race/permission-status follow-up.

Eight absent-preview-API transport errors retained separately; no other page/console errors recorded. These preview results do not imply live API availability.

## Retained artifacts and limits

Directory: `/tmp/opencode/work-scroll-corrected-compare/`.

- `work-task~done-dark.{app,design,diff}.png`
- `work-task~done-light.{app,design,diff}.png`
- `report.json`, `provenance.json`, `verification.json`
- `capture.mjs`, `capture.log`, `work-home-source.tsx`

Original `/tmp/opencode/current-full-compare-6d96535` report/images and `/tmp/opencode/current-full-comparison-review.md` remain unchanged, including their historical negative scores and scheduling qualifications. The original **431 renders / 410 comparisons / 21 gaps** are not replaced by this two-state result.

This evidence covers two settled browser-preview states only. Fixed Date/UTC does not attest the frozen browser's original timezone/mount time or synchronize timers. Native behavior, cancellation interactions, other Work variants, other integration scopes, motion, release acceptance and independent source review remain outside this capture. No production changes, builds, Mac or CI work performed in this pass.
