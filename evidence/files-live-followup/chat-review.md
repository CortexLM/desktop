# Saved-image Chat entry — independent source review
**CHANGES REQUIRED: one P2 in pending rename ownership.** Source-only; no runtime acceptance.
Base application `9ba8e59`; checkout `d390cce590600cf5896fa19acf0ddd44d7057e2c`; reviewed uncommitted released sources.
Read AGENTS, all nine rules, delivery/contract review, author handoff; traced navigation, live hooks and actual composer callers.
Only this report written; no delegation, application edits, builds/tests, network, CI, device operations or commits.

## Exact source pins
Paths below are relative to `packages/app/src/screens/chat/`; all match the author handoff.
- `live-chat.tsx` — `945ae020fbb4456067a236522f3dbea65325b4e45767df570d89982f42e2c3f1`
- `model-composer.tsx` — `adae1965674288508772d5f3815a31df25aa43c648cdb176204a4fa917e348a3`
- `chat.css` — `703d19a440aee2306c052ba5389d5484082586d45f788dd5a16ce7ed8963a9d9`

## P2 — one rename completion unlocks Open while another rename is pending
`live-chat.tsx:285–286,306,314,370,373`: the new pending-write fence is a boolean; Rename remains actionable during `renameBusy`.
1. On an idle Chat with an empty composer, rename to A; blur/Tab submits PATCH A. Hold its response.
2. Reopen Rename, enter B, blur/Tab; PATCH B starts despite A remaining pending. Hold B too.
3. Settle A only. Its `finally` clears both `renameWrite.current` and `renameBusy`; B is still pending, `renaming` is false.
4. Open the saved image. All header/composer checks pass; Chat departs with B unresolved. B may still fail or finish after departure.
This does not require simultaneous React events: two ordinary edits plus delayed IPC suffice. The pre-existing overlapping-write behavior now defeats the new Open admission contract.
Minimal fix: gate Rename menu admission at `:373` on `!renameWrite.current` as well as `!opening.current`; retain the synchronous ref check.
Coordinator runtime assertion: hold PATCH A, attempt Rename B through the menu, assert no second editor/PATCH; Open must keep the Chat URL and explain refusal until A settles. Then accepted Open may proceed. Also retain the original two-held-write sequence as the failing-source reproduction.

## Remaining source checks
- `model-composer.tsx:78–116,126–181`: guard checks raw text including whitespace, files, busy prop, read count and submission ref. Ref mutations precede setters; read count increments before awaiting. Refused/missing-model sends retain text/files; accepted sends clear after handlers have been synchronously fenced.
- Two read completions before a render do **not** independently overwrite each other: serialized continuations append through the same updated ref; the second queued array contains both batches. An intervening ordinary render includes queued state. Installed React 19.3 groups ordinary sync/continuous/default lanes; this call path introduces no React transition. No concrete stale-render/ref loss established here.
- Accepted `tryLeave` immediately locks before `go`; input, add/read admission, removal, model/thinking, send/voice/Stop handlers recheck the lock. Rendered inert/disabled controls supplement that fence. An existing read prevents lock admission, so its completion cannot newly dirty an accepted Open.
- `live-chat.tsx:290–319`: actual same-Chat `currententrychange` resets both locks even before deferred callbacks commit. Thrown navigation also resumes. `App.tsx:23–28` callbacks read the then-current URL rather than replaying a captured viewer destination.
- `Chat():109–115` returns keyed LiveChat from committed `params.id` before consulting `isPreview`; no outer actual-URL branch replaces this outgoing live Chat. Guarded ModelComposer uses committed preview/shot flags. PreviewGate/main identity likewise follow committed hash; deferred preview alone does not replace this composer.
- Single active rename: blocked pointerdown preserves focus; keyboard blur sets `renameWrite` synchronously before Open. Project drafts/pending writes block Open; project writes already have single-flight admission. Post-Open rename/move/delete/new-chat/prompt entry points reject the latched owner.
- Only LiveChat receives `leaveGuard`. Home/Code retain their existing mode selection; absent handles cannot latch their composers. Actual Work callers use the separate `components/composer.tsx`, not ModelComposer; FileThumb is private to LiveChat, not Work transcripts.
- `live-chat.tsx:308–318`: fetched `Session.kind === "chat"`, exact outer/message/part ownership, minimum-32 lowercase hex identities, singleton committed/actual Chat ID and nonpreview route checks precede exact `{session,message,part}` navigation. No filename/bytes/source URL enter history.
- `FileThumb:200–213`: shared `readRaster` runs before source assignment; only validated bytes become owned Blob URLs. Primitive source replacement hides the old image, effect cleanup revokes it; native error revokes/falls back, unmount revokes. No original/external-URL fallback. Open waits for native load; dirty-state refusal remains actionable with localized Base UI toast.
- `chat.css:426–427`: two thumbnail-scoped size/radius rules preserve the global native-button focus outline. Preview thumbnail components are untouched. No visual/layout certification from source inspection.
- No new engine/API/auth/key path or Open-triggered product mutation found. Parser internals, viewer ownership/download and cumulative decoder-memory limits remain separately owned reviews; their correctness is not inherited from this report.

## Runtime qualification
No proposed assertion executed. Existing Activity acceptance does not prove these Files changes.
Coordinator coverage should include overlapping file reads, held submit/refusal, dirty rename/project, native pointer/keyboard refusal, and Back re-enabling the same composer **before** either deferred navigation callback is released.
