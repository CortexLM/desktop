# Realtime and HTTP fallback

Chat, Code, and Bot prefer one authenticated socket, then fall back to HTTP.

## Preference order

1. **`WS /v1/realtime`** — authenticated JSON text frames. Chat tokens (owner
   room), Code tools/permissions, Bot ask-user, notifications. Cookie auth
   (`cortex_gt` / `wos-session`). No API key on the URL. Origin allowlisted;
   missing Origin is allowed for Electron.
2. **`GET /v1/realtime/events`** — SSE fallback, owner room, listen-only.
   Subscribe/send still need the socket. Chat turns stay on HTTP POST.
3. **HTTP turns** — `POST /v1/conversations/turns` (create) and
   `POST /v1/conversations/:id/turns` (follow-up). Server-sent events. This
   path was observed live on 2026-08-28.
4. **Desktop IPC** — SQLite + `event:chat-progress` inside Electron.

Optional rooms: `conversation:`, `code_session:`, `mascot:`. A miss is
`not_found`. `hello` / `heartbeat` / `subscribed` / `error` are
connection-local and must not become inbox rows or leak across tabs.

The socket may still `404` on the public API; that stays `not_found`. The
typed socket, the SSE fallback, and HTTP turns share one transport. The
in-process mock is a test double only (`CORTEX_ALLOW_TEST_DOUBLES=1`).
See [packages/cortex-api/CONTRACT.md](../packages/cortex-api/CONTRACT.md)
and [docs/staging.md](./staging.md).

## Web vs desktop

- **Electron** still owns local Chat and the Code harness in main. The
  renderer does not call the API from `file://`.
- **Web** on a `*.cortex.foundation` origin (or `VITE_CORTEX_API_BASE_URL`)
  uses the HTTP/realtime client. Localhost and the test suite stay detached
  so they never open a production guest session.
- **Web Code** never runs the harness in the tab. Cloud session or a named
  Cortex Code host only.

## Guest sessions

`POST /v1/auth/guest` creates a guest user and sets `cortex_gt`. That is
enough for public conversation turns. Projects require a free (or higher)
plan; a guest sees `entitlement_required`, which the UI must not hide.
