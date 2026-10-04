# Installed Mac verification — 0e63f87

Clean-installed [CI artifact](https://github.com/CortexLM/desktop/actions/runs/36997513479/artifacts/11222855043)
from green [CI 36997513479](https://github.com/CortexLM/desktop/actions/runs/36997513479).
Application revision `0e63f876bbe3d0fe893c6c698ff3fadb6dcec702`; unsigned arm64;
macOS 26.6.2, 1024×768 desktop.

- `install.json`: asar SHA-256, eight locales, zero raw fixtures/source stamps,
  bundled summarize skill. Existing app directory moved aside before installation.
- `manifest.json`: 426 native window captures, 213 registered states in both themes,
  1024×686, zero renderer errors. PNG/WebP hashes and dimensions recorded; conversion verified pixel-identical.
- `screens/`: full-resolution captures including native traffic lights/title bar.
  Contact sheets support review; they do not replace the full-resolution files.
- `menus/`: seven native menus in two appearances. Pixels come from the authorized
  graphical session's `screencapture`, not browser/CDP screenshots.
- `window-actions.json`: observed native minimize/fullscreen behavior and launch context.
- `gallery.json`: native Help opens Gallery at scrollTop 0 with one loaded preview;
  native Go → Chat returns to the live home composer.
- Twelve contact sheets and all menu pairs inspected; no blank main panes found.
  [index.html](index.html) links all full-resolution screen images. This is a visual review,
  not an automated assertion that every control is reachable.
- Verification cleanup: capture helper stopped, remote ports 9444/9445 confirmed closed,
  SSH forwards stopped, shared lease released. Cortex remains open without debugging enabled.

## Launch-context finding

The initial sweep used a direct binary launch through SSH. Renderer themes worked, but
native menus stayed light after the OS dark preference changed; green-button and native
View fullscreen attempts left `AXFullScreen=false`. Those attempts are recorded as failures.

The same installed artifact relaunched through LaunchServices in the authorized GUI session
rendered dark menus. Native View → Enter Full Screen produced `AXFullScreen=true`, 1024×768;
leaving fullscreen restored the window. The final sweep/menu captures use this GUI-launched
process. A requested OS preference alone is not proof of native appearance.

## Scope

These are English preview fixtures. Coverage establishes current registered-state rendering
on the installed artifact, not every live interaction, translation, 960×640 layout or missing
product surface. Source CI covers native title/minimum size/traffic-light placement/localized
menus, plus the separate real engine/provider flows. Manual action observations supplement it.
Signing/notarization and complete design acceptance remain unproven.
