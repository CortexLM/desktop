# Connection modes

`ConnectionMode` (`packages/schema/src/index.ts`) = `{ mode, url?, signedIn }`, stored by
`ConnectionService` (`packages/core/src/connection.ts`).

| Mode | Meaning | Backend |
| --- | --- | --- |
| `local` (default) | On this device, no account | none — the local engine and the user's own provider keys |
| `cloud` | Cortex Cloud, sign-in optional | `https://api.cortex.foundation` (`CLOUD_URL`) |
| `selfhost` | A self-hosted Cortex server | the URL the user enters (required) |

Routes: `GET /api/connection`, `PUT /api/connection`, `GET /api/connection/probe`.

## Probe

`probe()` returns `not_applicable` for local. For cloud and self-host, desktop main supplies
`probeRemote` (`packages/desktop/src/remote.ts`), which uses the vendored `@cortex/sdk`:

1. `GET {url}/readyz` — not 2xx or unreachable → `unreachable`.
2. `GET {url}/v1/instance` — optional; `auth.required === false` means sign-in is optional.
   Missing route → sign-in stays required.
3. `client.models.list()` — models → `reachable` with `models`; 401/403 → `reachable`,
   `authRequired: true`; anything else → `incompatible`.

Without a host probe (tests, `scripts/dev-api.ts`), core only checks `GET {url}/readyz`.
`packages/desktop/test/remote.test.ts` covers the probe against a local stub, and against a
real backend when `CORTEX_TEST_BACKEND_URL` is set.

## In the app

Settings → **Connection** (`#/settings?section=connection`): three radio rows, a URL field
for self-host with checking / reachable / unreachable / incompatible / invalid states, and
a sign-in button for cloud.

## Not built yet

- Cortex Cloud sign-in: no engine route; the live login submit says it is unavailable.
  `signedIn` is therefore always false in practice.
- Remote models are reported by the probe but sessions still run on the local engine with
  local provider keys.
