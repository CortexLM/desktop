# Files native a1 — bounded failure diagnosis
**Probable font-metric false positive; actual glyph clipping remains unproven.** No application defect established; no predicate weakening approved from geometry alone.
Receipt remains **FAILED**: first light Fit measurement, zero capture requests/images/native samples; Save and keyboard pan unreached.
Flow 17.017s, total 20.655s; nine driver cleanup flags true, zero renderer errors, exactly one completed image inference/zero fixture errors. These are not lease/helper teardown receipts.
Manifest `/tmp/opencode/files-native-d20a012-a1/manifest.json`: SHA-256 `9fac3f46b1dc712ef864677b3954eca042ba9fe83dc32b8151e38486f0647c77`.
Executed/current driver SHA-256 `9548b41317d5afd545dc086bf8b3ac463b3d477ade19a1075855202ffb05e009`; installed before/after pins match d20a012, PID 77172, 90 members.

## Source/receipt cause
`files-native.mjs:170–179` calls text `Range.getClientRects()` “ink”; these are font-metric rectangles, not painted glyph-pixel extents.
Filename border `[389,64,544.96875,80]` fits its ancestors; hit=true. Text Range `[389,63,544.96875,80]` fails own scroll clip `[389,64,545,80]`: `63 < 64 - 0.5`.
`image.tsx:117` places the filename span directly inside `.title`; `files.css:274` makes it a blockified flex item, not an explicitly inline-block title.
`kit/styles.css:50,210` supplies Geist, inherited 16px line-height, 13px/500 title; `files.css:314` imposes real `overflow:auto; max-height:3lh`. All three source files match committed d20a012 byte-for-byte.
The 17px font box can extend above a 16px line box while this string's painted ascenders remain inside. The self clip is real; its intersection with that nominal rectangle does not establish lost glyph pixels.
Only the first target was measured before abort; no claim that the other four passed. Fonts/finite animations had settled before this measurement; baseline/DPR/painted extents were not retained.
Prior `evidence/mac/37c22c2/geometry-final-review.md` exempts input borders only and explicitly retains text self-clipping. Its visible-overflow label examples cannot exempt this `overflow:auto` filename.
CI long-name coverage proves Home/End movement and reachable controls; its other strings/scroll positions and existing image audit cannot decide this exact normal-name pixel row.

## Proposed single diagnostic — not executed here
1. Use a new isolated root/profile/backend run ID, same admitted package, actual OS light/System, 960×640/sidebar shown. Preserve a1 unchanged; its removed Chat and exhausted one-turn backend are not reusable.
2. Pin a diagnostic-only strict fixture accepting one prompt with exactly two original-PNG FileParts: the exact normal filename and the existing 5,000-W scroll filename. One key write/session/turn, no tools; disable provider before viewing. No renderer payload substitution.
3. Fix budget before launch: 90s flow +30s cleanup, 120s absolute; at most four CoreGraphics window originals. Retain measurement failures without aborting before diagnostic images; never label this a main acceptance run.
4. After fonts settle, record computed font/weight/line-height/spacing, DPR, full clip chain, border/Range rectangles, client/scroll sizes and offsets. Capture the untouched normal name first.
5. Capture one diagnostic-only unclipped normal-name reference, preserving exact text origin, width, height, wrapping and font; restore afterward. Reject the comparison if those coordinates change. Compare padded native crops at original resolution, especially y=63–64, against that uncut glyph raster.
6. Capture untouched long-name Home and End states; retain scroll offsets, first/last visible rows, focus and reachable image/controls. Intentional offscreen rows are not required to fit simultaneously; retain self/ancestor clipping checks.
7. Copy of text/font `actualBoundingBoxAscent/Descent` may support the diagnosis only with a measured baseline; Range top is not baseline. Canvas metrics or a differently positioned text clone alone do not prove the installed pixels.
8. Delete only the owned Chat/key, restore provider/appearance/route, retain all cleanup receipts; coordinator owns process/port/lease teardown. No automatic retry if inconclusive.

## Decision after those pixels
If the same uncut glyph raster loses no pixels, correct only this filename's metric-based classification, bounded by retained pixel evidence; keep self clips, horizontal/ancestor bounds, hit checks and all original capture targets. No global 1px tolerance increase or blanket text exemption.
If glyph pixels are lost, use the smallest measured live-filename line-height correction while retaining three-line scrolling; verify both themes and long-name access under a new application pin.
Collector-only correction needs source/predicate review and bounded native confirmation, not an application rebuild/full 143-case rerun. A CSS change follows application checks; neither outcome retroactively passes a1.
Only this report written. Offline source/hash/receipt arithmetic and prior-review readback; no application/collector edits, runtime, device, network, CI, build or delegation. Native Save remains unexecuted.
