# Frozen-reference integration

Source authority: `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674`, fingerprint
`7b388e2d967400d20bf5f2cc7cd44c56ba74859889908c220964f8d12abfc768`.
The owner finalized 410 registered images, 205 comparison plates and 44 sequence boards
(220 frames). Source and all three artifact-manifest hashes were independently checked.

Application revision: `5ced8aa1d2eb04ed3131ffb40c0d360e5706526d`.

## Integrated changes

- Frozen shell, theme, segmented control, capsule composer and sidebar behavior.
- Preview Chat/Code initial-request identity and model selection through browser history.
- Rejected Code/Work/Bot sends retain drafts; Bot Studio leaves only after accepted saves.
- Preview Bot appearance, activity and drafts share temporary renderer state, reset on exit.
- Components: 94 blocks, 31 families, 30 motion entries, 80 glyphs, 19 accessories;
  no more than three live thumbnails. All eight locale catalogs supplied.
- Shared contracts disable dynamic compilation before initialization, preserving strict CSP.
- Comparator validates frozen source/images and records source, served assets and image hashes.

Integration review found and corrected focus-mode native drag overlap, tab focus loss,
keyboard theme activation blocked by inherited-color transitions, preview-exit shell remounts
and delayed onboarding navigation after departure. Regression assertions cover these cases.
The screen audit excludes six exact Components source filenames that resemble translation keys;
geometry checks allow only subpixel compositor rounding. These are recorded harness corrections.

The full product objective remains incomplete. Remote auth/model/inference routing,
approved missing-surface delivery, exhaustive interaction/localization/minimum-window
acceptance, signing and Windows verification remain outstanding. Historical native evidence
at `../mac/0e63f87/` does not cover these application changes.

## Review boundaries

Local checks: 131 unit passes, one optional backend skip; lint, types and i18n audit pass
(63 files, 2,264 used keys, 3,395 English keys). Linux package launches successfully.
`source.json` pins renderer-related sources; `linux-build.json` pins built assets and asar.
The full Linux Electron suite passes **40/40**, no failures/retries/flaky/skipped cases;
all **426** registered theme/state renders pass. `test-stats.json` records individual results.
`screens.json` pins 44 renderer screenshots and pixel-identical lossless WebP conversions;
both contact sheets were inspected.
Both platforms subsequently passed **40/40** in
[CI 37015801908](https://github.com/CortexLM/desktop/actions/runs/37015801908), together with
the unsigned macOS package/smoke and CodeQL. [CI review](ci-review.md) found Work-board
overflow and refusal-toast occlusion at the minimum size; a subsequent responsive patch
addresses those findings. Passing CI did not itself establish their visual acceptance.

[Installed Mac](../mac/5ced8aa/README.md): 426 native captures, 14 menus, fullscreen/minimize
and Gallery read-back. [Frozen comparison](../compare-7b388e2d9674/README.md): 410 comparisons,
mean 0.0517%, max 1.74%, 21 explicit gaps.
Browse [full-resolution renderer captures](index.html); [source hashes](source.json),
[suite results](test-stats.json), [Linux package resources](package-resources.json).

Targeted screenshots cover both themes, refused drafts/saves, preview history, Components
and interaction end states. End-state assertions do not establish frame-accurate motion.
The 16 design-detector findings are pinned reference choices: Geist, spring curves,
thinking shimmer and shell/control dimension transitions. No visual redesign was inferred
from these generic findings; full frame-budget acceptance remains separate.
