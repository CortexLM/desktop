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
| `/plugins` | Plugins | Last item in the Chat sidebar. Official brand marks. |
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

Cards: Google Drive, Slack, GitHub, Paper. Official logos only — never a
generic plug icon. Preferred install path is **Composio**. Until Composio is
configured the card stays installable and says so; it does not fake a
connection.

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

Planning, projects, library, plugin install flags: renderer store +
`localStorage`, shared by web and desktop, so the pages are real before a
server schema exists.
