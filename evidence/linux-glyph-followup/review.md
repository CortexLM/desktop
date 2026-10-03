# Glyph regression — independent bounded review

**APPROVE for integration; no concrete blocker found.** The new assertion detects the reproduced CJK missing-glyph failure. Linux CI provisioning and the final integrated run remain pending acceptance.

## Reviewed source pins

Offline verification at **2026-10-03 08:27 UTC**, rechecked before delivery:

| Source | SHA-256 |
| --- | --- |
| `.github/workflows/ci.yml` | `7d1fb3b18f9784ed295085dd96664e9f967f4eb12d3c4958bf183838e067e6c8` |
| `tests/e2e/remote-auth.spec.ts` | `653016add38f51d766dfec52c205790de4b941c02739a993315c282469b1b0cb` |
| Exact `readableGlyphs` initializer | `97bc5fa6552790d634e08551368bd6e9907c6995e8e380338a544ce9d6bf9f09` |

Git comparison against `1076c2584941cf054efffaf709a149b4195bc1c4` confirms only Linux provisioning/inventory and the existing locale-case additions in these files. The first408 test lines remain byte-identical, SHA-256 `ec9671e179cd43b07fb737b8e9c0ccd7316797a1426e4fb6814b08a4d15cb8c7`. Runner labels unchanged; no additional registered glyph case.

## Source review

- **Workflow `:41–56`:** separate top-level apt commands preserve GitHub's default `bash -e` failure handling. An update/install failure cannot fall through to successful inventory and mask its exit status. Both inventory commands are direct, checked commands; quoted `${Package}`/`${Version}`/`${Status}` reach `dpkg-query` literally. `out/fonts/` is included in the existing `if: always()` artifact upload. Charset output is finite installed-font metadata, not a new unbounded scan. Noto installation itself is not yet proved by these source edits.
- **Raster predicate `:443–479`:** two distinct samples per affected script, fixed equal128×64 canvases, computed heading family, explicit32px and weights400/500. Fresh canvases avoid prior-glyph residue. Required alpha ink rejects blank output; pair inequality rejects identical tofu even if U+10FFFF renders differently; missing-glyph inequality adds another check. Comparisons occur within one browser/font context, not against OS-specific golden pixels. No concrete supported-font false refusal found.
- **Readiness/call site `:435–437,509,524–525`:** awaited `view()` calls `readable()`, which awaits `document.fonts.ready` and finite animations before the glyph helper. Both themes execute for all three CJK locales; final `fontRecords.length===6` prevents silently skipping a script. The canvas check complements existing exact-copy, clipping, opacity, privacy and keyboard assertions; none were weakened.
- **CDP/platform compatibility `:467–474`:** renderer DOM/CSS methods, no unsupported Browser-window method. The retained installed-Mac harness uses `newCDPSession`, `DOM.enable`, `CSS.enable`, `DOM.getDocument` and `CSS.getPlatformFontsForNode` successfully in48 views/112 font groups. Manifest `ea1d51c5dbebc31995bddc7fcc6148b15b6a4c474e08fe5cae218c6dbb38c610` matches its recorded harness `25e6481613780096505e6b3970b36cc0290c1d1ac4a156aefa57829cb32faefe`. This establishes those methods' prior Mac support, not a new Mac execution of this exact helper. No font-name assertion excludes native fallback families.
- **Failure/cleanup `:475–478,535–541`:** failed groups attach their sample/sentinel PNGs, then fail the Playwright assertion. CDP detaches in `finally`; test failure/capture/attachment exceptions still reach nested app/backend cleanup. Neither diagnostic failure nor a missing CDP method becomes a pass.

## Independently checked retained evidence

Directory `/tmp/opencode/linux-ci-glyphs-check-s9i1loe0/`; no test rerun:

- `controlled/results.json` SHA-256 `5f03dd3047bd7cd7404833fab228afc503093aca1f73de1e837836eec75a528c`. Re-extracted the current initializer and recomputed its exact recorded hash. The receipt records execution of that helper, including its assertion/CDP collection: **3/3 scripts reject without CJK fallback, 3/3 pass with system fallback**, six weight groups per environment, zero requests. The retained configs differ in available font directories and isolated caches.
- All **18 negative PNGs** independently match their899-byte receipts and128×64 dimensions; all have identical SHA-256 `3f73e6105144e804e1e25e5647b52bfa486504c3097b6ed38969390a124c8c63`. Thus all six pairs and their missing-glyph samples have identical encoded pixels. The box-with-cross negative was inspected. Positive groups have ink, distinct pairs, neither matching the sentinel; no failure attachments.
- `e2e.json` SHA-256 `ab4a8252a8292cc1729abaeaa31b4fddc1c71ea9cf1c9ae37db33efe04a7c006`: **one existing case passed**,39909ms, retry0, zero unexpected/skipped/flaky/errors. Decoded original attachments contain80 measurements/48 primary states/384 text rows/144 Tab stops and six font records/twelve passing weight groups. CJK heading fallback is WenQuanYi Zen Hei; local Noto is not installed. Japanese/Korean/Chinese retained960×640 originals inspected: glyphs visible, no tofu in primary auth copy.
- The implementation handoff reports targeted TypeScript321-source-file/zero-diagnostic checking, final workspace typecheck, lint and shell/YAML checks. This review did not recompile; the retained real Electron case and exact-helper receipt supply runtime evidence. The handoff's **103** is the integrated registered-case count, not103 glyph tests or a final103-case CI pass. Glyph contribution remains zero new cases.

## Explicit ceiling / remaining acceptance

U+10FFFF is a noncharacter sentinel, not a universal definition of missing glyphs. Codepoint-specific hex-box fallback could produce distinct sample rasters and evade this bounded predicate; partial font coverage outside these six characters can also pass. The observed failure uses identical boxes, independently reproduced here. The `ponytail:` ceiling is accurate; no global Unicode library is warranted for this correction.

Approval covers the proposed provisioning and observed-failure regression. Next source-bound CI must still verify Noto installed/package inventory, actual selected-font/raster records, the final **103-case** Linux/macOS suite and full-size Linux locale images without tofu. Historical1076 Linux negatives remain valid; controlled fallback proof does not identify that runner's absent-package versus unusable-fontconfig cause. Existing Mac method/font evidence is not new-helper native acceptance.

Only this report written. Read-only source/Git-object inspection, retained JSON/PNG/hash verification; no source edits, compilation, test/build execution, Mac/CI/network operation or delegation.
