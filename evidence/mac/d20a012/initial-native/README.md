# First bounded native run — failed before capture

Reviewed driver `9548b41317d5afd545dc086bf8b3ac463b3d477ade19a1075855202ffb05e009`
ran once against the exact installed `d20a012` package and a fresh isolated profile.
It failed at the first light-theme filename geometry check: element box top64/bottom80,
text Range top63/bottom80, own overflow clip top64/bottom80. Center hit passed.
No capture was requested; no native Download was attempted. This receipt alone does not
distinguish a clipped glyph from a Range box extending beyond actual glyph pixels.

Flow **17.017 seconds**, total **20.655 seconds**. One controlled image turn completed;
zero backend/renderer errors; all **nine cleanup checks passed**. The corrected launcher
verified the owned isolated PID, quit it in633ms, stopped both helpers and reopened the
ordinary app. [Restoration](restoration.json) records ordinary PID77432, original dark
appearance, five closed test ports and released lease.

Original failed manifest, helper/launch/backend receipts and output are retained.
The later [fresh-profile pixel diagnostic](../filename-diagnostic/README.md) finds
byte-identical normal and unclipped native originals for this exact filename. The
nominal Range extension therefore lost no painted glyph pixels in that bounded case.
This original run remains failed and establishes no native acceptance.
