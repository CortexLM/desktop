# Saved Files native — source preparation only

Corrected scratch sources: `/tmp/opencode/files-native.mjs`, `launch-files-native.py`, this runbook.
Backend remains byte-identical `5c8239ef27f8d962b4a1cd5fcfb08e34c8ba4f3871f5242fe1043f73ef90476d`;
original collector/helpers remain archived under `evidence/mac/d20a012/scripts/`.
Driver syntax and launcher AST checks only; imports/runtime remain unexecuted by this executor.
Coordinator compiled the unchanged Save AppleScript; its scoped AX diagnostic is recorded below.
Application input binding: `d20a012fbb774aa9b348fe1913f85d3476430098`.
Local binding is `evidence/files-live-followup/production/application-pin.json`;
`/tmp/opencode/build-files-corrected/members.json` is rebound; original dirty receipts remain historical.
Linux ASAR `9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893`
is **not** Mac admission. Use the coordinator's independently verified Mac ASAR/full member manifest.
CI `37153526225` passes; matching Mac package admission is separately recorded. No new CI/device query here.
Old `9ba8e59`/`d390cce`/Memory/Projects revisions are rejected by driver and launcher.

## Fixed scope
- Four entire-window CoreGraphics-ID originals, 960×640, sidebar shown:
  `files-fit-light.png`, `files-zoom-light.png`, `files-fit-dark.png`, `files-zoom-dark.png`.
- Actual System Events appearance, shell System, unmodified media; samples saved before assertions.
  Eight native samples: before/after each original, PID/window/foreground/bounds/OS continuity.
- Five geometry targets each: filename, toolbar, image viewport, metadata card, Download.
  Descendant text clips, center hits, focus-visible and original hashes retained before/after.
- Exactly one local Chat, one accepted image prompt, one completed fixture response via real IPC.
  Then provider disabled before Chat mounts; Open uses Enter in light, pointer in dark.
  Exact session/message/part URL, decoded dimensions/RGB, displayed bytes and format checked.
- Zoom in/out, keyboard Fit, Tab to viewport, `+`, ArrowDown pan, portrait minimap ratio.
  Pan saves actual pre/post CSS translations and finite numeric displacement; unchanged zero cannot pass.
  The two bands' colors repeat red/blue/red over three 60-row horizontal bands.
- One dark native Download after the four captures, exact original byte equality including tEXt.
  No extra Save screenshot; accessibility readback supplies the separate dialog evidence.
- 150-second fixed flow deadline; 45-second separate cleanup deadline; 195-second absolute watchdog.
  Raw evaluate/CDP/fonts/import/body awaits are capped at remaining time (normally ≤10 seconds).
  Timeout latches flow failure; no subsequent flow operations. Cleanup checks its own remaining time.
  Each IPC request is saved as pending before awaiting; a timed-out admitted write may finish in main
  with an unknown ID. Such records stay isolated for coordinator recovery; no whole-flow Promise race.
  4 capture requests, 8 samples, 3 MiB/original, 12 MiB total, 400 KiB manifest, 100 IPC calls
  (20 reserved for cleanup), ≤10-second UI waits, ≤15-second SSH/capture calls, all capped by remaining time.
  Save AX probe ≤12 seconds; downloaded-file observation ≤8 seconds. No rerun/budget extension.

## Fixture and helpers
`files-native-backend.mjs`: new `cortex-files-native-v1`; health/catalog/receipt GET only;
one `/v1/chat/completions` POST, strict key/model/system/user text+image URL, no tools.
Request ≤64 KiB; receipt ≤32 KiB; only metadata retained, never raw authenticated bodies/key.
Catalog `fake/reasoner` declares image input and no tools. Main receives a write-only fixture key
and explicit loopback baseURL; packaged test-provider override remains prohibited.
Inline PNG: 393 bytes, RGB8 120×180, two colors, three bands; tEXt description preserved.
SHA-256 `35d49e647469369311f7f223d9e340034f77a96cceee1f27f5ebff8bbe3174cf`.
Generated once offline with Python stdlib PNG chunks/zlib; no app encoder, PIL or image file dependency.
Deferred `validateFixture()` checks exact hash, CRCs/chunks, inflated length and every RGB sample.
`launch-files-native.py` copies the f82a648 launch/inspect/capture guard structure, changes Files
root/backend/self names, rejects old revisions and adds owned `--cleanup` for the new helper names.
Before quit, cleanup reruns pure `inspect` to verify running PID/root/arguments plus ASAR binding;
unrelated Cortex refuses cleanup and remains untouched. An absent app permits helper cleanup.
Owned exit is awaited for ≤5 seconds and recorded; ordinary reopening requires no Cortex process.
Full ASAR checks: launcher admission, driver start/end, cleanup ownership check; never per capture.
Driver self-hashes actual import URL; new helper hashes are pinned, not borrowed from old helpers.

## Native Download — observed shape, Save delivery still pending
Local `electron.d.ts:8399–8418` documents default Save dialog; main installs no `will-download`
handler. E2E `item.setSavePath()` bytes prove engine delivery, not the default installed dialog.
Playwright 1.63.0 is pinned: `connectOverCDP({noDefaults:true})` preserves browser download behavior.
No `setSavePath`, synthetic anchor, interception, default Downloads search or alternate save path.
Candidate native flow requires Cortex foreground/exact PID, one AXSheet on window 1, exactly one
descendant Save button and text field equal to `Cortex native portrait.png`. It writes that name,
uses **Command+Shift+G**, requires a nested sheet and focused AXTextField, enters the fresh owned
directory, returns, rechecks owner/name, clicks Save once, requires the sheet to close.
AX stdout/stderr bytes (base64), byte counts, SHA-256 and exit/timeout retained before validation.
`/tmp/opencode/files-save-probe-d20a012-1/manifest.json` SHA-256
`4492c170668ffb2752431d1f174381039a0af6bb4f94d6e449daf08506292f69` records foreground PID 76250,
the exact Save filename/outer sheet and one nested Go-to-Folder sheet with focused AXTextField.
Its 14.398-second flow/19.609-second total remains failed solely for the diagnostic's missing Go-button
cancel expectation; the main Save script has no such expectation. Seven other cleanup checks passed;
coordinator's guarded Escape/Cancel is separate evidence. No actual Save/byte-delivery proof followed.
Main typing/Return/Save and four-capture timing remain unexecuted. Unknown layout/timeout fails closed;
no additional diagnostic, rerun, budget increase or capture expansion is authorized by this correction.

## Coordinator execution after Mac package and source admission
1. Lease and inspect the screen. Record pre-lease OS dark value before quit/install; preserve prior app.
   Current Activity PID/dark values are historical coordinator inputs, not fresh device observations.
2. Use a screen-recording/accessibility-authorized GUI host. Reserve Mac 9444/9445/9456,
   local 19444/19445; preserve unknown owners. Create fresh `/tmp/opencode/desktop-files-native-<revision>-<attempt>`.
   Replace staged old driver/launcher with verified corrected hashes; backend is unchanged.
   Stage exact Mac member JSON; install only the admitted Mac package.
3. Set `REVISION`, `ASAR_SHA256`, `RUN_ROOT`, `MEMBERS` (absolute local Mac-member manifest),
   `OUTPUT=/tmp/opencode/files-native-<revision>-<attempt>`; output must not exist.
   In the GUI host: `/usr/bin/python3 "$RUN_ROOT/launch-files-native.py" "$RUN_ROOT" "$ASAR_SHA256" "$REVISION" "$RUN_ROOT/package-members-input.json"`.
4. Own one tunnel: `ssh -N -o ExitOnForwardFailure=yes -L 19444:127.0.0.1:9444 -L 19445:127.0.0.1:9445 mac-live`.
5. From repository root, run once: `node /tmp/opencode/files-native.mjs "$OUTPUT" "$RUN_ROOT" "$ASAR_SHA256" "$REVISION" "$MEMBERS"`.
   Retain exit status, manifests, original PNGs, sources/hashes, admission, launch/binding/backend receipts.
   Review four full-size originals and AX readback; only coordinator's pre/post device guards are additional.
6. Driver cancels only a recognized owned Save sheet on failure; unknown nested dialogs stay explicit.
   Download cleanup targets only `$RUN_ROOT/native-download/Cortex native portrait.png`, regular single-link
   exact original bytes/hash, plus matching inode/device when observed. Mismatches/partials stay retained.
   Owned Chat removed, fixture key removed, provider defaults restored, initial OS/theme/route restored.
   Sanitized `{providerID:"fake",enabled:true,hasKey:false}` remains: no provider-delete API exists.
   Isolated profile/journal and download directory remain; logical deletion is not physical erasure.
   Accepted writes with missing IDs stay isolated for explicit recovery; never infer ownership for bulk deletion.
7. Resolve any retained modal first, then GUI host: `/usr/bin/python3 "$RUN_ROOT/launch-files-native.py" --cleanup "$RUN_ROOT" "$REVISION"`.
   Ownership refusal preserves unrelated Cortex/helpers for explicit recovery; read `cleanup.json`.
   After successful owned cleanup it forces dark and opens ordinary Cortex only when absent.
   Afterwards restore/read back the exact pre-lease OS value;
   verify ordinary PID/args/window/theme, stop owned tunnel, verify five ports closed, release lease.

No runtime acceptance from this preparation. Other formats, long names, restart, races/deletion,
oversized/malformed files, other locales and full-product behavior remain outside the native scope.
