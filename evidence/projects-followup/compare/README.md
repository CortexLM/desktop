# Projects — scoped production frozen comparison

**Scoped pass:** 38 existing captures, **36 frozen comparisons / two explicit gaps**, seven routes.
**14 Projects/Project theme-state renders**; no new blocking layout shift found in the inspected targets.
All36 pairs reviewed on three contact sheets; two gaps on one sheet. Five full-resolution pairs
(creation dark/light, overview dark/light, maximum Chat light) plus four difference originals inspected: **14 originals**.
[Image index](image-index.md) · [visual disposition](visual-review.json) · [summary](summary.json) · [verification](verification.json).

## Exact binding

- Original capture: `2026-10-03T14:27:56.137Z–14:29:57.320Z`, dirty base `0597848cdbdec362e1441b44c67bf74c525feefa`.
- Renderer: **473 files**, `6070fc3282e019c04a29f6a2a68f36f029c56e7813c4aecd84cba46f071a5bb4`.
- Verified **515 input hashes / 90 frozen build members / exact member set**, all **25 served assets**, 110 original PNGs.
- Coordinator committed `8e3fd795b699c8ff07357544421d00f34dc2823c` during review and updated frozen receipt headers.
  Archived capture-time input/member payloads equal the later receipts; all515 inputs match that Git commit.
  [Attribution](binding/commit-attribution.json) preserves the dirty-base provenance; this is supplied-build binding, not a rebuild/CI/ASAR attestation.
- Reference `7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`: 106 source files,
  freeze/manifest/registry/coverage/motion-index hashes and **all410 original image hashes** verified; 36 selected state mappings verified.
- French catalogs/`fr-FR`, **1440×900 CSS / scale2 / 2880×1800 PNG**. Fixed Date **2026-10-02T12:00:00.000Z**, UTC; timers real.
  Frozen timezone/mount time remains unattested. Original comparator [report](report.json)/[provenance](provenance.json) retain exact bytes.
- Comparator SHA-256 `838bbacffef18907c15505745189b4ecd18590e71cc99256f93a8e50835eadc6`; original color threshold **0.15**.
  All36 offline pixelmatch results and diff-PNG hashes reproduce exactly. No acceptance tolerance added.

## Measurements

Each image has5,184,000 pixels. Maximum **Chat light:7,833 pixels / 0.15109953703703705%** (original rounded0.15%).
Exact mean **0.014065715020576134%**; mean of original rounded scores0.013888888888888888%.
Projects maximum **empty light:985 / 0.019000771604938273%**; all14 below0.03%.
Creation dark/light have **zero threshold differences**; all36 pairs still have some raw RGBA differences.
[Exact metrics](metrics.json) distinguish pixelmatch counts from raw RGBA counts; original rounded values remain unchanged.

| State | Dark % / pixels | Light % / pixels |
| --- | ---: | ---: |
| `home` | 0.00 / 240 | 0.00 / 80 |
| `chat` | 0.15 / 7,759 | 0.15 / 7,833 |
| `library` | 0.01 / 280 | 0.01 / 273 |
| `search~results` | 0.01 / 277 | 0.01 / 288 |
| `search~empty` | 0.03 / 1,558 | 0.03 / 1,438 |
| `search~loading` | 0.00 / 236 | 0.01 / 310 |
| `search~recent` | 0.01 / 299 | 0.01 / 310 |
| `command~open` | 0.00 / 49 | 0.00 / 60 |
| `command~filtered` | 0.00 / 53 | 0.00 / 55 |
| `command~submenu` | 0.00 / 43 | 0.00 / 58 |
| `command~none` | 0.00 / 47 | 0.00 / 57 |
| `projects~grid` | 0.01 / 320 | 0.00 / 217 |
| `projects~empty` | 0.01 / 663 | 0.02 / 985 |
| `projects~create` | 0.00 / 0 | 0.00 / 0 |
| `project~overview` | 0.00 / 215 | 0.01 / 685 |
| `project~files` | 0.01 / 297 | 0.00 / 237 |
| `project~instructions` | 0.00 / 252 | 0.01 / 285 |
| `project~sharing` | 0.00 / 248 | 0.00 / 243 |
| `home+menu` | no-design-shot | no-design-shot |

## Visual and historical disposition

- Creation dialogs retain all fields, choices, selection/focus and actions. Interior `[995,390,1880,1415]` is **RGBA-exact** in both themes.
- Overview chat/file column `[850,500,2050,1515]` and Instructions card `[2090,505,2700,885]` are RGBA-exact in both themes.
  Light's Bot pose differs; small header/sidebar text/back-button residuals remain. [Regions](regions.json) use device pixels.
- Chat's two prose-line residuals are inherited: `[1140,440,2460,1490]` exactly matches historical
  `6d96535`/application`f9aca44` and initial transcript-correction app pixels. Current dark diff image is also exact to that latter diff.
  Whole frames differ: versus`6d96535`,144 dark/2,693 light raw pixels; historical rounded Chat scores remain0.15%.
- [Historical row comparison](history-comparison.json) covers all36 prior`6d96535` references and two transcript-correction Chat rows.
  Prior clock12:09 differs from current12:00; scores/pixels are compared, not merged or given identical scheduling authority.
- [Source inheritance](historical-source-binding.json): PreviewChat and six adjacent source/catalog files equal`99e3d04`, `37c22c2`, `f9aca44`;
  kit CSS also equals99/37, differs fromf9. No new99/37 screenshot row is inferred. Existing prose/raster gaps remain unwaived;
  unknown timing causes are retained. The0.15% Chat discrepancy is not attributed wholly to animation timing.

## Compact retention and limits

- [Retention map](retained.json): all38 apps retained; five selected design/diff triplets available. **47 new lossless WebPs**
  (22,668,462 bytes), **12 verified existing canonical references**. Reuse requires decoded RGBA equality, including transparent RGB.
  Twenty other design originals remain hash/path-only; the image index labels them accordingly. Original110 PNGs total71,756,089 bytes in scratch.
- [Raw gzip](raw-retention.json) preserves production and earlier development report/provenance bytes; [source archives](source-archive.json)
  preserve comparator and hash manifests. [SHA256SUMS](SHA256SUMS) binds retained files. No bulk capture-tree import.
- Earlier wrong-mode comparison remains separate: fingerprint`a2890f737406ca9a02e61c56652ffb8aff4b1ae6f7c4a82c85dd5088d67b54fe`,
  [original negative attribution/110 verified files](historical-development/disposition.json). No approval transferred; original scores preserved.
- Gaps are **only Home-menu dark/light in this38-row scope**; no statement closes the broader Settings/Appearance reference gaps.
- Browser preview fixtures only:48 retained`/api/projects`404 transport errors; comparator admits no other console/page errors.
  No live-engine, native, continuous-motion, minimum-window or full-product acceptance. Inline examples supply no extra hash authority.
- Offline review only: no render/capture, app/test/build, network/CI/native execution, source edit, commit or delegation.
