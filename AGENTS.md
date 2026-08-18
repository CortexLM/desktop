# AGENTS.md

## Cursor Cloud specific instructions

Cortex IDE is a single product: an **Electron 32 desktop IDE** in a **Bun workspaces monorepo**
(`packages/main` = Electron main, `packages/preload`, `packages/renderer` = React UI,
`packages/shared`, `packages/ai-engine`; `packages/test-harness` and `docs-site` are optional).
Persistence is an embedded SQLite DB (`better-sqlite3`) — there is no external DB/Redis/server to run.

Standard commands live in `package.json` scripts and `README.md` / `CONTRIBUTING.md`. Notes below
cover only the non-obvious things.

### Toolchain
- **Bun** is the package manager/runner (`bun.lock`). Install with `curl -fsSL https://bun.sh/install | bash`
  if `/usr/local/bin/bun` or `~/.bun/bin/bun` is missing.
- Node 22 + a C/C++ toolchain (`gcc/g++/make/python3`) are present for compiling native addons.

### Native modules (the main gotcha)
Three native/binary artifacts are built during environment setup and captured in the snapshot;
a plain `bun install` with an unchanged lockfile preserves them. You only need the steps below if a
native dependency version changes or `node_modules` is wiped:
- **electron** and **node-pty** are NOT in `trustedDependencies`, so Bun skips their postinstall.
  - Electron binary: `node node_modules/electron/install.js`
  - node-pty (build for Electron's ABI): run `npx node-gyp rebuild --target=$(node -p "require('electron/package.json').version") --dist-url=https://electronjs.org/headers --arch=x64` inside `node_modules/.bun/node-pty@*/node_modules/node-pty`.
- **better-sqlite3** must load under two ABIs — Node (vitest) and Electron (the app). Build both with
  `bun run build:native-dual-abi` and check with `bun run verify:native-abi`. `@electron/rebuild` does
  NOT work here (Bun's content-addressed store); see the header comment in `scripts/build-native-dual-abi.ts`.

### Running the Electron app
- Build first: `bun run build` (builds `main`, `preload`, `renderer`, `test-harness`).
- Root `package.json` sets `"main": "packages/main/dist/index.js"`, so `bun run start` / `electron .`
  works after a build. In a headless VM, disable the sandbox:
  `DISPLAY=:1 ./node_modules/.bin/electron packages/main/dist/index.js --no-sandbox`
  (the `Failed to connect to the bus` / GPU-process messages are harmless). The app opens on
  "Open a folder to get started"; enter an absolute folder path to load a workspace.
- `bun run dev` rebuilds `main` in watch mode; you still launch Electron against the built entry as above.

### Provider setup (agent loop)
The session workbench talks to whatever provider is saved in Settings. For a local/dev loop without
cloud keys, configure **Ollama** (default `http://127.0.0.1:11434`) or leave keys empty and the
composer will surface a provider error instead of hanging. Settings → Providers is the only place
API keys are entered; they never appear in logs.

### Tests / lint / build
- `bun run test` (Vitest) is the unit runner. Do not use `bun:test` (see `test:discovery`).
- `bun run test:e2e` (Playwright + Electron) needs `bunx playwright install chromium`; it already runs
  under `xvfb-run`.
- ESLint runs via `npx eslint packages` / `bun run quality:check` (the `lint` script is only a
  placeholder in `test-harness`).

### Product scope (do not invent a different app)
- Primary surfaces: welcome / open folder, session workbench, explorer + Monaco editor, terminal,
  git, settings, extensions/MCP, missions, notes, plans, browser, automations, account, security,
  review, knowledge, search.
- **No in-app Benchmarks screen.** Provider benches live in `packages/test-harness` (`cortex-test`).
- MCP `event:mcp-*` channels are emitted by `setupMCPEvents` in `packages/main/src/ipc/handlers/mcp-handlers.ts`.
