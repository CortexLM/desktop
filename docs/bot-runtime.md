# Bot runtime — client loop

The Bot UI talks to `api.cortex.foundation` through `@cortex-ide/cortex-api`.
localStorage is only a list cache. Create, send, hibernate, videos, memory,
skills, and routines never succeed by writing the cache.

## How a turn reaches the user

1. The composer calls `POST /v1/mascots/{id}/messages`.
2. If `/v1/realtime` is up, the client also sends `{ type: 'bot.turn' }` so the
   agent loop can stream.
3. The conversation renders **SendToUser only**: assistant text, attachments,
   `ask_user` widgets, and secret-request cards. Double newlines split a turn into
   employee-style bubbles. `tool_call` / `tool_result` stay off the thread.
4. A pending ask or secret **blocks the composer** until
   `POST /respond` or `POST /secrets`. The Approvals screen (`/bot/approvals`)
   lists the same pending cards across mascots.

Realtime frames on the existing socket: `token`, `tool_call`, `tool_result`,
`send_to_user`, `ask_user`, `computer_offline` (and the `bot.*` aliases).

## Computer

One dedicated box per mascot. The conversation's right rail and the Computer
page:

- Prefer a live noVNC embed when `POST /computer/vnc-ticket` returns an https
  `stream_url` or `embed_url`. The ticket hash is a capability probe only and is
  never stored in the renderer.
- Take control / Release via `POST /computer/control` `{ action: take|release }`.
  Input is forwarded only while the user holds control. A live 404 is
  “backend too old”, never a fake desktop.
- The computer is a cloud farm box. Lifecycle is wake / hibernate / stop.
  This PC and SSH are Cortex Code hosts, never Bot runtimes.
- Polls `GET /computer/screenshot` while status is `running` if there is no stream
- Forwards click / drag / scroll / type to `POST /computer/input` only with control
- Shell and files stay on the dedicated Computer page as secondary details, not
  a tab navbar on the conversation rail
- Hibernate / wake / stop via `POST /computer/lifecycle`
- Record start/stop via `POST /computer/record`; clips from `GET /videos`

If the computer is offline, or a `computer_offline` event arrives, the page
shows one honest empty state. It does not generate a fake desktop. Bot does
not offer This PC or SSH as a host; the box is a cloud farm machine.

## Bot runtime surfaces

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
