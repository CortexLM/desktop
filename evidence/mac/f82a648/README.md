# Installed local Projects and wrapping correction

Application `f82a64800c0fffd6ebaa99e571a8af0fa4307095`, CI `37132419774`, artifact
`11277523097`; [independent package admission](package-review.md) verifies 90 members,
515 inputs, 104 catalogs and one skill. Installed ASAR:
`a6d3c4f59d10b3d3fd16e7309441ebb6aff1dd670e11ff06a57362eca805f422`.

**Scoped positive evidence; original runs retain failures.** Four native 960×640 captures
pass their per-image assertions: creation and overview in actual OS light/dark, 56 measured
targets, keyboard radios/tabs/focus, exact Project/Chat IDs and sidebar links. Screenshot-free
checks verify a 48-character creation preview and accepted/reopened 4000-character instructions.
Light-theme UI deletion preserves the Chat record/model/timestamps and empty messages.

The [four-capture collector](native/manifest.json) retains `status: failed`: it exceeded
its 120-second budget immediately before dark-theme UI deletion, finishing cleanup in
128.800 seconds. Its four original images and seven cleanup checks passed. A separately
reviewed [zero-capture dark deletion supplement](dark-delete-supplement/manifest.json)
passes that remaining interaction in **8.840 seconds**, with exact Chat preservation and
five cleanup checks. This combined bounded evidence is not a passing monolithic collector.

Earlier attempts remain distinct:
- [Terminal capture-host refusal](initial-screen-permission/manifest.json): 29.782 seconds,
  one HTTP500 capture request, zero originals. The native screen-recording permission prompt
  was observed. No permission was granted; the already-authorized GUI host launched later helpers.
- [Pointer-hover attempt](initial-toast-hover/manifest.json): 47.147 seconds, one passing
  light creation capture, then the creation toast intercepted Edit. Moving the pointer to
  the heading and awaiting dismissal is a collector-only correction; application bytes stayed fixed.

[Final restoration](final-restoration.json) verifies stopped helpers, five closed ports,
ordinary app PID and the exact pre-lease dark OS appearance after shared cleanup; lease released.
The prior installed `99e3d04` app is preserved in the recorded backup. No full desktop
screenshots or personal-window content are retained here; images are exact Cortex windows.

[Independent image/receipt audit](native-audit/REPORT.md) accepts the scoped composite;
its offline verifier passes. These checks use fresh controlled local
records and no inference. Source E2E owns nonempty transcript retention, process restarts,
busy refusal and race assertions; no native acceptance of those behaviors is implied.
