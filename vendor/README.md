# Vendored packages

`@cortex/sdk` and `@cortex/api-types` are published by the Cortex SDK workstream (CortexLM/backend, `packages/sdk`, `npm run pack:vendor`).
They are vendored because this repository's CI cannot see the backend checkout.

Since 0.2.0 the SDK declares `@cortex/api-types` as an optional peer, so both tarballs are vendored unmodified and
`packages/desktop/package.json` depends on both directly. Re-vendor with `npm run pack:vendor -- <out>` in the backend's `packages/sdk`. Used only from Electron main
(`packages/desktop/src/remote.ts`) in the Cortex Cloud and self-hosted connection modes.
