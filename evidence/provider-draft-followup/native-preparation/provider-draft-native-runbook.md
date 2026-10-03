# Provider replacement draft — prepared, unexecuted

Two new files only: `/tmp/opencode/provider-draft-native.mjs` and this runbook.
Independent source review precedes any native run. Coordinator supplies the corrected
application revision, admitted package, actual installed ASAR and complete members JSON.
No fixed future revision, ASAR, test count or native outcome is assumed.

## Existing controls and bounded proof

Source: `packages/app/src/screens/system/settings.tsx` `ProviderDetail` and English
`system.json`: switch accessible name **Enable**, button **Save**, input **Cortex test
provider API key**, password type, hint **Saved · {hint}**. Real test IDs:
`provider-row`, `provider-key-input`, `provider-key-save`, `settings-nav-providers`.
Baseline control/source pin: `2956564fbe31f882014d74ff3a7f920e839fd634`;
Settings SHA-256 `54e9b65e6f37710d6235e64f720e75f0ed03ec647cd1f0dd1bda63aca544285d`,
English system catalog `18dff6afda09dc67df5091b5a2440fc1f6b3e1d439230cd9fda6967f6be7b10a`.
The original success handler clears a replacement draft after a preference PATCH;
this prepared driver requires the corrected handler to preserve it. These are baseline
source pins, not the future installed package pin.

Per theme, light then dark, use only the actual Settings controls:
1. Save obvious placeholder A (`sk-test-original-1111`) using the real Save button.
   Require accepted config `hasKey:true`, hint `1111`, enabled, empty masked input.
2. Type B (`sk-test-replacement-2222`) once. Disable, then re-enable with **Enable**.
   Each PATCH must retain B, keep saved hint `1111`, perform no additional PUT.
   No refilling, slow/held requests, retries into green or injected main handlers.
3. Capture **draft-preserved-<theme>.png** after re-enable: B still password-masked,
   old saved hint `1111`, enabled switch, Save available.
4. Explicit Save accepts B. Require hint `2222`, empty password input, disabled Save.
   Capture **replacement-saved-<theme>.png**. Four primary captures in total.

Dark starts with saved B from light; its UI Save A resets the saved hint. Reload/navigation
occurs before a theme's draft is entered, never between its toggles and final Save.
Screens are native minimum-window **960×640**, English, shown sidebar, both OS/app themes.
Fonts/finite animations settle; existing toasts expire before capture. Key-row labels,
hint, input, Save and Enable geometry are checked; disabled Save may be visibly dimmed.
The password input remains focused/editable; no raw key is drawn or retained in receipts.

## Observation and cleanup

`Request.prototype.text` records only method/path at the existing renderer bridge's
body-read boundary, returning its original promise. It does not inspect/store the body.
`Response.prototype.json` returns the original result; singular `fake` configs produce
only status, field names, provider ID, booleans, four-character hint and no-key-echo flag.
Provider-list arrays are ignored. Direct bridge readbacks use `JSON.parse`, bypassing
these UI-only observers. Exact per-theme sequence: **PUT, PATCH, PATCH, PUT** with config
hints **1111,1111,1111,2222** and enabled values **true,false,true,true**.
Both observer arrays and actual sanitized provider GETs must agree after each UI action.
No request/response replacement, bridge assignment, main hook or CSS override is used.

Fixture `/catalog`, `/health`, `/receipt` are reused unchanged. Inference request list
must remain empty, errors/failures zero. A/B intentionally differ from the fixture's
inference credential. No prompt, session, tool or remote-auth operation is performed.
Final cleanup directly DELETEs the key, restores initial enabled=true, checks the exact
keyless config and sole allowed metadata row. Reload/reopen ProviderDetail must show
empty password input, **Stored on this device, never shown again**, no Enable/Remove.
Fresh sessions/Bots/tasks/permissions remain empty; connection stays local/signed-out.
Appearance and initial route restore separately. A cleanup failure marks the run failed.

## Reuse these three files without edits

| Original file | Required SHA-256 |
| --- | --- |
| `terminal-state-native-backend.mjs` | `d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d` |
| `launch-terminal-state-native.py` | `4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257` |
| `cleanup-terminal-state-native.py` | `c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a` |

Existing originals are beside the new driver in `/tmp/opencode/`; archived copies are
under `evidence/mac/2956564/scripts/`. Driver refuses different original helper bytes.
Its manifest records its own hash plus all three originals, actual executable/version,
argv/cwd, start/end/duration, members hash and before/after installed identity.
The `protocol` import does not start the backend; the original backend's execution guard
only serves when that file itself is the program entry point.

## Future execution — coordinator only

1. Admit the corrected CI/package. Acquire the Mac lease, inspect the screen, quit the
   ordinary app normally, install that exact app at `/Applications/Cortex.app`. Verify
   ports9444/9445/9456 and local19444/19445 free; preserve unknown process owners.
2. Choose fresh root/output names. Provide actual members JSON
   `{revision:"<40 hex>",members:[{path:"packages/app/dist/…",sha256:"<64 hex>"},…]}`
   covering the exact full app/desktop build set. Never reuse an executed output/root.

```sh
REVISION='<new-40-hex-application-revision>'
ASAR_SHA256='<actual-installed-asar-sha256>'
MEMBERS='/absolute/path/to/new-mac-package-members.json'
RUN_ROOT="/tmp/opencode/desktop-terminal-state-provider-draft-${REVISION}"
OUTPUT="/tmp/opencode/provider-draft-native-${REVISION}"
LEASE_ID='<coordinator-session-id>'
ssh mac-live mac-lease acquire "$LEASE_ID"
ssh mac-live "mkdir '$RUN_ROOT'"
scp /tmp/opencode/terminal-state-native-backend.mjs /tmp/opencode/launch-terminal-state-native.py /tmp/opencode/cleanup-terminal-state-native.py "mac-live:$RUN_ROOT/"
scp "$MEMBERS" "mac-live:$RUN_ROOT/package-members-input.json"
```

3. In the authorized Mac GUI terminal, set the same root/ASAR/revision values and run:

```sh
/usr/bin/python3 "$RUN_ROOT/launch-terminal-state-native.py" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$RUN_ROOT/package-members-input.json"
```

Original launcher opens `#/home` through `open -na /Applications/Cortex.app`; driver opens
`#/settings?section=providers&theme=<theme>` after readiness. Isolated engine/profile,
English locale and loopback catalog are launcher-owned. No dev-renderer/provider override.
Inspector checks actual installed ASAR, exact member set, canonical root and one main PID.
Browser-level `SystemInfo.getProcessInfo` and CoreGraphics bind that PID to one foreground
960×640 window. Original capture endpoint uses OS `screencapture`, not page screenshots.

4. Keep this foreground tunnel in a separate local terminal:

```sh
ssh -N -o ExitOnForwardFailure=yes -L 19444:127.0.0.1:9444 -L 19445:127.0.0.1:9445 mac-live
```

5. From the repository with installed Playwright dependencies:

```sh
set -o pipefail
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  /tmp/opencode/provider-draft-native.mjs "$OUTPUT" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$MEMBERS" | tee "${OUTPUT}.log"
```

Driver output includes four PNGs, eight action checks, eight UI mutations, masked-draft
booleans, sanitized config/readback arrays and native identity/geometry. Unknown future
PID/window/duration come from the actual run. Full-size review must inspect all four
original images before acceptance; retain PNG hashes and RGBA-exact conversions later.

6. Retain original manifest/log/images, helper hashes, binding/members, launch and backend
   receipts/logs. Inspect all four full images. Run the original cleanup from the GUI:

```sh
/usr/bin/python3 "$RUN_ROOT/cleanup-terminal-state-native.py" "$RUN_ROOT" "$REVISION"
```

Coordinator verifies recorded helper exits, three Mac ports closed, tunnel/local ports
closed, ordinary matching installed app restored dark, then retains cleanup/port/final
screen observations and releases the lease. Driver never owns helper/tunnel/lease cleanup.
The reused cleanup helper does not independently wait for exits or attest port closure.

```sh
ssh mac-live mac-lease release "$LEASE_ID"
```

## Preparation status

Source-only preparation. One `node --check` is the permitted syntax check; importing or
executing this driver starts device work and is prohibited during preparation. Independent
review and future admitted-package native execution remain coordinator-owned. Coverage is
ordinary sequential Settings editing, English/two themes; no slow-IPC, inference, menus,
all-locale or remote acceptance follows from this prepared source.
