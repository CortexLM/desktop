# Cortex Code

**A local coding-agent desktop IDE built with Electron, Bun, and React.**

Cortex Code is a session-first workbench for AI-assisted coding: session list on the left, agent transcript + composer in the center, Git panel on the right.

## Quick Start

```bash
# Install dependencies
bun install

# Build native modules for Electron (if not already built)
bun run build:native-dual-abi

# Build all packages
bun run build

# Start the application
bun run start

# Or in development mode (with watch)
bun run dev
```

For headless/CI environments:
```bash
DISPLAY=:1 ./node_modules/.bin/electron packages/main/dist/index.js --no-sandbox
```

## What It Does

- **Coding-agent loop** — tool-using turns (read, edit, write, grep, glob, bash, git) with permissions and checkpoints
- **Session workbench** — chat with the agent, see tool calls, approve file changes
- **Git integration** — status, stage, commit, sync, stash
- **MCP extensions** — discover, install, and invoke Model Context Protocol servers
- **Missions** — multi-step workflows with state machine (planning → running → paused → completed)
- **Provider support** — OpenAI, Anthropic, Grok, Ollama, OpenRouter
- **Local-first** — embedded SQLite database, no external services required

## What It Does Not Do

- **Inline autocomplete** — use your code editor for that
- **In-app benchmarks UI** — the benchmark harness is CLI-only (`packages/test-harness`)
- **Silent dangerous tools** — file writes and shell commands require explicit approval

## Architecture

```
cortex-ide/
├── packages/
│   ├── main/           # Electron main process
│   ├── renderer/       # React frontend
│   ├── preload/        # Secure bridge to main
│   ├── shared/         # Types, schemas, constants
│   ├── ai-engine/      # Agent runtime, providers, tools
│   └── test-harness/   # CLI benchmark framework
├── tests/              # E2E tests (Playwright)
└── scripts/            # Build helpers
```

## Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, TanStack Query, Zustand, Radix UI, Tailwind CSS |
| Backend | Electron 32, Better-SQLite3, Node-pty, Simple-git |
| AI | Multi-provider registry, streaming, semantic chunking |
| Build | Vite, electron-builder, Bun |

## Development

```bash
bun run dev          # Watch mode
bun run build        # Production build
bun run start        # Launch Electron
bun run typecheck    # TypeScript check
bun run test         # Unit tests (Vitest)
bun run test:e2e     # E2E tests (Playwright)
```

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System architecture overview
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Development guidelines
- **[TESTING.md](./TESTING.md)** — Test setup and conventions
- **[AGENTS.md](./AGENTS.md)** — Instructions for AI coding agents
- **[docs/IPC_ARCHITECTURE.md](./docs/IPC_ARCHITECTURE.md)** — Inter-process communication

## Native Modules

The app uses native modules that need to be built for Electron's ABI:

- **better-sqlite3** — embedded database
- **node-pty** — terminal emulation

If tests fail with missing `pty.node`, run:
```bash
bun run build:native-dual-abi
bun run verify:native-abi
```

See [AGENTS.md](./AGENTS.md) for detailed native module build instructions.

## License

MIT
