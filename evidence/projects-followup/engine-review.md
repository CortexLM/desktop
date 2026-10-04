# Independent Projects engine review

**Disposition: no blocking defect found in the adopted local engine contract.** Source-only review of schema, core project/index/session/storage, protocol/server/client and all seven `packages/server/test/projects.test.ts` cases. Reported seven passes were not rerun or independently attested here.

## Contract and boundary findings
- `packages/schema/src/index.ts:138–149,472–506`: bounded nonempty opaque IDs; trimmed 1–48 names, 4000-character instructions, exact icon/color enums. Create/update reject extra writable fields; no arbitrary CSS, paths, HTML execution or credential fields added.
- `packages/core/src/project.ts:13–34`: main reparses IDs/bodies, checks generated-ID collisions before upsert, preserves creation time, orders equal timestamps by ID; duplicate names remain distinct records. Create/update publish only after successful synchronous storage writes.
- `packages/protocol/src/index.ts:49–61,172–181`, `packages/server/src/index.ts:55–69`, `packages/client/src/index.ts:141–155`: local typed routes, encoded IDs, existing validation/status/error mapping. Storage exceptions expose `internal` rather than raw disk text. No new dependency, socket, authentication or remote-provider path.
- `packages/core/src/index.ts:58,67–88`: sole production `SessionService` construction supplies Projects; `isBusy` is wired synchronously before exposure/startup. No asynchronous initialization gap found.
- `packages/core/src/session.ts:68–114,143–151`: only root Chat without Bot identity can receive membership. Unknown project refuses before writes. Title/agent/model patches retain membership; null on an already ungrouped child/Code/Bot is a tested no-op, not an assignment.
- Strict Session create/update now reject previously ignored unknown keys. Inspected live Chat/Code/file, scheduler, Bot route and subagent creation callers send declared fields; no existing caller incompatibility found. Persisted sessions are not reparsed/migrated by this change.

## Atomicity, admission and context
- `project.ts:36–40` performs existence/busy checks and publish synchronously. `storage.ts:25–30,79–95` appends one durable `project.deleted` event, deletes its document and removes only matching `data.projectID` values inside the same existing transaction.
- The delete projection does not touch session columns/timestamps/models, messages, parts or session event aggregates. `bus.ts:12–20` delivers only after commit; rollback prevents event delivery. No nested transaction or sequential detach loop.
- `session.ts:132–151,162–205`: the running map includes reserved admissions; ancestor traversal catches busy roots, children and grandchildren. Membership change/deletion refuses through the same map until completion.
- Expected membership is compared synchronously after reservation, before the first await/model lookup. Conflict releases reservation without session/message writes. Absent `expectedProjectID` preserves existing callers; null means explicitly ungrouped.
- Instructions are copied from the current root before lookup, passed unchanged into run/system context, added to admission estimate and output clamping (`session.ts:177–188,347–359`). Later edits/moves/detaches affect later admitted turns; children do not persist copied membership.
- Renderer event consumers are wired: `packages/app/src/state/live.ts:30–32` refreshes session lists on `project.deleted` and projects on `project.*`; live Chat also refreshes deletion/current-session events. These are source checks, not Electron event-delivery proof.

## What the seven cases actually establish by assertion
- `projects.test.ts:37–84`: typed CRUD/duplicate IDs, transcript and membership persistence through two SQLite reopens; delete retains children/transcript.
- `:86–151`: invalid create/update/path IDs, rejected nonroot assignments, sanitized storage failure, sort order and collision refusal without overwrite.
- `:153–198`: a real SQLite trigger aborts detach after document deletion; entire session rows, project, journal and delivery roll back. Successful delete changes only membership and its project aggregate.
- `:200–238`: held catalog admission and held `chat.params` phases each refuse root moves/detach/project deletion for root/child/grandchild turns.
- `:240–297`: captured fake-provider system bodies verify prelookup snapshot, next-turn edits, root inheritance/move/detach/delete. Context refusal writes no messages; 40 instruction characters reduce `max_tokens` from 48 to 38 despite an intervening 4000-character edit.
- `:299–330`: stale expected ID/null after move/delete refuses root and child before lookup, journal/message mutation or provider request; matching/absent expectations succeed.

## Remaining acceptance boundary
- Budget assertions establish the incremental project-instruction estimate, not exact tokenization or full agent/Bot/tool-schema/system-overhead accounting; that broader limitation predates this change.
- SQLite reopen tests are not desktop-process restart proof. Renderer draft/owner races, live SSE discovery/detach, minimum-window usability and integrated Electron/package/native acceptance still require coordinator verification.
- Files, sharing, assigned Bot, archive and metadata-editing UI remain outside the adopted slice. Code folders, Bot/remote routing and unrelated management surfaces gain no acceptance from these seven cases.

Only this report written; no source changes, tests, builds, network/CI/native operations or delegation.
