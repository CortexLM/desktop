# Saved Files native — source preparation only

Assigned sources: `/tmp/opencode/files-native.mjs`, `files-native-backend.mjs`,
`launch-files-native.py`, this runbook. No application, prior collector or evidence edits.
Both `node --check` checks pass; launcher AST parses without import/execution. Embedded AX remains uncompiled.
Application input binding: `d20a012fbb774aa9b348fe1913f85d3476430098`.
Local binding is `evidence/files-live-followup/production/application-pin.json`;
`/tmp/opencode/build-files-corrected/members.json` is rebound; original dirty receipts remain historical.
Linux ASAR `9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893`
is **not** Mac admission. Coordinator supplies the admitted CI macOS ASAR/full member manifest.
CI `37153526225` was coordinator-reported queued; this executor performs no CI/device query.
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
  The two bands' colors repeat red/blue/red over three 60-row horizontal bands.
- One dark native Download after the four captures, exact original byte equality including tEXt.
  No extra Save screenshot; accessibility readback supplies the separate dialog evidence.
- 150-second stage/IPC flow budget, fixed before execution; cleanup may extend total duration.
  4 capture requests, 8 samples, 3 MiB/original, 12 MiB total, 400 KiB manifest, 100 IPC calls
  (20 reserved for cleanup), 10-second UI waits, 15-second SSH/capture calls.
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
Full ASAR checks: launcher admission plus driver start/end only; no per-capture ASAR scans.
Driver self-hashes actual import URL; new helper hashes are pinned, not borrowed from old helpers.

## Native Download — unresolved installed AX shape
Local `electron.d.ts:8399–8418` documents default Save dialog; main installs no `will-download`
handler. E2E `item.setSavePath()` bytes prove engine delivery, not the default installed dialog.
Playwright 1.63.0 is pinned: `connectOverCDP({noDefaults:true})` preserves browser download behavior.
No `setSavePath`, synthetic anchor, interception, default Downloads search or alternate save path.
Candidate native flow requires Cortex foreground/exact PID, one AXSheet on window 1, exactly one
descendant Save button and text field equal to `Cortex native portrait.png`. It writes that name,
uses **Command+Shift+G**, requires a nested sheet and focused AXTextField, enters the fresh owned
directory, returns, rechecks owner/name, clicks Save once, requires the sheet to close.
AX stdout/stderr bytes (base64), byte counts, SHA-256 and exit/timeout retained before validation.
Unknown sheet layout, hidden-extension name, different language, permission prompt, default direct
download or timeout fails closed. This AX path is unobserved/uncompiled; independent source review
and coordinator's bounded installed diagnostic must settle it before runtime approval.
If that diagnostic uses a download, use a separate recorded isolated root; no silent collector retry.

## Coordinator execution after Mac package and source admission
1. Lease and inspect the screen. Record pre-lease OS dark value before quit/install; preserve prior app.
   Current Activity PID/dark values are historical coordinator inputs, not fresh device observations.
2. Use a screen-recording/accessibility-authorized GUI host. Reserve Mac 9444/9445/9456,
   local 19444/19445; preserve unknown owners. Create fresh `/tmp/opencode/desktop-files-native-<revision>-<attempt>`.
   Stage new backend/launcher and exact Mac member JSON; install only the admitted Mac package.
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
   It forces dark and opens ordinary Cortex. Afterwards restore/read back the exact pre-lease OS value;
   verify ordinary PID/args/window/theme, stop owned tunnel, verify five ports closed, release lease.

No runtime acceptance from this preparation. Other formats, long names, restart, races/deletion,
oversized/malformed files, other locales and full-product behavior remain outside the native scope.
