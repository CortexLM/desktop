# Live recovery source review

**Disposition: three P2 memory findings. No P1 found.** Approval-list recovery and model-row wrapping have no additional source-level blocker in the reviewed diff.

Reviewed HEAD `6d965358bb5e02473df6be7e97ecfdb07650c0b8` plus the uncommitted changes in the five assigned renderer files and three assigned E2E files. Read `AGENTS.md`, all `.rules/`, the baseline memory report/results and approval/provider before logs. Supporting hook, navigation, bridge and memory-handler source was read only to trace these changes. No tests, builds, runtime, Mac, CI or repository writes performed. This file is the sole deliverable; no delegation.

## P2 — Initial Bot loading can discard an unsaved memory draft

**Lines:** `packages/app/src/screens/bots/team.tsx:151-154`, `:230` (`bot` selection at `:139`).

The added identity reset treats `undefined -> loaded Bot ID` as an owner change and unconditionally clears `draft`. The Add button remains enabled while `bots.state === "loading"`; only `memoryBusy` and an existing draft disable it. Thus the user can type before the first Bot list resolves, then lose the exact draft without any accepted POST.

**Deterministic reproduction for the coordinator:**

1. Open `#/bot-settings?id=<existing Bot>&v=memory`; delay the real `GET /api/bots` response.
2. Click Add and type nonempty text while that read is pending.
3. Release the read. The new layout effect clears the field; no memory write occurred.

**Minimal fix:** disable/refuse live Add until the selected Bot is resolved (`!bot` in both the disabled condition and handler guard). If editing before load is intentional, bind the draft to the requested route identity instead of clearing on initial data arrival.

**Test gap:** `tests/e2e/memory-safety.spec.ts:81-86` opens the page and immediately interacts, but never holds the Bot-list read or asserts this loading boundary. Its later same-owner refusal test does not cover it.

## P2 — Bot identity reset leaves the previous Bot's memory actionable

**Lines:** `packages/app/src/screens/bots/team.tsx:140`, `:151-154`, `:165`, `:167-171`, `:235-243`.

Residual gap in the new owner-safety contract; the stale-query behavior itself predates this diff.

The new layout effect invalidates writes and drafts, but not the memory snapshot. `useQuery` retains its previous `ready` data when dependencies change (`packages/app/src/state/live.ts:18-27`); it does not enter loading. Live Bot settings are not keyed by Bot ID (`packages/app/src/shell/shell.tsx:118`, `packages/app/src/screens/bots/index.tsx:12`). On a same-component change from Bot A to Bot B, the heading/handlers switch to B while the list and count still contain A's memories. The reset also re-enables delete controls. A slow read exposes this normally; a failed B read ends in an unqualified Empty memory state.

**Deterministic reproduction for the coordinator:**

1. Give A and B distinct memories. Load A's Memory settings.
2. Hold the real memory-list response for B, then navigate directly between the two `bot-settings?id=...&v=memory` history entries.
3. B's heading shows A's saved text/count. Click Forget or Forget everything.
4. The renderer sends B's Bot ID with A's memory ID; the real engine refuses it. The Bot ownership check prevents cross-Bot deletion, but the displayed owner/content and action are wrong.

**Minimal fix:** remount an internal stateful settings body on the requested Bot ID, within the owned `team.tsx`, or bind the query result to its owner and suppress old-owner rows/actions. `MemoryEntry.botID` permits a small defensive display/mutation filter, but preserve a truthful pending state rather than interpreting an owner mismatch as empty.

**Test gap:** `tests/e2e/memory-safety.spec.ts:120-134` checks a late write cannot erase the next Bot's draft; it never delays B's GET or verifies A's rows cannot render/submit under B.

## P2 — Delete guard releases before stale rows are reconciled

**Lines:** `packages/app/src/screens/bots/team.tsx:173-176`, `:237`, `:241-243`.

`memQ.reload()` starts an async read and returns `void`; it keeps the old ready array. The `finally` block immediately clears `memoryWrite` and `memoryBusy`. After a successful delete/wipe, the old row and Forget everything button therefore become enabled before refresh completes. A second action submits already deleted IDs and produces a real `404 not_found` failure after the successful deletion. Partial wipes can also retry both surviving and already deleted IDs, falsely reporting another failure even after the last survivor was successfully deleted.

**Deterministic reproduction for the coordinator:**

1. Load one memory and allow its DELETE to complete normally.
2. Hold the subsequent real GET response.
3. While the stale row is still visible, click Forget again (or confirm Forget everything again).
4. Two DELETEs target the same ID; the second refuses. The first success is followed by Couldn’t forget this memory.

**Minimal fix:** retain the mutation lock until the refreshed list is installed, or immediately remove only fulfilled IDs from an owner-bound local snapshot/tombstone set before unlocking. Handle refresh failure explicitly; simply awaiting `memQ.reload()` is insufficient because this hook currently returns `void`.

**Test gap:** the gate in `tests/e2e/memory-safety.spec.ts:40-45` delays POST/DELETE only. `:160-164` proves duplicate protection while DELETE is pending, not while the follow-up GET is pending; `:187-192` waits for the survivor list before proceeding.

## Bounded pass / remaining verification scope

- **Add acceptance/refusal:** normal resolved-owner flow keeps the exact draft on rejection; trim only affects sent content. The synchronous symbol blocks repeated Enter/blur while pending; read-only input prevents accepted writes from clearing newer edits. Pending Escape is ignored. Idle Escape removes the field; no demonstrated Chromium Escape/unmount blur regression was found by source review. Existing tests do not assert zero POSTs after idle Escape, so that remains a useful bounded runtime check, not a fourth finding.
- **Partial wipe:** `Promise.allSettled` waits for every targeted write; one rejected member suppresses Memory erased; individual failures consume rejection and use localized copy. Pending/same-owner callbacks are guarded. Findings above concern identity/loading and post-settlement reconciliation.
- **System Memory:** `projects.tsx:224-238` retains refused rows and emits success only after acceptance. Per-ID refs reject synchronous repeats; success removes locally before releasing the guard. Its changed data-array dependency fixes the existing initial-ready-empty/list-result synchronization gap. The selected Bot cannot change through this screen's own live controls (`bots.data[0]`, no Bot-list subscription); no separately reproducible owner-switch finding is asserted there.
- **Preview isolation:** changed memory actions branch to preview-local state; no new preview mutation call. Preview/shot history entries remount the content; symbol/Set cleanup suppresses late live callbacks. Approval preview remains a distinct component.
- **Approval recovery:** `work/desk.tsx:106-108` explicitly handles failed GET before the empty-success branch. Retry invokes the same real query. The test rewrites only GET `/api/permissions` to a missing real route; the protocol produces the rejection. It verifies a real pending permission survives and is still present after Retry. No synthetic response or engine stub found.
- **Fault realism:** memory tests delay original IPC calls; refusal IDs reach the production DELETE handler and assert real 404/not_found. Add refusal deletes the real Bot. Baseline documentation separately records the real SQLite-lock 500; these new E2Es do not claim to repeat that fault.
- **Model layout:** scoped native flex wrapping; metadata returns to normal whitespace; installed catalog fixture's Reasoner Large carries context, cost and all three capability badges. `ui-flows.spec.ts:74-87` measures each rendered label rather than assuming line/font dimensions, exercises 960/1024/1440 in both themes, waits for fonts earlier, and scrolls the row into view. No source-based portability blocker found; native rendering remains for the coordinator. The existing pixel-width equality at `:40` predates this diff.

## Reviewed file pins (SHA-256)

```text
7433ad9a22062c600a655be08ca02e85096113a68913bd586d213d51e4a204f6  packages/app/src/screens/bots/team.tsx
b1eaf81b51773a3ba92a039ae78fbafdf5268310cd7d52d4ebeb9741d80ad131  packages/app/src/screens/system/projects.tsx
83684a1871d2a992327cc6b2bf2cc261c386ac856e41d0279292cad651707ac0  packages/app/src/screens/system/settings.tsx
99997698d23f177f27a3e632022bd6120297708cd414e829e0613d833bc3514e  packages/app/src/screens/system/system.css
1fd2ca98a9416e8da406aa64f56ab4eecb1f934a741e785ae91888d30d82aa99  packages/app/src/screens/work/desk.tsx
0b2383871db8a4490de1d5d9977ea0e05e3e8005842633a0a79421d3690771a6  tests/e2e/memory-safety.spec.ts
c128f8bb921829e346b0bd0393423b7a086a9827aa85591ebd80db462d808bc0  tests/e2e/approvals-recovery.spec.ts
86483759ea299f97faa0e09d6210b37876d535af4486651e141f46650cccc36b  tests/e2e/ui-flows.spec.ts
```
