# Installed Mac corrections — cc758a6

Clean-installed unsigned arm64 [artifact 11242356217](https://github.com/CortexLM/desktop/actions/runs/37039827971/artifacts/11242356217)
from green [CI 37039827971](https://github.com/CortexLM/desktop/actions/runs/37039827971).
Application revision: `cc758a69fe9349d17f6a4bf7accd978421035519`.
ZIP SHA-256: `a850b0072173159539735d9274dcdee813fbecc7e0c18a4edbabc1ad66378443`.
Installed asar SHA-256: `019a846b01c127da1cd612f6c16c21fd6b42e534454328c1095f7defd6dec5a7`.

**18 native captures**, nine cases per appearance; sixteen at **960×640**, two Chat refusal
captures at **1024×685**. Zero renderer errors. GUI LaunchServices launch:
`open -na /Applications/Cortex.app`, isolated profile/engine, English, local catalog fixture.

- Reduced-motion Home reload: heading inherits the active theme color; transitions compute
  to `0s`, animations to `0.001s`.
- Work board: two columns, no horizontal page overflow; lower columns reached vertically.
- Work completed preview: sidebar Bot reflects task activity. This is a preview fixture.
- Code instructions: inline code computes to 11px.
- Chat image refusal: retained image/draft, accessible model/send/remove controls, selection
  of an image-capable model while the refusal remains visible; checked at both widths.
- Code refusal: retained draft and reachable composer/model/send controls.
- Live Work refusal: reachable composer controls, retained draft and To do badge; reload
  preserves To do and the engine's message history remains empty.

Pixels come from OS `screencapture`, not CDP. `capture.mjs` records interaction assertions.
Reduced motion is enabled. The Chat toast clock is paused and advanced 100ms for menu/resize
operations because remote capture exceeds normal toast lifetime; committed CI recovery tests
separately use real timers. The suite's route-intent assertions run in CI, not in this capture script.

All eighteen frames were inspected through the contact sheet; Home dark, Chat refusal light
and Work refusal dark were also inspected full-size. [Full-resolution gallery](index.html).
`manifest.json` binds original PNG hashes to retained lossless WebPs; decoded RGBA equality
was checked for every conversion. `install.json` verifies eight locales, thirteen catalogs each,
no raw fixtures/source stamps and the bundled summarize skill. The previous app is preserved.

Cleanup verified: helper stopped, remote ports 9444/9445 closed, SSH forward stopped,
ordinary installed app restored, shared Mac lease released.

This targeted run supplements the [5ced8aa full native sweep](../5ced8aa/README.md).
Its 426 captures, native menus and window-action evidence retain their original revision.
This run does not establish exhaustive minimum-window, live workflow or whole-product acceptance.

The independent product-delivery readback later rehashed the application ZIP/ASAR, 59 embedded
build members and all 18 original/retained image pairs. It confirms receipt integrity and
source binding, not new native interactions or remote inference. Report pin and limits:
[scoped readback](../../recovery-followup/scoped-design-closures.md#product-packagenative-readback).
