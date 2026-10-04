# Work routine conversion — independent source review

Base `f7900564b4d0d9e193b0e3a97b899b2a79276019`; uncommitted three-file scope reviewed against AGENTS/rules, schema, client, hooks, session storage and scheduler. No source edits or runtime execution.

## Finding
- **P2 — enabled Create can silently do nothing when the Bot list is unavailable.**
  `packages/app/src/screens/work/routines.tsx:172–173,207–214,229–230,253`:
  source loading independently resolves `api.bots.get`, sets `who`/`original`, enabling Create;
  `useBots()` may still be loading or have failed, yielding `liveBots=[]`.
  Clicking Create then takes `if (!bot) ... return` without feedback because `sourceID` is set.
  `useBots` has no automatic retry/event refresh (`packages/app/src/state/live.ts:32`), so a failed
  list leaves this enabled action permanently inert. Draft remains intact; nothing is persisted.
  Gate Create on the selected Bot being available; expose existing localized load/save failure for
  an errored list. Current five cases do not cover list failure/late resolution during conversion.

## Verified source behavior
- `home.tsx:440–442`: action appears only for root Bot sessions; navigation carries the exact source ID, performs no write.
- `routines.tsx:207–214`: joins every non-synthetic text fragment of the first user message, trims outer whitespace, excludes follow-ups. Storage returns messages/parts in sortable ID order.
- Source title caps at 60; source session untouched. Source kind/Bot/root identity, nonempty request, user-file history and existing source Bot are checked before seeding.
- `routines.tsx:236–241`: before Create, history is reread and selected Bot fetched; any user file refuses. `SessionService.messages` first checks source existence, so deleted sources fail too.
- Same-Bot conversion/edit preserves model, agent and directory; new-routine reassignment sends selected Bot model without old agent/directory. Scheduler uses these exact fields when creating the run session.
- Existing edit-reassignment PATCH behavior is retained: omitted agent/directory remain persisted (`Scheduler.update:49–50`). No schema/engine contract change claimed.
- Editor key distinguishes source/edit IDs. Effect cleanup ignores stale loads; mounted checks suppress writes after preflight unmount and suppress late toast/navigation after accepted writes.
- Synchronous `saving` ref rejects duplicate clicks; fieldset and header controls disable during Save; failures unlock without clearing drafts. Explicit Create alone writes; Cancel is read-only.
- Five registered cases cover both-theme source/context/run preservation, cancellation, double-click admission, reassignment, missing/deleted source/Bot, files added before Create, and late source/save responses. Real IPC/engine responses remain intact.

## Claims and verification limits
- Work portions of AGENTS/docs match the intended first-request/context contract. “Deleted source Bots refuse” is checked at seed; before Save the fetched Bot is the selected destination after any reassignment.
- Synthetic filtering is source-inspected; no synthetic-part fixture assertion exists. Latest test contains a two-fragment first request.
- Initial 69 E2E / 178 unit pass report predates that fragment correction; final verification remains coordinator-owned. Earlier CI/native receipts do not validate this uncommitted batch.
- No additional concrete data-loss, duplicate-persistence or late-navigation regression found. Existing scheduler/editor limitations are not relabeled as this change's defects.
- `git diff --check` clean. No tests/builds/CI/Mac/owner actions; Search excluded.

## Reviewed SHA-256
- `home.tsx`: `3f600cd9a909e02651aa0d29dd72ff624017bfa7c98f6ef9428357ebde34a5c3`
- `routines.tsx`: `bdb49242544fd79f87c41df4cc21848767e9bca58b737f598a5d37df91546ad2`
- `tests/e2e/work-routine-source.spec.ts`: `6ee536bf6bc8a64176d1986d7833a114cc84dd9bd6af36a8a601a18a72a083ec`
