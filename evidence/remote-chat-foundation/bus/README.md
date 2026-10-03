# Remote event bus privacy prerequisite

Implemented and source-verified. Only these repository files changed by this task:

- `packages/core/src/bus.ts`: internal `Source = "local" | "remote"`; third `publish` argument defaults to `"local"`. Only local durable events reach `Storage.append`. Both `subscribe` and typed `on` listeners receive source separately from the unchanged event object. Existing one-argument listeners remain compatible. Cloning, persist-before-delivery, unsubscribe and fault isolation remain intact.
- `packages/core/src/index.ts:81`: the existing plugin event subscription dispatches only local events, including local deltas.
- New `packages/core/test/bus.test.ts`: two regression tests using real in-memory SQLite, `createCore`, a registered plugin event hook, and standalone `Bus`/`Storage`.

Exact full diff: [`changes.patch.gz`](./changes.patch.gz), retained losslessly. Source hashes: [`baseline-provenance.json`](./baseline-provenance.json), [`fixed-provenance.json`](./fixed-provenance.json). Base HEAD: `78857365a509d78af10ebdda5b52348a2e50e961`.

## Evidence

The privacy test publishes seven schema-parsed remote events: `session.created`, `session.updated`, `message.updated`, `part.updated`, `part.delta`, `session.status`, `session.deleted`.

- Ordinary one-argument listener receives all seven exact events. JSON serialization matches the original safe events; source is absent from the payload. Source-aware subscription receives seven `remote` values; typed delta listener receives `remote`.
- SQLite counts are read inside every live callback, preventing deletion from concealing temporary projection writes. `event/session/message/part` counts remain `[0,0,0,0]` throughout. Remote journal remains empty.
- Registered local plugin receives zero remote events, including `part.delta`.
- Then real local session create/read/update/delete plus message/part publication produce seven normal live/plugin deliveries. Default-local calls and explicit-local delta are covered. Callback-time counts are exactly `[1,1,0,0]`, `[2,1,0,0]`, `[3,1,1,0]`, `[4,1,1,1]`, `[4,1,1,1]`, `[4,1,1,1]`, `[5,0,0,0]`; local projections and five exact journal entries are checked.
- Separate regression verifies thrown subscriber errors cannot prevent later delivery or persistence. Publisher mutations to nested title/model/time after publication cannot alter delivered or stored snapshots. Unsubscribe is exercised.

### Negative baseline

Executed before modifying either production file; their scoped diff was empty. Vitest transpilation lets the unchanged runtime ignore the new third argument without requiring old TypeScript signatures to accept it.

Result: **1 expected failing privacy test, 1 passing compatibility test**. The old implementation wrote five remote journal entries, populated all three projections before deletion, delivered all seven remote events to the plugin, and omitted listener source. Soft assertions retained all these failures while allowing the local CRUD checks to complete.

Retained: [`baseline.json`](./baseline.json), [`baseline.log`](./baseline.log). No production rollback or negative-only source edits. Test SHA-256 is identical for negative and passing runs.

### Passing checks

Node executable: `/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node` (`v22.23.3`). Commands run from the repository root:

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/vitest/vitest.mjs run packages/core/test/bus.test.ts --reporter=verbose --reporter=json --outputFile=/tmp/opencode/remote-bus-prerequisite/fixed.json > /tmp/opencode/remote-bus-prerequisite/fixed.log 2>&1
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/eslint/bin/eslint.js packages/core/src/bus.ts packages/core/src/index.ts packages/core/test/bus.test.ts > /tmp/opencode/remote-bus-prerequisite/lint.log 2>&1
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/typescript/bin/tsc -p /tmp/opencode/remote-bus-prerequisite/tsconfig.json --pretty false > /tmp/opencode/remote-bus-prerequisite/types.log 2>&1
git diff --check -- packages/core/src/bus.ts packages/core/src/index.ts packages/core/test/bus.test.ts
```

All exit 0. Vitest: **2/2 passed**; lint/types: empty diagnostics. Type scope includes core source/tests and imported dependencies, excluding desktop work in progress. The negative command was the same Vitest invocation with `baseline.json`/`baseline.log`; exit 1. SQLite's normal Node experimental warning appears in both test logs.

## Integration handoff

Caller API is `bus.publish(type, properties, "remote")`; listeners may inspect `(event, source)`. Production remote dispatch is still the adapter owner's responsibility. This change establishes the bus/plugin prerequisite only; it does not establish remote Chat, IPC, installed-app or UI acceptance.

Coordinator owns documentation. In particular, `evidence/remote-auth-followup/routing-contract/README.md:76` currently sketches `{source:'remote'}`; document the implemented string argument instead. No temporary behavioral simplification was introduced, so no `ponytail:` ceiling comment is needed.

No delegation, schema/service/wire/UI/dependency edits, builds, Mac/CI operations or commits performed.

Coordinator follow-up: [independent source review](source-review.md) finds no cross-channel
bypass in this scope. The combined core/server/client suite passes **78 tests in 11 files**;
[integration log](integration.log) and lossless original retained. No remote prompt route,
session projection or UI is introduced by this prerequisite.
