# Cortex API contract

`https://api.cortex.foundation`, reported version `1.1.0`.

There is no published OpenAPI document, so this contract was established by probing the
live service. Everything below was observed directly; the "unverified" section records what
could not be reached without credentials, so nobody mistakes a guess for a fact.

## Authentication

The service accepts **a WorkOS sealed session cookie or an API key**. Bearer JWT is
explicitly turned off — sending `Authorization: Bearer <token>` returns:

```json
{ "code": "INVALID_SESSION", "message": "Bearer JWT session auth is disabled; use WorkOS sealed session cookie or API key" }
```

That is why `CortexApiClient` has no bearer-token mode. An API key goes in `x-api-key`.

### The sealed session cookie is named `wos-session`

Probed rather than assumed, by comparing the *failure* modes on `GET /auth/me`:

| Sent | Response |
| --- | --- |
| nothing | `401 {"code":"AUTH_REQUIRED"}` |
| `Cookie: foo=x` | `401 {"code":"AUTH_REQUIRED"}` |
| `Cookie: workos-session=x` | `401 {"code":"AUTH_REQUIRED"}` |
| `Cookie: wos-session=x` | `401 {"code":"INVALID_SESSION","message":"invalid_session_cookie"}` |
| `x-api-key: x` | `401 {"code":"INVALID_API_KEY","message":"Invalid API key"}` |

Only `wos-session` gets far enough to fail on its *contents*; every other name falls through
to "no credential presented at all". A name that is not read cannot produce an unseal error,
so this identifies the cookie.

This is what `CortexCredentials.accessToken` relies on: the device flow yields an
`access_token`, bearer is refused, and it is a session rather than an API key — so it travels
as `Cookie: wos-session=<token>`.

**Still unverified:** no device flow has been carried through to a real token (that needs a
human to approve in a browser), so the *last* step — that the `access_token` unseals as a
`wos-session` value — is inference from the three facts above, not an observation.

`OPTIONS` on any `/v1` route reports the accepted request headers:

```
authorization, content-type, accept, cookie, x-api-key, x-request-id, x-organization-id
```

### Browser redirect flow

| Method | Path | Observed |
| --- | --- | --- |
| GET | `/auth/login` | `307` to `https://api.workos.com/user_management/authorize?client_id=client_01KYRW8CKK6T3CZ0QWJHNNGRP5&provider=authkit&redirect_uri=https%3A%2F%2Fapi.cortex.foundation%2Fauth%2Fcallback&response_type=code` |
| GET | `/auth/callback` | `400 {"error":"Missing authorization code","code":"missing_code"}` without `?code=` |

The WorkOS client id is baked into the redirect, so the desktop app does not need to know
it. `provider=authkit` is what produces the GitHub / Google / email options the Auth Sign In
screen draws.

### Device flow (RFC 8628)

This is the path the desktop app uses, and what the Auth Device Code screen shows.

| Method | Path | Observed |
| --- | --- | --- |
| POST | `/auth/device/code` | `200 {"user_code":"AWTFR9HR","device_code":"<64 hex>","verification_uri":"https://auth.cortex.foundation/device","expires_in":900,"interval":5}` |
| POST | `/auth/device/token` | `400 {"error":"authorization_pending","error_description":"User has not yet authorized this device"}` while the user has not approved |
| POST | `/auth/device/token` | `400 {"error":"invalid_grant","error_description":"Invalid device code"}` for a code the service does not know |

`authorization_pending` is a poll signal, not a failure, even though it arrives as a `400`.
`slow_down`, `expired_token` and `access_denied` are the other RFC 8628 states; the client
handles all four, and `authorization_pending` and `invalid_grant` were observed live.

`invalid_grant` is RFC 6749 rather than 8628, and it is treated as a device-flow error
regardless: without it the poll loop still stopped, but the failure surfaced as a generic
`CortexApiError`, so a caller could not tell "that code is not valid" from "the service is
broken".

### Session

| Method | Path | Observed |
| --- | --- | --- |
| GET | `/auth/me` | `401 {"code":"AUTH_REQUIRED"}` unauthenticated |
| POST | `/auth/logout` | route exists (`405` on GET) |
| GET | `/auth/api-keys` | `401` unauthenticated |

## Public routes

| Method | Path | Observed |
| --- | --- | --- |
| GET | `/health` | `200 {"status":"healthy","version":"1.1.0","uptime_secs":2177830}` |
| GET | `/v1/models` | `200`, no auth required |
| GET | `/v1/providers` | `200 [{"name":"openrouter","configured":true,"default":true,"healthy":true,"active_model_count":0}]` |

`/v1/models` is OpenAI-shaped with Cortex extensions:

```json
{
  "id": "cortex-codex",
  "object": "model",
  "created": 1785464684,
  "display_name": "Cortex Codex",
  "category": "fast",
  "is_premium": false,
  "locked": false,
  "cost_multiplier": 1.0,
  "context_length": 128000,
  "max_output_tokens": 16384,
  "capabilities": { "function_calling": true, "json_mode": true, "streaming": true, "vision": true },
  "credit_multiplier_input": "0.600",
  "credit_multiplier_output": "1.000",
  "credit_multiplier_cached_input": "0.150",
  "price_version": 1,
  "stale": false
}
```

Two models were present: `cortex-codex` (`fast`, not premium, unlocked, ×1.0) and
`cortex-opus` (`reasoning`, premium, **locked**, ×2.5, 200k context).

That the catalogue is public while every inference route is authenticated is what makes the
product's anonymous mode work: a signed-out client can render the real Cortex model list
with premium entries locked, and route actual inference through a user-supplied provider key
until they sign in.

Credit multipliers arrive as **decimal strings**, not numbers. The client keeps them as
strings; parsing them to float would quietly lose precision on a billing value.

## Authenticated routes

Confirmed to exist by their `401`, with no visibility into their response shape:

| Method | Path |
| --- | --- |
| POST | `/v1/chat/completions` |
| POST | `/v1/responses` |
| GET | `/v1/agents` |
| GET | `/organizations` |
| GET | `/billing/portal` |

`/v1/chat/completions` is OpenAI-compatible, so the request shape is taken as given and the
response is parsed permissively.

## Errors

Two shapes, and they are not interchangeable:

- Application errors: `{ "code": "AUTH_REQUIRED", "message": "Authentication required" }`
- OAuth device errors: `{ "error": "authorization_pending", "error_description": "..." }`

Observed codes: `AUTH_REQUIRED`, `INVALID_SESSION`, `missing_code`.

Every response carries `x-request-id`. The client surfaces it on every error, because it is
the only handle support has on a failed call.

## Unverified

Not reachable without credentials, so deliberately not modelled:

- Usage and quota reporting. Nothing under `/v1/usage`, `/usage`, `/v1/quota` or
  `/v1/limits` responded; the Usage and Limits screens have no confirmed backing endpoint.
- Billing beyond `/billing/portal` existing.
- Cloud session execution. `/v1/agents` exists but its shape is unknown, and nothing under
  `/v1/sessions` responded.
- GitHub app installation, which the Auth Connect GitHub screen implies.

Those gaps are why `CortexApiClient` covers auth, models and providers concretely and
exposes a typed escape hatch (`request`) for the rest, rather than inventing endpoints that
would fail at runtime.

## Addendum — v1 contract drift (observed 2026-08-26)

The deployed service moved under the client; nothing below is a guess. Probed with
plain curl from this workspace while `CortexLM/backend` itself remained
inaccessible (repository not visible to this agent's GitHub token — this section
records the empirical surface until the source can be read).

### The `/auth/*` family is gone

Every previously-working auth route now answers RFC 7807 problem+json:

```json
{ "type": "about:blank", "title": "Not Found", "status": 404,
  "detail": "No such endpoint. See https://docs.cortex.foundation/api.",
  "code": "not_found" }
```

Observed on `/auth/me`, `/auth/device/start`, `/auth/device/poll`. The device
flow therefore cannot start against this deployment. `classifyError` surfaces the
problem+json `code`/`detail` as a `CortexApiError`, and the account service maps
`not_found` on the device flow to an honest "the account service has retired this
endpoint" message with the local-key fallback. What replaces the flow is not yet
discoverable from outside:

- `GET /v1/me` → `401 {"code":"AUTH_REQUIRED"}` (exists, wants credentials)
- `GET /v1/auth/login` → `405` (exists; method not allowed anonymously)
- RFC 8414 metadata (`/.well-known/oauth-authorization-server`) → 404
- `docs.cortex.foundation` timed out on every probe

### `/v1/models` changed envelope and key

```json
{ "items": [ { "slug": "cortex-1-mini", "display_name": "Cortex 1 Mini",
  "description": "Preview — the model Cortex is serving today.",
  "context_tokens": 262144, "max_output_tokens": 32768,
  "supports_reasoning": true, "supports_tools": true,
  "supports_vision": false, "is_preview": true } ],
  "has_more": false }
```

Previously `{ "object": "list", "data": [{ "id": … }] }`. `modelListSchema`
accepts both envelopes and normalises `slug` onto `id`, so consumers (the model
picker, capabilities) are unaffected. Verified against the live service through
`CortexApiClient.listModels()`.

## Addendum — guest, conversations, realtime (observed 2026-08-28)

`CortexLM/backend` is still not visible to this token. Parallel PRs (realtime
socket, Bot mascots, Chat Planning/Projects) are not on the public deployment
yet. What follows was probed with a **guest session** created by the live
service — no API keys were invented or stored.

### Guest auth (observed)

`POST /v1/auth/guest` → `200 {"kind":"guest","user_id":"usr_…"}` and
`Set-Cookie: cortex_gt=<token>; HttpOnly; SameSite=Lax; Secure; Domain=cortex.foundation`.

`GET /v1/me` with that cookie →

```json
{ "email": "", "display_name": "Guest", "plan_slug": "guest", "is_guest": true,
  "quotas": [{ "key": "quick_messages_per_day", "used": 0, "limit": 100,
    "resets_at": "2026-08-29T00:00:00+00:00" }] }
```

`POST /v1/auth/logout` → `204`.
`GET /v1/auth/login` → `307` to WorkOS AuthKit (`redirect_uri=…/v1/auth/callback`).

The cookie name for guests is `cortex_gt`, not `wos-session`. The client sends
whichever it has; it still never uses `Authorization: Bearer`.

### Conversations (observed)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/v1/conversations` | `{ items: [{ id, title, last_message_at, model_slug, message_count }], has_more }` |
| POST | `/v1/conversations/turns` | Body `{ message }`. **Creates** a thread. SSE. |
| POST | `/v1/conversations/:id/turns` | Follow-up. `id` is `cnv_` + ULID. SSE. |
| GET | `/v1/conversations/:id/messages` | `{ items: [{ id, role, text, created_at, model_name }], has_more }` |
| DELETE | `/v1/conversations/:id` | Allowed. GET on the conversation itself is `405`. |

SSE events (verbatim types): `disclosure`, `reasoning_delta`, `reasoning_done`,
`text_delta`, `usage`, `done`. Headers: `x-conversation-id`, `x-message-id`.
`last-event-id` is accepted on CORS preflight.

### Projects (observed)

`GET /v1/projects` → `{ items, has_more }` (empty for a guest).
`POST /v1/projects` requires `{ name }`. Guests receive `403 entitlement_required`
(`required_plan: "free"`). That is a real gate, not a missing route.

### Not landed (typed + mocked)

`GET/WS /v1/realtime` → `404`. Bot (`/v1/mascots`, `/v1/bots`, `/v1/computers`),
Planning, Library, Plugins, Code hosts, and `/v1/notifications` likewise `404`.
`packages/cortex-api` exposes a typed WebSocket client, an SSE fallback, and
`createHttpProductSurface` for mascots, Code hosts/sessions, Planning, Library,
Plugins, and notifications. In-process mocks are **not** on the public entry
— they live in `@cortex-ide/cortex-api/test-doubles` behind
`CORTEX_ALLOW_TEST_DOUBLES=1`. Chat/Code/Bot prefer the writable socket.
Chat falls back to SSE listen + HTTP turns. Web Code still never runs the
harness in the renderer.

`/health` and `GET /v1/providers` now `404`. `/v1/models` remains public.

## Addendum — product control plane (CortexLM/backend PR 36)

`CortexLM/backend` is still not visible to this token. The shapes below follow
`docs/product-realtime.md` and `packages/api-types/src/realtime.ts` on that
draft PR. A live 404 stays `not_found`. No keys were invented.

### Transport

| Method | Path | Role |
| --- | --- | --- |
| GET | `/v1/realtime` | Authenticated WebSocket. JSON text frames. |
| GET | `/v1/realtime/events` | SSE fallback. Owner room, listen-only. |
| POST | `/v1/conversations/{id}/turns` | Observed Chat HTTP stream (unchanged). |

Rooms: implicit signed-in user (owner), plus optional `conversation:`,
`code_session:`, `mascot:`. A miss is `not_found` (connection-local `error`).
`hello`, `heartbeat`, `subscribed`, and `error` are connection-local and must
not leak across tabs or become inbox rows.

Origin is allowlisted. A missing Origin is allowed (Electron). The client
never puts a cookie or API key on the WebSocket URL.

### Chat

Turn tokens fan out on the owner room. Scheduled-task results use
`POST /v1/conversations/{id}/scheduled-results` (owner-only, idempotent on
`user` + `task_id`). The client does not invent a conversation id.

### Code

Cloud and connected-host sessions. A run may prompt Allow / Always / Deny.
Host pairing returns a code shown once; the service stores a hash the client
never persists. Heartbeat is `{ device_token, host_id? }` — no SSH or
provider keys on the wire. Web still rejects `runtime: 'local'`.

### Bot

Mascot CRUD, ask-user, one computer per mascot. VNC signaling ticket is
`{ ticket_hash }` only — never a password. Videos list at
`GET /v1/mascots/{id}/videos`.

Cortex Bot runtime routes (parallel backend PR). A live 404 stays `not_found` /
`backend_too_old` in the UI — never a localStorage stand-in:

| Method | Path |
| --- | --- |
| GET/POST | `/v1/mascots/{id}/messages` |
| POST | `/v1/mascots/{id}/ask-user`, `/respond`, `/secrets` |
| GET | `/v1/mascots/{id}/computer` |
| POST | `/v1/mascots/{id}/computer/lifecycle`, `/input`, `/record`, `/shell` |
| GET | `/computer/screenshot`, `/cursor`, `/fs`, `/file` |
| GET/POST/DELETE | `/v1/mascots/{id}/memory?tier=` |
| CRUD | `/v1/skills` + `POST /v1/mascots/{id}/skills/{slug}/run` |
| CRUD + pause/resume | `/v1/mascots/{id}/routines` |
| POST/GET | `/v1/mascots/{id}/tasks` |
| POST/GET | `/inbox`, `/groups`, `/handoff`, `/teach` |
| GET | `/v1/plugins`, `/v1/plugins/connections` |

Agent turn events on `/v1/realtime`: `token`, `tool_call`, `tool_result`,
`send_to_user`, `ask_user`, `computer_offline`.

### Notifications

`GET /v1/notifications`, `POST /v1/notifications/{id}/read`, plus realtime
`notification` frames on the owner room.
