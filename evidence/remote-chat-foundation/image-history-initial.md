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
