# Remote bus privacy review

**Bounded approval. No blockers in the three-file delta.**

- `packages/core/src/bus.ts:12-19`: explicit `"remote"` bypasses `Storage.append` for every event type; default/explicit `"local"` retains synchronous commit-before-delivery. Append failures still propagate before listeners. Source travels as a separate primitive, never inside `Event`; cloning, unsubscribe and listener-fault isolation remain intact.
- `packages/core/src/index.ts:81`: the sole plugin event dispatcher rejects remote events before `plugins.trigger`, including non-durable deltas/status. Plugin loading exposes hooks/directory, not a bus subscription (`packages/core/src/plugin.ts:25-26,74,107-111`).
- Subscriber sweep found only that dispatcher and SSE forwarding in production (`packages/server/src/index.ts:22`). SSE serializes only `e`; desktop IPC forwards those bytes. Renderer event consumers update memory or refetch reads; none automatically republishes remote content as local, writes it back, or invokes plugin hooks. No current cross-channel bypass found.
- Existing one-argument `subscribe`/typed `on` callbacks remain assignable; typed narrowing remains intact. Source is captured per publication, avoiding shared-source/reentrant classification errors.

## Test adequacy

Adequate for this prerequisite: real SQLite plus a registered plugin; all five durable event types, delta/status, exact live/serialized payloads, source propagation, callback-time zero journal/projection rows, local CRUD/journal ordering, nested publisher cloning, unsubscribe and fault isolation. Callback-time assertions prevent final deletion from concealing temporary remote persistence.

Retained evidence inspected under `/tmp/opencode/remote-bus-prerequisite`: old runtime **1 privacy failure / 1 compatibility pass**; fixed runtime **2 passes**. Current three-file SHA-256 values match `fixed-provenance.json`; test hash matches the negative baseline. Node 22 core-scoped typecheck/lint reported successful; retained diagnostic logs are empty. Checks were not rerun during this read-only review.

## Acceptance boundary

Approval requires producers to call `publish(type, properties, "remote")`. Production remote publication remains unbound to `SessionService`/UI; the backend adapter is concurrent work. These tests establish bus/plugin isolation, not completed remote routing or runtime IPC/UI acceptance. Recheck source classification and subscriber paths when that integration lands.

Only this report written. Repository/auth/adapter files untouched; no tests, builds, commits, Mac or CI operations.
