# Projects native runbook re-review — REMAINDER

Source-only review of revised `/tmp/opencode/projects-native-runbook.md`.
Original `/tmp/opencode/projects-native-review.md` preserved.

One ordering correction remains: lines 111–116 quit ordinary Cortex/install the package in step 1, then record OS appearance in step 2.
This does not satisfy recording the original OS value before actions.
Move that record/read into step 1, immediately after lease acquisition and initial screen inspection, before quitting/installing/changing anything. Step 8 must restore that same recorded value.

Accepted: step 8 restores/reads back OS appearance after shared cleanup, records ordinary-app PID/window/theme, then releases the lease. The final paragraph correctly distinguishes intermediate dark from final restoration.
Accepted: header identifies historical preparation and requires the wrapping correction's final matching CI macOS package; `8e3fd79` evidence remains archival, not installation admission.
Future revision/ASAR/member arguments remain correct; no driver change required for this correction.
Driver byte identity/SHA `a1b93962907eb870b95d7d7629029759411feb2e4251f7755f9006d1f9aef76e` supplied by coordinator, not rehashed here.
Unchanged four-capture sequence remains scoped to short controlled English inputs; long-text regression/native acceptance is not established by this review.
No execution, Mac/lease access, network, builds, tests, CI queries or application changes. Runtime/package/restoration receipts remain coordinator-owned and pending.
