# Memory follow-up + Work font-readiness source review

**One residual P2 in Bot memory deletion. The three original direct reproductions are addressed; navigation can still revive an accepted deletion. Work scroll correction has bounded source approval.**

Scope: current changes in `packages/app/src/screens/bots/team.tsx`, `packages/app/src/screens/system/projects.tsx`, `tests/e2e/memory-safety.spec.ts`, plus the font-readiness effect in `packages/app/src/screens/work/home.tsx` and `tests/e2e/work-scroll.spec.ts`. Read the original review, current handoff and `/tmp/opencode/memory-live-repro/read-race-baseline.log`. No tests/build/runtime/Mac/CI performed; no source writes or delegation. Only this report written.

## Original findings: direct-path closure

| Original P2 | Current source | Closure |
| --- | --- | --- |
| Initial Bot read clears an editable draft | `team.tsx:238` | Add is disabled until both Bot and matching memory entries resolve; its handler repeats those conditions. A draft cannot be opened during the initial owner read. |
| New Bot renders previous Bot's memories | `team.tsx:140-142,168-169,173,238-244` | Success and failure snapshots carry `botID`; mismatched snapshots do not render rows or enable Add/wipe. Delete admission also checks each entry's owner. |
| Accepted delete remains actionable during refresh | `team.tsx:173,180-184` | Fulfilled IDs enter the exclusion Set before unlocking; display and delete admission filter them. Same-owner delayed refresh and partial retry are covered. Residual navigation case below. |

`tests/e2e/memory-safety.spec.ts:107-119,128-152` now holds real GET responses at the relevant boundaries. `:297-314` retries the refused survivor before refresh returns and verifies the accepted ID is deleted only once. `:121-126` explicitly checks Escape sends no POST. The inspected negative log fails the corresponding old load/owner/reconciliation assertions and missing recovery state; it is not claimed as a post-fix run.

## P2 — Returning to the original Bot can revive its accepted deletion

**Exact lines:** `packages/app/src/screens/bots/team.tsx:155` clears `forgotten` on every Bot change; `:168-169` accepts any cached snapshot with the returning Bot's ID. `:173` then has no exclusion left to prevent another DELETE.

`useQuery` retains its last ready snapshot during replacement reads. After an accepted deletion, that snapshot can still contain the deleted ID while its refresh is pending. Switching to B clears the exclusion; returning to A before B's read completes makes the cached A snapshot match again. The deleted row and controls reappear under A, despite the known accepted delete. This is a residual of the third finding, not cross-Bot deletion.

**Deterministic coordinator reproduction, source-derived; not executed here:**

1. Load Bot A with one saved memory; Bot B may be empty.
2. Hold A's memory GET responses. Delete A's memory normally; wait for DELETE 200 and the held refresh. The row is correctly absent initially.
3. Hold B's memory GET response, then navigate to B's Memory settings in the same component.
4. Before releasing either read, navigate back to A's Memory settings. Its pre-deletion snapshot is still cached; the deleted row is actionable again.
5. Click Forget: the real engine receives a second DELETE for the already removed ID and returns 404.

**Minimum fix:** preserve fulfilled-ID exclusions across Bot changes for the mounted settings lifetime; memory IDs are globally unique. Keep the write-token/draft reset owner-specific. The existing per-entry owner filter still prevents cross-owner mutations. Add the return-to-A assertion to the held-read case so it proves an accepted ID stays absent and is requested only once across navigation.

Current tests cover A-to-B navigation and same-owner delayed refresh separately, not this combined return path.

## Other changed memory paths

- `team.tsx:186-194,247`: refusal still preserves the exact draft; trimming applies only to the submitted content. Synchronous request identity/read-only state protects pending Enter/blur and late previous-owner callbacks.
- `team.tsx:243-244`: a matching failed read shows Retry; an unresolved/mismatched read does not claim Empty. Failure ownership is carried in the snapshot rather than an unowned hook error.
- `projects.tsx:205,218-221,258-259`: owner-tagged success snapshots, explicit load failure/Retry, initial loading suppression. `:224-238` preserves refused rows and emits success only after acceptance. No additional concrete P1/P2 found in the bounded System Memory changes.
- `memory-safety.spec.ts:40-60`: barriers forward production IPC responses; refusal uses real missing routes/IDs. `:70-90` releases barriers; `:154-175` checks Bot/System read refusal and recovery. Soft assertions still fail the test; they do not weaken the acceptance result.

## Work font-readiness effect: bounded approval

`packages/app/src/screens/work/home.tsx:285-301` captures the specific thread element, not a later `thread.current`. Cleanup sets a closure-local cancellation flag, cancels its frame and removes its listeners from that same element. The font-ready continuation checks cancellation before scheduling; the animation-frame callback checks again before writing. Variant changes/unmount therefore cannot redirect the old deferred scroll to a replacement thread. Wheel/pointer/touch/keyboard intent on the thread cancels both phases. Warm-font readiness coalesces the initial pending frame. Approval keeps its existing 260px behavior without the new font-ready second scroll.

`tests/e2e/work-scroll.spec.ts:47-70` delays real font requests without replacing metrics/fonts. `:78-138` checks cold/warm bottom position, wheel interruption, variant change and departure; the variant step exercises effect cleanup within the mounted screen. Source review found no new stale-DOM/cancellation blocker. Coordinator-reported runtime/pixel success was not independently rerun here.

## Reviewed SHA-256

```text
82026dfc4edbe11c0e8692e849a2af5e135a2823720160bbd814876e715511c5  packages/app/src/screens/bots/team.tsx
27fa94c6f85909f6a00ee2afaadc36f4b90bbb8557bd0b937f5f1edc092ede08  packages/app/src/screens/system/projects.tsx
4a66b4dfd82af2813ab875d2cf2a83b19165f46ed10538377d80db775c20d36a  tests/e2e/memory-safety.spec.ts
f20599c58871783afba2024f88aa8902b2e9f355baeb6af35f2a473a70e056d6  packages/app/src/screens/work/home.tsx
0b2f0c3a9cd73e0e1e7484ea9c7a1f70cd3baf67a751ff627c9ee4b79698379b  tests/e2e/work-scroll.spec.ts
```

## Final disposition — return-navigation correction

**Bounded source approval. The remaining P2 is closed; this disposition supersedes the earlier open finding. All three original findings and the return-navigation residual are addressed at the pins below.**

- `packages/app/src/screens/bots/team.tsx:149-158` retains the fulfilled-ID exclusion Set for the mounted component lifetime while still resetting the owner-specific write token, busy state and draft. `:170,174,181` continue filtering display/admission and recording successful deletions before unlock. Returning to the cached owner cannot revive a known deleted ID; globally unique IDs prevent excluding another Bot's distinct memory.
- `tests/e2e/memory-safety.spec.ts:147-161` now holds both owners' real reads, returns to the deleted memory's owner before releasing either, asserts zero rows/disabled wipe, and verifies exactly one DELETE. The two held returning-owner reads at `:153` make the stale-snapshot window deterministic.
- `/tmp/opencode/memory-return-before.log:9-30` confirms the extended test failed against the previous implementation with one row where zero was expected. No additional source blocker found in this minimal closure diff.

Closure-only review; no broader audit, source edits, tests/build/runtime/Mac/CI. Coordinator's earlier 83-case pass and final targeted execution remain coordinator-owned evidence.

Final reviewed SHA-256:

```text
b41bb7e76f31cc133f793a7ce53887cd6ab7bbcb17273b5f8a0abe3d0e6081e1  packages/app/src/screens/bots/team.tsx
d04b2a96257cc4bba2ea4108ed3d391dda798bd9699121f7aa4d15b61ada561a  tests/e2e/memory-safety.spec.ts
```
