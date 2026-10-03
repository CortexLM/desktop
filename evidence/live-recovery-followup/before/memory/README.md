# Memory write acceptance — baseline reproduction

**Two real-engine failures confirmed in the existing Electron build.**

| Surface | Actual engine refusal | Observed user-visible failure |
| --- | --- | --- |
| Bot settings → Memory → Add | `404 not_found` after the same Bot was deleted through the engine | Save error appears; entered memory disappears; Add reopens an empty field |
| Bot settings → Memory → Forget everything | `500 internal` after a real SQLite write-lock timeout (5,008 ms) | `Memory erased` success toast; original memory still displayed, returned by the engine, retained after renderer reload and application exit |

## Provenance and isolation

- Checkout at runtime: `6d965358bb5e02473df6be7e97ecfdb07650c0b8`; application source directories have no diff from `f9aca44`.
- Existing `packages/app/dist` and `packages/desktop/dist` only; Electron `44.5.1`, Linux/Xvfb, 1440×900 content. All 90 distribution-file hashes match before/after. Manifests: `memory-live-repro/dist-before.json`, `memory-live-repro/dist-verified-after.json`.
- Add checked in light theme; wipe checked in dark theme. This is a bounded behavioral reproduction, not a theme/size matrix or design comparison.
- Fresh independent `CORTEX_DATA_DIR`, `--user-data-dir`, `HOME`, XDG cache/config and temporary directories under `/tmp/opencode/memory-live-repro/` for every launch. Electron canonicalizes `/tmp/opencode` to `/var/tmp/opencode`; both paths refer to the same approved directory.
- Empty catalog URL `data:application/json,{}`; no provider or inference required. Test Bot/entry creation used real API routes. Each completed launch first asserted the engine returned zero Bots.
- The test wrapped `ipcMain`'s existing `cortex:fetch` callback only to record timestamps/status/body. Every request and response passed unchanged through the original callback. **No synthetic IPC response, UI refusal injection, engine stub or storage-method replacement.**
- Add fault: real Bot lifecycle deletion through the existing IPC/API route.
- Wipe fault: a separate SQLite connection held `BEGIN IMMEDIATE` on this launch's isolated database. The production engine's actual write failed after its existing `busy_timeout = 5000`. Lock released with `ROLLBACK`; no schema, table or data mutation by the lock holder.
- No repository edits/builds, Mac interaction or CI work by this executor. Concurrent coordinator evidence/docs/test changes were observed and preserved; repository-wide cleanliness cannot be claimed during that parallel work.

## 1. Add destroys a refused draft

### Source

`packages/app/src/screens/bots/team.tsx:161`:

```tsx
const addLive = (content: string) => { setDraft(null); if (bot && content.trim()) api.bots.memory.add(bot.id, content.trim()).then(memQ.reload, () => toast.add({ title: t("work.error.save"), data: { icon: "alert-triangle" } })); };
```

`team.tsx:212` invokes this handler from both `onBlur` and Enter. Clearing `draft` unmounts the field before acceptance.

The refusal is genuine: `packages/core/src/bot.ts:54-58` checks the stored Bot before remembering; `bot.ts:22-25` throws `not_found` for the deleted Bot. `packages/server/src/index.ts:125` binds the real handler; `packages/protocol/src/index.ts:134` maps it to 404.

### Executed sequence

1. Create `Memory acceptance check` through `POST /api/bots` (201), open `#/bot-settings?id=<id>&v=memory&theme=light`.
2. Click Add; enter `Keep this unsaved memory after the engine refuses it.`.
3. Delete this Bot through `DELETE /api/bots/<id>` (200), leaving the loaded settings screen and draft in place.
4. Press Enter in the memory field. Exactly one memory POST reaches the original engine and returns 404 with `error.code = not_found`.
5. Assert `Couldn’t save. Try again.` visible, draft input absent. Click Add again; assert input value is the empty string.

### Artifacts

- `memory-live-repro/01-bot-add-draft.png` + `.dom.json`: original draft present.
- `memory-live-repro/02-bot-add-refused-draft-lost.png` + `.dom.json`: error toast, no draft field.
- `memory-live-repro/03-bot-add-reopened-empty.png` + `.dom.json`: recreated field empty.
- `memory-live-repro/observed-run-results.json`, first case: exact request, 404 response, DOM assertions, isolated directories.

**Expected safe behavior:** keep the exact draft visible/editable after refusal; show the existing localized save error. Clear/close only after a successful persisted add. A deleted Bot need not become retryable, but its refusal must not discard the user's text.

## 2. Forget everything claims erasure after a failed delete

### Source

`packages/app/src/screens/bots/team.tsx:215-218`, specifically line 217:

```tsx
if (bot && confirm(t("bots.set.forgetAllSub", { count: memCount }))) Promise.all(liveMem.map((m) => api.bots.memory.delete(bot.id, m.id))).finally(() => { memQ.reload(); toast.add({ title: t("bots.set.toastWiped"), data: { icon: "trash" } }); });
```

Success is inside `finally`; rejection remains unhandled. `packages/core/src/bot.ts:61-65` invokes `Storage.deleteDoc`; `packages/core/src/storage.ts:168-170` runs the actual SQLite DELETE. Storage configures the 5-second busy timeout at `storage.ts:51`. Unknown SQLite errors become `500 internal` through `packages/protocol/src/index.ts:159-169`.

### Executed sequence

1. Create a fresh Bot and one real persisted memory: `This stored memory must survive a refused deletion.`.
2. Open `#/bot-settings?id=<id>&v=memory&theme=dark`; assert `Memory 1` has that exact value.
3. Hold a writer reservation with a separate `DatabaseSync(<isolated engine>/cortex.db)` connection and `BEGIN IMMEDIATE`.
4. Click Forget everything; accept the real confirmation.
5. Original engine DELETE returns `500`, body `{"error":{"code":"internal","message":"Internal error"}}`, after 5,008 ms.
6. Assert success toast `Memory erased` visible **and** `Memory 1` still contains the original text. Real engine GET returns the identical memory object/id.
7. Release lock; reload renderer; assert original memory still visible. After application close, a separate read-only SQLite query confirms that identical memory still persisted.

### Artifacts

- `memory-live-repro/04-bot-wipe-before.png` + `.dom.json`.
- **`memory-live-repro/05-bot-wipe-refused-false-success.png` + `.dom.json`: success toast and retained memory in one frame.**
- `memory-live-repro/07-bot-wipe-reload-still-persisted.png` + `.dom.json`.
- `memory-live-repro/observed-run-results.json`, second case: 500 response, timeout duration, unchanged API object, reload assertions. Renderer also emitted an unhandled `Internal error` page error; no failure toast was shown.
- `memory-live-repro/06-bot-wipe-native-xvfb.png`: supplemental root-window capture, including native controls. It retains a confirmation-dialog visual at upper left under Xvfb; do not use it to attest native dialog dismissal. The page capture, recorded response and DOM assertions establish the failure.

**Expected safe behavior:** only report `Memory erased` after every targeted deletion has fulfilled. Any rejected deletion must show existing localized failure copy, refresh the surviving entries, preserve them across reload, allow retry, and consume the rejected promise. For a partially successful batch, wait for all requests to settle before refreshing; never report a full wipe after a partial failure.

## Narrow adjacent source checks

These are **source findings only**, not additional runtime reproductions:

- `packages/app/src/screens/system/projects.tsx:217-220`: `MemoryScreen.forget` removes a row optimistically, starts the API DELETE, then emits `system.memory.forgotten` immediately. Its rejection callback restores the row and emits `system.memory.forgetFailed`. Thus the handler can announce both success and failure for one rejected operation. The overflow Forget everything at line 231 calls this same handler per entry.
- `packages/app/src/screens/bots/team.tsx:160`: single-entry `forgetLive` emits success only after fulfillment, but its rejection callback is empty. Reuse existing deletion-failure copy there if correcting this memory-write surface.
- An optional System Memory runtime setup did not produce a completed case/capture before harness cleanup failed. No System Memory runtime claim is made.

## Smallest safe correction plan

1. **`team.tsx`, Add:** put `setDraft(null)` in the successful add continuation. Preserve the draft on catch. Guard a pending submission synchronously so Enter/blur cannot submit the same draft twice; temporarily prevent editing/replacing that draft while awaiting acceptance. Reuse the existing field and `work.error.save`; no new design or dependency.
2. **`team.tsx`, wipe:** replace the success-in-`finally` chain with an all-settled boundary and explicit success/failure branch. Native `Promise.allSettled` is sufficient. Reload once all deletions settle; `bots.set.toastWiped` only if all fulfilled. Reuse `system.memory.forgetFailed` on failure. Keep the existing Forget everything button as retry; disable reentry while pending. Do not add a bulk-delete endpoint solely for this correction.
3. **`projects.tsx`, forget:** move the existing success toast into the DELETE fulfillment branch. Retain existing rollback and `system.memory.forgetFailed`; either preserve its optimistic row strategy or remove only after acceptance. No new error catalog needed. The existing menu batch inherits this correction.

Existing catalogs: `work.error.save` (`Couldn’t save. Try again.`), `system.memory.forgetFailed` (`Couldn’t forget this memory`), `common.retry` if an explicit retry control is required. Existing Add/Enter and Forget everything already provide retry affordances; the toast kit presently renders an action only for Undo (`packages/app/src/kit/ui.tsx:191`), so a new generic toast action is unnecessary scope.

Regression acceptance: refused add retains exact draft; Enter/blur during pending yields one write; accepted add creates one persisted entry and clears only afterward; refused/partial wipe shows no success and retains only the actual survivors; success removes entries after reload; rejected single-entry removal shows failure. Reuse existing real-engine E2E conventions and these isolated failure mechanisms.

## Execution accounting and reproducible evidence check

Observed script: `memory-live-repro/observed-run-repro.cjs`; log: `memory-live-repro/observed-run-run.log`. Both Bot cases completed their behavior assertions and captures. **The overall run exited 1:** an optional System Memory setup failed, then cleanup called `app.process()` on an already disposed Playwright object and masked that optional setup exception. Consequently this is not reported as a green full test suite.

Three earlier harness failures are preserved separately: explicit `executablePath` skipped Playwright's injected Electron loader; `CORTEX_RENDERER_URL=""` selected a blank URL through the app's `??`; an isolation assertion compared symlinked `/tmp` and canonical `/var/tmp` paths literally. Those produced no product findings. No retries followed the two completed Bot failure cases.

`repro.cjs` now omits the optional System Memory experiment and fixes cleanup using stored child-process handles. That cleaned runnable version was not rerun, avoiding further repetitions of the established failures.

The independent **artifact + persistence verifier did run successfully**:

```bash
node /tmp/opencode/memory-live-repro/verify-evidence.cjs
```

It asserts both recorded API refusals, original submitted text, lost/reopened draft, false wipe-success DOM, retained API object, retained row after reload, read-only persisted SQLite row after app exit, and all 90 unchanged distribution-file hashes. Output: `memory-live-repro/verified-summary.json`.

For a future bounded replay against the same stable build (writes only isolated temporary state):

```bash
TMPDIR=/tmp/opencode/memory-live-repro xvfb-run -a -s '-screen 0 1440x1000x24' \
  node /tmp/opencode/memory-live-repro/repro.cjs
```

All referenced screenshots were inspected. No source correction is included in this terminal executor's scope.
