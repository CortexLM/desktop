# Route contract

`src/index.ts` defines `routes`, validators, `Handlers`, error mapping and SSE
framing. Keep behavior injected through handlers, not imported from core.
For route changes, inspect `../schema/src/index.ts`, `../server/src/index.ts`
and `../client/src/index.ts` together, including status and query semantics.

Run `bun run test -- packages/protocol/test` from root. Invalid input must fail
before its handler executes; preserve the public `{ error: { code, message } }` shape.
