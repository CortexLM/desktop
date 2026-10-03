# Cortex full frozen comparison — independent review

Retained original review. Its Long Chat discussion is bounded to the sources/receipts it
inspected. The earlier `evidence/fidelity-followup/long-scroll.md` separately proves a 20px
font/anchoring mechanism on both implementations while preserving unknown historical capture
scheduling; the coordinator's parent README links both scopes. New Work correction work is
outside the original run and this review.

**Provenance verified. Earlier Code typography, Work sidebar activity and sidebar dimming corrections are present. Work's remaining 1 CSS-pixel displacement is reproducible font-loading/scroll-anchoring behavior; long Chat's 20 CSS-pixel displacement remains qualified. No parity verdict, residual waiver or new acceptance threshold.**

## Verified scope

- Original run: `/tmp/opencode/current-full-compare-6d96535`, run `2026-10-03T00-32-36-779Z-Na13cV`; captures `2026-10-03T00:32:39.658Z`–`00:55:28.711Z`.
- **431 renders: 426 registered theme/state renders + five optional interactions; 410 comparisons, 21 reference gaps.** Mean of rounded per-row percentages **0.037853658536585365%**; maximum **1.73%**, `chat-states~long-dark`.
- French, 1440×900 CSS viewport, scale 2; every original PNG verified as **2880×1800**. Pixelmatch `0.15` is a per-pixel color threshold, not an acceptance percentage.
- Report SHA-256: `75451933436da845d7b57b06be97e6341a5019f8ac63c34a9860fcb24376414c`; provenance SHA-256: `b398fb276074ef9eea8b939c5c48e4435c8e446fdfef8812b1a91f680de8c145`.
- Independently verified hashes, byte lengths and dimensions of **all 1,251 original PNGs**: 431 app, 410 copied design, 410 diff. All 410 copied references match the immutable manifest and original frozen PNGs; all manifest states are used exactly once. Row/run clock policies agree; no duplicate names.
- Independently recomputed all **473 application source-file hashes** from **both** `6d965358bb5e02473df6be7e97ecfdb07650c0b8` and `f9aca44`: fingerprint `5f709c11d836948142b65c5c2b4fe0582bddbfc19f76dbe15cf6d2146a6bcf0f`. Source findings below use that pin, excluding concurrent corrections.
- Independently recomputed the immutable freeze's **106 `src/` files**: `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`. Freeze, manifest, registry, coverage and motion-index hashes match provenance. No current design-owner source used.
- Pinned comparator hash verified: `838bbacffef18907c15505745189b4ecd18590e71cc99256f93a8e50835eadc6`. Independently recomputed its served-asset ledger fingerprint; fetched all **35 recorded assets** from the existing `http://127.0.0.1:5309/`, verifying hashes and sizes before diagnosis. Ledger fingerprint: `47d652c68f8313e58716da0336c5ef812047807f0fa539d233ef7338af21dbd1`. Source equivalence and served-byte identity remain separate facts, not build-to-source attestation.
- Recomputed original whole-frame Pixelmatch percentages for **16 selected states**; all agree with the report. Remaining 394 percentages were not independently rescored; their report/image hashes were checked.
- Inspected **all eleven** `evidence/current-full-followup/compare/contact-01.jpg`–`contact-11.jpg`: all 431 app thumbnails reviewed for gross blank/missing/clipped layouts. This thumbnail pass cannot establish fine typography or every control's correctness.
- Retained `report.json`/`provenance.json` are byte-identical to originals. All **60 selected WebPs** match retention hashes and their source PNG's decoded RGBA exactly. Contact-sheet hashes recorded separately.

## Findings and disposition

### 1. Work Done: remaining initial-scroll readiness defect, not card spacing

`work-task~done-dark` **0.42%**; light **0.45%**. Original app transcript is **1 CSS px lower**. Translating only the checked transcript region by two image pixels makes **1,303,400 pixels byte-identical per theme**. Card contents, heights and spacing within that region agree.

New bounded DOM-only diagnostic reproduced the offset in both themes using the verified app server and the existing immutable-freeze server at `http://127.0.0.1:5198/` (process root verified as the freeze). Six navigations total: app/freeze in both themes, plus two app anchoring controls. No screenshot recapture, source write, build or server change.

| App phase | `scrollTop` | `scrollHeight` | `clientHeight` |
| --- | ---: | ---: | ---: |
| Initial programmatic bottom scroll; fonts loading | 409 | 1068 | 659 |
| Fonts loaded; default `overflow-anchor: auto` | **391** | 1051 | 659 |
| Settled bottom, explicit diagnostic re-scroll | **392** | 1051 | 659 |
| Separate load; diagnostic `overflow-anchor: none` | **392** | 1051 | 659 |

The default anchor adjustment subtracts 18px when content height shrinks 17px, leaving a 1px bottom gap. Disabling anchoring in the isolated diagnostic prevents it. Explicitly re-scrolling after fonts settle makes all sampled app/freeze rectangles, scroll metrics, selected computed styles and text samples agree in both themes. The transcript viewport, composer and dock already agree before re-scrolling.

**Proven mechanism in the reproduced run:** initial bottom scrolling precedes font readiness; browser scroll anchoring leaves the final viewport one pixel short. Source: pinned `packages/app/src/screens/work/home.tsx:282–285`; frozen `src/screens/lot-travail.tsx:266–269`. Both request a mount/state-change bottom scroll without waiting for fonts.

**Historical qualification:** original PNGs carry no scroll/font-event telemetry. These logs reproduce and causally isolate the current offset; they do not retroactively prove every historical scheduling detail. The existing frozen development server also executed repeated mount scrolling; its timing is not attestation of the original frozen capture environment.

**Action:** make the intended initial auto-bottom position stable after font/layout readiness, scoped to that initial state and cancelled on navigation/user scrolling. Verify cold-font and warm-font paths. No card-margin correction justified. The current 0.42%/0.45% residual stays recorded and unwaived; the temporary `overflow-anchor` control is diagnostic evidence, not a proposed global CSS policy.

### 2. Long Chat: 20px offset reproduced in original pixels; exact trigger still unresolved

`chat-states~long-dark` **1.73%**; light **0.01%**. Dark app transcript sits **20 CSS px above** the reference. Header, composer and floating bottom control align. After a 40-image-pixel translation, the checked transcript region has **zero Pixelmatch mismatches** at the existing color threshold; **16,486 exact pixel differences remain**.

Both sources initialize `scrollTop = 260` in a mount-only layout effect: pinned `screens/chat/states.tsx:326`; frozen `screens/lot-chat.tsx:523`. Neither waits for fonts. Font reflow/scroll anchoring remain plausible; the Work reproduction does **not** prove this distinct Chat cause. Preserve the historical qualified diagnosis in `evidence/compare-7b388e2d9674/outliers.md`.

Documentation integration: `evidence/current-full-followup/compare/README.md:23–24` currently says earlier diagnostics “identify” the long-Chat font/scroll-anchoring difference. Keep that cause explicitly **plausible/unproven**, rather than promoting the historical hypothesis to a proven cause.

**Action:** a matched, settled-scroll diagnostic is still needed before assigning a Chat product fix. No 20px spacing compensation or parity claim supported.

### 3. Components: intentional demonstration notice and integration copy

Both themes **1.20%**. The honest-preview notice adds **24 CSS px** before the contents/catalog: `.cmp-demo-note` has 8px top margin and 16px line-height (`screens/system/components.css:103`, `components.tsx:188`). A checked titlebar-card interior is **180,000 byte-identical pixels per theme** after translating by 48 image pixels.

Visible accompanying differences are the removed supplier attribution, truthful source location and demonstration-navigation wording. These are intentional preview/integration copy. No missing catalog block or additional geometry defect established by this pair. Their recorded pixel residual is not removed from the score.

### 4. Upload: unmatched real-timer samples

`upload~uploading-dark` **0.48%**: app has **3/5 ready**, presentation complete, document **78%**, image **24%**; frozen has **2/5 ready**, presentation **94%**, document **64%**, image **18%**. Identical seeds and `pct + 3 + (id % 5)` every 160ms explain an app lead of **two ticks / nominally 320ms**. Crossing 100% changes presentation-row content and subsequent row placement.

Light **0.11%**: app document **71%**, image **21%**, presentation **99%**; frozen **64%**, **18%**, **94%**: **one tick / nominally 160ms**. Additional localized percent/size spacing remains.

Sources: pinned `screens/files/docs.tsx:588–600`, French files fixture; frozen `screens/lot-fichiers.tsx:630–660`. Fixed `Date` leaves timers real. No upload algorithm/layout defect established. For closer future comparison, match progress states explicitly; retain these original frames.

### 5. Spreadsheet: locale currency spacing, not shifted grid geometry

`file-xlsx~range` / `~chart`: **0.17% dark / 0.18% light**. Inspected triplets show differences concentrated in currency digits and the aggregate footer. Grid borders, selection extent, chart geometry and values agree visually.

Pinned `screens/files/shared.tsx:55` uses locale-aware currency formatting. French output contains **U+00A0 before `€`**; frozen `screens/lot-fichiers.tsx:499` explicitly joins with **U+202F**. Since values align right, the wider separator moves the digits left. Independent string checks confirm the separator difference for 0, 300, 7800, −550 and 72520. The footer also replaces ordinary spaces before colons with French narrow no-break spaces (`locales/fr/files.json:166`).

This is a source-explained localization/typographic-policy difference, not missing cells, incorrect totals or a demonstrated column-width defect. Exact typographic parity would need an explicit French-spacing decision; this review grants no waiver.

### 6. Earlier port omissions: scoped corrections confirmed

| Earlier omission | Current evidence |
| --- | --- |
| Code instruction filename lost monospace/11px styling | Both instructions states now **0.02%**. `.code-lead code { font-family: var(--mono); font-size: 11px; }` exists at pinned `screens/code/lot-code.css:15`. A lead/title region is **207,690 byte-identical pixels per theme** with no translation. No whole-editor vertical shift visible; small fixture-space and shell residuals remain. |
| Work preview left background sidebar activity visible | Done sidebar now shows **“a relancé 5 devis”** and completed appearance. Checked sidebar region has zero Pixelmatch mismatches; 121 exact pixels dark / 27 light remain. Pinned `WorkTaskPreview` publishes `state`/`doing` and restores prior activity. This review confirms the captured state, not exit/pause interaction behavior. |
| First sidebar chat stayed undimmed outside Chat | Pinned `shell/shell.tsx:234` now applies route-dependent dimming. Checked Components first-chat region is **30,420 byte-identical pixels per theme**. Captured Work/Upload appearance also agrees. |

### Other inspected residuals

- `chat-dark/light` **0.15%**: the two French colon-space differences still displace the rest of their lines; body layout/code block align. No new Chat-body geometry omission established.
- `chat-states~searching-light` **0.13%**: app **8/14**, frozen **7/14**, different current-source label; quote-space differences also visible. Progress and mascot frames remain timer-sensitive.
- `pricing~compare-light` **0.13%**: small horizontal differences in price/value columns inspected; exact cause not established here. No acceptance inference from its low percentage.
- Smaller shell glyph/mascot/raster differences remain. This review does not assign a cause to every residual pixel or establish every smaller row as intentional.

## Read-only pixel checks

Image-pixel rectangles are half-open `[x0,y0,x1,y1]`. Compare app `(x,y)` with design `(x,y+dy)`. These are diagnostic region checks, **not replacement normalized scores**.

| State / region | Rectangle | `dy` | Exact different pixels | Pixelmatch different pixels |
| --- | --- | ---: | ---: | ---: |
| Long Chat dark transcript | `[1160,490,2400,1410]` | +40 | 16,486 | 0 |
| Work Done dark/light transcript | `[1110,510,2440,1490]` | −2 | 0 / 0 | 0 / 0 |
| Components dark/light card interior | `[835,590,1735,790]` | −48 | 0 / 0 | 0 / 0 |
| Code instructions dark/light lead | `[1370,270,2660,431]` | 0 | 0 / 0 | 0 / 0 |
| Work Done dark/light sidebar | `[210,370,738,442]` | 0 | 121 / 27 | 0 / 0 |
| Components dark/light first chat | `[215,940,722,1000]` | 0 | 0 / 0 | 0 / 0 |

## Exact visual review coverage

Original full-resolution **app/design/diff triplets** inspected for:

- `chat-states~long-{dark,light}`
- `components-{dark,light}`
- `upload~uploading-{dark,light}`
- `work-task~done-{dark,light}`
- `code-settings~instructions-{dark,light}`
- `file-xlsx~range-{dark,light}`
- `file-xlsx~chart-{dark,light}`
- `chat-{dark,light}`
- `pricing~compare-light`
- `chat-states~searching-light`

**18 triplets / 54 PNGs** visually inspected, plus eleven all-state app contact sheets. Whole-frame recomputation covers the first sixteen states above; regional checks cover the stated rectangles only. All other PNGs were hash/dimension-verified, not full-resolution visually reviewed.

## Gaps and clock limits

- **16 extra Settings renders:** `appearance`, `providers`, `connection`, `bot`, `notifications`, `privacy`, `shortcuts`, `account`, each dark/light. No corresponding frozen reference state.
- **Five clicked extras:** `home+menu-dark`, `home+menu-light`, `history-menu-dark`, `history-menu-light`, `file-image+ask-light`. Captured, not compared.
- Browser Date **`2026-10-02T12:09:00.000Z`**, timezone **UTC**, timers **real**. This is caller-selected. The original frozen `capturedAt` does not attest browser timezone or Date at mount. Fixed Date does not synchronize upload/search timers, animations, mascot pose, font readiness or scroll anchoring.
- Earlier ambient-clock/night-wallpaper outliers remain original evidence. This fixed-clock run must not overwrite or silently merge their clock policy.
- Freeze fingerprint covers `src/` only; original dependencies/configuration/public-asset provenance is narrower than a fully reproducible environment. The diagnostic frozen development server is not a reconstruction of its historic browser scheduling.
- Provenance separately retains **1,793 ignored preview API transport errors**; preview observations do not prove live-engine availability.
- Scope is settled browser preview. No Mac, CI, native chrome, live backend, motion, exhaustive interactions, minimum-window or eight-locale acceptance performed. Concurrent source corrections are outside the captured pin.

## Review artifacts

Only `/tmp/opencode/current-full-comparison-review.md` and `/tmp/opencode/full-compare-review/` written. Original PNGs, frozen files, repository source and retained evidence left intact.

- `verify.py`, `verification.json`: all-image/source/reference/report checks; run from repository root with `python3 /tmp/opencode/full-compare-review/verify.py`.
- `pixel-checks.mjs`, `pixel-checks.json`: region checks and sixteen percentage recomputations; run from repository root with `node /tmp/opencode/full-compare-review/pixel-checks.mjs`.
- `work-diagnostic.mjs`, `work-diagnostic.json`, `served-assets-verified.json`: app/freeze font/scroll/geometry measurements; served-byte identity checked before diagnosis.
- `work-anchor-check.mjs`, `work-anchor-check.json`: isolated `auto`/`none` anchoring control with assertions; six browser navigations across both diagnostic scripts total.
- `retention-verified.json`: selected WebP RGBA verification and contact-sheet hashes.
- `currency-format-check.json`: explicit French currency code points and pinned budget fixture.

**Next corrections justified:** scoped Work initial-scroll readiness; separate settled-scroll investigation for long Chat. Intentional notice/copy/timer differences remain documented. Broader fidelity and release acceptance remain partial.
