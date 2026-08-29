# Chat

Chat is the general assistant. It is the default product (`/`).

## Destinations

| Route | Screen | Notes |
| --- | --- | --- |
| `/` | Home | Greeting, composer (Search / Reason), product cards, suggestions. |
| `/chat/:id` | Conversation | Streamed thread. Backed by SQLite on desktop. |
| `/research` | Research | Honest empty / loading / error / signed-out. |
| `/planning` | Planning | **Scheduled tasks**, not a project plan. ChatGPT-style recurring jobs with original Cortex copy. |
| `/projects` | Projects list | Empty until the user creates one. |
| `/projects/:id` | Project | Brief, status, link to sources. |
| `/projects/:id/sources` | Project sources | Files and connections attached to that project. |
| `/library` | Library | Saved answers and uploads. |
| `/plugins` | Plugins | Last item in the Chat sidebar. Catalogue comes from the API; each card is assigned to Chat, Bot, or both. |
| `/settings` | Chat settings | Defaults for Chat. Code settings stay under `/code/settings`. |

Search in the sidebar opens the command palette. It is not a separate page.

## Sidebar order

Search → Research → Planning → Projects → Library → Plugins (last).

## Planning

Active recurring jobs. Seed mix (do not reorder):

1. Today's notes — Daily
2. Unread mentions — Daily
3. Week ahead — Weekly
4. Evening recap — Daily
5. Subnet 100 news — Daily, **Cortex-only** (last)

Copy is Cortex's. Do not paste ChatGPT task names or descriptions.

A run result emits a `scheduled-task` notification. When a live conversation
id (`cnv_…`) is already known, the same result is also posted to
`POST /v1/conversations/{id}/scheduled-results` (idempotent on user+task_id).
The client never invents that id.

## Plugins

The catalogue is `GET /v1/plugins/catalog` — the marketplace list, cached
server-side — rendered as it arrives. The client keeps no list of its own, so
there is nothing to fall back to and nothing to fall out of date: `is_live:
false` and a `503` are states the page shows, not reasons to substitute apps
chosen here. The marketplace lists itself (a `composio` row); that row is
dropped, because the provider is the install path rather than an app to connect.

Rows carry a monogram, not the service's own mark: the catalogue's `logo_url`
points at the provider's CDN, which the renderer's `img-src 'self' data:` policy
blocks — and widening it would make every visit fetch dozens of images from a
third party.

Connecting needs a Cortex account. `POST /v1/plugins/{slug}/connect` refuses a
guest with `403 entitlement_required` ("a guest session cannot be signed back
into to revoke it later"), which is correct and which the UI never shows:
Connect on a guest opens sign-in, remembers the slug and the Chat / Bot choice,
and finishes the connection when the account arrives. See
`state/pending-connect.ts`.

### Chat, Bot, or both

Every card carries two switches. They are the connection's **surfaces**: a
Cortex Chat turn may use the tools of a plugin assigned to `chat`, and a Cortex
Bot mascot the tools of one assigned to `bot`. The choice travels in the connect
call, and a connected app is re-assigned with `PATCH
/v1/plugins/{slug}/connect`. A connection keeps at least one surface — switching
off the last one is refused and the card says to disconnect instead.

The client does not pick tools for a turn: it neither sends a tool list on
`chat.turn` nor on `bot.turn`, so the assignment is state the service filters
on. What this page owes the user is therefore that the switches describe the
account and not the click — they move when the service has agreed, and a write
that failed says so and leaves them where they were.

An answer with no `surfaces` on it is read as both, because a service that does
not filter by surface really does reach those tools from either product. A
backend with no `PATCH` on the route says so on the page ("Cortex cannot yet
choose where a plugin is used on this workspace") rather than pretending the
change was saved. See `packages/cortex-api/CONTRACT.md` § Plugins.

## Honest states

Every Chat destination handles:

- **Empty** — nothing created yet.
- **Loading** — a request is in flight.
- **Error** — the host or API failed; the message is the real reason.
- **Signed-out** — account-only rows (Subnet 100, synced library) explain the
  gate and offer Sign in. Local Chat still works with BYO keys.

## Persistence

Conversations: SQLite + `chat:*` IPC on desktop. On a `cortex.foundation`
origin (or `VITE_CORTEX_API_BASE_URL`) the web host talks to the live API:
guest session via `POST /v1/auth/guest`, turns via `/v1/realtime` when that
socket is up, otherwise `POST /v1/conversations/turns` (SSE). Localhost and
tests stay detached so they do not open a production guest session.

Planning, projects, library and plugin connections live on the account and are
read from the API on each visit. None of them is mirrored into `localStorage`:
a schedule that runs while the tab is shut, or a connection another machine
must be able to revoke, is not something a browser store can stand in for.
