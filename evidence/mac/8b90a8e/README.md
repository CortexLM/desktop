# Installed Mac corrections — 8b90a8e

Clean-installed unsigned arm64 [artifact 11234453471](https://github.com/CortexLM/desktop/actions/runs/37025236580/artifacts/11234453471)
from green [CI 37025236580](https://github.com/CortexLM/desktop/actions/runs/37025236580).
Artifact revision: `8b90a8e4b7b5d51274278c6bd204434cef190d25`; application source matches
`dc7f529f7a3cce2b375881436ba5a7dae4999c3a` (the later commit changes tests/documentation only).

**12 native window captures at 960×640**, six cases in both appearances; zero renderer errors.
Launched through the GUI session with `open -na /Applications/Cortex.app`, isolated renderer
profile/engine storage, English and a local catalog fixture. Native traffic lights are included.

- Work board: no horizontal page overflow, two columns, lower columns reachable vertically.
- Work completed task: shared sidebar mascot/state reflects the completed preview activity.
- Code instructions: inline code computes to 11px; native typography inspected.
- Chat image refusal: input/model/send/remove controls reachable; model changes to an
  image-capable option while the draft/image and refusal remain visible.
- Code refusal: input/model/send controls reachable; retained draft visible.

`capture.mjs` records the assertions and capture method. Pixels come from OS `screencapture`
through `scripts/mac/capture-server.py`, not a renderer screenshot. The native capture uses
reduced motion and pauses the Chat toast clock, advancing 100ms for each menu operation.
Initial remote attempts exceeded the normal toast lifetime; a paused-clock attempt needed
that event-loop advancement to open the menu. Those attempts are not counted as passes.
The committed CI recovery tests separately pass with real timers on both operating systems.

All twelve images and the contact sheet were inspected. `manifest.json` preserves original
PNG and retained WebP hashes; decoded RGBA bytes match exactly. [Full-resolution gallery](index.html).
`install.json` records the installed asar hash, eight locales, 13 catalogs each, no raw fixtures
or source stamps, and the summarize skill.

Cleanup: capture helper stopped; debugging ports 9444/9445 confirmed closed; SSH forwards
stopped; ordinary installed app relaunched; shared Mac lease released.

This targeted proof supplements the [5ced8aa full native sweep](../5ced8aa/README.md),
without reattributing its 426 captures or native-menu/window-action evidence to this revision.
Exhaustive minimum-window and live-product acceptance remain incomplete.
