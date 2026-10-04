# Independent native evidence audit — 96df66c

**PASS, bounded scope.** Four installed Memory/Privacy off-state captures, switch synchronization,
paused manual access and one final dark-theme note deletion are supported by the retained proof.
**Aggregation correction:** focus/pointer-hit checks cover both themes; deletion itself occurs
only on final dark Enter. “Paused-note deletion in both themes” is not supported by this run.

## Identity and execution
- Application `96df66ce727c42ddf647b2dcb4eeeff04fda4927`; CI `37139741944`, artifact `11279989876` identity matches the prior offline package admission. No CI query or rerun performed.
- ASAR `b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44`; all 90 member pins agree with before/after installed inspection, launch/binding and package receipts.
- Corrected collector `d1eaeea3ae44d0b32fc0903e67c860a0d8c2444b93ab23a0a997f4c1f17c4b8e` and all three helpers match recorded hashes. Original `370b06ee…` is retained separately, never attributed to the passing execution.
- Fresh `…memory-96df66c-a2` profile, installed PID **71055**, native window **8973**, GUI LaunchServices; CoreGraphics window-ID `screencapture` supplies originals. CDP supplies controls/geometry, not screenshots.
- `installed.json` records the earlier a1 physical installation and preserved `f82a648` backup. The a2 launch, pre-lease and installed inspections consistently identify the already-installed Memory package; those roots serve different purposes.
- Execution **68.646 seconds including driver cleanup**; last image completes at 62.521 seconds. Exact flow/cleanup split is not recorded. The complete duration is below the 120-second flow budget.

## Images and interaction proof
- All **four original 960×640 PNGs inspected at full size**: Memory off and Privacy off, English, real OS light/dark with shell System. Readable glyphs/copy, complete descriptions, visible blue switch focus rings, native traffic lights; no clipping, overlap, blank or black capture observed.
- **20 target rows**, five per image: independent recomputation confirms bounds/text ranges inside recorded clipping ancestors, opacity 1 and positive hit checks. Two separate Forget geometry/focus checks pass.
- **Eight native samples**, before/after each image: exit 0 and exact System Events boolean, one active window, matching PID/ID/bounds. Sample pairs preserve window identity; serialized appearance/window reads are not an atomic sample.
- PNG hashes, all **42 chunk CRCs**, dimensions and full decoding pass. Four WebP hashes and complete RGBA equality pass: no pixel change, crop or rescale. Originals total **314,518 bytes**, within budgets; each image contains matching traffic-light pixels and 252 blue focus-ring pixels.
- **15 persisted-state checks** preserve exact controlled note and Bot metadata, plus **two paused Forget checks**. Seven English labels match the committed catalog and pinned collector.
- Pinned control flow plus accepted state readbacks establish **nine UI setting changes**: one pointer-off, eight Space toggles. The **70-entry explicit IPC log** contains 66 GETs, fixture Bot/note POSTs, cleanup settings PUT and owned-Bot DELETE; it does **not** log UI-generated writes.
- Final dark Enter removes the note: memory-list count becomes zero, Bot read remains successful with original metadata, setting remains false. Only later cleanup deletes the owned Bot. No claimed individual-note GET/404 check.
- Empty initial/final guarded lists, local signed-out checks, unconfigured unused model and zero backend requests/errors support the controlled, zero-inference scope. No provider/auth mutation or session creation is exercised.

## Cleanup and retained failures
- All **eight driver cleanup checks pass**, errors `[]`. Settings value returns to true; the initialized document remains in the isolated profile. No claim that original document absence was restored.
- Final restoration receipt: ordinary PID **71358**, same ASAR, isolated arguments absent, both helper PIDs stopped, Mac ports 9444/9445/9456 and local ports 19444/19445 closed; original OS dark value `true` restored after shared cleanup, lease released.
- Initial attempt remains **failed, 20.330 seconds, zero captures, eight cleanup passes**. Its missing native sample leaves the original failing conjunct unknown. Separate explicit-light diagnostic establishes conflicting appearance readbacks only.
- Two later launch refusals remain pre-profile evidence; unchanged guard rejected still-running Cortex. They are separate from the passing fresh-profile execution.

## Reproducibility and limits
- Offline check: `python3 evidence/mac/96df66c/native-audit/verify.py` (existing Pillow 12.3.0).
- Machine result: [`audit.json`](./audit.json); scratch `/tmp/opencode/memory-native-audit/{summary.json,input-hashes.json}`. Verified 47 checksum entries; 56 retained inputs stable before/after audit.
- Audit UTC `2026-10-03T18:07:40Z`. Only assigned audit files/scratch written; no device, lease, network, CI, application test/build, source edit or new capture.
- Acceptance excludes restart persistence, legacy migration, inference/context injection, preview/refusal/races and full-product/full-rewrite completion. Other reviews retain their own scope.
