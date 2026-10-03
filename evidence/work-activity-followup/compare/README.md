# Work Activity — scoped frozen preview comparison

**Scoped pass:** no new blocking static layout regression identified. **22 captures / 22 references / zero gaps**:
Activity3 states×2 themes, Work Task8×2. All22 pairs inspected on three sheets; seven full-size pairs (**14 originals**).
[Image/row ledger](image-index.md) · [visual review](visual-review.json) · [metrics](metrics.json) · [summary](summary.json).

## Source and artifact identity
- Capture `2026-10-03T18:45:11.552Z–18:46:24.629Z` retains **dirty `906987b94c04c3c4566ecb33394584ff0e93074e`**.
  Renderer **`a4a815bac24ce5f509f813d06371b8a754908b4b472c3d786f1325dbed53b8df`**.
- Verified **517 copied source inputs / 475 renderer inputs / 90 members / 19 served assets**, complete source/member path sets,
  against `/tmp/opencode/build-work-activity`. All517 also match Git **`9ba8e59fbec8c1f38f93ace25414d4a3489aede3`**.
  [Later commit binding](commit-binding.json) preserves original dirty receipts separately; no clean rebuild or ASAR/package attestation.
- [Source/build delta](source-build-delta.json) from Memory`96df66c`: new `activity.tsx`, changed `desk.tsx`, `home.tsx`,
  `work.css` plus eight Work catalogs. Existing catalog values unchanged; seven added keys/locale. Main/preload/maps byte-exact.
  Work CSS adds15 live-selector lines; other seven CSS sources exact. Bundled CSS changes to
  `9d9dc52f85eade46c37195f05c01de58997a3a79070bce4bfa2361d8f686f1d5`; renderer JS/HTML also change.
- Committed preview parameters select `ActivityPreview`; live selector classes are absent there. `WorkTaskPreview` is byte-exact
  to Memory source. These observations bound preview geometry; they establish no live-feed/identity behavior.
- Reference **`7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`**:106 source hashes, metadata,
  all22 selected reference mappings/hashes and66 supplied PNGs verified. [Original report](report.json)/[provenance](provenance.json) unchanged.
- French/`fr-FR`, **1440×900 / scale2**, Date **2026-10-02T12:00:00.000Z / UTC**, real timers; frozen timezone/mount time unattested.
  All22 pixelmatch counts/diff hashes reproduce offline at original color threshold0.15. No tolerance or pixel masking added.

## Measurements
5,184,000 pixels/frame. Original rounded percent and exact differing-pixel count:

| State | Dark % / pixels | Light % / pixels |
| --- | ---: | ---: |
| `work-task~running` | 0.01 / 395 | 0.01 / 470 |
| `work-task~computer` | 0.02 / 821 | 0.02 / 920 |
| `work-task~takeover` | 0.01 / 299 | 0.01 / 315 |
| `work-task~approval` | 0.01 / 353 | 0.01 / 382 |
| `work-task~blocked` | 0.03 / 1808 | 0.04 / 1930 |
| `work-task~done` | 0.00 / 225 | 0.00 / 240 |
| `work-task~failed` | 0.02 / 1076 | 0.02 / 1121 |
| `work-task~paused` | 0.01 / 302 | 0.01 / 336 |
| `activity~timeline` | 0.03 / 1798 | 0.03 / 1354 |
| `activity~filtered` | 0.03 / 1515 | 0.03 / 1593 |
| `activity~loading` | 0.01 / 264 | 0.01 / 310 |

- Maximum **Blocked light1930 / 0.03722993827160494%**; exact mean **0.015631137766554434%**.
  Mean rounded0.01681818181818182%. No frozen pair is threshold-zero or RGBA-exact; rounded0.00 retains nonzero residuals.
- Activity timeline/filtered dark/light, Done dark/light and maximum Blocked light were inspected full-size against frozen originals.
  Timeline has13 visible fixture events; filtered one. Event text/icons/times `[1080,420,2535,1620]` are RGBA-exact to frozen/history.
- [Regions](regions.json): filtered summary retains historical **`1 action` versus frozen `1 actions`**, shifting Clear slightly;
  summary pixels exactly match prior app. Timeline differences occupy mascot columns; loading raw skeleton pixels differ despite zero content threshold count.
- Blocked light entire app frame equals historical`6d96535` RGBA; Blocked dark transcript also exact. Frozen copy residuals remain unwaived.
- Done transcript `[1110,510,2440,1490]` matches frozen and later transcript-correction app exactly, without translation.
  Earlier`6d96535` Done0.42/0.45% scores remain preserved; its crop matches only with **+2 image pixels / +1 CSS pixel** sampling offset.
  [Prior scroll diagnostic](../../current-full-followup/compare/README.md) establishes the mechanism; this audit adds no DOM timing proof.
- Historical app comparisons cover22 prior-full and16 later Work frames. Historical clock12:09 differs from current12:00;
  no score merge or scheduling attribution. Mascot/indicator, raster, blocked/failed copy and border residuals retain their scope.

## Retention and limits
- [Retention](retained.json): **27 new lossless WebPs / 14,372,412 bytes**,17 verified canonical reuses; all22 app/reference pairs linked.
  Decoded RGBA checked for every conversion/reuse. Original66 PNG hashes retained; no bulk triplet import.
- [Raw gzip](raw-retention.json), [helper hashes](helpers.json), [SHA256SUMS](SHA256SUMS) bind original receipts and supplied-image checks.
- **22 `/api/projects`404s** retained; no other admitted console/page error. Preview fixtures/native-looking chrome prove no live or native behavior.
  No full-suite/CI/package/ASAR/native claim, fresh render/test/build/network, source edits, commit or delegation. Other reference gaps remain open.
