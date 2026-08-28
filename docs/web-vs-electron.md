# Web vs Electron

One UI package (`packages/app`) renders both surfaces. Detection is
runtime: `window.cortex` exists only when the preload script ran.

```ts
import { chromePlatform, hasElectronHost } from './state/platform.ts';

chromePlatform();     // 'darwin' | 'win32' | 'linux' | 'browser'
hasElectronHost();    // true only inside Electron
```

## What is shared

- Routes, shell, Chat | Code | Bot switcher, tokens, components.
- HashRouter — required so `/code/sessions/:id` works under `file://`.
- Detached hosts: every `resolve*Host()` has an Electron façade and a
  browser implementation that returns honest empty / error states.
- `localStorage` product stores (Planning, projects, library, bots).

## What is desktop-only

- Local Code harness (tools, PTY, Git on this disk).
- OS keychain for provider keys.
- Custom window chrome (`TitleBar`) and `windowControls`.
- SQLite conversation and session databases.
- Electron `Notification`.
- Opening a local folder.

## What web does instead

- Code runtimes: `cloud` and `ssh` when signed in; never `local`.
- Provider keys: not stored in the tab. Sign in to Cortex or attach a
  remote Cortex Code host that already has keys.
- Notifications: Web Notification API after permission.
- Title bar: omitted (`chromePlatform() === 'browser'`).

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
   Bot ask-user, notifications. Not deployed yet; the typed client + mock
   share one interface.
2. HTTP fallback — `POST /v1/conversations/turns` (SSE). Observed live.
3. Desktop IPC — local SQLite + `event:chat-progress` when Electron is present.

Web Code still never runs the harness in the tab. See
[CONTRACT.md](../packages/cortex-api/CONTRACT.md).
