# Settings Appearance — prepared, unexecuted
Driver: `/tmp/opencode/appearance-theme-native.mjs`. New files are only that driver
and this runbook. Coordinator owns source-positive evidence, matching new CI/package
admission, independent helper review, future Mac execution and image acceptance.
Revision/ASAR/members/PID/window are run inputs or observations, never prior app pins.

## Existing controls and proof
Implementation contract: `/tmp/opencode/appearance-theme-source-plan.md`; existing
Settings Appearance `main .pg-themes`, accessible group **Theme**, cards **System**,
**Light**, **Dark**. Rail `.rail .theme` is a separate group with the same names.
The following button is **English**. Expected visible cards are native buttons with
radio semantics; Base UI's three hidden inputs remain aria-hidden and tabIndex=-1.

1. Preserve initial native appearance, actual rail preference, raw `cortex.theme`
   storage and document theme. Check an empty local engine through GET only.
2. Set native light; open `#/settings?section=appearance&theme=light` and reload once.
   Initial main/rail selection must be Light, document light, one main Tab stop.
   Hash initialization keeps original storage; clicking selected Light must then persist it.
3. For each final theme, select System by pointer. Change actual native appearance
   to the opposite then target theme: System stays selected/stored while the document
   follows the native media query in both directions.
4. Pointer-select main Dark; expand the rail by actual hover and pointer-select Light.
   Main/rail checked states, their single Tab stops, document/storage/hash must agree.
   From English, Shift+Tab enters the externally selected Light card; Tab exits to English.
5. Pointer-select System, then exercise three Right, three Left, three Down, three Up
   presses. Each arrow focuses/selects the expected next card, wrapping System/Light/Dark.
   Each step records focus, both groups, storage, resolved theme and unchanged main group.
6. Focus unchecked Dark; require it still unchecked, press Space, verify selection.
   Finish with explicit Light or Dark selected. Keyboard-enter from English again so
   the selected card is focused with `:focus-visible` for the final native capture.

**Two captures only:** `appearance-theme-light.png`, `appearance-theme-dark.png`.
No Home/End expectation: installed Base UI excludes those keys for the main cards.
The main group stays mounted across UI interactions; no preference-writing setup,
forced click, emulated media, injected handler or application observer is used.

Seven capture targets: three cards, their three label spans, English button. Check
border bounds, ink ranges, opacity, native viewport and clipping, plus actual hit tests.
Use the input-only self-clipping exception approved after the provider collector review;
all these targets are non-inputs, so their own overflow clips remain checked. No broad
`node !== el` text exemption. Record actual focus outline/shadow values, no color guess.
Fonts/finite animations settle; sidebar stays shown; OS and app theme match at capture.
Review both full native images for text, cards, focus ring and controls after execution.

GETs cover connection, sessions, Bots, tasks, providers, plugins and permissions;
require local/signed-out connection and empty arrays before/after/cleanup. No credential
write or Request/Response observer exists. Original fixture supplies only catalog/health/
receipt; require zero inference requests and zero errors/failures throughout.

## Unmodified shared helpers
| File | SHA-256 |
| --- | --- |
| `terminal-state-native-backend.mjs` | `d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d` |
| `launch-terminal-state-native.py` | `4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257` |
| `cleanup-terminal-state-native.py` | `c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a` |

Existing files remain beside the driver in `/tmp/opencode/`; archived originals are
under `evidence/mac/37c22c2/scripts/`. Driver hashes itself and verifies all three originals.
Original inspector validates ASAR, complete member set, isolated profile/root, process
arguments and one installed main PID. CDP SystemInfo and CoreGraphics bind the same PID
and foreground window. Capture uses the original OS-screencapture endpoint, unchanged.

## Future commands — coordinator only
After new source-positive checks and package admission, acquire the lease, inspect the
screen, quit ordinary Cortex, install the exact new package. Verify ports9444/9445/9456
and local19444/19445 free. Use fresh names; preserve unknown process owners.

```sh
REVISION='<new-40-hex-application-revision>'
ASAR_SHA256='<actual-installed-asar-sha256>'
MEMBERS='/absolute/path/to/new-mac-package-members.json'
RUN_ROOT="/tmp/opencode/desktop-terminal-state-appearance-theme-${REVISION}"
OUTPUT="/tmp/opencode/appearance-theme-native-${REVISION}"
LEASE_ID='<coordinator-session-id>'
ssh mac-live mac-lease acquire "$LEASE_ID"
ssh mac-live "mkdir '$RUN_ROOT'"
scp /tmp/opencode/terminal-state-native-backend.mjs /tmp/opencode/launch-terminal-state-native.py /tmp/opencode/cleanup-terminal-state-native.py "mac-live:$RUN_ROOT/"
scp "$MEMBERS" "mac-live:$RUN_ROOT/package-members-input.json"
```

In the authorized Mac GUI terminal, set the same root/ASAR/revision, then:

```sh
/usr/bin/python3 "$RUN_ROOT/launch-terminal-state-native.py" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$RUN_ROOT/package-members-input.json"
```

Keep a foreground tunnel in a separate local terminal:

```sh
ssh -N -o ExitOnForwardFailure=yes -L 19444:127.0.0.1:9444 -L 19445:127.0.0.1:9445 mac-live
```

From the repository with installed Playwright dependencies:

```sh
set -o pipefail
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  /tmp/opencode/appearance-theme-native.mjs "$OUTPUT" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$MEMBERS" | tee "${OUTPUT}.log"
```

Driver cleanup restores native appearance, dispatches the existing theme event solely
to restore the original preference, removes the storage entry only if originally absent,
then restores the initial route and verifies exact original document/rail/storage state.
Engine/fixture cleanup assertions are GET-only. Any cleanup failure fails the run.

Retain original manifest/log/two PNGs, actual invocation/hashes, binding/launch/member
and backend receipts. Inspect both full images. Coordinator runs original cleanup in GUI:

```sh
/usr/bin/python3 "$RUN_ROOT/cleanup-terminal-state-native.py" "$RUN_ROOT" "$REVISION"
```

Verify recorded helper exits, closed Mac ports/tunnel/local ports, ordinary matching app
reopened dark; retain cleanup/final-screen observations, then release the lease.

```sh
ssh mac-live mac-lease release "$LEASE_ID"
```

Preparation permits one `node --check`, never importing/executing the driver. Runtime
remains unexecuted. English/minimum-window/two themes only; no preview, all-locale,
menu, remote-inference or wider product acceptance is inferred.
