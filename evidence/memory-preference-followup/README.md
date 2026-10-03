# Persistent saved Bot memory pause

Application `96df66ce727c42ddf647b2dcb4eeeff04fda4927` is pushed;
[CI 37139741944](https://github.com/CortexLM/desktop/actions/runs/37139741944) passes
all three jobs, including the unsigned macOS package/smoke.
[Post-commit binding](final/application-pin.json) verifies all 516 tested package inputs.
Original run receipts retain dirty base `74579d5`. Projects' earlier passing CI/native
evidence does not establish this new behavior.

The source-only [contract audit](source-contract.md) found two ineffective controls:
Settings Privacy saves a renderer preference unused by inference; Memory resets its local
switch after remount. An actual `f82a648` Electron [baseline](baseline/receipt.json)
reproduces both: Privacy false is ignored by Memory, whose own false resets on reload.
The first collector used an incorrect exact accessible name; that selector failure remains
separate from the reproduced result. All 90 baseline build members matched `f82a648`.

The [implementation contract](implementation-contract.md) uses one strict persisted engine
setting, existing controls and absent-only legacy import. Pausing preserves manual notes
and existing history; only future admitted Bot context changes. Personal cross-Chat memory
and automatic learning remain absent. Seven live keys are translated across eight locales;
[copy review](copy-review.md) records author review and native-speaker review limits.

The initial production candidate passes lint/types/i18n, **260 units plus one optional
backend skip**, 14 targeted Electron cases and **124 full cases / 426 render visits**.
Eight locales cover 64 live text states. Linux package/smoke matches 90 build members,
516 inputs and renderer fingerprint
`30ec7f97fb1de75ba4dc66fa81a4dfba0e76cd16008bfa53600d7ca512b810fb`.

[Renderer review](initial-renderer-review.md) identified a further canceled-preview
navigation race outside those tests. A new case reproduces two failures: stranded loading
after GET, and a checked/disabled switch after an accepted false PUT. The single-hook
actual-boundary correction passes the unchanged case inside **21 targeted cases**,
including existing navigation and Memory safety checks. Both baseline failures remain in
[navigation evidence](navigation/summary.json); the earlier green candidate keeps its scope.

The corrected Linux package/smoke binds 90 members/516 inputs and renderer
`64a314be9950c61466f8beec1b1ef50aa7f5b60a7f67d67bc3deff805a5800ef`.
The coordinator inspected all 26 targeted-image contacts plus four full-size views;
[lossless images](targeted-images/index.json) retain exact pixel identity. Final full-suite,
**125/125 cases / 426 render visits**, passes in 293.095 seconds, zero retries/skips/flaky
outcomes. The [independent local artifact audit](electron-final/README.md) verifies
173 unique frames, 12 full-size targets, all package inputs and actual model payloads.
[Matching CI image review](ci-96df66c/README.md) verifies 125 cases/426 visits per OS,
339 images/24 primary full-size targets and all sixteen auth-locale images exact to
`f82a648`. Memory covers 64 states/112 text rows per OS. The CI native-display capture
failure remains separate from its passing process/window/renderer smoke.
[Independent installed-image review](../mac/96df66c/native-audit/README.md) accepts
four native images, both-theme paused access and one dark-theme note deletion.

[Independent macOS package admission](../mac/96df66c/package-review.md) verifies
artifact `11279989876`, all 91 ASAR files/92 blocks, 90 build members, 104 catalogs and
the bundled skill. Its ASAR exactly matches the tested Linux package. The first installed
collector [stops before capture](../mac/96df66c/initial-native-probe/README.md); all eight
cleanup checks pass. A separate appearance-readback diagnostic motivates a collector-only
correction. The failed run retains its original status. The [fresh-profile corrected run](../mac/96df66c/README.md)
passes four native captures/checks in 68.646 seconds, including paused-note deletion.
All eight cleanup checks pass; the original OS appearance returns, five ports close,
ordinary Cortex reopens and the Mac lease is released.

[Independent preview comparison](compare/final/README.md) accepts 32 final captures:
16 frozen references, 16 explicit Settings gaps. Initial and corrected-hook receipts stay
separate; 28/32 main-content regions match exactly, remaining changes are within mascots.
The maximum frozen difference is 0.063522%. This establishes preview preservation only.
