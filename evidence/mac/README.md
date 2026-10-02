# Native Mac evidence

Installed artifact: [CI 36957854761](https://github.com/CortexLM/desktop/actions/runs/36957854761),
code `d40b5d786a44657cf18ea5b990d83f3a357034e1`, unsigned Cortex 0.2.0 arm64.
Installed at `/Applications/Cortex.app`; macOS 26.6.2, 1024×768 desktop.

- **426 native window captures**, 213 registered states × light/dark; 1024×685 pixels.
- `screens/*.webp`: lossless conversion of native `screencapture` PNGs, including traffic
  lights and title bar. Original PNG hashes are recorded in [manifest.json](manifest.json).
- [index.html](index.html): full-resolution capture browser; `contact-*.jpg`: review sheets.
- `menus/*.webp`: seven native menus in each appearance, whole desktop captured.
- The sweep asserts the requested route/theme and nonempty screen content, records uncaught
  renderer errors (**zero**) and the installed `app.asar` SHA-256. Image variance checks found
  no blank main panes. Every contact sheet was inspected; suspect panels were read at full size.

Navigation used CDP over SSH. Pixels came from `screencapture` in the authorized graphical
session via `scripts/mac/capture-server.py`, not a renderer screenshot. Direct SSH capture
failed the Screen Recording permission check; the authorized path is explicit.

## Findings and scope

These are preview screens with fixtures, not live-provider or backend-flow proof. Native
menus initially exposed unimplemented destinations and duplicate fullscreen entries; small
panels clipped Code suggestions, Canvas controls and Work computer controls. Corrections
are being verified separately; this revision is not claimed as final visual acceptance.

The yellow native traffic light was clicked through mac-computer: accessibility reported
`AXMinimized=true`; restoring it yielded the visible window again. The green light yielded
`AXFullScreen=true`; leaving fullscreen restored the same window. Source E2E assertions
cover window title/minimum size, traffic-light coordinates and localized native menus.
Native screenshot review supplements those assertions; it does not replace them.

CI's native screenshot could not run without Screen Recording permission. Its packaged
renderer screenshot is in `../ci/macos-ci-packaged-renderer.png`; these installed-app
captures provide the separate native-window evidence. Signing/notarization is unproven.
