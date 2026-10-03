# Installed Appearance correction

Application `99e3d04a8dab6b51b6cf23bcdae0365624492e0f`; CI `37124432902` passes all three jobs.
Mac artifact `11274389994` is admitted against the frozen tested build:

- Outer ZIP: `4ab14b8e8657b1620a9306833ffc291b11823c3ca4e4d9888754653fe9b676e2`.
- Inner ZIP: `3ac93b98a28db6c5ca6eaf1b9f2e8df82e06b814a74411168804bc82316746a4`.
- ASAR: `f0b5f9ee60b8170d69bdd7bc04fa636a44f3360bc90082d41437097b1c902aae`.

All 90 build members match; 104 catalogs and one skill match Git. Main/preload/maps and CSS
remain byte-identical to `37c22c2`. [Independent package audit](package-review.md) passes.
The source-reviewed two-capture native driver checks theme/keyboard synchronization,
actual OS appearance, stored preference, focus and unchanged local engine state.
The admitted package is installed and launched through the GUI with a fresh isolated profile;
the previous installed app is preserved. The [first native run](initial-media-override/README.md)
failed before capture: Playwright's CDP defaults forced light media while actual macOS was
dark. A screenshot-free diagnostic releases those overrides and verifies three real OS
changes. The collector-only correction passes fresh-profile confirmation: **47 state/focus
checks, two native captures**, English light/dark at 960×640, in **80.917 seconds**.
Initial hash and explicit preference persistence, real OS-following System, four arrows with
wrap, Space, Tab entry/exit and unchanged group identity pass. Both full-size images show
readable labels, selected cards, keyboard focus rings and native traffic lights.
[Independent reset review](media-review.md) approves the exact one-line media reset;
the original failed run and its earlier driver review retain their own pins.

Application bytes remain unchanged. Page/console/fixture errors and inference requests are
zero; all five driver cleanup checks pass. [Cleanup](cleanup.json) restores ordinary dark
`99e3d04`; [ports/forwarding are closed](ports-closed.json), lease released.
[Independent native audit](native/README.md) passes both full-size images, exact RGBA
retention, 47 state/focus checks, fourteen geometry targets and 37 receipt references.
