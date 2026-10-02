# Cortex PR36 — final admission review

**PASS — no concrete remaining blocker in the reviewed patch.**

Read-only review of the working-tree diff in `packages/core/src/session.ts`, `packages/core/test/session.test.ts`, and `packages/core/test/capabilities.test.ts` against `945c4e2`.

## Source checks

- `session.ts:125-136`: input/session/agent checks are synchronous; reservation exists before the first await. A competing prompt cannot replace its controller or completion promise.
- `session.ts:137-162`: catalog, capability, context, provider and synchronous persistence failures enter the same cleanup path. `finish()` removes the reservation and resolves `done`; the original prompt still rejects. Abort/delete waiters are not stranded by a refusal.
- `session.ts:155-161`: successful admission hands cleanup to the asynchronous runner; refusal cleanup and runner cleanup are mutually exclusive in the current control flow. No newer run can acquire the slot before its owner finishes.
- `session.ts:100-106`: parent cancellation now happens before descendant deletion can suspend. Descendants still settle before deletion publishes.
- `session.ts:146-150`: cancellation checks bracket the event-producing model/agent update. Synchronous abort from its listener cannot reach `admit()`; nested prompts encounter the existing reservation.
- `session.ts:150-158`: no post-admission cancellation rejection was introduced. Abort from user-message/part/title listeners reaches the runner's signal without falsely rejecting an already persisted prompt.
- `session.ts:141-145`: incoming files and historical user files are capability-checked before persistence; history-plus-prompt context validation remains under the same reservation.
- Persistence exception handling releases ownership; this is not a claim of new multi-event rollback. `admit()` still publishes separate durable events, as before (`session.ts:174-182`; `storage.ts:77-84`).

## Verification boundary

- Reviewed regression assertions for concurrency, direct abort/delete, parent cancellation, synchronous update cancellation, historical images and PDFs.
- Existing refusal-then-success coverage remains in `session.test.ts:153-159`; history refusals assert unchanged events/model and cleared busy state in `capabilities.test.ts:93-102`.
- Read coordinator's two before-fix logs: three initial failures plus four additional failures. These establish the recorded regressions, not current success.
- No tests/builds executed by this reviewer. Current passing-test claim remains with coordinator.
- Only this report written; no repository edits.
