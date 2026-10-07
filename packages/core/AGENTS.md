# Local engine

Start with `README.md` and `../../docs/engine.md`; `src/index.ts` wires services.
`src/storage.ts` and `src/bus.ts` define persistence versus live-only delivery.
Preserve commit-before-notification ordering and admission/abort/deletion ownership
when changing `src/session.ts`, `src/project.ts` or `src/scheduler.ts`.
`src/remote-sessions.ts` projects an injected main host. Verified `/me.id` accounts
persist snapshots in `doc`, partitioned by origin/account; ephemeral hosts remain
process-only. Keep remote bus events out of the event journal and local plugin hooks.
Read `../../docs/connection-modes.md` for restart recovery and discovery limits.

Tests belong in `test/`; run `bun run test -- packages/core/test` from repository
root. Use injected fetch and `test/fixtures/catalog.json`, not live providers.
