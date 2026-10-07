# SDK archives

`README.md` records provenance, hashes and admission limits. The only pair is
`trunk/cortex-sdk-0.4.2.tgz` / `cortex-api-types-0.3.2.tgz` (packed from backend
`integration/backend`), selected by
`../packages/desktop/package.json`, `../packages/app/package.json` and `../bun.lock` with relative `file:../../vendor/...`
paths (never absolute checkout paths). Older pairs were removed; git history keeps them.
Do not patch archive contents or infer backend DTO completeness from generic
SDK payload types. Obtain replacements from the SDK owner, then update provenance,
manifest and lockfile together through an explicitly scoped dependency task.

Consumers live in `../packages/desktop/src/remote.ts`, `remote-session.ts` and
`remote-chat.ts`. Run `bun run test -- packages/desktop/test` from root for
consumer admission; read `../docs/connection-modes.md` for current integration.
Stub success is not real-account, inference or packaged-native acceptance.
