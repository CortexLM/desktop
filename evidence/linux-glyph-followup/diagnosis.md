# Linux CI missing glyphs — controlled diagnosis, minimal repair proposal

**Missing usable CJK fallback is causally reproduced. A CSS weight defect is not required.**
Identical committed Geist bytes, text, CSS and Chromium produce tofu when CJK fonts
are excluded; restoring existing system fonts restores Japanese/Korean/Chinese.
Historical CI did not retain a font inventory, so **absent packages versus unusable
fontconfig remain indistinguishable for that runner**. This is not a proved defect
on the separately reviewed Mac installation.

## Evidence

- Pin: `1076c2584941cf054efffaf709a149b4195bc1c4`; application `f5bf305`.
  `kit/styles.css:1–6` declares Geist/Geist Mono, weights **100–900**, then
  `ui-sans-serif, system-ui, sans-serif`. `system.css:189` uses **500 / 26px** for
  login headings; normal text uses **400**. No locale-specific CJK face is bundled.
- Both bundled font cmaps lack the affected sample characters. Geist SHA-256
  `a369fcf5628ea2aa4e1b9e2ec6a5b3624e365bda588e1f0f2f12b564f728fbb8`;
  Geist Mono `fba8f577f38a2bbcbe818efa6348dd58f36303a10b8737c42fefad275be563ab`.
  These equal the audited frozen bundle; variable weight range is supported.
- CI `37105137365`: Linux **Ubuntu 24.04.3**, Node **22.22.0**, Electron **44.5.1**.
  `.github/workflows/ci.yml:41` installs only `xvfb`; apt output updates
  `xserver-common`/`xvfb`, lists `xfonts-base` as suggested. No CJK provisioning,
  `fc-list`, charset coverage or selected-platform-font receipt exists.
- Existing locale test waits for `document.fonts.ready`, checks Unicode copy,
  clipping/opacity and keyboard geometry. It contains **no glyph-coverage check**.
  Its 384 `readable` flags therefore passed while `ja`, `ko`, `zh-Hans` PNGs failed.

## Controlled proof — exactly two captures

Local host: **Ubuntu 26.04.1**, installed Playwright **1.63.0**, existing
**Chrome 153.0.8010.12**, Node **24.21.0**. A static 960×640 sheet contains Latin
plus the three exact committed heading/error/Cancel strings. No app or Electron
launch; no network requests. Each browser has its own fontconfig, profile and cache.
Only available font directories differ; no global config/cache mutation or install.

| Probe | Latin | Japanese / Korean / Chinese | Recorded browser fonts |
| --- | --- | --- | --- |
| DejaVu-only system fallback | Visible | Tofu at **400 and 500** | Geist reports even missing glyphs as positive `glyphCount` |
| Full existing system font directories | Same Latin content pixels | Visible at **400 and 500** | Japanese **IPAPGothic**; Korean/Chinese **Unifont**, Latin Geist |

The normal local `fc-match :lang=…` selects **WenQuanYi Zen Hei**. The isolated
config's browser selection above is independently measured through
`CSS.getPlatformFontsForNode`; `fc-match` names are not browser proof. Local
`fonts-noto-cjk` is **not installed**, so this did not test that package itself.

In both environments, **`document.fonts.check()` returns true**, geometry passes,
CDP glyph counts are positive. In the missing-font environment, each script's two
distinct glyph rasters are **identical to each other and to U+10FFFF's missing-glyph
raster**. Restored fallback makes them nonempty and distinct at both weights.
The tested fontconfig charset gate exits **1 before / 0 after**; Latin passes both.

The same box-with-cross failure is visibly reproduced. Whole-heading CI pixels
are **not identical**: different Chromium/environment and subpixel layout remain;
`ci-tofu-comparison.json` preserves that negative. Thus the controlled mechanism is
proved, not a forensic inventory of the historical runner. Two originals and the
derived side-by-side sheet: `/tmp/opencode/linux-ci-glyphs/comparison.webp`.

## Smallest proposed repository repair — not applied

1. Extend the existing Linux E2E apt step to install **`xvfb fonts-noto-cjk fontconfig`**.
   `fonts-noto-cjk` supplies JP/KR/SC coverage through the existing generic fallback;
   `fontconfig` makes the diagnostic CLI explicit. Runner label and application CSS
   need no change. The package recommendation is supported by cached OS package
   metadata; installation on Ubuntu 24.04 remains for the authorized repair run.
2. Before Electron E2E, retain `dpkg-query` versions plus `fc-list` file/index/family/
   PostScript-name/charset. Run a charset-union check for the committed Japanese,
   Korean and Chinese heading/error/Cancel characters; fail on missing codepoints.
   The runnable stdlib/fontconfig prototype is `check-coverage.py`; negative/positive
   exits are retained in `coverage-check-results.json`. `fc-match` alone is insufficient.
3. Add a small glyph sentinel to the existing locale case, not another geometry
   assertion: use its computed font stack/weight; rasterize **あ/ア, 한/글, 汉/字**
   plus U+10FFFF into equal canvases; require ink, distinct pairs and no missing-glyph
   equality. Attach CDP platform-font records for diagnosis; **do not assert a font
   family name across OSes**. The mechanism already fails/passes in this two-capture
   proof. This sentinel catches the observed tofu; it is not exhaustive Unicode proof.
4. On the authorized repair run, require charset/raster gates plus full-size review
   of all eight Linux locale images; compare the three previous failures. Keep this
   CI's failure images unchanged. Mac evidence needs no repeat for this Linux scope.

## Receipts / limits

`/tmp/opencode/linux-ci-glyphs/`: source/font hashes, cmap coverage, 215-file local
font inventory, both isolated configs, CDP font records, two captures, canvas
evidence, before/after coverage exits and `verification.json`. The helper's initial
whole-card comparison failure is retained; content-only Latin pixels match exactly.
No repository edit, font/dependency download or install, build, Mac action, new CI,
owner post or authentication. No claim that the broader product goal is complete.
