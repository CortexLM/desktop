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
| `tests/unit/locales.test.ts` · `tests/unit/audit-i18n.test.ts` | locale parity, Node source-stamp exclusion, audit behaviour |

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
  thinking- and image-capable catalog model through the **local fake provider**, image
  refusal for a model without image input. Checks request serialization, key redaction,
  reasoning/text deltas and persisted parts.
- `tests/e2e/ui-flows.spec.ts` — Settings key entry/masking, composer model and thinking
  selection, image attachment and streamed reply through the **same local fake**. The
  predetermined answer is not evidence that a real model understood an image.
  Both themes also cover draft/file retention after capability refusal on home and in a
  conversation, pending/failed file reads, then a rejected provider response and historical
  image-preserving retry after another prompt. That 960×640 regression
  uses the repository catalog fixture and retains screenshots as test attachments.
- `tests/e2e/screens.spec.ts` — enumerates every registered screen/variant in dark and
  light, currently **426 theme/state renders**. Checks theme selection, nonempty body,
  uncaught page errors and raw i18n keys in visible/accessibility/tooltip copy in preview;
  it does not exercise every control.
- `tests/e2e/chrome.spec.ts` — native window title/minimum bounds, English/French menus,
  macOS traffic-light position `{x:20,y:15}` through Electron APIs.
- `tests/e2e/responsive.spec.ts` — 960/1024×640 in both themes: scroll to and apply a Code
  suggestion, read split-diff line endings, use Canvas selection/version controls, operate
  Work computer controls. Also forces preview navigation before startup subscription to
  ensure fixtures gate the first render. These regressions do not certify every screen.
- `tests/e2e/navigation.spec.ts` — real anchor and native-menu navigation, distinct engine
  chat identities through back/forward, variant parameters, history branching and Gallery
  return. macOS fullscreen uses AppKit's injected command; native captures verify that entry.
  Gallery checks bound loaded frames, retain the top scroll position, unload scrolled previews
  and require the exit link to respond within five seconds.
  Capture manifests are revision-specific; a later targeted capture does not refresh the full sweep.

The engine is real in these E2Es; the inference endpoint is fake. Catalog calls use
models.dev unless `CORTEX_CATALOG_URL` overrides it. No real-provider chat, thinking or
image-inference proof is recorded by these tests.

### Real-provider verification

`scripts/verify-real-provider.mjs` uses Playwright Electron against the existing build.
Set `CORTEX_REAL_BASE_URL` and `CORTEX_REAL_API_KEY` in the environment, then run
`xvfb-run -a node scripts/verify-real-provider.mjs` on Linux. Credentials enter main only;
temporary credentials/history are removed. The loopback proxy changes only the catalog
model ID to the configured gateway's `cx/gpt-6-astra`; response bytes pass through unchanged.
The live models.dev capabilities are not altered. At most two requests, 120 seconds each.

`evidence/real-provider.json` records a successful real `/v1/responses` SSE exchange:
9 text deltas, 1 reasoning delta, persisted image/text/reasoning parts, correct blue/red
image answer, no tools. Reasoning content, key and private endpoint are omitted. This proves
the built Electron bridge and local engine path, not packaged/UI interaction acceptance.

## Packaged and visual checks

- `node scripts/smoke.mjs <mac|linux|win>` — launches the binary from `dist/` with a
  debugging port, waits for a window, checks it stays up and renders the Cortex shell,
  screenshots to `out/`. This is a packaged-launch check, not a full flow or signing check.
  Linux: `bun run pack` first; on a headless host run `xvfb-run -a node scripts/smoke.mjs linux`.
- `node scripts/compare-shots.mjs [--base http://localhost:5299/] [--shots <dir>] [--only id,id] [--merge]`
  — renders every gallery state plus five interaction shots (French locale, 1440×900 @2x):
  home mode menu and history second-row menu in both themes, file-image ask panel in light.
  Pixel-diffs against the reference go to `evidence/compare/`. Needs `bun run dev:app` and
  the reference checkout. `--merge` retains earlier report rows for routes not rerun.
  The report has no pass/fail pixel threshold; missing references remain explicit gaps.
  Capture fails if theme/content never becomes ready rather than silently comparing a blank page.
- `scripts/mac/capture.sh <routes-file> <out-dir>` — runs on a remote Mac, captures each
  route with native window chrome in light and dark. `scripts/mac/artifact-url.sh <run-id>
  <artifact>` prints a download URL for a CI artifact (needs `gh`).
- `scripts/mac/capture-connected.mjs <ssh-host> <cdp-url> <capture-url> <out-dir>` — reuses
  the installed app's CDP connection for navigation, then takes real native window pixels
  through `scripts/mac/capture-server.py`. Start that loopback-only Python helper via
  `mac-computer` so it inherits Screen Recording permission. Forward ports 9444 (CDP)
  and 9445 (capture) over SSH; acquire/release the shared Mac lease. The script asserts
  the theme/content, records renderer errors and writes `<out-dir>/manifest.json`. An optional
  final comma-separated screen list narrows a regression capture; copied evidence keeps its build hash.
  Stop the helper and close debug ports after verification.
- `scripts/dev-smoke.mjs` — quick local launch + screenshot of the built app.

The recorded `evidence/compare/report.json` contains **431 renders**: 426 registered
theme/states plus five interactions. **421** have reference shots (mean differing pixels
**0.04%**, maximum **0.78%**, pixelmatch threshold 0.15); **10** Settings renders have none
(Providers & models, Connection, Bot, Notifications, Privacy in both themes). The 13 other
reference PNGs are mascot review boards, not routed screens. These figures describe that
report, not a fresh run or acceptance of every interaction.

## CI

`.github/workflows/ci.yml`: `checks` (lint, typecheck, test, audit:i18n) on the runner
named by `vars.CORTEX_LINUX_X64_RUNNER` (CodeBuild labels get `-<run_id>-<run_attempt>`
appended; fallback `ubuntu-latest`); `e2e` on `blacksmith-4vcpu-ubuntu-2404`; `macos` on
`blacksmith-6vcpu-macos-26` (build, E2E, unsigned arm64 package, packaged smoke). No
release, publish or signing jobs exist.

The workflow describes configured checks, not the latest result. Use the PR's run and
uploaded artifacts for revision-specific evidence; there is no Windows CI job.

## Acceptance gaps

- **Real providers:** CI bridge/UI inference tests use a local fake. The separate real
  inference evidence above uses a transparent test-only model alias. The SDK probe log
  records backend model metadata, not remote-mode authentication or remote sessions.
- **Visual coverage:** the 426-render sweep is preview smoke coverage. It does not prove
  pixel fidelity, 960×640 usability, native window chrome, all interactions or all locales.
  `evidence/compare/report.json` records comparisons and missing references; inspect the
  relevant screenshots, including native Mac captures, for the revision being accepted.
- **Missing product surfaces:** Space, standalone Scheduled and Plugins & skills still
  await designs in `/root/cortex-ui/DESIGN-REQUESTS.md`. Their absence from the registry
  means a complete registered-screen sweep cannot establish their acceptance.
- **Connection/auth:** mode selection and probes work at the code-path level; sessions
  still run locally. Remote auth and remote inference remain unimplemented
  ([connection-modes.md](./connection-modes.md)).
- **Locales:** all eight catalog/fixture sets exist. Key/placeholder parity does not prove
  translation quality or complete localized layout coverage ([i18n.md](./i18n.md)).
