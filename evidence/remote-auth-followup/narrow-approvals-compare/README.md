# Narrow approval descriptions — wide-reference preservation

**Scoped review passes: 8 renders / 8 frozen comparisons / 0 gaps. All eight wide
application PNGs are byte-for-byte identical to the previous full comparison.**
The narrow correction introduces no wide layout/pixel change in these states.
This preserves the incumbent wide design, including its joined title/description text;
it is not a claim that every existing presentation detail is ideal.

[Browse all app/reference/diff images](index.html). All 24 originals were verified for
SHA-256, byte size and 2880×1800 dimensions, then retained as exact-RGBA lossless WebPs
(**7,987,904 bytes**). All eight triplets were inspected full size; the contact sheet
also covers all states. Original `report.json` and `provenance.json` are unchanged.

## Exact pixels

| Code Settings state | Dark pixels / rounded % | Light pixels / rounded % |
| --- | ---: | ---: |
| Repositories | 227 / 0.00% | 243 / 0.00% |
| Instructions | 855 / 0.02% | 866 / 0.02% |
| Approvals | 2257 / 0.04% | **2444 / 0.05%** |
| Usage | 238 / 0.00% | 269 / 0.01% |

Maximum raw difference: **0.04714506172839506%**, Approvals light. All eight scores
and decoded diff-image buffers were independently recomputed with the comparator's
unchanged Pixelmatch color threshold **0.15**. No percentage acceptance threshold
was introduced. Rounded **0.00% does not mean zero mismatches** against the design.

[Pixel verification](pixel-verification.json) proves **zero exact and threshold pixel
differences over the entire image** versus each matching application PNG from
`/tmp/opencode/current-full-compare-6d96535`, run `2026-10-03T00-32-36-779Z-Na13cV`.
That source-bound full run used renderer inputs matching f9aca44. Its report and all
eight selected app hashes were verified; [binding](followup-binding.json) records them.

At 1440×900 CSS viewport / 1360×840 inset application frame, both default-row regions
**`[1368,364,2658,564]`** (image coordinates, **258,000 pixels each**) are byte-identical
to **both the prior app and frozen reference**, dark/light. The rectangle includes both
titles/descriptions, model selector and notification switch. See
[approval-region.json](approval-region.json). No translation or tolerance is used.

Visible frozen residuals are inherited: shell/state labels/back control; the Instructions
colon/continuation line; Approvals' repository-automation explanation near the semicolon.
The defaults card itself is exact. No new blank, clipping or control displacement was
found in the eight wide states. Existing joined wide descriptions remain intentionally
unchanged; only the narrow media-query layout stacks them.

## Separate narrow regression reports

The worker/coordinator's existing Electron reports were audited, **not rerun here**:

- Baseline: **4 intended failures**, 960×640 and 1024×686 × light/dark, zero retries.
  At 960 both descriptions failed below-title/text-box fit; the model description also
  overlapped its control. At 1024 both descriptions failed below-title only. All reported
  failures are those geometry assertions; no keyboard-focus/reachability failure appears.
- Rebuilt: **4 passes**, same sizes/themes, zero retries/skips/flaky cases, no runner/test
  errors. Every decoded row reports `belowTitle`, `fitsTextBox`, `clearOfControl` true.
- The test checks exact row text/count, text-range containment, then real Tab traversal
  from Usage to model selector and notification switch with viewport/trial-click checks.
  It uses English preview fixtures, reduced motion and the real Electron renderer.
- Four negative screenshots were opened full size and retained. **The fixed report has
  no screenshot attachments**: the baseline test attached images only on failure. The
  currently inspected test differs solely by making that attachment unconditional;
  geometry/keyboard assertions are unchanged. No fixed-run source snapshot is retained,
  so this audit does not attest its exact source bytes or invent positive screenshots.

[Responsive results](responsive-results.json) retain report hashes, every case outcome,
exact errors and decoded geometry. [Baseline provenance](responsive-baseline-provenance.json)
pins original source/dist/test. Baseline source extracted from its trace matches the
recorded test hash. [Follow-up binding](followup-binding.json) records the later
screenshot-only test difference. Normalized logs preserve original and normalized hashes
in [log-binding.json](log-binding.json); original raw files remain in the worker cache.

## Captured source and assets

| Item | Verified pin |
| --- | --- |
| Capture HEAD context | `ffc118a2e58df66f430f3078e00f6e931dd910cf` plus two uncommitted approval files |
| Recorded/reconstructed source, 473 files | `71772215cd57c34f683d85aa748e6039af25a187249d50863bc97bf3ff362ccd` |
| Captured `bun.lock` | `8f5b7dcfbf8e7d3a82f8dfc2b9b8327498fd474836cd34c13bc629b456791d8b` |
| Report SHA-256 | `b621a712437b5a6a0b00db185baa0a51a47aea40665592f20e60024db4fcdfb2` |
| Provenance SHA-256 | `ff19f3e677b536ebdb0447be1cf33d20dbcc0b8ac1813a14f04e67a760023560` |
| Comparator SHA-256 | `838bbacffef18907c15505745189b4ecd18590e71cc99256f93a8e50835eadc6` |
| Served ledger, 15 assets re-fetched and verified | `97caab987cdba834c05f3f8cdb21489e1b4ac636ebd326dcc58fe7cfa5c79682` |

The source fingerprint was recomputed from **ffc118a Git blobs plus exactly
`packages/app/src/screens/code/lot-code.css` and `lot-code.tsx`** as captured. It matches
the recorded fingerprint. The snapshot adds a class to the first approval list and two
rules inside the existing `max-width: 1200px` query. All other 471 inputs are committed
ffc118a bytes, including its **SDK 0.3.1** lock. The later SDK 0.3.5 intake changed
`bun.lock`; this receipt does not claim today's root fingerprint or new SDK acceptance.

[Source manifest](source-manifest.json), [lossless source delta](source-delta.patch.gz)
and [verification](verification.json) preserve that distinction. Frozen source fingerprint
`7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`, all 106 source
files, capture metadata and all 410 manifest PNG hashes were verified. Served-byte and
source fingerprints remain separate evidence, not a build reproducibility attestation.

Run `2026-10-03T04-28-22-568Z-V7ezEi`, completed `2026-10-03T04:28:49.511Z`.
French, 1440×900 @2x; fixed Date `2026-10-02T12:09:00.000Z`, UTC, real timers.
The previous controlled full run uses the same clock policy; the original reference's
mount Date/timezone remains unattested. **16 preview API transport failures** remain
recorded separately. Browser-preview stills prove no native chrome, live approval
configuration, authenticated backend, motion or complete responsive/localization coverage.

Original capture: `/tmp/opencode/narrow-approvals-compare/`; original regression reports:
`/tmp/opencode/narrow-approvals-fix/`; audit scripts: `/tmp/opencode/narrow-review/`.
Only this receipt and the audit scratch directory were written. No source change,
application test, build, recapture, CI/native operation or commit was performed.
