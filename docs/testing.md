# Testing

## Suites

| Command | Scope | Notes |
| --- | --- | --- |
| `bun run test` | Vitest (`vitest.config.ts`): `packages/*/test/**/*.test.ts`, `tests/unit/**/*.test.ts`, `packages/app/src/**/*.test.{ts,tsx}` | Node environment, 20 s timeout. Prefix `NODE_ENV=test` if the host exports `production` |
| `bun run test:e2e` | Playwright (`playwright.config.ts`), `tests/e2e` | Launches `packages/desktop/dist/main.cjs` via `_electron`; **run `bun run build` first**. Workers: `E2E_WORKERS` (default 4). Reports: `playwright-report/`, `test-results/` |
| `bun run audit:i18n` | `scripts/audit-i18n.mjs` | See [i18n.md](./i18n.md) |
| `bun run lint` | `eslint packages scripts tests` | |
| `bun run typecheck` | `tsc -p tsconfig.json` | Includes tests and scripts |

Linux headless E2E: `xvfb-run -a -s "-screen 0 1920x1080x24" bun run test:e2e` (as CI).

## Unit tests

| File | Covers |
| --- | --- |
| `packages/schema/test/schema.test.ts` | contracts |
| `packages/core/test/{catalog,capabilities,session,services,computer-use}.test.ts` | catalog cache/offline, capability gates, session loop, services, computer use |
| `packages/protocol/test/protocol.test.ts` · `packages/server/test/server.test.ts` · `packages/client/test/client.test.ts` | routes, binding, client + SSE |
| `packages/desktop/test/remote.test.ts` | SDK probe; real backend only with `CORTEX_TEST_BACKEND_URL` |
| `tests/unit/locales.test.ts` · `tests/unit/audit-i18n.test.ts` | locale parity, audit behaviour |

Engine tests use `createCore({ dataDir: ":memory:", credentials: memoryCredentials() })`
and the catalog fixture `packages/core/test/fixtures/catalog.json`.

## E2E

- `tests/e2e/fixtures.ts` — `launch()` gives each app a fresh temp `CORTEX_DATA_DIR`, sets
  `CORTEX_START_HASH` and `CORTEX_LOCALE`.
- `tests/e2e/fake-provider.ts` — local OpenAI-compatible streaming endpoint (reasoning then
  text deltas) that records requests.
- `CORTEX_TEST_PROVIDER_BASEURL=<providerID>=<url>` points one provider at it; main ignores
  it when packaged. `CORTEX_TEST_PICK_DIRECTORY` stubs the folder dialog.
- `tests/e2e/engine.spec.ts` — catalog through the bridge, a streamed exchange with a
  thinking- and image-capable model, image refusal for a model without image input.

## Packaged and visual checks

- `node scripts/smoke.mjs <mac|linux|win>` — launches the binary from `dist/` with a
  debugging port, waits for a window, checks the process stays up, screenshots to `out/`.
  Linux: `bun run pack` first.
- `node scripts/compare-shots.mjs [--base http://localhost:5299/] [--shots <dir>] [--only id,id]`
  — renders every gallery state (French locale, 1440×900 @2x) and pixel-diffs it against
  the design reference shots; output in `evidence/compare/`. Needs `bun run dev:app` and a
  local checkout of the design reference.
- `scripts/mac/capture.sh <routes-file> <out-dir>` — runs on a remote Mac, captures each
  route with native window chrome in light and dark. `scripts/mac/artifact-url.sh <run-id>
  <artifact>` prints a download URL for a CI artifact (needs `gh`).
- `scripts/dev-smoke.mjs` — quick local launch + screenshot of the built app.

## CI

`.github/workflows/ci.yml`: `checks` (lint, typecheck, test, audit:i18n) on the runner
named by `vars.CORTEX_LINUX_X64_RUNNER` (CodeBuild labels get `-<run_id>-<run_attempt>`
appended; fallback `ubuntu-latest`); `e2e` on `blacksmith-4vcpu-ubuntu-2404`; `macos` on
`blacksmith-6vcpu-macos-26` (build, E2E, unsigned arm64 package, packaged smoke). No
release, publish or signing jobs exist.

## Known red

`tests/unit/locales.test.ts` fails until catalogs exist for `es de ja zh-Hans pt-BR ko`
and `fr` is complete ([i18n.md](./i18n.md)).
