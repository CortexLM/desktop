# Settings Appearance keyboard and theme synchronization

Baseline application `37c22c2fcff92fb76b10ffc97ec0643ac325d62f`; documentary
`6642d46467304cbe1181d0963d51c085ec09a0c4` has identical package inputs.
Correction pushed: `99e3d04a8dab6b51b6cf23bcdae0365624492e0f`; renderer fingerprint
`474405faaf26dba6319cb1c139f0b32ef04adf2b7e600d6edee37f72b4fabf44`.
CI [37124432902](https://github.com/CortexLM/desktop/actions/runs/37124432902) passes all
three jobs. [CI artifact audit](ci-99e3d04/README.md) verifies 113 cases/426 renders per OS,
300 images/20 full-size targets and sixteen locale images pixel-exact to `37c22c2`.
[Matching installed confirmation](../mac/99e3d04/README.md)
passes 47 state/focus checks and two native captures in 80.917s, with cleanup complete.
[Independent native audit](../mac/99e3d04/native/README.md) passes; the initial CDP
media-override failure stays retained.

The [actual Electron baseline](baseline/README.md) reproduces **two failed cases / 17 assertions** at 960×640 in both themes:
all three theme cards are Tab stops, arrows do not select, and rail changes leave the mounted
Appearance selection stale. Initial hash/selected-card disagreement is separately observed.
Pointer selection, stored preferences, OS resolution and reload controls pass; page errors
are zero. The exact two-case regression remains unchanged after its negative run.

The correction uses the installed Base UI RadioGroup/Radio with the same button geometry
and exposes Shell's authoritative theme preference through the existing context. Checked
state controls the Tab entry even after external rail selection. No CSS, catalog or dependency
change. Home/End is not claimed for these Base UI cards.

The initial candidate passes lint/types, 245 units/one optional skip, i18n and both existing
keyboard cases. Its two Appearance cases fail at pointer setup: Base UI does not emit a
change for an already-selected hash preference, so clicking it did not save that preference.
The follow-up retains the prior selected-card click-to-save behavior; all **four unchanged
targeted cases now pass** in 21.679s. Confirmed lint/types/i18n pass; the mechanical detector
has zero findings. All eighteen recorded stages show one selected Tab stop and agreement
between the Appearance and rail selections. Both positive images were inspected full-size.
Original candidate source/results remain retained. The full **113-case Electron suite passes**
in 284.403s, zero retries/skips/flaky cases. Linux package/smoke passes; all 90 packaged build
members match. [Final artifact audit](electron-final/README.md) verifies 149 images, nineteen
contact sheets and two full-size Appearance views. All 90 members and 514 input bindings
match the tested source. The later matching CI and installed checks above complete this
correction's verification scope.
The final-source unit run also passes 245 cases with one optional backend skip.
[Native harness source review](native-preparation/appearance-theme-native-review.md) approves
the prepared two-capture check, including actual OS appearance, all four arrows, Space and
Tab entry/exit. That original driver failed before capture because CDP forced light media;
the independently reviewed one-line media reset passes fresh-profile confirmation above.
[Actual source review](source-review.md) approves the final three-file implementation.
The later [screenshot-free preview check](preview-check/result.json) passes eight groups:
arrow focus retains the same card node, external rail selection retains one Tab entry,
Tab exits to Language, System follows both OS schemes, and reload retains System without
persisting preview preferences. This closes the review's then-unverified preview concern.
Historical reference captures retain their original source and size; current native acceptance
is limited to the two captured Appearance states and recorded interaction sequence.
The frozen manifest has no Appearance state ([reference gap](reference-gap.json)); this
existing Settings gap remains explicit. Before/after behavior images do not replace it.
