# Files native collector — independent source review
**CHANGES REQUIRED: three P2 corrections below.** Source review plus supplied AX receipt readback; main collector acceptance remains pending.
Application `d20a012fbb774aa9b348fe1913f85d3476430098`; inspected selectors/engine/SDK paths match that source. Package and CI image audits remain separately owned.
Only this report written. No delegation, device/network access, collector import, backend launch, application/test execution, build or source edits.

## Reviewed SHA-256 pins
- `/tmp/opencode/files-native.mjs`: `fb1bf733f6982190817408f73d33e4b96aea44708fca876de8487c1d6767b9eb`
- `/tmp/opencode/files-native-backend.mjs`: `5c8239ef27f8d962b4a1cd5fcfb08e34c8ba4f3871f5242fe1043f73ef90476d`
- `/tmp/opencode/launch-files-native.py`: `d7463d642ab0348e8bcebb58f18db9495fbc8594f0dfcdae657e6f9878d149c8`
- `/tmp/opencode/files-native-runbook.md`: `4417413bc6435200bec896a5d1c565bc5d054767405557bc2b9aacb00c23b71b`
Both `node --check` commands pass; launcher and embedded Python probes AST-parse without import. Independent literal-PNG analysis verifies CRCs, dimensions, metadata and every RGB row.

## Concrete corrections — one batch
1. **P2: cleanup can quit an unrelated Cortex process.** `launch-files-native.py:108–112` verifies only the on-disk ASAR/binding before `tell application "Cortex" to quit`; it never verifies the running profile/PID.
   Reproduction sequence: owned collector app exits; ordinary Cortex opens from the same admitted package; `--cleanup` still quits that ordinary app. The existing helper-PID checks occur afterward and cannot protect it.
   Minimum: reuse `inspect(root, expectedAsar, revision)` immediately before quitting; require the recorded isolated PID/root/arguments, then quit that owner and wait for its exit. If no owned process remains, preserve other Cortex processes and report that disposition. Keep helper command/root checks and coordinator port readback.
2. **P2: the 150-second flow bound does not cover raw awaits.** `files-native.mjs:108–109,135,151` checks elapsed time only between operations. `page.setDefaultTimeout(10000)` does not time-limit `page.evaluate()` awaiting IPC or `document.fonts.ready`; CDP sends likewise lack a local deadline.
   A held `window.cortex.request` Promise at `:135` can leave the driver awaiting indefinitely, never reaching the next budget check or `finally`; advertised cleanup cannot start.
   Minimum: bound raw evaluate/CDP awaits with the remaining fixed 150-second deadline (and an explicit per-operation ceiling), latch failure before subsequent flow operations, retain unknown accepted IDs for existing recovery, keep cleanup separately bounded. Do not race an uncancelled whole-flow Promise that continues later mutations/captures.
3. **P2: keyboard-pan proof can pass with zero movement.** `files-native.mjs:176–177` compares the post-key CSS serialization only with literal `'0px 0px'`, then records `keyboardPan:true`.
   CSSOM may serialize the zero pair as `'0px'`; an unchanged zero translation therefore passes. The value is not compared with the actual pre-key position.
   Minimum: sample translation immediately before ArrowDown at 150%, poll until it differs, retain both values; ideally check finite numeric displacement within the current pan bounds. Existing `tests/e2e/files-live.spec.ts:160` already uses the before/after pattern. Preserve the four-capture budget.

## Confirmed source behavior
- Backend import is inert: `serve()` runs only when realpath of the entry file equals the backend module; `validateFixture()` itself performs no network/startup. Adjacent helper hashes match the driver's pins.
- Fixture is exactly 393 bytes, SHA-256 `35d49e647469369311f7f223d9e340034f77a96cceee1f27f5ebff8bbe3174cf`, RGB8 120×180, red/blue/red 60-row bands; tEXt is `Description\0Cortex native two-color portrait`.
- Exact system/user-message array matches build-agent prompt, no directory/Bot/Project context, and compatible SDK text+`image_url` conversion. JSON object property ordering is not significant to `deepEqual`; message/part array ordering is intentional. No incompatible whole-body equality imposed.
- `tool_call:false` prevents tool generation independently of the agent's capabilities; compatible reasoning adds none of the forbidden fields. One real IPC prompt, one terminal SSE response and exact persisted parts/answer/reasoning are checked; backend request/key/model/counter guards fail closed.
- Provider is disabled before Chat mounts; exact Open label/tuple, Fit/zoom labels, metadata and 120×180 decoded color samples match current UI. No synthetic renderer file payload or inference bypass is used; canvas only samples the actually loaded image.
- Playwright 1.63.0 implementation confirms `noDefaults:true` leaves default-context download behavior untouched; no `Browser.setDownloadBehavior`, `will-download`, `setSavePath`, synthetic download anchor or interception in this collector. Media overrides reset to null; actual System Events appearance is checked against System-theme renderer state.
- Four requests/eight native samples/twenty primary geometry targets are enforced; descendant clipping, center-hit and focus checks repeat after capture. `.medias-view[role=img]` intentionally has no text fragments and satisfies the named-region allowance.
- Original images come solely from `/usr/sbin/screencapture -l <CoreGraphics window ID>`; no Playwright page screenshot. Before/after foreground/PID/window/bounds/OS samples plus CDP PID bind the window. Window-only capture excludes unrelated-process overlays; samples are bounded, not atomic.
- Fresh output/root checks, exact ASAR/full-member-set equality, helper hashes and isolated engine/renderer arguments precede controlled writes. Supplied revision/member identity remains conditional on the coordinator's independent package admission; this report does not reinspect artifact 11284474514.
- AX candidate checks exact PID/name/foreground, one sheet, one Save button and matching filename field; nested Go-to-Folder role/value and post-save closure are recorded before assertions. Shell/Python arguments are quoted; filename/path inputs are controlled ASCII; no clipboard overwrite occurs.
- Download verification compares all original bytes, preserving tEXt; removal is restricted to the fresh root's exact regular single-link file, expected bytes and observed inode/device. Unknown/partial files and unknown nested sheets remain retained; profiles/backups are never recursively removed.
- IPC cleanup targets only the created Chat and fixture key/config; default keyless provider metadata intentionally remains. Original theme/OS/route restoration is checked; launcher forces dark only before the runbook's explicit pre-lease restoration.

## Runtime qualification
Coordinator reports exact Save AppleScript successfully `osacompile`d on the Mac. Supplied `/tmp/opencode/files-save-probe-d20a012-1/manifest.json` (SHA-256 `4492c170668ffb2752431d1f174381039a0af6bb4f94d6e449daf08506292f69`) was read offline.
Its AX records show PID 76250, Cortex foreground, one window/outer sheet, Save/Cancel and exact Save As value; Go-to-Folder is one nested sheet with focused AXTextField. This matches the main collector's role/value contract; it never requires the diagnostic's nonexistent named Go button.
Diagnostic flow 14.398s, total 19.609s, one exact image inference/zero backend errors; status remains **failed** solely for its cancel-path `Unknown Go to Folder focus`. Save confirmation/file bytes were not exercised. Coordinator-reported guarded Escape/Cancel cleanup is separate; seven other diagnostic cleanup controls pass.
Update runbook's uncompiled/unobserved/queued wording with these scoped receipts; helper/source corrections need fresh hashes. Actual typing/Return/Save behavior and four-capture timing remain unexecuted for the main collector, not an additional speculative gate.
After the three corrections, run once within the original budget; retain failures, originals, AX readback and cleanup receipts. No retry/budget increase, native screenshot acceptance or full Files/text acceptance follows from this review.
