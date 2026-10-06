# Browser-safe client

`src/index.ts` supplies the typed fetch facade and `parseSSE`.
Preserve injected fetch support for browser, IPC and in-process server callers.
Keep endpoint paths, statuses and payload types aligned with
`../protocol/src/index.ts` and `../schema/src/index.ts`.
SSE changes must preserve chunk decoding, frame validation and cancellation;
subscription reconnect policy belongs to the caller.

Run `bun run test -- packages/client/test` from root; cover fragmented frames
and refused responses rather than relying on an external server.
