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
`signedIn` is always false until authentication is implemented, including when a caller
submits true or old stored metadata contains true. The renderer cannot assert authentication.

## Probe

`probe()` returns `not_applicable` for local. For cloud and self-host, desktop main supplies
`probeRemote` (`packages/desktop/src/remote.ts`), which uses the vendored `@cortex/sdk`:

1. `GET {url}/readyz` — not 2xx or unreachable → `unreachable`.
2. `client.instance.list()` — validate instance/auth/registry metadata. Only HTTP 404 permits
   legacy discovery; malformed replies and other errors do not silently fall back.
3. Cloud/legacy: `client.models.list()`, using `slug` and `display_name`. Self-host:
   `client.registry.models.list({query:{configured:true,limit:500,cursor?}})`, consuming every
   page even when registry enrichment is disabled. Missing registry never falls back to
   Cloud's seeded catalog. Model discovery 401/403 → `reachable`, `authRequired: true`.

The entire probe has a five-second deadline, including model response bodies and pagination.
Backend URLs are HTTP(S) origins; credentials, paths, queries and fragments are rejected
before storage/transport. Every probe request pins that origin, refuses redirects and disables
cookie storage. `reachable` means the probe responded, even if model listing requires auth;
it does not establish a usable chat session
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
- Selecting self-host reveals a URL field. **Check** validates the HTTP(S) origin, saves the mode and
  URL, then probes it; a failed probe leaves the saved preference in place.
- The self-host badge displays checking / reachable / unreachable / incompatible / invalid.
  The UI does not display the returned remote models or `authRequired` value.

## Remote integration inputs still needed

The current backend supports guest Chat, email OTP and self-host `none`/operator auth.
Desktop transport must isolate token/cookie state by origin and account. SDK regeneration
and OTP/upload typing remain owned by the SDK session. The existing backend turn input
has reasoning effort `low|medium|high`, no disabled value; omission means `medium`.
Cancelling the stream reader does not cancel backend generation. Supported reasoning-off
and cancel-turn behavior has been requested from the contract owner, who confirmed both
are absent at backend `73b934c7`. A remote UI must distinguish detachment from cancellation;
reconnection repeats the same POST/body, Idempotency-Key and Last-Event-ID. Password/MFA
continuation designs are requested in the shared design board. None of these probes proves
the pending authentication or remote inference integration.

The backend's `none` mode also validates browser Origin headers on mutations. Main-process
SDK requests are origin-pinned server requests without a browser Origin; a separate browser
client must use its operator-configured allowed origin. The renderer still never talks directly
to the backend or bypasses this boundary.
