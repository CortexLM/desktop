# Files native collector — targeted correction acceptance
**APPROVED for one bounded coordinator execution.** All three reported P2 defects resolved in source; native runtime acceptance remains pending.
Application `d20a012fbb774aa9b348fe1913f85d3476430098`; comparison baseline `evidence/mac/d20a012/scripts/`.
Only this report written; terminal review, no delegation, collector/import/app/test execution, device/network access or build.

## Exact reviewed SHA-256 pins
- Driver `/tmp/opencode/files-native.mjs`: `9548b41317d5afd545dc086bf8b3ac463b3d477ade19a1075855202ffb05e009`
- Launcher `/tmp/opencode/launch-files-native.py`: `7d4fdba05afe52d09a79e7775f2f1e0c234ab12ec28cda42e45be0474eae339b`
- Runbook `/tmp/opencode/files-native-runbook.md`: `0127bccd4f8d39dedce60c65db98c17b9d5d5133debe995e6f8b29a72354215c`
- Backend `/tmp/opencode/files-native-backend.mjs`: `5c8239ef27f8d962b4a1cd5fcfb08e34c8ba4f3871f5242fe1043f73ef90476d` (byte-identical).
Archived driver/launcher/runbook hashes match the original review's `fb1bf733…` / `d7463d64…` / `4417413b…`; full diffs inspected.

## Three corrections verified
1. Launcher `:119–138` reruns installed/profile `inspect` before quit, rechecks the sole PID, guards its AX name and bounds quit/exit observation to five seconds. Ordinary-profile mismatch refuses before quit/helper signals; absent app permits owned-helper cleanup. Reopening requires no remaining Cortex PID.
2. Driver `:109–120` bounds individual raw awaits by remaining flow time, latches failure and rejects late flow results. IPC entries persist before dispatch (`:147–148`); subsequent flow operations are fenced. Fonts/CDP/evaluate/import/body waits are covered; UI/SSH/capture waits use remaining time.
   Flow remains 150 seconds; cleanup has 45 seconds, absolute watchdog 195 seconds. No raced whole-flow continuation. Already-dispatched main writes remain noncancellable; pending/unknown outcomes stay explicit for coordinator recovery.
3. Driver `:186–193` samples real numeric translation before ArrowDown, polls finite changed coordinates, records both samples/displacement. Equivalent zero serializations cannot falsely establish movement.
Four captures/eight native samples/twenty geometry targets remain unchanged. Backend and Save AppleScript/probe are byte-identical; helper pins match current sources.

## Qualification
Author-reported Node syntax/Python AST checks accepted at these exact pins; not rerun. This review performed offline diffs/hash/embedded-source comparisons only.
Earlier AX diagnostic remains failed for its own Go-button cancel assumption; seven other cleanups and coordinator GUI recovery remain separately recorded. Main Save script requires the observed nested AXTextField, no Go button.
Replace the staged old launcher with the exact corrected hash before fresh-root launch. Existing package admission/CI/image audits stand separately; no additional diagnostic requested.
Actual main Save typing/Return/confirmation, original-byte download, four native captures and cleanup timing remain to be observed in the single authorized run.
