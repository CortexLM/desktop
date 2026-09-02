# Cortex architecture

This document describes the tree as it exists today. Older notes that described
a React renderer, invented IPC channel names, or a SmartChunker that does not
exist were removed rather than patched.

## What Cortex is

One application with three products behind a single shell:

- **Chat** — conversations, scheduled tasks, projects, library, plugins.
- **Code** — session-first coding agent (plan, permissions, terminal, diff).
- **Bot** — mascots, each with exactly one dedicated computer.

It ships as:

- an **Electron 42** desktop app (`packages/main` + `packages/preload` + `packages/app`);
- the **same UI** served as a web app (`packages/app` via Vite). The Code
  harness does not run in the browser. See [docs/web-vs-electron.md](./docs/web-vs-electron.md).

There is no external database, Redis, or application server to run locally.
Desktop persistence is SQLite (`better-sqlite3`). The live Cortex HTTP API
(`CortexLM/backend`, default `https://api.cortex.foundation`) is optional and
reached through `packages/cortex-api`. Cloning that repository is not required.

## Package map

| Package | Role |
| --- | --- |
| `packages/app` | SolidJS renderer. Only UI. HashRouter (required under `file://`). |
| `packages/main` | Electron main: windows, SQLite, IPC handlers, agent loop, local harness. |
| `packages/preload` | `contextBridge` façades. Channel allowlist. No Node for the renderer. |
| `packages/shared` | IPC channel names, request/response types, Zod schemas. |
| `packages/ai-engine` | Provider registry, tools, semantic chunking, agent manager. |
| `packages/cortex-api` | HTTP + realtime client for the live Cortex API. |
| `packages/tokens` | Concept 03 tokens (palette, type, layout). Generated from Paper. |
| `packages/ui` | Design-system components transcribed from Paper. |
| `packages/test-harness` | CLI (`cortex-test`). Not an in-app Benchmarks screen. |

`packages/renderer` (React) is gone. Do not reintroduce it.

## Process boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  packages/app  (SolidJS, file:// or http://localhost:5173)  │
│  Chat | Code | Bot shell · never holds API keys             │
└───────────────────────────┬─────────────────────────────────┘
                            │  preload allowlist (window.cortex)
┌───────────────────────────▼─────────────────────────────────┐
│  packages/main                                              │
│  SQLite · agent loop · node-pty · Git · OS notifications    │
│  OS keychain for provider keys                              │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
        ai-engine / local FS          cortex-api → api.cortex.foundation
        (desktop harness only)        (account, catalogue, cloud Code, farm)
```

On the web there is no main process. Hosts in `packages/app/src/state/*-host.ts`
return a **detached** implementation: honest empty / error / signed-out states
instead of pretending the harness is running in the tab.

## Design

- File: Paper *Cortex FF1 v1* (`01M0WGA7TGHQFZ2H22QFE3YZ9C`).
- Chat + Code: Concept 03, page `6-0`.
- Bot: page `D-0`.
- Tokens: ivory `#FAF8F4` / ink `#211F1C`, sidebar `#F3F0EA` / `#1A1815`,
  green `#1F4945` / `#3F958C`, terracotta `#B4622D` / `#CE8B57`.
- Fonts: Inter, Source Serif 4, JetBrains Mono.
- Product UI copy is English. Fixture person in mocks: Ana Moreno.

`design/paper/screens.json` is generated (`bun run paper:sync`). The route
table in `packages/app/src/routes.ts` lists every Paper screen **and** the
product screens that are not on page 6-0 yet. The suite checks Paper slugs
against `source: 'paper'` routes so a design screen cannot be forgotten, while
Chat / Bot destinations may exist before their artboards are extracted.

## Chat

Conversations persist in SQLite (`conversations`, `conversation_messages`)
via `ConversationService` and `chat:*` IPC on desktop. Streaming uses
`event:chat-progress` locally.

On the web (a `cortex.foundation` origin, or `VITE_CORTEX_API_BASE_URL`), Chat
prefers authenticated `/v1/realtime` for tokens and falls back to
`POST /v1/conversations/turns` (SSE). Localhost and the test suite stay on the
detached host so they never open a production guest session. See
[packages/cortex-api/CONTRACT.md](./packages/cortex-api/CONTRACT.md).

Planning, projects, library, and plugins are product stores in the renderer
(`packages/app/src/state/`). They persist to `localStorage` so web and desktop
share the same behaviour without a second SQLite schema for UI-only lists.
Scheduled-task *results* become inbox notifications; they do not invent a
second agent runtime. When the live API grows those routes, the same typed
client is reused — until then the pages are honest local state.

## Code

Sessions persist in SQLite (`session` migrations). The agent loop, tools,
permissions, and the PTY live in main. The renderer projects that state.

**Harness rule:** the browser never executes tools, a shell, or Git. Web Code
is Cloud-only or attached to a named host that already runs Cortex Code.
Desktop may use `local`. SSH and host keys stay on the server; the client
never receives them.

Provider settings follow an OpenClaw-style catalogue (`PROVIDER_CATALOG` in
`packages/cortex-api`) plus `GET /v1/models` for Cortex models. Keys stay in
the keychain.

## Bot

One mascot → one computer record. Creating a mascot creates its machine;
machines are never reused. Farm machines are specified as x86_64, ≥4 vCPU,
≥16 GiB, browser preinstalled, hibernate when unused. This client does not
provision the farm; it shows honest states (empty, hibernated, waking,
running, wake failed) and talks to the live API when reachable.

## Notifications

One inbox (`packages/app/src/state/inbox.ts`) with kinds:

`scheduled-task` · `mention` · `code-run-done` · `code-run-blocked` ·
`bot-ask-user` · `farm-wake-fail`

Surfaces: in-app center and `/code/notifications`, Electron `Notification`,
and the Web Notification API after permission. See [docs/notifications.md](./docs/notifications.md).

## IPC

Source of truth: `packages/shared/src/types/ipc/channels.ts` and
`packages/main/src/ipc/handlers/*.ts`. Do not copy channel lists into docs.

Security that is actually implemented:

- Zod validation on handler payloads (`createHandler` and the few hand-rolled handlers).
- Preload allowlists for `window.cortex` and `window.ipc` / `window.electron`.
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.

Details: [docs/IPC_ARCHITECTURE.md](./docs/IPC_ARCHITECTURE.md).

## Database

SQLite via `packages/main/src/database`. Migrations are a **static** list in
`migrations/index.ts` (a directory scan cannot work in the packaged bundle).

Current product tables include workspaces, sessions / run timeline, secrets,
MCP, and conversations. Chat extras and Bot records that are UI-local use
`localStorage` until a farm/API contract exists to persist them server-side.

## What this repo is not

- A full code editor (Monaco is present for diffs / files; this is not VS Code).
- An in-app Benchmarks product. Benches are `packages/test-harness`.
- A clone of ChatGPT. Planning is Cortex scheduled tasks with original copy.
- A place that stores provider keys in git or in the renderer.

## Changing the architecture

Prefer extending the Concept 3 shell and existing hosts over rewriting main.
If a change needs a new IPC domain, add: channel names, Zod schema, handler,
preload façade, host in `packages/app/src/state`, and tests for the façade.
