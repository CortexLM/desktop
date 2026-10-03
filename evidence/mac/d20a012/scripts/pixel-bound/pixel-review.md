# Files filename — independent pixel/classification review
**Pixel proof ACCEPTED; current collector needs one literal correction below.** The exact light filename's one-pixel Range overrun is not painted-glyph loss.
Only this report written; offline source/receipt/image readback, byte comparison and RGBA decoding. No collector/app/test execution, device/network/CI/build or delegation.

## Verified pins
- Diagnostic `/tmp/opencode/files-name-diagnostic.mjs`: `dc10c6bd12a89aa2b59bef403d8ead5a810c6388047042d77114f670d7dd1cdf` (143 lines).
- `/tmp/opencode/files-native-name-probe-d20a012-1/manifest.json`: `378505501fa3425326b1b60ede248c005a8f913af6cf1be510b3a19556851989`.
- `pixel-comparison.json`: `647bb2fc58dbcce4e5bc257b782160bfe25dc501bf3ce050dc910dbd8a259385`.
- Both actual native PNGs: `f1152f2820297bf2d0764fbbc0687e39bd063f5e7da0eee55f68209506aeba8f`, 65,221 bytes each, 960×640; independently byte-identical.

## What the diagnostic establishes
Independent RGBA decoding confirms whole-frame equality; crop `[383,58,551,86]` has zero changed pixels, RGBA SHA-256 `5678c18549382854ec76779985db701cfc67e6727f2d27aba7ccfb8c7d80d95a`.
Both full-size views show the complete normal filename. Actual overflow:auto versus overflow:visible changes no glyph pixel; Canvas metrics are supplemental, not the deciding proof.
Four same-owner samples retain identical text/font/coordinates/scroll/DPR and 265-node layout hash. Only overflow, first clip-chain overflow and derived Range visibility differ; both captures' before/after samples agree.
Installed before/after identity matches d20a012/ASAR `9eeffe46…`, PID 77857, CoreGraphics window 9092. Four foreground/OS-light native samples bind two originals; no page screenshot substitution in source.
Status remains diagnostic `observed`: 36.883s flow/40.280s total; one exact controlled inference, zero fixture/renderer errors, ten cleanup flags true. Original filename style was restored first, before Chat deletion.

## Collector correction
Reviewed `/tmp/opencode/files-native.mjs`: `4ef7b54303f30b26d538517952810be0ae61fb5ac6bbeb28d1d28ce35bc6e862` (221 lines); diff from archived 9548 is confined to geometry classification.
**P2:** line 175 requires `style.letterSpacing === '0px'`; every retained CSS sample records `letter-spacing: normal`. Only `canvas.letterSpacing` is `'0px'`. The exact observed filename therefore cannot receive the new flag and fails again.
Minimum correction: require `style.letterSpacing === 'normal'`, matching the recorded CSS value; refresh the source hash. No tolerance broadening or further diagnostic is needed for this literal mismatch.
The remaining classification is accepted in scope: exact owner selector/text/single child/font/DPR/bounds/zero scroll, exact Range/self clip and opacity; retain original `visible:false` plus explicit `measuredFilenameLeading`.
Unchanged ancestor containment, horizontal geometry, hit checks and five targets remain enforced. Other names/metrics keep the original predicate; this grants no arbitrary text or long-name exemption.
Dark color tokens do not change glyph geometry in the pinned source. The same exact guard may classify dark; upcoming dark native images still require visual review. No additional dark diagnostic required.

After the literal correction and exact source readback, one fresh-root a2 execution is supported; collector-only change requires no application rebuild/full suite.
Historical 9548 a1 stays failed with zero captures. This light-name diagnostic supplies no Save/zoom/pan/dark/long-name acceptance; existing CI long-name evidence remains separate. Native Save remains unverified.
