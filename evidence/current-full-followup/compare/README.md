# Full fixed-clock frozen comparison — 6d96535

**431 renders, 410 comparisons, 21 explicit reference gaps.** Mean of rounded
per-image differences **0.0379%**, maximum **1.73%** at `chat-states~long-dark`.
Pixelmatch's 0.15 color threshold is unchanged; no acceptance threshold is applied.

- Application revision `6d965358bb5e02473df6be7e97ecfdb07650c0b8`, renderer fingerprint
  `5f709c11d836948142b65c5c2b4fe0582bddbfc19f76dbe15cf6d2146a6bcf0f`, 473 files.
  Application inputs equal `f9aca44`; source hashes remained stable throughout capture.
- Immutable reference `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`:
  all source/manifest/410 image hashes verified before and after capture.
- French, 1440×900, device scale 2; browser Date `2026-10-02T12:09:00Z`, UTC, real timers.
  The original reference's timezone/mount time is unattested. This explicit caller clock
  does not replace that missing metadata or erase earlier ambient-clock outliers.
- 21 gaps: sixteen extra Settings theme renders, five clicked extras. None is substituted
  with an older reference image.
- `report.json` and `provenance.json` retain all hashes, timestamps, clock policy and served
  asset receipts. Original PNGs: `/tmp/opencode/current-full-compare-6d96535`.
  `retained.json` binds [selected lossless triplets](index.html); eleven contact sheets
  include all 431 app renders. Lossless conversions are RGBA-verified.

Largest residuals: long Chat 1.73%; Components 1.20% both themes; uploading dark 0.48%;
Work Done 0.45% light / 0.42% dark. Source/pixel review identifies the intentional Components
demonstration notice and unmatched upload timer samples. The exact historical scheduling
behind the long-Chat capture offset remains unproven.
The separate earlier [six-navigation Long Chat diagnostic](../../fidelity-followup/long-scroll.md)
does reproduce a 20px font/anchoring mechanism on both implementations; its unrecorded historical
capture scheduling remains explicitly unresolved. That receipt is distinct from the current review.
[Independent current-run review](review/README.md) verifies all 1,251 original PNG hashes,
410 references, 35 served assets and 60 retained lossless images; inspects all 431 thumbnails
and eighteen full-resolution triplets. Six bounded DOM navigations causally reproduce Work's
1 CSS-pixel gap: initial scrolling precedes font readiness, then scroll anchoring leaves the
position at 391px instead of the settled 392px bottom. The diagnostic establishes a current
mechanism, not the exact scheduling of historical PNGs. A scoped readiness correction is
being implemented separately; original residuals remain unwaived.

This is settled browser-preview evidence. Native rendering, all live interactions, continuous
motion, missing product routes and complete minimum-window/localization acceptance remain
separate requirements.
