# In-process server adapter

`src/index.ts` binds protocol handlers to core and streams the live bus.
Desktop calls `createServer(core).fetch`; `listen` is only a dev/test adapter.
Keep SSE subscription, heartbeat and abort/cancel cleanup paired.
Read `../protocol/src/index.ts` when changing status/body semantics and inspect
`../core/src/index.ts` for service lifetime and injected host capabilities.

Run `bun run test -- packages/server/test` from root. Adapter tests should
exercise `app.fetch` with the real in-memory core, including refused mutations.
