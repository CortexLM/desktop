# Historical image capability — bounded review

**Confirmed admission defect; block remote image-history acceptance until corrected.** A text-only follow-up is admitted after the same model/epoch has lost confirmed vision, despite an earlier admitted image. Backend refusal cannot be relied on. Existing image metadata and upload bytes were preserved in the probe; the defect is context/capability admission, not deletion from storage.

## One isolated actual-source reproduction

- Node **22.23.3**, actual `createCore` + in-memory SQLite + `RemoteSession` + SDK **0.3.5**, native HTTP on an ephemeral **127.0.0.1** port. No mock SDK, external endpoint, real account or inference.
- First catalogue: same slug, `vision:true`; genuine 1×1 PNG uploaded byte-exact; image turn admitted and completed. Refresh awaited fully, same binding/epoch, same slug now `vision:false`.
- Text-only follow-up with `attachmentIDs:[]`: **accepted**, second HTTP POST observed, result `{state:"settled",complete:true,partial:false,finishReason:"stop"}`.
- Control using the original image ID explicitly: **refused `model_no_image_input`**, no third POST. Original user/file projection unchanged; caller follow-up draft unchanged; SQLite event/session/message/part counts all zero.
- Expected-red regression: **1 test failed, exit 1**, 110 ms test / 937 ms suite, `2026-10-03T06:42:35Z`. It expects refusal before the second POST. No wider suite executed.

Files: `/tmp/opencode/remote-history-capability-review/{history-capability.test.ts,vitest.config.mjs,result.json,vitest.json,run.log,provenance.json}`. `desktop-source/` and `backend-source/` retain inspected bytes. Reproduction command:

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node /root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/vitest.mjs run --config /tmp/opencode/remote-history-capability-review/vitest.config.mjs
```

## Desktop cause and exact binding

Observed HEAD `7a0b55288b584e1fe7a25eb435e609db6918550c`; inspected working-tree sources remained hash-identical before/after the probe:

| File | SHA-256 / relevant lines |
| --- | --- |
| `packages/desktop/src/remote-chat.ts` | `43372f6b8c115cdb13cf4fc00d5d4fffacbfc3e18ba69ee41a6f6311ed53259f`; `:220` stores only model/effort; `:290–296` checks only current `attachmentIDs.length`; `:309–310` overwrites conversation metadata at each admission |
| `packages/core/src/remote-sessions.ts` | `5d14e25bd6732b80c2139ac66c1e8de77b9d4240f11bc3deaf3b8d3462a6e559`; `:118–126` refreshes catalogue; `:149–160` gates upload; `:165–178` prompt does not inspect prior user file parts |
| `packages/desktop/src/remote-session.ts` | `2394cd1f9cf8852808168b4bff48aadbc51d76202524dccdbe63b40723d063d6` |

Local `packages/core/src/session.ts:141–143` already checks historical user files against the selected model. `docs/providers.md:67–70` and the explicit task requirement prohibit silently losing image context. The remote path has no equivalent historical requirement. This vector uses a fully completed catalogue refresh, so it is independent of the other reviewer's discovery race.

## Pinned backend truth: historical images are not replayed here

Read immutable Git objects from backend `d6c71de1d99197c5e0ee5c59d0a089842d760cea`; all six relevant files are byte-identical at SDK source pin `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31`. Exact hashes are in `provenance.json`.

1. `server/src/api/turns/create.ts:89,177–184`: `attachmentIds` comes only from the current body; `refuseUnreadableImages` runs only for a routed registry model and receives only those IDs. `registry.ts:344–345` returns immediately for an empty array. Ordinary Cloud catalogue selection does not call this refusal helper.
2. `create.ts:226–229` persists attachment references as `user_attachment` blocks; `:260–272` passes only the current body's IDs into generation.
3. `server/src/chat/turn.ts:59–65` excludes `user_attachment` from context blocks; `:81–97` builds text-only `UpstreamMessage` content. It does not load historical image bytes.
4. `server/src/api/turns/generate.ts:166–176` converts historical context to `textMessage(...)`, then attaches images **only when current IDs are nonempty and `j.model.supports_vision` is true**. `:281–283` sends those messages upstream. `upstream.ts:23–31` serializes only images actually attached there.

Therefore the proposed premise “backend existing-thread replay includes historical images” is **false for this pin**. Text-only follow-ups omit the historical pixels even if vision remains true. This strengthens the no-loss integration gate, but it is not a runtime claim about today's deployed backend. The controlled probe proves desktop admission; pinned source proves this handler's omission/refusal behavior. Prior assistant text/captions are not a byte-preserving image replay guarantee.

## Smallest recommended correction

**Extend the existing main gate; one boolean per known conversation, no new core/public schema.**

- Add `needsVision:boolean` beside `modelSlug/effort` in main's private `conversations` Map.
- After valid matching admission headers, store `previous.needsVision || ledger.input.attachmentIDs.length > 0`. Preserve it on every repeated admission/follow-up; never reset it from an empty follow-up. Uploaded-but-unadmitted files do not set it. Epoch cleanup already removes the Map.
- In `execute`, before a **new** request (`!ledger.requested`), require confirmed vision when either current IDs exist or the known conversation needs vision. Return existing `model_no_image_input` before POST. Existing typed `admissionState:"refused"` releases reservation; core retains draft and historical records. Replays retain their original handle/body and are not new capability-gated generations.
- Core could scan admitted user file parts, but a second gate is unnecessary for this fix: main already owns the authoritative catalogue/turn admission, and fixing it covers both core and direct binding calls. No automatic history read, re-upload, ID union, new transport/body or account import is needed for the demonstrated regression.

**Ceiling remains:** that boolean fixes vision-loss refusal, not the backend's missing historical-pixel replay with `vision:true`. Under the explicit no-discard requirement, ordinary image-bearing follow-ups cannot be called complete-context inference until G2 supplies/accepts history-image hydration semantics; conservatively refuse such follow-ups pending that contract rather than silently adding all previous files to the newest message. Automatic resubmission would change attachment placement/count/body semantics and is outside this patch.

No application source edits, builds, global tests, Mac/CI actions, credentials or owner posts. One isolated probe only. No claim of lost on-disk files or real-model behavior.

## Correction readback — 2026-10-03 06:51 UTC

**Bounded APPROVE: historical-vision gate and explicit unsupported-history ceiling. Original failure is corrected in the reviewed source; image-history hydration remains unavailable.** Earlier findings/results above retain their original revision scope.

### Current source binding

Observed HEAD remains `7a0b55288b584e1fe7a25eb435e609db6918550c`; these are corrected working-tree bytes, not a new committed/native artifact claim. All eight inspected source/test hashes stayed stable during the probe; original failure logs, test, receipts and source snapshots stayed byte-identical.

| Corrected file | SHA-256 |
| --- | --- |
| `packages/desktop/src/remote-chat.ts` | `a735975865341bec30fb1981165192f993fbd1235416a3271b947bfb15a4fad6` |
| `packages/core/src/remote-sessions.ts` | `72bd7be91cf5ad99734a58300617da17e4bb782a631da3acbbbdfb8ca049decb` |
| `packages/schema/src/index.ts` | `0403846e16c38e7f06c077d7980a9c375898ba413f5aa5f93cf863d7229f5361` |
| `packages/desktop/test/remote-chat.test.ts` | `d6447e76b5b75af5b09f9226f66490483dddf89d9ff8326451b837d225e307d9` |

### Reviewed correction

- Main `:221,311–318`: `needsVision` is set only after validated matching headers, using previous value OR current admitted image IDs. Repeated headers/empty follow-ups cannot clear it. Upload alone only changes `files` (`:366–384`), so uploaded-but-unadmitted images do not taint a conversation.
- Main `:293–303`: new-request validation checks current **or historical** images. Unconfirmed vision refuses `model_no_image_input`; confirmed vision plus admitted image history refuses `provider_unsupported` until pixel hydration is verified. Both occur before `ledger.requested=true`; `:356–358` releases the preflight reservation and the getter reports `refused`.
- That gate is inside `!ledger.requested`: existing delivery replay retains its original body/path/key and bypasses fresh-generation refusal. This is source-verified here; no separate resume runtime batch was repeated.
- Main `:354–355` now returns `projection:"limited"`. Core `:276–293` validates it, adds nonblocking `unsupported/transport`, marks partial, withholds successful completion/timestamp. The hidden discarded-frame issue is not re-audited here; its explicit new contract is required by the corrected probe.
- Repository regression `remote-chat.test.ts:120–130` checks both capability values, `admissionState:"refused"` and exactly one turn POST. The prior image-upload case now expects the honest unsupported follow-up (`:250–253`). Reviewed source only; those repository tests were not rerun.

### Corrected isolated execution

**1/1 passed, exit 0**, Node **22.23.3**, `2026-10-03T06:51:15Z`; 112 ms test / 886 ms suite. Actual core/main/SDK/native loopback path retained. Only the first-turn completion assertion changed to the explicitly supplied limited-projection contract; image/refusal/no-POST assertions remain strict and the restored-vision check was added.

| Assertion | Observed |
| --- | --- |
| Initial admitted image turn | `settled`, `stop`, `partial:true`, `complete:false`; nonblocking `transport` marker; no success timestamp |
| Same epoch/binding, vision false, text-only follow-up | `model_no_image_input`; zero extra turn POSTs |
| Explicit original-image control, vision false | `model_no_image_input`; zero extra turn POSTs |
| Same epoch/binding, vision restored true | `provider_unsupported`; zero extra turn POSTs |
| Reservation and retained data | Core state `ready` after both refusals; entire original user/assistant projection and caller draft unchanged |
| Persistence | SQLite event/session/message/part counts remain `[0,0,0,0]` |

Corrected files: `/tmp/opencode/remote-history-capability-review/corrected-{history-capability.test.ts,vitest.config.mjs,result.json,vitest.json,run.log,provenance.json,source.diff,probe.diff}` and `corrected-source/`. The recorded command uses the same Vitest binary with `--config /tmp/opencode/remote-history-capability-review/corrected-vitest.config.mjs`; only this isolated test runs.

No remaining blocker in this correction's bounded admission/refusal scope. Backend hydration and SDK complete-projection contracts remain owner gates; neither refusal nor this controlled fixture proves those features, real inference or public UI acceptance. No repository writes, build, global suite, Mac/CI action or owner post performed.
