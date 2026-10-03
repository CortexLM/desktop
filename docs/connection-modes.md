# Connection modes

**Today: saved preferences, reachability probes and process-lifetime email-code sign-in.**
All three modes keep chat sessions, prompts, tools and storage on the local engine.
Cortex backend prompt routing is not wired; the local engine still calls configured providers.

`ConnectionMode` (`packages/schema/src/index.ts`) = `{ mode, url?, signedIn }`, stored by
`ConnectionService` (`packages/core/src/connection.ts`).

| Mode | Current behaviour | Probe target |
| --- | --- | --- |
| `local` (default) | No account; probe returns `not_applicable` | none |
| `cloud` | Saves the mode; email-code sign-in runs in main | `https://api.cortex.foundation` (`CLOUD_URL`) |
| `selfhost` | Saves a URL and checks it; email-code sign-in is usable on hosts supporting it | the URL the user enters (required) |

Routes: `GET /api/connection`, `PUT /api/connection`, `GET /api/connection/probe`,
`GET /api/connection/auth`, `POST /api/connection/auth`.

## Prompt routing and authentication

`packages/app/src/api.ts` always uses the local IPC bridge in Electron. Main sends every
`/api/*` request to `createServer(core)`; `session.prompt` calls `core.sessions.prompt`.
`SessionService` resolves models from the models.dev catalog and local provider settings.
It does not read `ConnectionService`. Selecting cloud or self-host therefore changes
neither the provider endpoint nor the model picker, and sends no prompts to that server.

`probeRemote` accepts an optional token, but desktop main calls it without one. Authentication
uses a separate `RemoteSession` (`packages/desktop/src/remote-session.ts`) injected into core's
`RemoteAuth` host contract. Main validates every remote auth result; IPC returns only
`{ status, signedIn, email? }`. Bearer tokens, cookie jars, pending authentication tokens,
challenge/factor IDs and enrollment secrets stay in main, never SQLite, renderer storage or events.
`signedIn` derives from the active validated main session; persisted/renderer-supplied booleans
cannot establish authentication. A pending account candidate may coexist with an active session.

Sessions last until Cortex quits. Cloud refresh, persistent account identity and authenticated
model/prompt/history transport remain pending. Main's typed actions cover email-code acquisition,
operator local login, email verification and MFA challenge verification; only the existing email
and six-digit-code screens are wired. Local password, email-verification and MFA/enrollment screens
await approved integration; the UI reports unavailable rather than guessing continuation contracts.
Operator bearer expiry is enforced when reading state. Cloud sign-out discards device-local state;
server-side revocation is not claimed. Local operator logout uses its typed endpoint.

Each auth candidate has a separate origin-pinned SDK client and in-memory cookie jar. A failed
candidate preserves the active account. Successful promotion aborts the previous client;
cancel/logout and accepted mode/origin changes invalidate pending work. Requests refuse redirects
and foreign origins and have ten-second deadlines. Main shutdown clears all session material.

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

- Local/cloud selection waits for accepted persistence. Cloud does not automatically probe;
  its sign-in button opens the live email-code flow. Starting email sign-in from local mode
  explicitly selects Cloud on submit. A saved self-host origin is retained for its login.
- Selecting self-host reveals a URL field. **Check** validates the HTTP(S) origin, saves the mode and
  URL, then probes it; a failed probe leaves the saved preference in place.
- The self-host badge displays checking / reachable / unreachable / incompatible / invalid.
  The UI does not display the returned remote models or `authRequired` value.
- Successful sign-in states and Account/Connection settings explain the process lifetime and
  continued local prompt routing. Account/Connection offer device sign-out. Refused email/code
  submissions retain input; duplicate submits are guarded; Cancel can interrupt a pending code.
- Third-party sign-in and company SSO remain unavailable. Backend continuation states use the
  existing unavailable presentation; no simulated countdown, attempt count or lockout is used live.

## Active remote integration

Remote authentication, remote model selection and Cortex inference remain an active delivery
goal. The [current SDK handoff readback](../evidence/recovery-followup/remote-integration-readback.md)
preserves the PM report's 15:05 observation and earlier readbacks. In the
**3 October 2026, 00:32 UTC snapshot**, PR #447 remained at `7633f7e2`, before the canonical
package delivery. The later owner handoff supplies SDK **0.3.1** / api-types **0.2.0** at
`ce05a6040ec05ac479d23dc2f701c8835a529663`, with successful upstream CI `37084973406`.
The [desktop admission readback](../evidence/sdk-031-admission/README.md) verifies its exact
archives, peer, schema and source pins. Precise OTP/MFA/local-login/Library contracts are
admitted; dependency intake `4fea24a` passes 44 probe checks plus one optional backend skip. Media-tail loss and feedback screenshot
corruption reproduce in exact 0.3.1. Password/signup/refresh, stable account identity, Cloud
models and history remain incomplete contracts; generated turn bodies are `never`.
These block full remote-product admission, not the bounded verified paths. Earlier SDK 0.3.0
retains its Node 22 regression HOLD. Bounded sign-in integration is separate from those probe
receipts; full authenticated inference remains unproven. Later SDK corrections are under review.
The [next-pair readback](../evidence/sdk-next-readback/README.md) confirms media/screenshot
corrections at 0.3.2 and usable generic turn bodies in the 0.3.3 candidate. The later 0.3.4
owner release is incomplete after a Node 20.9 verification process failed to exit; no
replacement is adopted from that incomplete handoff.

G3's [source-backed DTO disposition](https://github.com/CortexLM/backend/pull/447#issuecomment-5964672516)
permits narrow validation of existing Cloud model/turn fields, without claiming generated
precision. `/me` has no public stable account ID; Chat history omits reasoning/tool blocks,
caps list/window results and hardcodes `has_more:false`. Complete pagination/replay and durable
cross-login identity need G2 contracts/server work. Current auth remains process-isolated.
The append-only design request dated 3 October, “G1 remote Chat admission controls,” requests
named reuse/import authorization for effort `low|medium|high`, detach/reconnect and honest
bounded-history states. Existing local boolean reasoning and Stop controls cannot silently
stand in for remote semantics. The current Platform package is still a separately pinned draft.

Delivery order:

1. Consume G3's versioned pair with source commit, canonical schema pin, archive hashes and
   targeted runtime receipts. `vendor/` and `packages/desktop/package.json` must agree on both
   packages. G2's five typed auth/upload bodies are already delivered at `d6d46014`; SDK
    regeneration, public `Problem` reconciliation and runtime receipts remain G3-owned and
    are now supplied by the corrected 0.3.1 handoff, subject to desktop admission checks.
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
the admitted 0.3.1 pair now powers bounded process-lifetime sign-in. The existing backend turn input
has reasoning effort `low|medium|high`, no disabled value; omission defaults a new conversation
to `medium`, while ordinary follow-ups retain its stored effort.
Cancelling the stream reader does not cancel backend generation. Supported reasoning-off
and cancel-turn behavior has been requested from the contract owner, who confirmed both
are absent at backend `73b934c7`. A remote UI must distinguish detachment from cancellation;
reconnection repeats the same POST/body, Idempotency-Key and Last-Event-ID. Password/MFA
continuation designs are delivered as Platform drafts in the shared design board. The
eight-route, 94-variant receipt and later scoped corrections have separate source pins;
the complete combined candidate is delivered, while whole-page acceptance and approved
integration disposition remain pending. See the
[verified receipt](../evidence/recovery-followup/platform-receipt.json). Its simulated auth,
diagnostic and stream states establish no backend availability. None of these probes proves
the real-account acceptance or remote inference integration.
The [route contract map](../evidence/recovery-followup/platform-contract-map.md) distinguishes
local provider settings from remote operator routing and records untyped remote turn/approval
payloads. The historical draft's automatic attachment removal conflicts with desktop's retained-file
contract. The **20:01–20:07 UTC readback** records double scoped attachment filename/text-retention
confirmation on `b1b9130`, including refusal/recovery; A's collector negative and offline adjudication
remain preserved. Combined candidate `3e99a045` / `45839` reuses those runtime bytes. Source/state
import authorization remains pending. Exact pins, counts and owner-reported package checks:
[scoped design readback](../evidence/recovery-followup/scoped-design-closures.md).

The backend's `none` mode also validates browser Origin headers on mutations. Main-process
SDK requests are origin-pinned server requests without a browser Origin; a separate browser
client must use its operator-configured allowed origin. The renderer still never talks directly
to the backend or bypasses this boundary.
