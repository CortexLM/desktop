# 08 — Testing

## 8.1 The commands

| Layer | Command | Proves |
| --- | --- | --- |
| Unit | `bun run test` (Vitest; `packages/*/test`, `tests/unit`, `packages/app/src/**/*.test.{ts,tsx}`) | Engine services, protocol, server, client, remote probe, locale parity, i18n audit |
| E2E | `bun run build && bun run test:e2e` (Playwright `_electron`, `tests/e2e`) | The built Electron app: IPC bridge, catalog, streaming, capability refusals |
| i18n | `bun run audit:i18n` | No literal copy in `packages/app/src` / `packages/desktop/src`; every `t()` key exists in English |
| Types | `bun run typecheck` | `strict` holds across packages, tests, scripts |
| Lint | `bun run lint` | `eslint packages scripts tests` |
| Packaged launch | `bun run pack && node scripts/smoke.mjs linux` (or `mac`) | The packaged binary opens a window and stays up |
| Design comparison | `node scripts/compare-shots.mjs --shots <freeze>/shots --out <new-directory>` (needs renderer server) | Gallery states vs a hash-verified frozen reference; explicit output preserves historical evidence |

Details, fixtures and hooks: [`docs/testing.md`](../docs/testing.md). If the host exports
`NODE_ENV=production`, prefix test runs with `NODE_ENV=test`.

## 8.2 New behaviour gets a test

The PR that adds behaviour adds the test. A bug fix gets a test that fails before the fix;
if you cannot write one, say why in the PR. Engine tests use
`createCore({ dataDir: ":memory:", credentials: memoryCredentials() })`.

## 8.3 Test the honest states

Empty, loading, error, no-provider and unavailable are states users hit. A screen change
covers them — in preview via `variants`, and in live mode by an E2E or a unit test when
the state depends on the engine.

**Bad** — only the happy path:

```ts
test("chat streams", …)
```

**Good** — `tests/e2e/engine.spec.ts` also asserts the refusal:

```ts
test("an image is refused for a model without image input", …)
```

## 8.4 Test what the user experiences

Drive the real app through the bridge or the UI. Do not stub the engine in an E2E. Network
providers are replaced by the local fake in `tests/e2e/fake-provider.ts`, wired with
`CORTEX_TEST_PROVIDER_BASEURL` (ignored when packaged).

## 8.5 Tests must not lie

- Do not weaken or delete an assertion to get green.
- Do not skip a test without a condition and a reason (`it.skipIf(!process.env.CORTEX_TEST_BACKEND_URL)` is the pattern).
- Do not hit the real models.dev or a real provider from unit tests; use
  `packages/core/test/fixtures/catalog.json` and an injected `fetch`.
- Each E2E launch gets a fresh `CORTEX_DATA_DIR` (`tests/e2e/fixtures.ts`).
