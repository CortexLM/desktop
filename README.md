# Cortex

**Chat. Code. Bot.** One product, two surfaces: a web app and an Electron desktop app.

Cortex is a local-first workspace for talking to models, running a coding agent in your repos, and giving each mascot its own computer. The same SolidJS shell runs in the browser and inside Electron. Persistence is an embedded SQLite database on desktop. There is no required cloud account for Chat or local Code.

## The three products

| Product | What it is |
| --- | --- |
| **Chat** | General assistant. Home, conversations, scheduled tasks (Planning), projects and sources, library, plugins, settings. |
| **Code** | Coding-agent workbench. Sessions with a plan, permissions (Allow / Always / Deny), a real terminal, and a changes diff. |
| **Bot** | Mascots. Each mascot owns exactly one dedicated computer — never a shared VM, disk, VNC session, or recording. |

The product switcher in the sidebar is **Chat | Code | Bot**. Design source of truth is the Paper file *Cortex FF1 v1* (Concept 03 for Chat + Code; page D-0 for Bot).

## Web vs desktop

The UI is one shell (`packages/app`). What differs is where work *runs*.

- **Desktop (Electron)** may run the Code harness on this machine: filesystem, `node-pty` terminal, Git, and the agent loop live in the main process.
- **Web** never runs that harness in the browser. Code is Cloud-only, or it talks to a PC / server that already runs Cortex Code. See [docs/web-vs-electron.md](./docs/web-vs-electron.md) and [docs/harness.md](./docs/harness.md).

Provider API keys entered in Settings are stored in the OS keychain on desktop. They are never written to the renderer, logs, or this repository. `.env.example` is example-only.

## Quick start

```bash
# Install dependencies (Bun)
bun install

# Native addons for Electron (if node_modules was wiped)
bun run build:native-dual-abi

# Build main, preload, app, test-harness
bun run build

# Desktop
bun run start

# Web preview of the same UI (no local harness)
bun run --filter @cortex-ide/app preview
```

Headless / CI desktop:

```bash
DISPLAY=:1 ./node_modules/.bin/electron packages/main/dist/index.js --no-sandbox
```

Optional: configure **Ollama** (`http://127.0.0.1:11434`) or a provider key in **Settings → Providers**. Empty keys surface a provider error; they do not hang the composer.

## Architecture

```
packages/
  app/            SolidJS UI — Chat, Code, Bot (web + Electron)
  main/           Electron main: SQLite, IPC, agent loop, local harness
  preload/        Typed bridge. Allowlisted channels only.
  shared/         Types, Zod schemas, IPC channel names
  ai-engine/      Providers, tools, chunking
  cortex-api/     Client for the live Cortex API (CortexLM/backend)
  tokens/         Concept 03 palette and fonts
  ui/             Design-system components
  test-harness/   CLI benches (`cortex-test`) — not an in-app screen
```

Start with [ARCHITECTURE.md](./ARCHITECTURE.md). Product docs live under [`docs/`](./docs/).

## Stack

| Layer | Choice |
| --- | --- |
| UI | SolidJS, `@solidjs/router` (HashRouter), `@cortex-ide/ui` |
| Desktop | Electron 39, better-sqlite3, node-pty |
| AI | Multi-provider registry (OpenAI, Anthropic, Grok, Ollama, OpenRouter, Cortex) |
| Package manager | Bun |

## Development

```bash
bun run dev              # watch main
bun run build            # production build
bun run start            # launch Electron
bun run typecheck
bun run test             # Vitest
bun run test:e2e         # Playwright + Electron (needs xvfb in CI)
npx eslint packages      # lint (root `lint` is a placeholder)
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [TESTING.md](./TESTING.md).

## Native modules

`better-sqlite3` and `node-pty` must be built for Electron's ABI (and `better-sqlite3` also for Node, so Vitest can load it):

```bash
bun run build:native-dual-abi
bun run verify:native-abi
```

Details are in [AGENTS.md](./AGENTS.md).

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — current system
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to change this repo
- [SECURITY.md](./SECURITY.md) — how to report vulnerabilities
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [docs/chat.md](./docs/chat.md) · [docs/code.md](./docs/code.md) · [docs/bot.md](./docs/bot.md)
- [docs/notifications.md](./docs/notifications.md) · [docs/harness.md](./docs/harness.md)
- [docs/web-vs-electron.md](./docs/web-vs-electron.md) · [docs/realtime.md](./docs/realtime.md)
- [packages/cortex-api/CONTRACT.md](./packages/cortex-api/CONTRACT.md) — live API contract

## License

Copyright 2026 Cortex Foundation / CortexLM.

Licensed under the [Apache License, Version 2.0](./LICENSE). Third-party notices (fonts, brand marks) are in [NOTICE](./NOTICE).
