# Projects native — prepared, unexecuted

Driver: `/tmp/opencode/projects-native.mjs`. Preparation/source review only.
One `node --check /tmp/opencode/projects-native.mjs` passed. Driver/imports unexecuted.
Coordinator owns the future committed application revision, exact CI macOS package,
independent source approval, lease, device execution, four-image review and evidence archive.
Preparation originally preceded committed Projects `8e3fd79`. Its later CI package was
admitted separately. A subsequent long-text wrapping correction requires its own matching
package before this driver runs; input arguments must identify that final artifact.

## Admission and provenance

Mandatory runtime inputs: fresh local output, fresh Mac run root, actual installed ASAR
SHA-256, full 40-hex application revision, absolute path to complete package-members JSON.
JSON shape: `{ "revision": "<40 hex>", "members": [{ "path": "packages/app/dist/...", "sha256": "<64 hex>" }] }`.
Supply every renderer/desktop distribution member, including `main.cjs`, `preload.cjs`
and renderer `index.html`; use the actual admitted Mac package. No fixed member/input count.
The unchanged inspector compares the entire ASAR member set and every byte hash, validates
binding/member-file hash, isolated engine/renderer roots and exact installed process args.
CDP browser PID and foreground CoreGraphics window must bind that same installed PID.
The revision remains package-owner attribution; the driver cannot prove a Git/CI relationship.
Admit a production renderer build (`NODE_ENV=production` or unset), never a Vite build
with `NODE_ENV=test`; development React/StrictMode replay invalidates capture assumptions.

Unmodified shared files come from `evidence/mac/99e3d04/scripts/`:

| File | SHA-256 |
| --- | --- |
| `terminal-state-native-backend.mjs` | `d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d` |
| `launch-terminal-state-native.py` | `4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257` |
| `cleanup-terminal-state-native.py` | `c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a` |

The driver hashes itself and those three adjacent local originals; verifies the same three
files inside the fresh Mac root. Backend health binds protocol, run ID, root and script hash.
Helpers keep Mac ports **9444 CDP / 9445 window capture / 9456 fixture**.
Only 9444/9445 need local tunnels **19444/19445**. Fixture health/receipt use loopback
GETs over SSH. Catalog traffic is expected; inference `requests`, failures and errors must
stay zero. No fixture admin route, Cloud route, provider configuration/key or prompt is used.

## Bounded native sequence

1. Verify package/helper/process identity before attaching to the single installed page.
   Release Playwright defaults with `page.emulateMedia({ colorScheme: null,
   reducedMotion: null, forcedColors: null, contrast: null })`, matching the reviewed
   Appearance correction. Save actual OS appearance, raw theme storage, rail preference,
   resolved theme and initial URL.
2. Require empty Projects, sessions, Bots, tasks, providers, plugins and permissions;
   require local/signed-out connection. The new `/api/projects` must return 200/empty.
   An old installed build or any nonempty profile fails before writes; guard records
   contain status/count only, never existing records. Activate Cortex, set 960×640,
   select Dark then **System** through rail Home/ArrowLeft (an already-selected System
   pointer click does not persist storage), then use actual OS light/dark for each theme.
3. Click sidebar **New project**. Fill **Name** / **Instructions** with short English
   controlled data. Verify calendar/violet defaults and 48/4000 limits. ArrowLeft selects
   Rocket; color arrows select Orange in light, Teal in dark. Verify all eight/six native
   button radios, checked-based single Tab stops, fourteen aria-hidden `tabIndex=-1` inputs.
   Tab from Instructions through Cancel to Create project, leaving visible keyboard focus.
4. Capture `project-create-<theme>.png`; click **Create project**. Require dialog closure,
   exact Project route ID, exact persisted fields and a one-record Projects list.
   Click **Edit instructions**, replace text, click **Save**. Require editor exit and exact
   accepted GET by the same ID; original metadata/creation time remain intact.
5. Through real `window.cortex.request`, POST one root Chat with `kind: "chat"`,
   `agent: "build"`, the Project ID and `{providerID:"native-project",modelID:"reasoner"}`.
   This is deliberately keyless record creation, not a configured/usable model claim.
   Verify 201, exact stored membership/model/title and empty messages. No prompt is sent.
6. Select Overview. Click the actual sidebar Project tree to expand it; click its Chat,
   require the exact session URL, then click **See all** back to the exact Project.
   Require revised instructions, **1 chat**, the main root-Chat row and expanded sidebar.
   Focus Overview; ArrowRight/ArrowLeft verify roving focus; leave Overview selected/focused.
   Capture `project-overview-<theme>.png`.
7. Use **More actions → Delete project**. Require navigation to Projects and the deleted
   Project's 404. Compare the surviving Chat against its complete original record with
   only `projectID` removed: title, agent, model, ID and both times unchanged; messages
   remain empty. DELETE that exact controlled session ID; all guarded lists return empty.
8. Restore original OS appearance, exact theme preference/storage and initial URL.
   Independently verify empty engine and zero fixture inference. Capture failures retain
   stage/partial receipts and every downloaded original. No automatic retry or rerun.

This proves preservation of a Chat record and **empty** message history. Source E2E owns
nonempty transcript/inference, two process restarts, busy refusal and async-race evidence.
No native process-restart or frozen-reference pixel-match claim follows from this driver.

## Capture and geometry budget

Exactly four capture requests, two per theme, 960×640 logical window including native
chrome. Only CoreGraphics-bound `/usr/sbin/screencapture -x -o -l <window-id>` is used by
the unchanged helper. No page/full-screen screenshot or capture retry. Maximum 8 MiB per
original, 32 MiB total; oversize originals remain retained and fail the budget assertion.
Record native bounds/PID/window ID, PNG dimensions/scale, bytes and SHA-256.
Keep originals before post-capture assertions; do not resize/recompress or substitute them.

Each capture measures fourteen explicit visible targets:
- Create: heading, description, preview name, Name label/input, Icon label/selected radio,
  Color label/selected radio, Instructions label/textarea/hint, Cancel, Create project.
- Overview: name, count, New chat, four tabs, main Chat row, instructions heading/body/Edit,
  sidebar Project/Chat/See all.

The collector retains ancestor clipping, opacity, text ranges and center hit-testing.
Hidden Base UI inputs are verified separately and excluded from visible geometry targets.
The input-only self-scrollbox exception extends narrowly to the native textarea; both
controls additionally require their value's scroll dimensions to fit. Non-control text
still checks its own clipping. Native textarea/input ink is not claimed as DOM range proof;
review their actual pixels. Focus-visible and computed outline/shadow are retained.
Fonts and finite animations settle; toast/tooltips must disappear; sidebar stays shown.
Same native window/PID/size/OS theme checked before/after each original. The 120-second
flow budget is checked at stages; individual waits use 10 seconds, capture 15, SSH 30.
Target ordinary execution: 40–120 seconds; independent cleanup may extend failure duration.

## Future execution — coordinator only

1. Admit the committed source/CI package and complete Mac member manifest; review this
   source independently. Choose fresh root/output suffixes. Acquire the Mac lease, inspect
   its current screen, then record OS appearance in the lease receipt with
   `osascript -e 'tell application "System Events" to tell appearance preferences to get dark mode'`.
   Only after recording that value, quit ordinary Cortex and install the admitted package. Check
   Mac ports 9444/9445/9456 and local ports 19444/19445 are free; preserve unknown owners.
2. Place the three byte-identical helpers beside the local driver, then copy them and
   the supplied member JSON into a new remote root. Example, from repository root:

```sh
REVISION='<future-40-hex-application-revision>'
ASAR_SHA256='<actual-installed-asar-sha256>'
MEMBERS='/absolute/path/to/admitted-mac-package-members.json'
RUN_ROOT="/tmp/opencode/desktop-terminal-state-projects-${REVISION}"
OUTPUT="/tmp/opencode/projects-native-${REVISION}"
LEASE_ID='<coordinator-session-id>'
ssh mac-live mac-lease acquire "$LEASE_ID"
cp -n evidence/mac/99e3d04/scripts/terminal-state-native-backend.mjs evidence/mac/99e3d04/scripts/launch-terminal-state-native.py evidence/mac/99e3d04/scripts/cleanup-terminal-state-native.py /tmp/opencode/
ssh mac-live "mkdir '$RUN_ROOT'"
scp /tmp/opencode/terminal-state-native-backend.mjs /tmp/opencode/launch-terminal-state-native.py /tmp/opencode/cleanup-terminal-state-native.py "mac-live:$RUN_ROOT/"
scp "$MEMBERS" "mac-live:$RUN_ROOT/package-members-input.json"
```

3. In the authorized Mac GUI terminal, set the same three values, then launch:

```sh
/usr/bin/python3 "$RUN_ROOT/launch-terminal-state-native.py" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$RUN_ROOT/package-members-input.json"
```

4. Keep a foreground tunnel in a separate local terminal:

```sh
ssh -N -o ExitOnForwardFailure=yes -L 19444:127.0.0.1:9444 -L 19445:127.0.0.1:9445 mac-live
```

5. From the repository with existing Playwright dependencies, run once with Node 22+:

```sh
set -o pipefail
node /tmp/opencode/projects-native.mjs "$OUTPUT" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$MEMBERS" 2>&1 | tee "${OUTPUT}.log"
```

6. Retain manifest/log, originals (including failed captures), exact driver/runbook/helpers,
   member JSON, package/source admission, remote binding/launch/backend receipts. Inspect
   all four full-size originals. Any failure stays a failed attempt with its own directory.
   Failed-run cleanup deletes only IDs already captured from this controlled run; an
   accepted create whose ID never reached the driver may remain in the isolated profile.
   The empty-list check then fails; retain the profile and resolve it explicitly.
7. Run the unchanged cleanup in the Mac GUI terminal:

```sh
/usr/bin/python3 "$RUN_ROOT/cleanup-terminal-state-native.py" "$RUN_ROOT" "$REVISION"
```

8. After shared cleanup, restore the recorded pre-run OS appearance and read it back.
   This is mandatory even though the driver already restored its isolated profile; the
   unchanged shared helper forces dark while reopening the ordinary app. Record the final
   OS value, ordinary app PID/window/theme and cleanup provenance separately.
   Verify helper termination and closed Mac ports; stop the owned tunnel, verify local
   ports closed. Retain cleanup receipt and final ordinary-app observations, then release:

```sh
ssh mac-live mac-lease release "$LEASE_ID"
```

The shared cleanup's intermediate dark state is not final restoration. Step 8 restores the
pre-lease OS state after ordinary-app reopening; its receipt is separate from the driver's
isolated-profile restoration.
Lease acquisition/release, package installation, app/helper shutdown and tunnel ownership
are coordinator actions, never success claims made by this preparation or driver.
