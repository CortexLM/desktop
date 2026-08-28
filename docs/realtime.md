# Realtime and HTTP fallback

Chat, Code, and Bot prefer one authenticated socket, then fall back to HTTP.

## Preference order

1. **`WS /v1/realtime`** — Chat tokens, Code tools/permissions, Bot ask-user,
   notifications. Authenticated with the same cookie as HTTP (`cortex_gt` for
   guests, `wos-session` for a WorkOS session). No API key is placed on the
   URL.
2. **HTTP turns** — `POST /v1/conversations/turns` (create) and
   `POST /v1/conversations/:id/turns` (follow-up). Server-sent events. This
   path was observed live on 2026-08-28.
3. **Desktop IPC** — SQLite + `event:chat-progress` inside Electron.

The socket is **not deployed yet** (`404` on the public API). The typed client
and the in-process mock implement the same `RealtimeClient` interface, so the
UI does not grow a second event shape. See
[packages/cortex-api/CONTRACT.md](../packages/cortex-api/CONTRACT.md).

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
