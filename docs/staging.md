# Staging

`staging` is the long-lived integration branch for Chat | Code | Bot (Apache-2.0,
web + Electron). It tracks the backend staging contract (CortexLM/backend
`staging` / PR 36): **WS `/v1/realtime` first**, then **SSE
`/v1/realtime/events`**, then **HTTP conversation turns**. A live 404 stays
`not_found`.

Point the web client at the farm later with:

```bash
VITE_CORTEX_API_BASE_URL=https://<staging-api-host>
```

Leave it unset on localhost so unit tests never open a guest session. Electron
still uses `CORTEX_API_BASE_URL` in main (file:// cannot call the API).

Production is a separate GitHub Environment. This repo stays private.

## Mock audit

These are every ProductSurface and host-shaped double. Production code uses the
HTTP client from `liveSession()` / `VITE_CORTEX_API_BASE_URL`. Doubles exist
only behind `CORTEX_ALLOW_TEST_DOUBLES=1` (set in Vitest configs).

| Name | Kind | Where | Production? |
| --- | --- | --- | --- |
| `createHttpProductSurface` | live HTTP | `packages/cortex-api/src/pending.ts` | Yes — mascots, Code hosts/sessions, Planning, Library, Plugins, notifications |
| `createMockProductSurface` | test double | `packages/cortex-api/src/test-doubles.ts` | No. Throws without the flag. Not exported from `@cortex-ide/cortex-api`. |
| `createRealtimeSocket` | live WS | `realtime/socket.ts` | Yes — `GET /v1/realtime` |
| `createRealtimeSse` | live SSE | `realtime/sse-fallback.ts` | Yes — listen-only `GET /v1/realtime/events` |
| `createMockRealtime` | test double | `test-doubles.ts` | No. Same flag. |
| `createCloudChatHost` | live host | `packages/app/src/state/cloud-chat-host.ts` | Yes when `liveApiBase()` is set |
| `createCloudSessionHost` | live host | `cloud-session-host.ts` | Yes; **rejects `runtime: 'local'`** |
| `detachedHost` / `detachedSessionHost` / `detached()` chat | honest empty | `host.ts`, `session-host.ts`, `chat-host.ts` | Yes on localhost / Vitest — empty or reject, never a fake farm |
| `detachedSettingsHost` / `detachedSecretsHost` / `detachedAutomationHost` | honest empty | matching `*-host.ts` | Same |
| `@cortex-ide/test-utils` IPC/FS/AI mocks | test harness | `packages/test-utils` | No — benches and integration suites only |

Local `localStorage` stores (Planning seed, library, inbox) are UI caches.
Bot mascots, messages, computer lifecycle, videos, and plugin connections
are API-backed. The mascot list cache must reconcile on open. A 404 on a
Cortex Bot runtime route is “backend too old”, not a local stand-in. A 503 on
plugins is “Composio is not configured”. See [bot-runtime.md](./bot-runtime.md).

## Product locks

- Pairing: `POST /v1/code/hosts/pair` returns a code shown once
  (`consumePairingCode`). `pairing_hash` is dropped at parse time.
- VNC: `{ ticket_hash }` only. Passwords in the payload are dropped.
- Web Code never starts a local harness.

## Auto-deploy

Push to `staging` runs `.github/workflows/staging.yml`: build web + Electron
artifacts, upload them, GitHub Environment `staging`, OIDC (`id-token: write`).
PRs into `staging` run `.github/workflows/test-suite.yml` (same unit / IPC /
e2e jobs as `main`). Deploy is gated on `vars.STAGING_DEPLOY_ENABLED` and is
off while the staging AWS account is CLOSED. No AWS keys in git.

## Linux Bot box

```bash
bun run test:staging-local
# or
bash scripts/test-staging-local.sh
```

No secrets. See the script header for which e2e suites need `xvfb`.
