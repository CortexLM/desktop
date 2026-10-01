# Vendored packages

`@cortex/sdk` and `@cortex/api-types` are published by the Cortex SDK workstream (CortexLM/backend, `packages/sdk`, `npm run pack:vendor`).
They are vendored because this repository's CI cannot see the backend checkout.

Bun cannot resolve the SDK tarball's own `file:./cortex-api-types-*.tgz` dependency, so after each re-vendor the SDK tarball is
repacked with that dependency removed; `packages/desktop/package.json` depends on both tarballs directly. Used only from Electron main
(`packages/desktop/src/remote.ts`) in the Cortex Cloud and self-hosted connection modes.
