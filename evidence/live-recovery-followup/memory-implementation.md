# Memory acceptance correction — implementation handoff

## Independent-review follow-up (current handoff)

All three P2 read races from `/tmp/opencode/live-recovery-source-review.md` were reproduced in one deterministic **960 light** run against the coordinator's integrated build, before the follow-up source correction. No rebuild performed by this executor.

Evidence: `/tmp/opencode/memory-live-repro/read-race-baseline.log` and `/tmp/opencode/memory-live-repro/read-race-baseline/`.

- Held real `GET /api/bots` responses: Add incorrectly enabled and opened a field before its owner resolved.
- Held real Bot B memory-list response: B heading displayed A's private memory and enabled Forget everything.
- Accepted real DELETE (200), held its follow-up GET: deleted row stayed present and Forget everything re-enabled.
- A real missing memory-list route (404) produced Empty instead of error/recovery.
- Same run's explicit draft Escape followed by request-log assertion proved **zero memory POSTs**.

The three captured race screenshots were inspected. Soft assertions intentionally let one run reach all three defects; the run exited 1 for those intended failures plus the missing recovery state. Existing real SQLite 500 baseline evidence remains separate.

### Follow-up correction

- Bot memory query now returns an owner-bound `{ botID, entries }` snapshot; old-owner data/error cannot render under a new Bot. Pending owner/read shows no false Empty/count and keeps Add disabled. Add's handler also checks resolved owner/list.
- Fulfilled deletion IDs enter an owner-scoped exclusion Set **before the write guard unlocks**. Rendering and deletion admission both exclude them. A delayed or stale GET cannot make a completed deletion actionable again; partial retry targets only survivors. The Set resets on owner change.
- Bot/System memory read failures reuse `work.error.loadTitle`, `work.error.loadText`, `common.retry`. Pending loads do not claim Empty. System memory reads are owner-tagged too.
- Tests now register **eight cases** (four per theme). New read-barrier race case covers owner load, same-component owner change, delayed delete reconciliation, Bot/System read refusal/Retry, exact one DELETE, explicit Escape/no POST. The existing partial-wipe case retries a survivor **before** the earlier refresh resolves and asserts the fulfilled ID is requested only once.
- Read barriers delay actual engine responses; missing-list refusal reaches the actual protocol; no list data or response is fabricated. Cleanup releases every pending read and write barrier.

### Follow-up checks

- Targeted lint: passed (`read-race-lint.log`).
- Full TypeScript: passed (`read-race-typecheck.log`).
- Eight tests register (`read-race-test-list.log`).
- Owned-file `git diff --check`: passed.
- Post-follow-up build/E2E remains coordinator-owned and **not yet run**. No dist write, Mac/CI action, commit or docs/i18n change by this executor.

Ready for the independent reviewer to recheck `team.tsx`, `projects.tsx`, `memory-safety.spec.ts`, then coordinator rebuild and eight-case execution.

---

The sections below preserve the initial implementation handoff and its earlier verification boundary.

## Owned files changed

- `packages/app/src/screens/bots/team.tsx`
- `packages/app/src/screens/system/projects.tsx`
- `tests/e2e/memory-safety.spec.ts`

No builds, distribution replacement, commits, docs/i18n changes, Mac operations or CI runs. Coordinator/other-worker edits preserved.

## Behavior implemented

### Bot settings

- Add preserves the exact typed draft, including surrounding spaces, until the corresponding real add fulfills. The engine still receives the trimmed content as before. Blank drafts remain editable; Escape cancels explicitly.
- A synchronous request token prevents Enter/Enter/blur from duplicating the write. Pending input is `readOnly`, not `disabled`, avoiding disabled-input auto-blur. Add cannot replace an open/pending draft; Escape cannot clear a pending one. Refusal leaves the original field editable with existing `work.error.save` copy.
- Bot identity/preview changes and unmount invalidate the token. An old response cannot clear a new Bot's draft, unlock its request, reload its memory query, or post a stale action toast.
- Individual deletion and Forget everything share the existing action handler. All requested deletes settle before list refresh. `bots.set.toastWiped` appears only if every targeted delete fulfilled; any rejection uses existing `system.memory.forgetFailed`. Single-entry failures are visible. Mutation controls and synchronous guard prevent duplicate actions while pending.
- Existing preview mutations/Undo remain on their original branch.

### System Memory

- Live row removal and `system.memory.forgotten` occur only after accepted deletion. Refused/pending rows stay visible and exportable; refusal uses the existing failure copy.
- Per-entry synchronous Set plus disabled pending row button prevent duplicate deletes, including repeated batch-menu actions. Owner-change/unmount invalidation suppresses late UI updates.
- Corrected the live-memory synchronization dependency from only `live.state` to the loaded array/owner. `useQuery` can replace an already-ready array without changing the state string; the previous dependency could miss initial Bot-backed data and leave the live list empty.
- Preview edit/remove/Undo unchanged. Memory-enable policy and APIs untouched.

## Regression coverage added

Six registered Electron cases: each at **960×640, light and dark**.

1. Real deleted-Bot `404 not_found` preserves exact draft; Enter/Enter/blur while gated produces one pending write; accepted add persists once; pending response from an earlier Bot cannot clear the next Bot's draft; accepted entries survive reload.
2. Wipe rejects a real missing memory ID, retains original row, shows failure, no success; partial batch keeps the second request held after the first rejection, proving all-settled waiting; remaining real delete succeeds; survivor refresh is accurate; retry erases and remains empty after reload; no page errors.
3. Individual Bot deletion failure visible; System Memory retains row while pending/refused, rejects duplicate click, emits no premature success; accepted retry removes row and stays absent after reload; no page errors.

Test fault mechanism is explicit: an IPC observation/barrier wrapper forwards to the original production callback. For selected DELETEs only, the requested memory ID gets `-missing`; the real `BotService.forget` rejects that nonexistent ID with 404. Other requests execute normally, including successful partial-batch deletion. Responses are never stubbed. The earlier real SQLite 500 baseline remains in `/tmp/opencode/memory-live-repro.md`; portable committed regressions no longer take DB locks. All held requests, including unexpected duplicates, are released in `finally` before app close. Tests create no permission asks.

## Checks actually executed

| Check | Result |
| --- | --- |
| Desired regression against unchanged baseline dist, one light Add case, no retries | **Expected failure**: real 404 observed; exact draft input missing |
| Targeted ESLint on all three owned files | Passed |
| Full `tsc -p tsconfig.json --noEmit` | Passed; the reported TS2538 test callback issue is fixed |
| `git diff --check` for owned files | Passed |
| Playwright `--list` for `memory-safety.spec.ts` | Six cases registered |
| Existing artifact/persisted-row/dist verifier | Passed; all 90 distribution hashes still unchanged |

Baseline command executed once before application edits:

```bash
TMPDIR=/tmp/opencode/memory-live-repro NODE_ENV=test \
  xvfb-run -a -s '-screen 0 1440x1000x24' \
  node node_modules/@playwright/test/cli.js test tests/e2e/memory-safety.spec.ts \
  --grep 'retains refused.*960 light' --workers=1 --retries=0 --reporter=line \
  --output=/tmp/opencode/memory-live-repro/desired-baseline
```

Evidence: `/tmp/opencode/memory-live-repro/desired-baseline.log`, corresponding `test-failed-1.png`, `trace.zip`, `error-context.md`. Screenshot inspected. Failure was the intended `toHaveValue("  Keep my exact memory draft.  ")`, not setup; the preceding request assertion confirmed 404/not_found.

Logs: `/tmp/opencode/memory-live-repro/fix-typecheck.log`, `fix-lint.log`, `fix-test-list.log`, `fix-dist-check.log`.

## Coordinator follow-up required

**Updated UI has not been built or runtime-verified.** Existing dist stays at baseline by instruction. Once the other baseline worker releases it, coordinator should build and run the six new cases, plus owned integration checks. Example after authorized build:

```bash
TMPDIR=/tmp/opencode/memory-live-repro NODE_ENV=test \
  xvfb-run -a -s '-screen 0 1440x1000x24' \
  node node_modules/@playwright/test/cli.js test tests/e2e/memory-safety.spec.ts \
  --workers=1 --retries=0 --reporter=line \
  --output=/tmp/opencode/memory-live-repro/fixed-e2e
```

Review captures, repeat the supported-OS/packaging workflow as appropriate, update coordinator-owned AGENTS/docs, integrate with concurrent corrections. No green post-fix UI, Mac, CI or packaging claim is made here.
