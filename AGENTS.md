# AGENTS.md

## Cursor Cloud specific instructions

Cortex Code is a single product: an **Electron 32 desktop app** in a **Bun workspaces monorepo**
(`packages/main` = Electron main, `packages/preload` = the context-bridge,
`packages/app` = **SolidJS** UI, `packages/tokens` + `packages/ui` = the design system,
`packages/cortex-api` = the `api.cortex.foundation` client, `packages/shared`,
`packages/ai-engine`; `packages/test-harness` and `docs-site` are optional).
Persistence is an embedded SQLite DB (`better-sqlite3`) — there is no external DB/Redis/server to run.

**There is exactly one renderer, and it is `packages/app`.** The React renderer that used to live
in `packages/renderer` has been deleted; do not reintroduce React, and do not look for it.

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
- Build first: `bun run build` (builds `main`, `preload`, `app`, `test-harness`). `main` loads
  `packages/app/dist/index.html`, so a stale `app` build is the failure mode where you test the
  previous commit's UI.
- Root `package.json` sets `"main": "packages/main/dist/index.js"`, so `bun run start` / `electron .`
  works after a build. In a headless VM, disable the sandbox:
  `DISPLAY=:1 ./node_modules/.bin/electron packages/main/dist/index.js --no-sandbox`
  (the `Failed to connect to the bus` / GPU-process messages are harmless). The app opens straight
  onto a usable signed-out workspace — being usable with no account is a product requirement.
- `bun run dev` rebuilds `main` in watch mode; you still launch Electron against the built entry as above.

### The renderer cannot call the Cortex API (this trips everyone once)
The renderer is loaded from `file://`, so its origin is opaque and **every** `fetch` to
`api.cortex.foundation` fails the CORS check before it is sent. No header fixes this. All API access
goes through main over the `cortex:*` IPC channels (`packages/main/src/services/cortex-account-service.ts`,
exposed as `window.cortex.cortex`). The session token stays in main — encrypted at rest via
`safeStorage`, `0o600` when no keyring is available — and never crosses to the renderer, nor does the
device flow's `device_code`. See `packages/shared/src/types/ipc/cortex.ts` for the contract and
`packages/cortex-api/CONTRACT.md` for what was established by probing the live service (notably: the
service refuses `Authorization: Bearer`; the sealed session cookie is named `wos-session`).

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
- The UI is pixel-matched to the Paper file `01M0S24CY8SPNCXKQEC58TJVWS`. The routed screens are the
  artboards: home, sessions inbox, session detail, automations, review, usage, settings (+
  integrations), secrets, sign-in, device code, onboarding flows, SSH connect. `packages/app/src/routes.ts`
  is the source of truth and a test asserts it against the Paper manifest.
- Design values come from `@cortex-ide/tokens`; do not hardcode colours or spacing. Regenerate with
  the `paper:*` scripts rather than editing generated files by hand.
- Anonymous use is supported by design: without an account the Cortex models and cloud runtimes are
  *shown and locked*, not hidden — a locked row explains what an account buys, an empty list does not.
- **No in-app Benchmarks screen.** Provider benches live in `packages/test-harness` (`cortex-test`).
- MCP `event:mcp-*` channels are emitted by `setupMCPEvents` in `packages/main/src/ipc/handlers/mcp-handlers.ts`.
