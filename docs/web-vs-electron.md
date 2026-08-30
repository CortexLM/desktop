# Web vs Electron

One UI package (`packages/app`) renders both surfaces. Detection is
runtime: `window.cortex` exists only when the preload script ran.

```ts
import { chromePlatform, hasElectronHost } from './state/platform.ts';

chromePlatform();     // 'darwin' | 'win32' | 'linux' | 'browser'
hasElectronHost();    // true only inside Electron
```

## Three hosts, not two

Every `resolve*Host()` picks in the same order:

1. **Electron** — the preload bridge. Main holds the session and the keys.
2. **Cloud** — a browser on an origin `liveApiBase()` allows, talking to
   `api.cortex.foundation` directly through the one `CortexApiClient` in
   `realtime-session.ts`. Signing in here authenticates Chat and Code at once.
3. **Detached** — the suites and the preview server. Reads answer empty, writes
   reject with a message naming the cause.

The cloud branch is what makes the web app usable. Without it `resolveHost()` fell
through to detached, whose `startDeviceFlow()` rejects — so a browser could not sign
in at all, and Settings and Automations were permanently read-only.

| Host | `host.ts` | `session-host.ts` | `settings-host.ts` | `automation-host.ts` |
| --- | --- | --- | --- | --- |
| Electron | IPC | IPC | IPC | IPC |
| Cloud | `cloud-host.ts` | `cloud-session-host.ts` | `cloud-settings-host.ts` | `cloud-automation-host.ts` |
| Detached | rejects | empty + rejects | defaults + rejects | empty + rejects |

## What is shared

- Routes, shell, Chat | Code switcher, tokens, components.
- HashRouter — required so `/code/sessions/:id` works under `file://`.
- The connection banner (`shell/connection-banner.tsx`), on every surface.

## What is desktop-only

- Local Code harness (tools, PTY, Git on this disk).
- OS keychain for provider keys.
- Custom window chrome (`TitleBar`) with Chat | Code, and `windowControls`.
- `cortex://` protocol and the HTTPS bridge at `https://cortex.foundation/desktop/open`.
- SQLite conversation and session databases.
- Electron `Notification`.
- Opening a local folder.
- **This PC** as a Cortex Code runtime (folder-bound on desktop). Not offered
  on the web, and never as a Cortex Bot computer host.
- Auto-update against `https://releases.cortex.foundation/` (see [releases.md](./releases.md)). Staging installers check `https://software.cortex.foundation/staging/` ([runbooks/desktop-staging-prod.md](./runbooks/desktop-staging-prod.md)).
- Google/GitHub sign-in in the **system browser**, returning on
  `cortex://auth/callback` (HTTPS bridge at `https://cortex.foundation/desktop/open`).
  Email + password stays on the in-app form. The session cookie never crosses
  to the renderer. A callback is accepted only when it carries the one-time
  `state` issued when that login was started in this app, and a code is
  exchanged with the PKCE verifier kept in main. A `?session=` link with no
  `state` is rejected.

## What web does instead

- Code runtimes: `cloud`, a **paired machine**, or `ssh`; never `local`. Pair from
  `/code/runtimes` — the service issues a code, the machine running Cortex Code
  redeems it. The code is shown once and held in memory only.
- Provider keys: never in the tab. The service stores them and answers with a mask.
- Notifications: Web Notification API after permission.
- Title bar: omitted (`chromePlatform() === 'browser'`).

## No localStorage product stores

Planning, Projects, Library, Research and Chat preferences are account state, read
and written through `packages/cortex-api`. They used to be `localStorage` signals,
which reads as working and is not: a job that only fires while a tab is open has not
been scheduled, and a library one cleared cache deletes was never saved.

`localStorage` now holds device preferences and caches, none of them a source of
truth: the theme, the notification inbox, the Bot mascot **list** cache (reconciled
on open; writes never go to it), the optional remote-host URL, and whether this
device has seen the first-launch splash (`cortex.welcome-seen`).

Each remote list carries a lifecycle (`state/remote-collection.ts`), because getting
it wrong is what makes a broken screen look empty:

| State | Means | Renders as |
| --- | --- | --- |
| `loading` | first read in flight | loading, so empty does not flash first |
| `empty` | the service answered with nothing | empty state |
| `unsupported` | the route 404s | "not on this backend" — **not** empty |
| `disconnected` | no client on this origin | "not connected", with a retry |
| `error` | anything else | the message, not a swallowed failure |

## How to run

```bash
# Web
bun run --filter @cortex-ide/app dev          # http://localhost:5173
bun run --filter @cortex-ide/app preview      # after bun run build:app

# Desktop against that dev server
VITE_DEV_SERVER_URL=http://localhost:5173 bun run start
```

## Live API

`packages/cortex-api` targets `https://api.cortex.foundation` (override
with `CORTEX_API_BASE_URL` in main, or `VITE_CORTEX_API_BASE_URL` for the
web renderer). The backend implementation lives in `CortexLM/backend`.
Contributors do not need that clone.

Streaming order:

1. Authenticated `WS /v1/realtime` — Chat tokens, Code tools/permissions,
   Bot ask-user, notifications.
2. `GET /v1/realtime/events` — SSE, listen-only. Chat turns go HTTP.
3. HTTP fallback — `POST /v1/conversations/turns` (SSE). Observed live.
4. Desktop IPC — local SQLite + `event:chat-progress` when Electron is present.

Mocks are test-only. See [docs/staging.md](./staging.md).

Web Code still never runs the harness in the tab. See
[CONTRACT.md](../packages/cortex-api/CONTRACT.md).

## Routes the web app needs and the service does not answer yet

Typed clients exist for all of these and every caller renders `unsupported` on a 404.
None of them is faked, and none falls back to a local write:

| Surface | Routes | Client |
| --- | --- | --- |
| Code sessions | `/v1/code/sessions*`, `/v1/code/repositories` | `code-control.ts` |
| Code config | `/v1/code/{settings,providers,secrets,automations,tickets}` | `code-config.ts` |
| Runtimes | `/v1/code/hosts*`, `/v1/code/runtimes/ssh*` | `code-config.ts` |
| Usage | `/v1/code/usage` | `code-control.ts` |
| Planning | `/v1/planning/tasks*` | `chat-surface.ts` |
| Library | `/v1/library*` | `chat-surface.ts` |
| Project sources | `/v1/projects/:id/sources*` | `chat-surface.ts` |
| Research | `/v1/research/tasks` | `chat-surface.ts` |
| Preferences | `/v1/me/preferences` | `chat-surface.ts` |

`/v1/projects` and `/v1/conversations` are live. Everything else in the table
answered 404 when the clients were written, so a successful parse is not proof the
feature exists.
