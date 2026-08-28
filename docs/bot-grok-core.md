# Bot Grok core — client loop

The Bot UI talks to `api.cortex.foundation` through `@cortex-ide/cortex-api`.
localStorage is only a list cache. Create, send, hibernate, videos, memory,
skills, and routines never succeed by writing the cache.

## How a turn reaches the user

1. The composer calls `POST /v1/mascots/{id}/messages`.
2. If `/v1/realtime` is up, the client also sends `{ type: 'bot.turn' }` so the
   agent loop can stream.
3. The conversation renders **SendToUser only**: assistant text, attachments,
   `ask_user` widgets, and secret-request cards. `tool_call` / `tool_result`
   land in the collapsible Work rail.
4. A pending ask or secret **blocks the composer** until
   `POST /respond` or `POST /secrets`.

Realtime frames on the existing socket: `token`, `tool_call`, `tool_result`,
`send_to_user`, `ask_user`, `computer_offline` (and the `bot.*` aliases).

## Computer

One dedicated box per mascot. The Computer page:

- Polls `GET /computer/screenshot` while status is `running`
- Forwards click / drag / scroll / type to `POST /computer/input`
- Runs a real box shell via `POST /computer/shell`
- Lists and previews files via `/computer/fs` and `/computer/file`
- Hibernate / wake / stop via `POST /computer/lifecycle`
- Record start/stop via `POST /computer/record`; clips from `GET /videos`

If the provider is `mock`, the status is `offline`, or a
`computer_offline` event arrives, the page shows one honest empty state.
It does not generate a fake desktop.

A VNC ticket is still `{ ticket_hash }` only.

## Grok surfaces

| Surface | Routes | Missing backend |
| --- | --- | --- |
| Memory | `GET/POST/DELETE /v1/mascots/{id}/memory?tier=` | “Backend too old” |
| Skills | `CRUD /v1/skills`, `POST /mascots/{id}/skills/{slug}/run` | same |
| Routines | `CRUD` + `/pause` + `/resume` | same. Default cron `0 9 * * 1-5` |
| Groups / inbox / handoff | `/groups`, `/inbox`, `/handoff` | empty, not a mock roster |
| Teach | `POST /teach` `{ video_id }` from Videos | same |

## Plugins

Catalog `GET /v1/plugins` and `GET /v1/plugins/connections`. A **503** means
Composio is not configured. The four brand cards (Drive, Slack, GitHub, Paper)
stay on the page; none are shown as connected unless the API says so.

## Web vs Electron

Web calls the API only on a `cortex.foundation` origin or
`VITE_CORTEX_API_BASE_URL`. Electron cannot fetch from `file://`; the renderer
sends allowlisted `/v1/mascots|skills|plugins` paths over
`cortex:product-request`. Main attaches the session cookie. Web still never
runs a local Code harness.
