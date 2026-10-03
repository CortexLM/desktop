# Memory preference — initial frozen preview comparison

**Initial preview scope accepted:** no new blocking layout shift found in the inspected Memory/Privacy/Bot-memory targets.
**32 captures: 16 frozen comparisons, 16 explicit reference gaps.** Memory 6 + Bot Settings 8 + Settings 18.
All16 pairs/two contact sheets and all16 gaps/two sheets inspected; **14 full-resolution originals** opened.
[Image index](image-index.md) · [visual review](visual-review.json) · [metrics](metrics.json) · [summary](summary.json).

## Initial source authority
- Capture `2026-10-03T16:48:23.931Z–16:49:55.407Z`, **dirty base `74579d574646aff5dbd462247b4fd47a99dd2cdd`**.
  Renderer **`30ec7f97fb1de75ba4dc66fa81a4dfba0e76cd16008bfa53600d7ca512b810fb`**; no later commit/correction attribution.
- Verified **516 copied source inputs / 474 renderer inputs / 90 build members / 28 served assets**, complete input/member path sets,
  against `/tmp/opencode/build-memory-preference/source` and its sibling built packages. [Binding](binding/frozen-source.json), [verification](verification.json).
- [Source/build delta](source-build-delta.json) versus `f82a648`: one added `packages/app/src/state/runtime-settings.ts`,
  30 changed inputs, 485 unchanged. **All8 CSS sources and bundled CSS byte-exact**; renderer JS/main change, preload unchanged.
- Frozen reference **`7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`**:106 source hashes and
  freeze/manifest/registry/coverage/motion-index hashes verified, all16 selected reference mappings/hashes and64 current PNGs verified.
- French/`fr-FR`, **1440×900 CSS / scale2 / 2880×1800 images**; Date **2026-10-02T12:00:00.000Z / UTC**, real timers.
  Frozen timezone/mount time remains unattested. [Original report](report.json)/[provenance](provenance.json) preserve exact bytes.
- All16 pixelmatch results/diff-PNG hashes reproduced offline; original color threshold **0.15**, no new acceptance threshold.
  Comparator SHA-256 `838bbacffef18907c15505745189b4ecd18590e71cc99256f93a8e50835eadc6`.

## Exact results
5,184,000 pixels/frame. Original rounded scores preserved; each count below is exact threshold-different pixels.
| State | Dark % / pixels | Light % / pixels |
| --- | ---: | ---: |
| `bot-settings~general` | 0.03 / 1634 | 0.02 / 1067 |
| `bot-settings~permissions` | 0.01 / 332 | 0.01 / 351 |
| `bot-settings~memory` | 0.00 / 239 | 0.01 / 356 |
| `bot-settings~usage` | 0.01 / 377 | 0.01 / 458 |
| `memory~list` | 0.01 / 260 | 0.00 / 228 |
| `memory~off` | 0.01 / 278 | 0.01 / 292 |
| `memory~empty` | 0.00 / 233 | 0.00 / 254 |
| `settings~general` | 0.06 / 3294 | 0.06 / 3143 |

- Maximum **Settings General dark:3294 / 0.06354166666666666%**; exact mean **0.015427276234567902%**.
  Mean of rounded scores0.015625%. No full pair is threshold-zero or RGBA-exact; rounded0.00 does not mean identical.
- All **16 gaps**: Settings `appearance`, `providers`, `connection`, `bot`, `notifications`, `privacy`, `shortcuts`, `account`,
  each dark/light. [Explicit gap records](gaps.json); historical app images never substitute for absent frozen references.

## Regional visual disposition
- Memory-off dark/light and Bot-memory dark/light opened with their frozen originals. Toggles, retained/faded groups,
  pause notice, five Bot notes, action buttons and dividers remain aligned. Sampled Memory list/off panels `[1000,250,2545,1690]`
  and Bot-memory panels `[1360,250,2710,1160]` are **RGBA-exact to frozen**. Rectangles use device pixels.
- Privacy dark/light opened full-size: three rows retain original preview copy, Memory enabled and aligned switches.
  Panel `[1360,270,2680,725]` and Memory row match historical app pixels exactly; **both remain reference gaps**.
- General dark maximum opened as a pair: inherited Providers/Connection navigation plus state picker absent from frozen;
  right-hand General panel is exact. Header/sidebar glyph rasters, border pixels and Bot poses remain measured residuals.
- Historical `6d96535`/`f9aca44` app comparison: **27/32 content regions exact**. Bot General/Memory-empty differences lie in mascot regions;
  Usage matches history while149 pixels/theme differ from frozen. Raster/timer causes remain unproven.
- Appearance light's historical delta **0.19755015432098766%** is app-to-app only: full-size review shows Light selected now,
  Dark selected in the historical light shell. Blue selection outlines/radios differ; it remains a frozen gap, not a failed frozen comparison.
  Historical clock12:09 differs from current12:00; scores are neither merged nor given common scheduling authority.

## Retention and boundary
- [Retention](retained.json): **32 new lossless WebPs / 14,402,088 bytes**, **16 verified canonical frozen-reference reuses**.
  Every retained conversion/reuse is decoded RGBA-exact. Source PNG/frozen-manifest authority stays attached; no bulk PNG triplets.
- [Raw gzip](raw-retention.json), [helper hashes](helpers.json), [SHA256SUMS](SHA256SUMS), [preview-source observations](preview-source-binding.json).
  Original hook SHA-256 `481982a480a648639a8361f5e2b2fd30c3c9edba853ef0d2887e7e3b421360b3` archived separately.
- Initial hook skips preview migration; preview copy unchanged. **32 `/api/projects`404s** retained; no other admitted console/page errors.
- This initial receipt establishes no corrected-hook approval, live/copy/locale/engine/test/CI/native acceptance. Later delta has separate provenance.
- Offline only: no tests/build/app/capture/network/CI/Mac, source edit, commit or delegation. Historical negatives/gaps retain their scope.
