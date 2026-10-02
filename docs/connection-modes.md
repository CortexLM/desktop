# Connection modes

**Today: saved preferences and reachability probes.** All three modes keep sessions,
prompts, tools and storage on the local engine. Cortex backend prompt routing and sign-in
are not wired; the local engine still calls configured model providers.

`ConnectionMode` (`packages/schema/src/index.ts`) = `{ mode, url?, signedIn }`, stored by
`ConnectionService` (`packages/core/src/connection.ts`).

| Mode | Current behaviour | Probe target |
| --- | --- | --- |
| `local` (default) | No account; probe returns `not_applicable` | none |
| `cloud` | Saves the mode; exposes the unavailable sign-in screen | `https://api.cortex.foundation` (`CLOUD_URL`) |
| `selfhost` | Saves a URL and checks it | the URL the user enters (required) |

Routes: `GET /api/connection`, `PUT /api/connection`, `GET /api/connection/probe`.

## Prompt routing and authentication

`packages/app/src/api.ts` always uses the local IPC bridge in Electron. Main sends every
`/api/*` request to `createServer(core)`; `session.prompt` calls `core.sessions.prompt`.
`SessionService` resolves models from the models.dev catalog and local provider settings.
It does not read `ConnectionService`. Selecting cloud or self-host therefore changes
neither the provider endpoint nor the model picker, and sends no prompts to that server.

`probeRemote` accepts an optional token, but desktop main calls it without one. There is
no sign-in route, token acquisition, refresh or authenticated remote session transport.
`signedIn` defaults to false and normal UI flows never authenticate. The connection PUT
accepts this boolean as stored metadata; setting it to true is not proof of authentication.

## Probe

`probe()` returns `not_applicable` for local. For cloud and self-host, desktop main supplies
`probeRemote` (`packages/desktop/src/remote.ts`), which uses the vendored `@cortex/sdk`:

1. `GET {url}/readyz` — not 2xx or unreachable → `unreachable`.
2. `GET {url}/v1/instance` — optional; `auth.required === false` reports optional auth.
   Missing route → sign-in stays required.
3. `client.models.list()` — models → `reachable` with `models`; 401/403 → `reachable`,
   `authRequired: true`; anything else → `incompatible`.

The readiness and instance requests use five-second timeouts. `reachable` means the probe
responded, even if model listing requires auth; it does not establish a usable chat session
or check a backend version range. The returned models are probe metadata only.

Without a host probe (tests, `scripts/dev-api.ts`), core only checks `GET {url}/readyz`:
2xx is `reachable`, non-2xx is `incompatible`, network failure is `unreachable`.
`packages/desktop/test/remote.test.ts` uses a local stub by default. The optional
`CORTEX_TEST_BACKEND_URL` case asserts `reachable`; the recorded
[`evidence/sdk-real-backend.log`](../evidence/sdk-real-backend.log) shows returned model
metadata. Neither proves authentication or real-provider inference.

## In the app

Settings → **Connection** (`#/settings?section=connection`, in `settings.tsx`):

- Local/cloud selection saves immediately. Cloud does not automatically run the probe;
  its sign-in button opens `LoginScreen`, whose live submit reports unavailable.
- Selecting self-host reveals a URL field. **Check** validates HTTP(S), saves the mode and
  URL, then probes it; a failed probe leaves the saved preference in place.
- The self-host badge displays checking / reachable / unreachable / incompatible / invalid.
  The UI does not display the returned remote models or `authRequired` value.
