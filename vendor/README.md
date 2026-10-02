# Vendored packages

`@cortex/sdk` 0.2.0 and `@cortex/api-types` 0.1.0 are vendored unmodified from the
Cortex SDK workstream (`CortexLM/backend`, `packages/sdk`) because this repository's CI
cannot see that checkout.

The SDK declares `@cortex/api-types` `^0.1.0` as an optional peer;
`packages/desktop/package.json` depends on both tarballs directly. Re-vendor with
`npm run pack:vendor -- <out>` in the backend's `packages/sdk`.

Only Electron main imports the SDK. `probeRemote` in `packages/desktop/src/remote.ts`
checks readiness/instance metadata, then calls `client.models.list()` for cloud or
self-hosted probes. Main supplies no auth token. The SDK does not route desktop prompts
or authenticate users; see [connection-modes.md](../docs/connection-modes.md).

`packages/desktop/test/remote.test.ts` exercises the SDK against a local stub. Its optional
real-backend case (`CORTEX_TEST_BACKEND_URL`) asserts reachability; the recorded
[`evidence/sdk-real-backend.log`](../evidence/sdk-real-backend.log) contains returned model
metadata, not a generated response or authenticated-session proof.
