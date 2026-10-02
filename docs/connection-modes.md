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

## Active remote integration

Remote authentication, remote model selection and Cortex inference remain an active delivery
goal. The [current SDK handoff readback](../evidence/recovery-followup/remote-integration-readback.md)
preserves the PM report's 15:05 observation and earlier 18:23–18:24 readback. In the
**2 October 2026, 19:10–19:15 UTC snapshot**, PR #447 remains at `7633f7e2`; G3's canonical
versioned pair and owner checks remain undelivered. Desktop's unchanged 0.2.0/0.1.0 pair remains
probe-only; local generated edits are not a package release.

Delivery order:

1. Consume G3's versioned pair with source commit, canonical schema pin, archive hashes and
   targeted runtime receipts. `vendor/` and `packages/desktop/package.json` must agree on both
   packages. G2's five typed auth/upload bodies are already delivered at `d6d46014`; SDK
   regeneration, public `Problem` reconciliation and runtime fixes remain G3-owned.
2. Implement session acquisition and continuations in Electron main. Keep bearer/cookie/pending
   state origin/account-bound; replace the authenticated client on identity changes rather than
   repointing it. Expose validated, sanitized state through schema/protocol/client contracts;
   renderer metadata cannot establish authentication. Local bearer expiry and Cloud refresh
   remain distinct. Integrate approved continuation states with the existing login/Connection UI.
3. Route model discovery, upload, prompts and transcripts through that selected remote session.
   Preserve unknown capabilities and genuinely empty registries. Local `SessionService.prompt`
   currently resolves providers independently of connection mode; the remote path needs explicit
   conversation identity, remote effort and admission semantics rather than changing a base URL.
   Retain drafts/files on refusal. Raw-byte uploads and reconnect use the owner-verified contracts.
4. Prove authentication plus streamed image/reasoning on the actual Cortex remote path, including
   account/origin changes, refusal, expired auth and reconnect without a duplicate turn. Local
   provider inference and discovery probes are separate evidence. Then package the changed
   revision and capture its modified surfaces natively; retain the earlier Mac baselines.

Run checks for the new dependency/application delta when it lands. Existing passing suites and
native captures are not rerun for this documentary handoff update.

### Contract boundaries

The current backend supports guest Chat, email OTP and self-host `none`/operator auth.
Desktop transport must isolate token/cookie state by origin and account. SDK regeneration
against canonical schema `d6d46014d1c436b96540529dca2a3005556ae920` remains owned by the
SDK session. That backend pin supplies typed OTP/MFA/email continuations and raw-byte uploads;
it does not update the vendored SDK or implement desktop authentication. The existing backend turn input
has reasoning effort `low|medium|high`, no disabled value; omission defaults a new conversation
to `medium`, while ordinary follow-ups retain its stored effort.
Cancelling the stream reader does not cancel backend generation. Supported reasoning-off
and cancel-turn behavior has been requested from the contract owner, who confirmed both
are absent at backend `73b934c7`. A remote UI must distinguish detachment from cancellation;
reconnection repeats the same POST/body, Idempotency-Key and Last-Event-ID. Password/MFA
continuation designs are delivered as Platform drafts in the shared design board. The
eight-route, 94-variant receipt and later scoped corrections have separate source pins;
whole-page acceptance and immutable integration delivery remain pending. See the
[verified receipt](../evidence/recovery-followup/platform-receipt.json). Its simulated auth,
diagnostic and stream states establish no backend availability. None of these probes proves
the pending authentication or remote inference integration.
The [route contract map](../evidence/recovery-followup/platform-contract-map.md) distinguishes
local provider settings from remote operator routing and records untyped remote turn/approval
payloads. The historical draft's automatic attachment removal conflicts with desktop's retained-file
contract. At the **19:15 UTC snapshot**, candidate `b1b9130` has owner-confirmed retention/refusal
behavior; independent approval and final integration disposition remain missing. Exact pin and
receipt: [scoped design readback](../evidence/recovery-followup/scoped-design-closures.md).

The backend's `none` mode also validates browser Origin headers on mutations. Main-process
SDK requests are origin-pinned server requests without a browser Origin; a separate browser
client must use its operator-configured allowed origin. The renderer still never talks directly
to the backend or bypasses this boundary.
