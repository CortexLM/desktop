# Process-lifetime remote sign-in

Implementation in progress, uncommitted. Earlier green CI `37091082338` at `b0e6d78`
covers the recovery/transition/SDK-intake batch, not this authentication delta.

## Scope

- Main owns a validated, origin-bound SDK client, in-memory cookies and token/continuation
  material. IPC exposes status, active `signedIn` and email only. Process exit clears it.
- Existing email/code UI supports accepted sign-in, refused input retention, resend, explicit
  submit, duplicate prevention, interruption and device sign-out. Account/Connection explain
  that chats still use local provider settings. Unsupported continuation UI says unavailable.
- Main's typed local operator login/email-verification/MFA-challenge paths have contract
  coverage; their dedicated screens await approved integration. Cloud refresh and durable
  account identity remain pending. This implementation does not route prompts remotely.

## Current checks

Local integrated checks: **201 Node 22 units pass**, one optional backend probe skipped;
lint/types/i18n pass. Five Electron cases use the actual main SDK against a **controlled
loopback HTTP backend**, both themes at 960×640, with one 1440×900 capture. Refusals,
duplicate verification, cancellation, sanitized continuations, reload/restart and origin
changes pass. They do not establish real Cloud authentication or actual remote inference.

Independent [UI/core review](ui-contract-review.md) identified three read/loading races;
source corrections pass bounded re-review. The separate [held-read regression](read-races/result.json)
passes without rebuilding: initial Settings edits stay gated, equivalent origins allow Sign in,
Cancel clears a candidate while initial auth status is held. [Main-session review](main-review.md)
finds no blocker in the stated process-lifetime scope.

[Full integrated Electron suite](e2e-full.log): **90 passed, 426 renders**. Linux package/smoke
passes. These precede the newly identified native preview-departure/long-terminal corrections,
tracked under [installed recovery](../mac/b0e6d78/README.md). Changed-revision CI and installed-Mac
authentication proof remain pending.

The [native-discovered corrections](../live-recovery-followup/native-corrections/README.md)
now pass 26 targeted Electron cases after rebuilding, including all six auth cases again.
Lint/types/i18n and rebuilt Linux package/smoke pass. Both auth Settings logout paths now
refresh status even when server revocation fails after main has already cleared local state.
The later mixed-size Code correction passes eight final Electron cases including all six
auth cases, lint/types and rebuilt Linux package/smoke. The main service now imports the
public core export; its eight Node 22 tests pass after that boundary-only change.

Owner follow-up supplies source-backed validation bounds for existing turn/model payloads;
it does not add stable `/me` identity or complete history. The newer SDK 0.3.4 handoff remains
incomplete after its Node 20.9 verification process hung. Current adoption stays the exact
0.3.1 pair; no local dependency patch or inferred final-release approval.
