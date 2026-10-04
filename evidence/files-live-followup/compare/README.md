# Files image / Chat — independent frozen preview audit

**Scoped static pass:** no new blocking layout regression found in **9 captures / 8 frozen comparisons / 1 explicit gap**.
Three contact sheets and **eight full-size pairs plus one unpaired image** inspected: **17 unique originals**.
[Row/image ledger](image-index.md) · [metrics](metrics.json) · [visual review](visual-review.json) · [summary](summary.json).

## Exact attribution
- Captured `2026-10-03T20:53:17.599Z–20:53:49.137Z` on port5433; original dirty base **`d390cce590600cf5896fa19acf0ddd44d7057e2c`** retained.
- Later source binding: **all520 frozen inputs equal Git `d20a012fbb774aa9b348fe1913f85d3476430098`**. Rebound receipt headers change only revision/dirty; payloads are exact. [Binding](commit-binding.json).
- Renderer **478 inputs**, fingerprint **`087587293bfb7c2ccf85176cece73982ae75db48318e1c381270caa5196a0d73`**; all source/member path sets complete.
- **90 frozen build members / 20 served-asset receipts** match exact bytes/hashes, including index, main JS/CSS and images/fonts. [Verified binding](binding/verified.json).
- Linux receipt names ASAR **`9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893`**; ASAR bytes/package execution are not independently admitted here.
- Versus `9ba8e59`: **3 added +14 changed inputs /503 unchanged**. Additions are viewer, raster and raster test; changed inputs are six renderer files and eight Files catalogs. Each catalog adds19 keys, no existing-value change.
- Main/preload/both maps remain byte-exact; **87 build members** retain path and bytes. Main JS/CSS change filenames/content; HTML updates references. [Source/build delta](source-build-delta.json), [source patch](source.patch).
- `raster.test.ts` belongs to the broad520/478 source inventories, not the production import graph. PreviewChat function and ChatStates source are byte-exact to `9ba8e59`; new thumbnail CSS is live-specific.
- Committed preview dispatch selects ImageScreen; its ZoomView receives no dimensions, retaining prior preview geometry. ModelComposer selects the existing preview Composer; new guard applies to live usage.
- Frozen authority **`7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`**: all106 source hashes, metadata, eight selected mappings and exact original PNG bytes verified.
- French/`fr-FR`, **1440×900, scale2**; Date **2026-10-02T12:00:00.000Z / UTC**, real timers. Each row retains its original frozen capture timestamp; frozen timezone/mount Date are unattested.
- All25 supplied PNGs decode/CRC/hash-check; all eight original pixelmatch counts and **diff PNG bytes** reproduce at threshold0.15. No masking, pixel shift or tolerance change.

## All rows
Each frame contains5,184,000 pixels. Percentages below are original rounded values; counts are exact.

| State | Frozen % / pixels | Prior/current threshold / raw pixels |
| --- | ---: | ---: |
| `chat-dark` | 0.15 / 7762 | 0 / 14 |
| `chat-light` | 0.15 / 7915 | 1 / 143 |
| `file-image~view-dark` | 0.00 / 104 | 185 / 3880 |
| `file-image~view-light` | 0.01 / 288 | 0 / 4 |
| `file-image~zoom-dark` | 0.01 / 634 | 2 / 143 |
| `file-image~zoom-light` | 0.02 / 883 | 19 / 185 |
| `file-image~compare-dark` | 0.04 / 2109 | 2 / 50 |
| `file-image~compare-light` | 0.04 / 2267 | 22 / 180 |
| `file-image+ask-light` | **No reference** | 6 / 308 |

- Maximum **Chat light0.15268132716049382%**, exact mean **0.05295621141975308%**. No whole frame is RGBA-exact or threshold-zero against frozen; rounded0.00 still has104 differing pixels.
- View/zoom/compare preserve image placement, controls, metadata/minimap/handle geometry in both themes; no new clipping, blank image, missing text or overlap observed.
- All **six Image content rectangles `[754,150,2880,1800]`** exactly match prior app RGBA. Chat dark content is exact; Chat light has six changed pixels around its mascot, retaining prose/code geometry.
- Frozen View content has zero threshold differences but141/189 raw bottom-edge pixels. Zoom retains385/602 content-threshold pixels; Compare1821/1936. These residuals already occur in prior app content; not pixel-perfect fidelity.
- Chat retains two French colon-space differences: frozen ordinary spaces versus app narrow no-break spaces. Compare retouch copy likewise retains inherited punctuation spacing; remaining small raster/shell/mascot differences are recorded, not assigned an invented cause.
- Prior comparison is `6d96535`, fixed **12:09 UTC**, versus current12:00. Its original clock/scores remain separate; no compatible-run merge or timing-cause claim. [Regions](regions.json).
- Ask panel is readable in the supplied frame but lacks an approved matching frozen shot. `--only file-image,chat` captures ordinary Chat only: **uploaded/selected Chat preview states are absent**, not silently accepted.

## Retention and limits
- **15 new lossless WebPs /24,192,700 bytes**, two verified historical Chat-reference reuses; all17 decoded RGBA payloads exact, including opaque alpha. [Retention](retained.json), [25 original hashes](original-images.json).
- Original report/provenance, raw metadata/comparator archives, runnable offline helper archives and all row mappings are retained. [Verification](verification.json), [final check](final-check.json), [SHA256SUMS](SHA256SUMS).
- First port5432 attempt failed at gallery navigation with `ERR_EMPTY_RESPONSE`, **zero credited captures**. [Negative receipt/log](negative/receipt.json); occupied-port cause remains coordinator-reported. Successful capture is a separate run.
- Nine ignored preview `/api/projects`404s retained; comparator accepted no other console/page errors. Server stop is coordinator-owned; no audit fetch was needed.
- Browser fixture evidence establishes static regression scope only: no live viewing/download/deletion behavior, small-window/locales, animation, full-suite, CI, installed-native or full-product acceptance.
- Offline only; no application source changes, captures, builds, tests, device/lease/network/CI actions, commits or delegation. Writes confined to this directory and `/tmp/opencode/files-compare-audit`.
