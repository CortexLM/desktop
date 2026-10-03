# Approval cancellation — bounded source review

**Approve the frontend one-liner. Existing events cover cancellation of pending session permissions; no new engine event/schema contract needed. No concrete P1/P2 residual found in this correction.**

- **Abort ordering:** `packages/core/src/session.ts:116-120` calls `controller.abort()` before awaiting completion. Its signal is passed to every session permission ask at `:234-236`. The registered abort listener in `packages/core/src/permission.ts:75` synchronously calls `settle`; `:80-85` removes the pending entry before rejecting its waiter. Session finalization later publishes `session.status` idle at `session.ts:427`; the run's `done` resolves afterward at `:134,155-157`. Thus the new invalidation observes the removal, not the old pending map. Aborted admission creates no permission wait.
- **Deletion ordering:** `session.ts:100-106` aborts the session controller, recursively deletes children, awaits the session abort, then publishes `session.deleted`. Existing pending asks are removed before both the final idle event and deletion event. Child sessions have their own status/deletion events. `packages/core/src/bus.ts:11-18` publishes synchronously; `packages/server/src/index.ts:22` forwards existing events into SSE.
- **Refresh behavior:** `packages/app/src/state/live.ts:33` now matches `permission.*`, `session.status`, `session.deleted`. Old in-flight reads cannot overwrite a newer refresh because `:21-23` increments/checks the sequence. Status publishes occur at run start/end (`session.ts:287,426-427`), not on token/part deltas. Cost is two additional reads per ordinary run per mounted permission hook, up to three on a non-abort error, plus deletion reads. `GET /api/permissions` only reads the map (`server/src/index.ts:70`, `permission.ts:88-90`), so no feedback loop or serious request-flood regression is evident.
- **Test guard:** `tests/e2e/approvals-recovery.spec.ts:55-59` restores the real route and confirms the unresolved ask returns after Retry. `:60-62` awaits real abort, explicitly verifies the engine permission list is empty, then requires UI empty without reload. The intervening GET emits no event and cannot itself fix the UI. This meaningfully distinguishes engine cleanup from renderer invalidation. Deletion has source coverage here, not an executed deletion regression.

Baseline `/tmp/opencode/live-recovery-first-targeted.log` inspected: seven passes, two failures at the post-abort empty-UI assertion, after Retry assertions completed. No replay, tests, build, Mac or CI performed by this review. Only this report written; no delegation or memory-worker progress query.

Reviewed SHA-256:

```text
4c4ec7ae725dfd250f5102c273deeed827c22a3e70568eaa145435a2970119c7  packages/app/src/state/live.ts
e3c7c13502645f367e9e8e8c6a536c3a7d024e32e41090952b50a095a093c4d9  tests/e2e/approvals-recovery.spec.ts
```
