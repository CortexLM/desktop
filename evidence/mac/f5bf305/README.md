# Remote foundation — installed Mac verification

Matching package verified. Six English installed auth captures/assertions pass at 960×640,
both themes. The corrected eight-locale native sweep passes 48 states, 144 Tab stops and
16 additional native wrong-code captures. [Retained-image audit](auth-locales/README.md)
verifies all sixteen full-size images and source/transport/geometry receipts.

- Application `f5bf305473db12fddfddcda890a01794f02f578f`; documentary `1076c2584941cf054efffaf709a149b4195bc1c4`.
- CI `37105137365`, artifact `11267761992`; [artifact receipt](artifact.json).
- Outer SHA-256 `d3d05506cd42d69a5fa5214372cf4d55a700bfe6488a8a7b14001360e282f3f5` matches GitHub.
- Inner ZIP `7dc146e4ad02aaf877b70aef312ce61e13292b42f391d0b7583dc4c11f8f1565`.
- ASAR `d34d6d8609045f56851a6004f5c7bb185108cd743732ff8b79d6e3689df7f14c`;
  [90 built members, 104 locale catalogs and skill](package.json) verified byte-for-byte.
- [514 package inputs](pinned-inputs.json) match the application Git pin;
  [473 renderer inputs](renderer-inputs.json), comparator fingerprint
  `5361c34082a62dfb944d47fc27b11695d3f9826870bb928f74670ba778cc3d9b`.

Native auth uses controlled loopback HTTP through the installed SDK/main. The private
remote Chat service has no UI route; installed auth checks establish neither its public
activation nor real Cloud inference. Prior [7885736](../7885736/README.md) captures retain
their original SDK/main/build binding.

[Authentication receipt](auth/manifest.json) verifies wrong-code retention, duplicate-submit
prevention, renderer reload, device-local sign-out, late cancellation, unavailable enrollment
and main-only private state. All six originals were inspected full-size and retained as
RGBA-exact lossless WebPs. Page/console errors and renderer HTTP requests remain zero.
[Independent review](review-auth.md) verifies all six full-size originals, fresh PID/ASAR
binding, all 90 build members, 32 workspace sources, 16 SDK modules and locale resources.

The first native-locale harness attempt failed during setup with zero captured views;
[its receipt](auth-locales-initial/manifest.json) retains that negative and successful
profile/connection restoration. It does not establish a locale UI failure or success.
Its error hash identifies unsupported `Browser.getWindowForTarget`; the corrected harness
uses native AppleScript sizing plus CG/AX bounds/state assertions.

[Cleanup](cleanup.json) stops fixture/capture helpers, restores ordinary LaunchServices
launch and dark appearance. [Five ports and SSH forwarding are closed](ports-closed.json);
the Mac lease is released. The earlier application backup is preserved.
