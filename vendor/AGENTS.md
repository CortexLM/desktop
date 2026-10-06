# SDK archives

`README.md` records provenance, hashes and admission limits. The active pair is
`cortex-sdk-0.3.5.tgz` / `cortex-api-types-0.2.0.tgz`, selected by
`../packages/desktop/package.json`; older archives are retained evidence.
Do not patch archive contents or infer backend DTO completeness from generic
SDK payload types. Obtain replacements from the SDK owner, then update provenance,
manifest and lockfile together through an explicitly scoped dependency task.

Consumers live in `../packages/desktop/src/remote.ts`, `remote-session.ts` and
`remote-chat.ts`. Run `bun run test -- packages/desktop/test` from root for
consumer admission; read `../docs/connection-modes.md` for current integration.
Stub success is not real-account, inference or packaged-native acceptance.
