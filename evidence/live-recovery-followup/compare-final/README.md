# Final scoped frozen comparison — 749bc0c

**58 renders, 42 comparisons, 16 explicit Settings reference gaps.** All image/source/asset hashes verified; all 42 percentages independently recomputed. Work Done has **zero image-position offset** in the checked transcript region. This is scoped browser-preview evidence, not threshold-based acceptance.

[Browse every retained frame](index.html). All **142 images** are retained as full-resolution lossless WebPs: 58 app, 42 reference, 42 diff; decoded RGBA equals each original PNG. Three labeled contact sheets cover all 58 app states. Original `report.json` and `provenance.json` are copied byte-for-byte.

## Coverage and scores

| Family | Captures | Comparisons | Gaps |
| --- | ---: | ---: | ---: |
| Bot settings | 8 | 8 | 0 |
| Memory | 6 | 6 | 0 |
| Approvals | 8 | 8 | 0 |
| Code session | 2 | 2 | 0 |
| Work task | 16 | 16 | 0 |
| Settings | 18 | 2 | 16 |
| **Total** | **58** | **42** | **16** |

Mean of rounded comparison percentages: **0.018571428571428572%**. Maximum report value **0.06%**; actual maximum **3,310 pixels / 0.06385030864197531%**, `settings~general-dark`. Pixelmatch's unchanged **0.15** is a per-pixel color threshold, not an acceptance percentage.

| Work Done | Original full-run score | Final mismatched pixels | Final raw percentage | Rounded score |
| --- | ---: | ---: | ---: | ---: |
| Dark | 0.42% | **236** | **0.004552469135802469%** | 0.00% |
| Light | 0.45% | **240** | **0.004629629629629629%** | 0.00% |

For each Done theme, rectangle **`[1110,510,2440,1490]`** contains **1,303,400 byte-identical pixels against the frozen reference without translation**. Earlier frames needed a −2 image-pixel adjustment; these final frames do not. Rounded zero does not mean whole-frame equality. This image-only review did not collect new DOM scroll telemetry; the earlier zero-bottom-gap diagnostic remains separately scoped in `../work-scroll-compare/`.

## Pixel review findings

- **Work Done:** corrected placement retained in the final build; steps, recap and checked transcript pixels align. Small shell residuals remain. No whole-frame waiver.
- **Settings General, both 0.06%:** visible residuals include the additional Providers/Connection navigation and preview-state/shell text. The sampled main-content rectangle `[754,260,2780,1560]` has zero Pixelmatch differences against the prior `f9aca44` renderer capture, in both themes. These are existing integration differences, not a newly demonstrated settings-layout regression.
- **Approvals detail/approved:** invoice/card geometry agrees visually. Residuals include the rationale sentence, mascot pose and shell/state labels. The French fixture at `749bc0c` contains ordinary U+0020 before the rationale colon; frozen `src/screens/lot-travail.tsx:660` uses U+202F. This explains the horizontal rationale-text residual; mascot timing is not synchronized. All detail/approved/denied rounded scores already occurred in the original full run. No approval-list failure, cancellation or pending-mutation behavior is exercised by these preview stills.
- **Bot memory / Memory list:** rows and controls agree visually; checked main-content regions have zero Pixelmatch differences from the prior app capture. This does not verify refused writes, partial deletion, stale-owner races or their recovery interactions.
- **Code session:** transcript/diff layout agrees visually. Both frames round to 0.00%, with **229 dark / 216 light** mismatches; spinner/shell residuals remain. These fixtures do not exercise actual terminal output annotations or live model routing.
- **Work blocked light:** geometry agrees visually; punctuation/colon-space and preview-state labels account for visible localized residuals. No new whole-widget offset observed. Exact causes of every remaining pixel across all rows were not assigned.
- **Settings Providers:** both full-size app frames inspected; they show the provider list, key row and beginning of the model list at 1440×900. **Neither has a frozen reference.** These wide stills do not demonstrate the newly corrected narrow-pane model-badge wrapping. That requires separate responsive/live evidence; no gap filled by an older app image.

No new gross blank/clipped layout detected in the 58-state thumbnail review. Fine visual inspection was scoped as listed below; low percentages alone do not establish parity.

## Exact visual inspection scope

All three contact sheets inspected: `contact-01.jpg`, `contact-02.jpg`, `contact-03.jpg` (**all 58 app states**).

Full-resolution app/reference/diff triplets inspected for:

- `work-task~done-{dark,light}`
- `settings~general-{dark,light}`
- `bot-settings~memory-{dark,light}`
- `memory~list-{dark,light}`
- `approvals~approved-{dark,light}`
- `approvals~list-{dark,light}`
- `code-session-{dark,light}`
- `approvals~detail-light`
- `work-task~blocked-light`

**16 triplets / 48 images**, plus the two full-size `settings~providers-{dark,light}` app frames: **50 full-resolution images**. All 142 originals were hash/dimension-verified and retained losslessly; all 42 comparison scores were recomputed. The other images were not individually full-resolution visually reviewed.

## Provenance verified

| Item | Exact pin |
| --- | --- |
| Application revision | `749bc0c035391d72aeafb4b5ce39cc0aa5342830` |
| Application fingerprint, **473 files**, recomputed from commit and matching working tree | `9ba9fd691b7f6757aaefdfe242d62e06e5e0b49f29ae039769e6ec025144346b` |
| Original/retained report SHA-256 | `56618b15b89ab081e3db2138e1b611c6fc66464ff0f46f39ae17fb1923c78f38` |
| Original/retained provenance SHA-256 | `a4f561c8e45c93583593a9e855c8c55e2074bc06ebc28d543a17f64733df817c` |
| Frozen source, **106 files** | `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768` |
| Comparator SHA-256 | `838bbacffef18907c15505745189b4ecd18590e71cc99256f93a8e50835eadc6` |
| **29 served assets**, ledger fingerprint; bytes re-fetched and checked | `800d2cd6fbf288ae35ddf8190930794e1a43d5e688657828576c636aa1fcbf91` |
| Served `/assets/index-BiiO_bNG.js` | `55fc5c789823fd4464323874e009f47fb7882737124db1c2cca9b0e8b92786a7` |
| Served `/assets/index-Bo4UCD38.css` | `66b5535728e44c658157393b4350e21624c56597d27ed3a5887aaf6b50a2fca5` |

Original run: `/tmp/opencode/live-recovery-final-compare`, ID `2026-10-03T02-07-00-529Z-CfuM6e`, completed `2026-10-03T02:09:58.105Z`. All **142 PNG hashes, byte sizes and 2880×1800 dimensions** checked. Frozen metadata hashes and all **410 frozen PNG hashes** checked; the 42 copied references match their manifest records. No original files changed.

`verification.json` records checks; `pixel-verification.json` records all exact counts and selected regional checks. `retained.json` binds every lossless WebP to its original PNG hash and records contact-sheet hashes. Lossless image payload is **53,422,946 bytes**. Source hashes and served-asset hashes remain separate provenance facts, not a build-to-source attestation.

## Gaps and limits

The **16 gaps** are eight extra Settings sections, each dark/light: `appearance`, **`providers`**, `connection`, `bot`, `notifications`, `privacy`, `shortcuts`, `account`. No substitute reference or comparison score assigned.

French catalog, `fr-FR`, 1440×900 CSS viewport, scale 2. Browser Date **`2026-10-02T12:09:00.000Z`**, timezone **UTC**, timers **real**. Original frozen browser timezone/Date at mount remains unattested. Fixed Date does not synchronize animation, mascot pose, font load or elapsed timers. **263 preview API transport failures** remain separately retained in original provenance; stills prove no live-engine availability.

The earlier `f9aca44` renderer full run remains **431 renders / 410 comparisons / 21 gaps**, with its original images, scores and clock qualifications. This six-family run does not replace it, recalculate its mean or close unrelated residuals/reference gaps.

This reviewer authored the Work readiness correction: the numeric evidence review is valid, but it is **not independent Work-source approval**. Independent source review belongs to the separately recorded reviewer. No source changes, recaptures, builds, Mac, CI checks or commits performed here. Native chrome, pending memory/permission actions, responsive minima, eight-locale coverage, motion and release acceptance remain outside this comparison.

## Reproducible checks

From repository root, `node evidence/live-recovery-followup/compare-final/verify-pixels.mjs` recomputes the 42 scores and Work regions from original PNGs. `retain.py` documents the source/image/asset verification and exact-RGBA retention operation; rerunning it requires the original directory, matching served build and Pillow. No capture command is run by either script.
