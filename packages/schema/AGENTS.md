# Shared contracts

`src/index.ts` is the shared zod contract authority. Keep its `jitless` setup
before schema initialization so renderer CSP does not require dynamic evaluation.
Check core, protocol, server and client consumers together when changing inputs,
events or public shapes; remote projection types are not backend SDK wire types.

Run `bun run test -- packages/schema/test` and `bun run typecheck` from root.
