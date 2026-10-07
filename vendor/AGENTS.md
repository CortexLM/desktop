# SDK archives

`README.md` records provenance, hashes and admission limits. The active pair is
`task16-refactor/cortex-sdk-0.4.3.tgz` / `cortex-api-types-0.3.2.tgz`, selected by
`../packages/desktop/package.json`, `../packages/app/package.json` and `../bun.lock` with relative `file:../../vendor/...`
paths (never absolute checkout paths); older archives are retained evidence.
Do not patch archive contents or infer backend DTO completeness from generic
SDK payload types. Obtain replacements from the SDK owner, then update provenance,
manifest and lockfile together through an explicitly scoped dependency task.

Consumers live in `../packages/desktop/src/remote.ts`, `remote-session.ts` and
`remote-chat.ts`. Run `bun run test -- packages/desktop/test` from root for
consumer admission; read `../docs/connection-modes.md` for current integration.
Stub success is not real-account, inference or packaged-native acceptance.
