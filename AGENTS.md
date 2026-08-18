# AGENTS.md

## Cursor Cloud specific instructions

Cortex IDE is a single product: an **Electron 32 desktop IDE** in a **Bun workspaces monorepo**
(`packages/main` = Electron main, `packages/preload`, `packages/renderer` = React UI,
`packages/shared`, `packages/ai-engine`; `packages/test-harness` and `docs-site` are optional).
Persistence is an embedded SQLite DB (`better-sqlite3`) — there is no external DB/Redis/server to run.

Standard commands live in `package.json` scripts and `README.md` / `CONTRIBUTING.md`. Notes below
cover only the non-obvious things.

### Toolchain
- **Bun** is the package manager/runner (`bun.lock`). It is preinstalled at `/usr/local/bin/bun`
  (persisted in the environment); the update script runs `bun install`.
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
- Build first: `bun run build` (builds `main`, `preload`, `renderer`).
- `bun run start` / `electron .` **fails** with `Cannot find module '/workspace'`: the root
  `package.json` has no `main` field (electron-builder injects it only when packaging). To run the
  built app in this headless VM, point Electron at the entry directly and disable the sandbox:
  `DISPLAY=:1 ./node_modules/.bin/electron packages/main/dist/index.js --no-sandbox`
  (the `Failed to connect to the bus` / GPU-process messages are harmless in headless mode). The app
  opens on a "Open a folder to get started" screen; enter an absolute folder path to load a workspace.
- `bun run dev` rebuilds `main` in watch mode; you still launch Electron against the built entry as above.

### Tests / lint / build
- `bun run test` (Vitest) is the unit runner; the full suite passes. Do not use `bun:test`
  (see `test:discovery`).
- `bun run test:e2e` (Playwright + Electron) needs `bunx playwright install chromium`; it already runs
  under `xvfb-run`.
- ESLint runs via `npx eslint packages` / `bun run quality:check` (the `lint` script is only a
  placeholder in `test-harness`).

### Known pre-existing defects (NOT environment problems)
- `bun run typecheck` reports errors (type errors in some `__tests__` files, missing
  `@types/better-sqlite3`). `bun run lint`/ESLint reports pre-existing findings.
- `packages/test-harness` build fails: it imports `./benchmarks/index.js`, a source file that does not
  exist in the repo. This optional package does not affect the Electron app.
