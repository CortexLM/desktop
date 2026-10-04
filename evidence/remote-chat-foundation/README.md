# Remote Chat foundation — internal implementation

Application `f5bf305473db12fddfddcda890a01794f02f578f` follows `7885736` and documentary `7a0b552`. The installed `7885736`
evidence does not include these main/core changes. Local checks below bind their source hashes;
changed-revision CI and native acceptance are recorded separately.

- [Bus privacy prerequisite](bus/README.md): explicit internal remote source delivers live
  events without SQLite persistence or local plugin callbacks. Negative baseline reproduces
  both leaks; two focused checks and 78 core/server/client checks pass. Independent review
  approves this boundary.
- `packages/desktop/src/remote-chat.ts`: private account-epoch binding for model discovery,
  raw owned image uploads, header-admitted streamed turns, fixed POST replay and limited
  known-conversation history. The first 11 transport/eight auth checks pass. Independent
  [initial security review](security-review-initial.md) reproduces a high-bit GIF/WebP signature
  bypass in ASCII decoding; the byte-preserving correction and regression pass.
  [Final security review](security-review.md) passes three independent probes.
  [Contract vectors](contract-traps.md) cover exact replay, media tails, ownership and expiry.
  [DTO review](contract-review.md) confirms field shapes and corrects HTTP 403 to neutral
  refusal, preserving active authentication. Unsupported version-index/count coupling is
  removed. Equal-ID replay, callback failure and canonical Cloud-only 404 fallback checks pass.
  [Admission disposition](disposition/README.md) explicitly distinguishes safe refusal from
  uncertain delivery without exposing private ledger details. The integrated main/bus tree
  passes **220 units plus one optional backend skip**, lint/types/i18n (65 files, zero findings); the earlier stale-403
  assertion failure remains retained. This predates core-service integration.
  A later [replay review](replay-review-initial.md) reproduces lost consumer admission after
  its callback throws. Admission is now idempotently announced on every validated replay
  response, preserving ledger identity. The new native-HTTP regression and eight auth checks
  pass in a 26-case focused run; [independent correction review](replay-review.md) passes
  all four recovery/identity probes with the original failure retained.
- [Core implementation](core/README.md): process-only sessions, truthful delivery outcomes
  and identifier-only events; 17 focused cases pass. The replay ledger remains owned by main.
  Backend same-ID frame replay prevents a general exact-text guarantee; resumed projections
  remain partial. [G2 follow-up](https://github.com/CortexLM/backend/pull/446#issuecomment-5966307621)
  requests an unambiguous cursor or authoritative full history.

The actual SDK-to-core native-HTTP integration passes header admission, raw PNG upload,
reasoning/text delivery, safe projection and account replacement with zero local side effects.
The initial combined tree passes **239 units plus one optional skip**, lint/types and i18n
(65 files/2,272 used keys/3,405 English keys/zero findings). Build and Linux packaged smoke
pass; all 90 ASAR members match the build. The initial full Electron run passes **97 cases**,
zero retries/skips/flaky results, including the 48-state locale regression.
[Independent image review](electron-initial/README.md) covers 123 unique PNGs and 19 full-size
originals. Later core corrections and historical failures retain separate source snapshots.

Independent [core lifetime review](core-security-initial.md) then reproduces two missing
guards: a detached snapshot returned after subscriber-driven logout, and concurrent upload
requests creating duplicate files. Both guards are corrected; the focused 19-case core/HTTP
suite and [three independent real-SDK probes](core-security-review.md) pass. The initial
full-suite/build/package receipts above predate these two lines;
final rebuild and reviewed-source verification follow separately.
Main [catalogue ordering review](model-race-initial.md) also reproduces an older capability
read replacing a newer success or failure. A private read counter now rejects stale
results before cache assignment; both repository regressions pass with zero image POSTs.
The [projection review](core-projection-initial.md) finds nullable reasoning usage, hidden
SDK frame discards and dangling tool status after history recovery. Null remains unknown;
recovered tools become interrupted. SDK 0.3.5's completion explicitly carries a limited
projection, so core cannot claim full output even on `stop`. The [G3 request](https://github.com/CortexLM/backend/pull/447#issuecomment-5966461570)
asks for the existing parser discard callback rather than a second consumer parser.
[Corrected projection review](core-projection-review.md) passes all six semantic probes.

[Historical-image review](image-history-initial.md) confirms both a missing desktop
capability guard and pinned backend omission of prior pixels. Main now preserves the
conversation's vision requirement, refuses lost vision and refuses fresh image-history
follow-ups pending [G2 hydration](https://github.com/CortexLM/backend/pull/446#issuecomment-5966488098).
Original delivery replay still retains its exact body/files/key. These scoped refusals
are honest limits, not complete remote workflow acceptance.
[Independent image-history correction](image-history-review.md) verifies both refusals,
zero additional turn POSTs and preserved draft/history. [Catalogue correction review](model-race-review.md)
likewise passes both unchanged out-of-order read probes.

The adapter now has an internal core caller, with no public route or renderer dispatch.
Existing user prompts still use local providers. Approved remote controls and real authenticated
image/reasoning evidence remain separate delivery work. See the
[retained integration contract](../remote-auth-followup/routing-contract/README.md).

## Final local verification

The corrected [source](integrated/source-final.json) passes **245 unit cases plus one
optional backend skip**, lint/types/i18n and a fresh build. Eleven rebuilt Electron
auth/engine cases pass with zero retries/skips, including all 48 locale states. Linux
packaged smoke passes; [all 90 members](integrated/linux-package-final.json) match the
corrected build. This is distinct from the earlier 97-case full run. Current main has
21 transport cases, core has 18 projection cases, the actual SDK/core boundary has three
integration cases. [Final artifact review](electron-final/README.md) verifies all 18 images,
14 source pins, 90 build members and embedded main source-map contents. Three exact pixel
drifts retain their unisolated causes. [CI 37105137365](https://github.com/CortexLM/desktop/actions/runs/37105137365)
passes all three jobs at documentary `1076c25`. [Matching installed authentication](../mac/f5bf305/README.md)
passes six English captures and 48 native locale states/144 Tab stops with 16 further
captures; every native image is reviewed full-size. All use the exact new ASAR. Earlier run
`37105080871` was cancelled by the documentary push.

[Completed CI artifact review](ci-1076c25/README.md) verifies 97 cases/426 render checks
per OS, 245 units plus one optional skip, 248 unique PNGs and 54 full-size originals.
Linux Japanese/Korean/Simplified Chinese captures show missing glyphs despite passing
geometry; visual acceptance fails for those images. All eight macOS locale captures
render glyphs. Font-environment diagnosis remains separate; native CI capture also fails.

Review scopes remain pinned: initial security reproduction, final signature/expiry checks,
DTO 403/history correction, then the admission-disposition getter. Older reports' line
numbers and test counts refer to their own source hashes. The corrected Cloud-discovery
403 expectation passes in the 220-test run; no error assertion was waived.
