# Memory native — prepared, unexecuted

Driver `/tmp/opencode/memory-native.mjs`; source matches the current Memory contract and labels.
One `node --check /tmp/opencode/memory-native.mjs` passed; driver/imports remain unexecuted.
Renderer work is ongoing: independent source approval must follow the final tested commit.
Projects `f82a648`/closure `74579d5` provide helper provenance only, not Memory acceptance.
Use the future committed Memory revision and its exact admitted production CI macOS package.
Mandatory arguments: fresh output, fresh Mac root, actual ASAR SHA-256, full revision, members JSON.
Member shape: `{ "revision": "<40 hex>", "members": [{ "path": "packages/app/dist/...", "sha256": "<64 hex>" }] }`.
Include every renderer/desktop distribution member; count is discovered, never fixed at 90.
Admit Vite built with `NODE_ENV=production` or unset, not `NODE_ENV=test`/development React.

## Scope and budget
- Four originals only: `memory-off-light/dark.png`, `privacy-off-light/dark.png`, 960×640.
- Actual OS light/dark with shell System; CDP color/reduced-motion overrides released.
- One controlled Bot and note via real IPC; model reference deliberately unconfigured.
- No inference, sessions/Projects creation, provider configuration, auth, preview or migration exercise.
- Memory pointer-off plus Space on/off; Privacy observes off, Space on/off; revisit Memory off.
- GET settings after each settled UI state; full note and Bot metadata equality on every check.
- Paused Forget: Tab from Memory switch must reach its enabled button; pointer hit/focus checked
  in both themes; final dark Enter deletes that one note after all four captures.
- Five measured targets/image: Memory title/description/switch/paused body/note text;
  Privacy heading/selected nav/Memory label/description/switch. Separate Forget geometry twice.
- Fonts/finite animations settle; ancestor clipping, text ranges, opacity, center hits and
  focus-visible retained. Raw switch hidden input is not a geometry target. No blanket UI claim.
- **120-second flow budget**, checked at stages and after each retained image; cleanup may extend
  total duration and is reported separately by its checks. No budget extension or automatic rerun.
  Target 40–90 seconds before cleanup; this is a planning estimate, not an executed timing claim.
- 10-second UI/CDP waits, 15-second SSH/capture limits; 8 MiB/original, 32 MiB total;
  manifest ≤400 KiB, ≤180 IPC entries, bounded diagnostics. Failed downloaded originals retained.
- Exactly two full installed-ASAR inspections, before/after. Per image two native-window samples
  check foreground PID/window/960×640/OS dark via fresh CoreGraphics/AppKit processes; no per-action SSH.

## Reused unchanged helpers
From `evidence/mac/f82a648/scripts/`, placed adjacent to driver and inside fresh Mac root:
- `launch-terminal-state-native.py`: `4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257`
- `terminal-state-native-backend.mjs`: `d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d`
- `cleanup-terminal-state-native.py`: `c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a`
Launcher verifies all ASAR members, isolated engine/renderer and expected process arguments.
Driver binds CDP browser PID, helper hashes and fixture receipt identity; native PNGs use only
the helper's CoreGraphics window-ID `screencapture`, never Playwright/CDP screenshots.
Main-only fixture GETs may serve catalog; inference requests/errors/failures must remain zero.

## Coordinator execution after admission and independent approval
1. Acquire Mac lease; inspect current screen first. Record exact OS dark value in the lease
   receipt **before quit/install**: `osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`.
   Preserve prior app. Quit ordinary Cortex, install the exact admitted future Memory package.
2. Check Mac 9444/9445/9456 and local 19444/19445 free; preserve unknown owners. Use an already
   screen-recording-authorized GUI host for helpers. Earlier Terminal capture permission failure
   is retained evidence; no new permission grant or screenshot retry is part of this plan.
3. Supply unique paths and future pins; copy the three byte-identical helpers and member JSON
   into a newly created Mac root. Never reuse a previous engine/renderer root or output:
   `RUN_ROOT=/tmp/opencode/desktop-terminal-state-memory-<revision>-<attempt>`
   `OUTPUT=/tmp/opencode/memory-native-<revision>-<attempt>`
   `REVISION=<future-40-hex>; ASAR_SHA256=<actual-64-hex>; MEMBERS=<absolute-members.json>`
4. In that authorized GUI host run the unchanged launcher:
   `/usr/bin/python3 "$RUN_ROOT/launch-terminal-state-native.py" "$RUN_ROOT" "$ASAR_SHA256" "$REVISION" "$RUN_ROOT/package-members-input.json"`
   Keep the English renderer/ordinary launcher settings; driver requires `html[lang=en]`.
5. Keep an owned tunnel in a separate local terminal:
   `ssh -N -o ExitOnForwardFailure=yes -L 19444:127.0.0.1:9444 -L 19445:127.0.0.1:9445 mac-live`
6. From repository root, Node 22+ with existing Playwright dependencies; run once:
   `node /tmp/opencode/memory-native.mjs "$OUTPUT" "$RUN_ROOT" "$ASAR_SHA256" "$REVISION" "$MEMBERS"`
   Retain stdout/exit status separately. Never import or execute it during source review.
7. Driver guards empty Bots/sessions/Projects/providers/tasks/plugins/permissions, local signed-out
   mode, no legacy renderer preference, and GET `/api/settings` exactly `{memoryEnabled:true}`.
   Navigations use history/hash events, not reload; switches use incumbent controls only.
8. Retain manifest, originals, exact driver/runbook/helper sources, members, admission and
   launch/binding/backend receipts. Inspect all four originals at full size, both themes.
   Failures keep their own status/root/output; accepted writes whose IDs were never received
   may remain isolated and must be resolved explicitly, never by global record deletion.
9. Driver finally restores settings value `true`, deletes only its owned Bot (and remaining note),
   restores OS appearance, raw shell preference and initial route; verifies guarded lists empty,
   fixture zero-inference and unchanged installed identity. `/api/settings` has no DELETE:
   **the initialized settings document remains in the isolated profile**; absence is not restored.
10. Run shared cleanup in the authorized GUI host:
    `/usr/bin/python3 "$RUN_ROOT/cleanup-terminal-state-native.py" "$RUN_ROOT" "$REVISION"`
    It forces dark while reopening the ordinary app. **Afterwards**, restore/read back the exact
    pre-lease OS value; record ordinary PID/window/theme, absent isolated args, stopped helpers,
    closed Mac/local ports, owned tunnel termination. Release lease; retain restoration receipt.

No native claim about model memory injection, automatic learning, personal cross-Chat memory,
restart persistence, legacy initialization, preview isolation, refused writes or async races.
Those belong to engine/Electron suites. Full rewrite completion is outside this bounded check.
