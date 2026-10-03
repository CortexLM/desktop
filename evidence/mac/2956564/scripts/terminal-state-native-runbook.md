# Installed terminal states — prepared, unexecuted

Own helpers: `/tmp/opencode/terminal-state-native.mjs`,
`terminal-state-native-backend.mjs`, `launch-terminal-state-native.py`,
`cleanup-terminal-state-native.py`, this runbook. Independent source review must
precede the coordinator's future matching-package run. Existing accepted760c4a0
driver/backend/launcher/runbook and frozen source/dist receipts remain separate.

## Preconditions

1. Select the application revision containing both minimal Chat/Code corrections.
   Admit its CI and matching Mac artifact separately; install that artifact at
   `/Applications/Cortex.app`. Supply its actual ASAR SHA-256 and full application
   revision. Existing760c4a0 bytes are a baseline, not proof of this correction.
2. Supply immutable Mac-package JSON `{ "revision": "<40 hex>", "members":
   [{ "path": "packages/app/dist/…", "sha256": "<64 hex>" }, …] }` covering the
   complete app/desktop dist set. Use its actual member count, not historical90.
   Coordinator owns artifact/source provenance; the helpers verify supplied bytes.
3. Acquire the Mac lease; inspect the screen before actions. Quit prior Cortex
   normally. Ports9444/9445/9456 and local19444/19445 must be free. Do not terminate
   unknown owners. Use fresh root/output names for every attempt.
4. Mac: Node22+ at `/opt/homebrew/bin/node`, `/usr/bin/python3`, Swift, AppleScript,
   Screen Recording and Accessibility. Launch from the authorized GUI terminal.
   Local checkout: installed Playwright/@playwright/test, Node22+, alias`mac-live`.

## Future commands — coordinator only

Set exact values after package admission. `MEMBERS` is the Mac ASAR member manifest.

```sh
REVISION='<40-hex-fixed-application-revision>'
ASAR_SHA256='<64-hex-installed-app.asar-sha256>'
MEMBERS='/absolute/path/to/new-mac-package-members.json'
RUN_ROOT="/tmp/opencode/desktop-terminal-state-${REVISION}"
OUTPUT="/tmp/opencode/terminal-state-native-${REVISION}"
LEASE_ID='<coordinator-session-id>'
ssh mac-live mac-lease acquire "$LEASE_ID"
```

After screenshot, ordinary GUI quit and verified artifact installation:

```sh
ssh mac-live "mkdir '$RUN_ROOT'"
scp /tmp/opencode/terminal-state-native-backend.mjs /tmp/opencode/launch-terminal-state-native.py /tmp/opencode/cleanup-terminal-state-native.py "mac-live:$RUN_ROOT/"
scp "$MEMBERS" "mac-live:$RUN_ROOT/package-members-input.json"
```

In the authorized Mac GUI terminal, set the same three variables, then:

```sh
/usr/bin/python3 "$RUN_ROOT/launch-terminal-state-native.py" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$RUN_ROOT/package-members-input.json"
```

Launcher is the accepted113-line launcher with only root/backend/launcher names
changed. It verifies installed ASAR and exact complete build-member bytes, rejects
existing engine/profile/binding/receipt and occupied ports, starts owned helpers,
then uses `open -na /Applications/Cortex.app`. Isolated engine/profile, English,
`#/home`, loopback catalog; renderer/dev-provider overrides removed. Inspector
requires one installed main process with those actual environment/argument values.

Keep a separate foreground local tunnel open:

```sh
ssh -N -o ExitOnForwardFailure=yes -L 19444:127.0.0.1:9444 -L 19445:127.0.0.1:9445 mac-live
```

From the checkout with installed Playwright dependencies:

```sh
set -o pipefail
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  /tmp/opencode/terminal-state-native.mjs "$OUTPUT" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$MEMBERS" | tee "${OUTPUT}.log"
```

Driver records actual interpreter path/version, argv/cwd, four helper hashes,
members digest, start/end/duration, before/after installed identity and every
native capture's actual mainPID/window. No final revision or ASAR is hardcoded.

## Closed fixture and expected proof

Only four requests, in this order:

```text
light fail (HTTP401), light recover (HTTP200 SSE),
dark fail (HTTP401), dark recover (HTTP200 SSE)
```

All four use the actual Code composer, main IPC admission and configured
`fake/reasoner`. Provider setup uses real PATCH/write-only PUT with obvious dummy
`sk-test-terminal-state`; cleanup removes it. Catalog advertises reasoning,
text-only and **no tools**. No disk/terminal calls or permission replies are needed.
Requests must match model/key, canonical run-root working directory, exact user
history, no tools and absent generic-provider reasoning enable fields. Unknown
route/order/model/history/authorization increments errors and refuses422; no fifth
completion or retry is accepted. The expected401 is not a fixture error.

First user: `Cortex <theme> Code fail.` The resulting assistant must be completed
with `provider_auth_failed`, no text/reasoning, no tools/files. Core maps401 to this
code, persists completion, emits error then idle (`packages/core/src/session.ts`
finally block; `error.ts`). Settled checks include an IPC-health/frame fence.
The harness does not open another event subscription or inject main handlers.
Renderer reload resets transient status and must preserve the exact failed history,
red-dominant `badge err`/`Failed` and the existing two-part task-stopped banner.

Recovery user: `Cortex <theme> Code recover.` Core's `toModelMessages` omits the
failed assistant's empty content; its error remains in SQLite. The compatible
request therefore contains **two separate user entries**, no assistant replay.
Receipt validates both entries. Response delivers `Checking <theme> recovery.`
through `reasoning_content`, then `Recovered <theme> Code task.` through `content`.
Bounded delays:250ms before401;120ms before SSE deltas,60ms per word. A passive DOM
observer must record `Failed`, then `Running`/`badge run`, ending `Ready`/`badge ok`.
No timing-dependent Running screenshot is required. Final badge is green-dominant,
banner absent, failed pair unchanged within the four-message history. Code renders
text only; reasoning proof comes from exact stored parts/fixture, not screenshots.

Passive `Response.prototype.json` observation returns the original result unchanged
and retains only real202/messageID and404/not_found tuples. Each composer admission
must equal the persisted userID. Direct setup reads use `JSON.parse`, so cannot
satisfy these UI-response assertions. No fake response, held RPC or replacement
bridge/main handler. Main's one shared event stream remains untouched.

Per theme, an empty real Chat is created/deleted through IPC before opening its
actual deleted-ID route. The alert must contain exactly existing
`shell.notFound.title/body`: “Page not found” / “This link goes nowhere, or the page
has moved.” No alert button or misleading kept/retry text; transcript empty.
Both direct session/message reads return real404/not_found; UI readback also must
observe404. Capture includes focused empty editable composer plus existing New chat
control. Its actual click must reach Home, dismiss alert, expose fresh editable
composer without inference. This narrow run does not re-prove live deletion races.

## Six native captures

| File | Required scope |
| --- | --- |
| `missing-chat-light.png` | Exact truthful alert, New chat control, empty composer |
| `code-failed-light.png` | Persisted failure **after reload**, red Failed badge, banner, first user |
| `code-recovered-light.png` | Green Ready, both users, recovery answer, absent failure banner |
| `missing-chat-dark.png` | Same Chat scope, dark |
| `code-failed-dark.png` | Same reload/failure scope, dark |
| `code-recovered-dark.png` | Same recovery scope, dark |

AppleScript sets native appearance/960×640 size; CoreGraphics asserts the single
foreground layer0 Cortex window and same actual mainPID/window throughout. CDP
identity uses supported `SystemInfo.getProcessInfo`. OS`screencapture` provides
PNG bytes; no browser screenshot fallback. Native pixels may be scaled by display
density; manifest requires the exact960:640 ratio and records actual dimensions.
Fonts/finite animations, clipping-aware text/control geometry and composer hit
target are checked before/after pixels. No CSS, zoom or reduced-motion override.
Manifest retains failed/reloaded/recovered snapshots, IDs/completion/error, UI
admissions, measured badge colors and transition samples, receipt, errors and cleanup.
Expected six check groups, four admissions, four fixture turns, zero unexpected
page/console/dialog/rendererHTTP/fixture errors. Exact native images still require
full-size review; no menu/fullscreen/all-locale acceptance follows from this batch.

## Cleanup and retained evidence

Driver cleanup stops its observer, aborts/deletes only recorded owned sessions,
removes dummy key, restores provider enabled/baseURL, appearance and initial route.
A keyless provider metadata row may remain in this disposable engine. Cleanup
failure makes the manifest fail. Redacted diagnostics retain stage/hash; backend
stores validated sentinels/booleans and stack frames, never raw request bodies,
system prompts, credential store or authorization bytes. Any failed attempt is
retained separately; never reuse its roots or merge manifests.

Retain local manifest/six originals/log and Mac binding, expected members, launch,
backend receipt/log, capture log and PID files before shutdown. The driver exits
only its CDP process. Coordinator runs cleanup in the GUI session:

```sh
/usr/bin/python3 "$RUN_ROOT/cleanup-terminal-state-native.py" "$RUN_ROOT" "$REVISION"
```

Cleanup is the accepted29-line script with only root/helper names changed: normal
quit, command/root verification before SIGTERM to recorded helpers, ordinary
LaunchServices reopen and dark appearance. It records hashes/PIDs; it does not
wait for termination, attest port closure or release the lease. Coordinator must
verify helper exits and9444/9445/9456 closure, close the foreground tunnel, verify
ordinary installed artifact/dark appearance with a final screenshot, retain
`cleanup.json`/port receipt, then release:

```sh
ssh mac-live mac-lease release "$LEASE_ID"
```

## Preparation verification and acceptance boundary

Only Node`--check`, Python`compile()` without imports/execution/bytecode, and static
byte/hash comparison are permitted in preparation. Runbook/helper source hashes
are handed off for independent review. There is no native runtime pass at this
stage. Exact Electron negative/positive regressions, CI/package admission and
all-eight-locale existing-key receipts remain independently coordinator-owned.
No remote-auth/account/SDK Chat/hosted-inference claim.
