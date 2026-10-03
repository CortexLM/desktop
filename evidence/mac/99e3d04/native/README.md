# Installed 99e3d04 — independent Appearance audit

**Scoped PASS: English Settings Appearance, two 960×640 native states and the recorded interaction sequence.** Both original PNGs and retained WebPs inspected full-size; decoded **RGBA is exact**, including transparent-pixel RGB.

## Executed confirmation

| Item | Verified receipt |
| --- | --- |
| Application | `99e3d04a8dab6b51b6cf23bcdae0365624492e0f` |
| UTC interval | `2026-10-03T13:21:49.994Z`–`13:23:10.911Z` |
| Duration | **80,917 ms / 80.917 seconds** |
| Installed ASAR | `f0b5f9ee60b8170d69bdd7bc04fa636a44f3360bc90082d41437097b1c902aae` |
| Members JSON | `3b996ff64590a75312b188ba83ca153338b1b4a683d6fd0b8ae7d20110f360e6`; **90 members** |
| Executed driver | `9cffda47c56978f012f6a405abe5fcdb81e3a2678c796046536ceae000e883c1` |
| Main / CoreGraphics window | PID **63872**, window **8824**, foreground in both captures |
| Window / pixels / viewport | `{X:0,Y:30,Width:960,Height:640}` / **960×640** / **960×640** |
| Isolated root | `/private/tmp/opencode/desktop-terminal-state-appearance-theme-99e3d04-confirm` |
| Backend run ID | `709bdf8b-61ff-46f3-8b55-1b0241d301a6` |
| Original manifest | `c9f07314771736d510c311cba1315df908caf1a25441db5211b0af85a6f402f4`; **88,803 bytes** |

[Manifest](manifest.json) and [run log](run.log) preserve original bytes. [Invocation](invocation.md) records Node v22.23.3, executable, argv and cwd. [Image index](retained.json) binds original PNG and retained WebP/RGBA hashes; [checks](checks.json) pins **37 existing root/helper/history/package references**.
Installed before/after identities agree with [installed](../installed.json), [binding](../binding.json), [launch](../launch.json), [members](../members.json) and [collector correction](../collector-correction.json). All executed helper hashes match retained scripts and their [hash receipt](../scripts/hashes.json).
The [independent package review](../package-review.md) and retained [summary](../package-audit/summary.json) verify 91 ASAR files/92 integrity blocks, exact 90 build members, 105 resources, 514 inputs and 473 renderer inputs. This audit verifies their retained hashes without duplicating package/source payloads.

## Exact interaction coverage

**47 state/focus checks: two initial, 23 light, 22 dark.** Every check retains the same connected Appearance radiogroup; main and rail checked values, selected Tab stop, hash and stored preference agree. Initial `theme=light` overrides the absent stored preference; clicking the already-selected Light card persists it.

- Pointer: main System/Dark selection and rail Light selection synchronize without replacing the group.
- System: actual macOS appearance changes produce matching renderer media/document themes while System stays selected. Recorded transitions include light→dark→light and later light→dark; no fixed media theme is used.
- Keyboard: all four arrows, three selections per direction, per theme: **24 transitions / eight wraps**. Space selects focused unchecked Dark in each theme.
- External Shift+Tab enters the selected card; Tab exits to English: **two entry/two exit checks**. Main radios have exactly one Tab stop; three Base UI sibling inputs remain `aria-hidden=true`, `tabIndex=-1`.
- Light has one additional final ArrowLeft selection before capture, explaining 23 versus 22 checks. Both captures re-enter the selected card through keyboard navigation and retain visible focus.
- The driver performs one initial reload before these actions. This evidence establishes in-session persistence/synchronization, **not post-action reload acceptance**. Home/End are outside this sequence.

All **21 direct engine calls are GET200**, three identical batches of seven recorded payloads: connection local/signed-out; sessions, Bots, tasks, providers, plugins and permissions empty. Collector source contains only that GET bridge call; the scenario creates no API writes or inference. [Backend receipt](../backend-receipt.json) matches: requests/failures empty, errors0, catalog0, health2, receipt5.
Page errors, console errors, renderer HTTP and unexpected dialogs are zero **after watcher attachment**, following unique-page identification and the awaited media reset. This is not a startup-wide error/network assertion.

## Full-size native captures

| Image | Independent visual result |
| --- | --- |
| [Light](images/appearance-theme-light.webp) | Light checked/focused; complete System/Light/Dark and English labels; visible blue focus outline |
| [Dark](images/appearance-theme-dark.webp) | Dark checked/focused; same unobscured controls and readable labels in dark appearance |

Both show native traffic lights, shown sidebar and English Settings. All **14 recorded geometry targets**—three cards, three labels and English per frame—have contained borders/ranges, opacity1 and successful hit checks. The input-only self-clip exception is present in the collector; none of these measured targets is an input. No clipping found in the bounded targets.
Focus is `:focus-visible`, solid **2px** outline, **1px** offset plus 2px shadow: light `rgb(59,130,246)`, dark `rgb(91,155,255)`. This is observed focus evidence, not a complete accessibility/contrast audit.
Original PNGs total **178,546 bytes**; lossless WebPs **64,648 bytes**. All RGBA bytes match, including **176 fully transparent pixels per frame**. No resize/crop; these are application-window captures, not full-desktop captures.

## Historical failure and source correction

The [initial attempt](../initial-media-override/README.md) remains **failed**,30.995 seconds,three checks,zero images; all five cleanup flags true. At `light:system-opposite-os`, OS dark mode was true while the CDP-overridden renderer remained light. Its twelve indexed historical files verify unchanged.
The separate screenshot-free [diagnostic](../initial-media-override/diagnostic.json) records three actual OS dark/light/dark switches with matching renderer media/theme/System after clearing overrides. It is diagnostic evidence, not the fresh confirmation.
Whole-file reconstruction proves executed9cff differs from original230f only by inserted line36: awaited `page.emulateMedia({ colorScheme: null, reducedMotion: null, forcedColors: null, contrast: null })` plus comment. Null releases CDP defaults; it does not choose a light/dark value. All assertions/actions/cleanup remain. [Media source review](../media-review.md) separately approves that correction.
Confirmation retains identical application ASAR/member bindings but a fresh isolated root, PID and backend run ID. The initial failed collector was corrected; no product change or waived assertion turned that old run into a pass.

## Cleanup and boundary

All **five driver cleanup checks** pass: appearance, preference and route restored; engine unchanged; zero inference. Previous preference was System with absent stored key and dark resolved appearance.
[Coordinator cleanup](../cleanup.json) records helpers **63869/63870** stopped, ordinary installed99e3d04 reopened, dark appearance restored. [Port receipt](../ports-closed.json), `2026-10-03T13:24:34.244115Z`, records **9444/9445/9456/9457/9458 closed**, SSH forwarding closed, lease released. These are retained receipts, not new device observations.
Scope remains two English Appearance states/this sequence: no all-screen, native-menu, all-locale, reasoning or remote-inference acceptance follows.
Offline verifier: `python3 /tmp/opencode/native-99e3d04-audit/verify.py`; [SHA256SUMS](SHA256SUMS) binds this packet. Only assigned native/scratch files written; no new device/network/CI/test/build execution.
