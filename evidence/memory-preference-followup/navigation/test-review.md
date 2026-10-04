# Cancelled-navigation regression review

Verdict: **approve the regression test**; baseline establishes two real UI failures. No test defect found requiring correction.

- Reviewed appended case `tests/e2e/runtime-settings.spec.ts:220–278`, gate/fence helpers, current hook/App, existing navigation-test pattern and executed baseline receipts; no reruns.
- Full SHA-256: `a3749931aa28b459844b9c4ab24bb52d8762a079210a379de524416624acffe8`.
- First 218 lines hash to `47b4b17adc8222565e8513db3880cf49fdbdec1be35f743816662a77e7d03580`: original five cases byte-identical.
- Baseline JSON/log: one failed test, 6,281 ms, zero retries, two assertion errors at line 266; test ID `5ec10339be8effb868ac-67f5d75dd8df0f6ef8d0`.
- Decoded `cancelled-preview-settings`: GET engine `{memoryEnabled:true}`, control `[]`; PUT engine `{memoryEnabled:false}`, control checked `true`, disabled `true`, visible `true`.
- All six attached settings responses are real HTTP 200; exactly one PUT with `{memoryEnabled:false}`. No fake settings result or model/provider response involved.
- GET hold occurs after real engine response creation. PUT hold precedes admission; the live user's earlier click authorizes that pending write despite the subsequent preview URL.
- Transition substitution controls callback scheduling only, matching `navigation.spec.ts:95–103`; actual history, App callback, React owner and IPC remain exercised.
- One held departure plus one held Back callback is asserted. Both callbacks read the restored live URL; `.home` never mounts and the original DOM owner remains connected before/after.
- Gate release waits for handler return, health IPC and two frames. Final soft polling checks accepted value, enablement and visibility together; it does not accept a cosmetic toggle or remounted owner.
- GET's failed soft assertion is retained before the sole between-phase reload. Reload enables independent PUT reproduction, not a recovery claim; both failures remain in the receipt.
- Root cause matches current hook: raw `liveRoute()` rejects GET settlement and PUT value/busy cleanup during deferred preview; Back restores the same committed active owner, so `[active, reload]` does not trigger recovery.
- The two-second poll follows explicit completion fences. Receipt shows stable wrong state, not an unresolved request; no evidence justifies weakening the assertion or expanding its timeout.
- Attachment contains only fixture settings bodies, local route URLs and control state. Cleanup restores transition scheduling and releases IPC waits.
- Prior `targeted.log` records 14 passes, including original five cases; unchanged proof boundary remains two UI-composed plus two direct-IPC sends per theme.
- This proves deterministic deferred-navigation failure, not native transition timing frequency, fixed behavior or visual acceptance. Candidate label `30ec7` was not resolvable as a local Git revision; supplied receipts do not independently pin its build.
