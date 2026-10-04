# Frozen-reference comparison — 5ced8aa source

**431 renders, 410 comparisons, 21 reference gaps.** Mean differing pixels **0.0517%**,
maximum **1.74%** at `chat-states~long-dark`. Pixelmatch threshold 0.15; no acceptance threshold
or global design approval is inferred from these numbers.

## Provenance

- Frozen source `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`:
  106 files; all 410 reference PNG hashes checked. Final capture/coverage/motion-index
  hashes match the owner's `freeze.json`.
- Application source `c0572c874ec5c437aa59a1b24f8ed950ea22415df7be42d3b988b064a0f52d4c`:
  473 renderer-related files, unchanged during capture. All bytes subsequently verified
  against commit `5ced8aa1d2eb04ed3131ffb40c0d360e5706526d`.
- The run started before that commit, at dirty HEAD `08533da`; `provenance.json` preserves
  the original revision field. Source equivalence, not a rewritten manifest, establishes attribution.
- Served asset hashes, per-row timestamps and PNG hashes are retained. Chromium HTTP cache
  was disabled; asset reads drain before navigation. Application console errors fail capture;
  absent preview API transport is recorded separately.
- French, 1440×900, device scale 2. Sequence boards do not establish continuous timing fidelity.

## Retained evidence

[Report](report.json), [capture provenance](provenance.json), [selected comparisons](index.html).
All 431 application states appear in eleven inspected contact sheets. Sixty selected
application/reference/diff PNGs are retained as verified lossless WebP files; `retained.json`
records both hashes. Complete original PNGs remain at
`/tmp/opencode/desktop-compare-7b388e2d9674`; unretained full-resolution images are not committed.

The 21 gaps are 16 additional Settings theme renders and five clicked extras. No historical
image was substituted. Original-reference fidelity, owner approval of other screens and
exhaustive responsive/interaction/localization acceptance remain unproven.

[Independent outlier review](outliers.md) distinguishes intentional demonstration copy,
French spacing, timer/scroll-state differences and three source-proven port defects. Work
preview activity, Code instructions typography and route-dependent sidebar dimming need
their [subsequent corrections](../fidelity-followup/README.md) before parity can be claimed.
Large scalar differences alone are not diagnoses; a later diagnostic reproduces the 20px
long-chat difference through font-metric reflow and browser scroll anchoring on both sides.
