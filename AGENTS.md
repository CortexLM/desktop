# AGENTS.md

## Read this first (mandatory)

Every contributor — human or agent — **must** read this file and the rule files in
[`.rules/`](./.rules/) **before writing any code**.

| Rule file | Covers |
| --- | --- |
| [`.rules/00-overview.md`](./.rules/00-overview.md) | The map, the non-negotiables, what was retired and why |
| [`.rules/01-security.md`](./.rules/01-security.md) | Keys stay in main, sandboxed renderer, no secrets in git |
| [`.rules/02-errors.md`](./.rules/02-errors.md) | Error codes map to Cortex copy; never a vendor name or raw message |
| [`.rules/03-responsive.md`](./.rules/03-responsive.md) | Window sizes, dark + light, CSS variables not raw hex |
| [`.rules/04-structure.md`](./.rules/04-structure.md) | Package boundaries, no seeded data, fixtures only in preview |
| [`.rules/05-documentation.md`](./.rules/05-documentation.md) | Docs ship in the same PR as the code |
| [`.rules/06-product.md`](./.rules/06-product.md) | Surfaces, what is live, what is blocked on design |
| [`.rules/07-git-and-prs.md`](./.rules/07-git-and-prs.md) | Branches, commits, the required attestation |
| [`.rules/08-testing.md`](./.rules/08-testing.md) | Which suite proves which claim |

Three obligations on **every** pull request:

1. **Attest.** Fill in the attestation block at the bottom of
   [`.github/pull_request_template.md`](./.github/pull_request_template.md). Tick a box
   only if it is true; if a line does not apply, leave it unticked and say why.
2. **Keep this file true.** A PR that changes product surfaces, screens, engine routes,
   environment variables, configuration or error copy updates `AGENTS.md` (and the
   matching `docs/` page) in the same PR.
3. **Name things correctly.** The product is **Cortex**, the domain is
   **`cortex.foundation`**, source copy is **English**. No other assistant brand or
   internal codename in code, docs, UI copy, commits, branches or PR titles. No vendor
   name in a user-facing string.

## What this repository is

Cortex desktop: one **Electron 44** app in a **Bun workspaces** monorepo. The agent engine
runs **in the Electron main process**; there is no server socket in the app and no
external database. Details: [`docs/architecture.md`](./docs/architecture.md).

| Package | Role |
| --- | --- |
| `packages/schema` | zod contracts, browser-safe |
| `packages/core` | Local engine: storage (`node:sqlite`), bus, models.dev catalog, providers, sessions, tools, permissions, agents, skills, plugins, MCP, bots, scheduler, space, connection, computer use. See [`packages/core/README.md`](./packages/core/README.md) |
| `packages/protocol` | Hono route table + zod validation, error shape `{error:{code,message}}` |
| `packages/server` | `createServer(core)` → `app.fetch(Request)`; `listen()` is dev/test only |
| `packages/client` | Typed fetch client + SSE parser, browser-safe |
| `packages/i18n` | Catalogs per locale/namespace, `vite.ts` and `node.ts` loaders |
| `packages/app` | Renderer: React 19 + `@base-ui/react` + Vite 8 |
| `packages/desktop` | Electron main + preload, credentials, menu, Cortex Cloud probe |

`vendor/` holds unmodified `@cortex/sdk` 0.2.0 and its optional peer `@cortex/api-types`
0.1.0, used by the main-process remote probe ([`vendor/README.md`](./vendor/README.md)).

## Toolchain

- **Bun** 1.4.x (CI pins `1.4.2`) and **Node 22+** (`node:sqlite`).
- No native addons. Persistence is `node:sqlite`; no `better-sqlite3`, no `node-pty`.
- Electron binary: Bun skips its postinstall, so after `bun install` run
  `node node_modules/electron/install.js`.

## Commands (all exist in `package.json`)

| Command | Does |
| --- | --- |
| `bun run build` | `build:app` (Vite → `packages/app/dist`) + `build:desktop` (esbuild → `packages/desktop/dist/{main,preload}.cjs`) |
| `bun run start` | `electron .` (needs a build). Headless Linux: `DISPLAY=:1 bun run start -- --no-sandbox` |
| `bun run dev:app` | Vite on `:5299`, proxies `/api` to `:5298` |
| `bun run dev:api` | Engine on `:5298` for the browser dev loop (in-memory keys) |
| `bun run typecheck` | `tsc -p tsconfig.json` |
| `bun run lint` | `eslint packages scripts tests` |
| `bun run test` | Vitest: `packages/*/test`, `tests/unit` |
| `bun run test:e2e` | Playwright `_electron`, `tests/e2e`; needs `bun run build` first |
| `bun run audit:i18n` | Fails on literal copy in `packages/app/src` / `packages/desktop/src` or missing English keys |
| `bun run pack` / `bun run dist:mac` | electron-builder, `--publish never` |

If the host exports `NODE_ENV=production`, run tests with `NODE_ENV=test`.
Full matrix and acceptance limits: [`docs/testing.md`](./docs/testing.md). E2E enumerates
426 registered theme/state renders; CI inference flows use a local fake. A separate real
image/reasoning exchange is recorded in `evidence/real-provider.json`; visual acceptance remains partial.

## Running the app

`main` loads `cortex://app/index.html` from `packages/app/dist`, so a stale `build:app`
means you are testing the previous UI. A dev renderer can be loaded with
`CORTEX_RENDERER_URL=http://localhost:5299`.

The app opens on Chat home with **no account** (local mode). The design gallery
(`#/gallery`, e.g. `CORTEX_START_HASH='#/gallery'`) renders every screen state with
preview fixtures. Only visible gallery iframes load; offscreen previews unload to keep navigation responsive.

## Environment variables

| Variable | Read in | Effect |
| --- | --- | --- |
| `CORTEX_DATA_DIR` | `packages/desktop/src/main.ts`, `scripts/dev-api.ts` | Engine data dir (default `<userData>/engine`) |
| `CORTEX_CATALOG_URL` | same | Override `https://models.dev/api.json` |
| `CORTEX_LOCALE` | `main.ts` | Force the native menu locale |
| `CORTEX_START_HASH` | `main.ts` | Initial route hash, e.g. `#/settings?section=providers` |
| `CORTEX_RENDERER_URL` | `main.ts` | Load the renderer from a dev server |
| `CORTEX_TEST_PROVIDER_BASEURL` | `main.ts` | `id=url` provider base URL override; **ignored when packaged** |
| `CORTEX_TEST_PICK_DIRECTORY` | `main.ts` | Directory dialog returns this path (E2E) |
| `CORTEX_TEST_BACKEND_URL` | `packages/desktop/test/remote.test.ts` | Optional real backend for the SDK probe test |
| `CUA_DRIVER_PATH` | `packages/core/src/computer-use.ts` | Path to the Cua Driver binary |
| `PORT` | `scripts/dev-api.ts` | Dev engine port (default 5298) |
| `E2E_WORKERS` | `playwright.config.ts` | Playwright workers (default 4) |

`scripts/translate-locales.mjs` reads `TRANSLATE_BASE_URL`, `TRANSLATE_API_KEY`,
`TRANSLATE_MODEL`; `scripts/verify-real-provider.mjs` reads `CORTEX_REAL_BASE_URL` and
`CORTEX_REAL_API_KEY` (main-only, never logged). There is no `.env.example`.

## Renderer ↔ engine (the boundary everyone must respect)

- Preload exposes `window.cortex` = `{ platform, appVersion, request, events, openExternal,
  pickDirectory, onMenu }` (`packages/desktop/src/preload.ts`).
- `cortex:fetch` (invoke) rebuilds the request in main; only `/api/*` paths reach the server.
  `cortex:events` pumps the SSE stream as chunks. `packages/app/src/api.ts` turns both back
  into `fetch()` for `@cortex/client`.
- Renderer: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
  Shared schemas set zod `jitless` before initialization; the renderer never probes dynamic evaluation.
  Navigation is locked to `cortex://app`; new windows are denied; only `https://` URLs
  go to `shell.openExternal`. CSP lives in `packages/app/index.html`.
- **Provider keys never cross to the renderer.** `PUT /api/providers/:id/key` is write-only;
  `ProviderConfig` carries `hasKey` + `keyHint` (last 4) only. Main stores keys in
  `<dataDir>/credentials.json` (mode `0600`) encrypted with `safeStorage` when available.
  See [`.rules/01-security.md`](./.rules/01-security.md).

## Product scope (do not invent a different app)

Two modes in the sidebar switcher: **Cortex** and **Cortex Code**
(`packages/app/src/kit/ui.tsx` `Mode`). Screens live in
`packages/app/src/screens/<area>/index.tsx`, each exporting `SCREENS`, collected by
`packages/app/src/registry.tsx`. Hash routes use native browser history, preserving query parameters.
Hidden sidebar/focus-mode controls and collapsed project chats are inert. Theme radios use
one Tab stop plus arrow/Home/End selection; reduced motion skips theme view transitions.
Toast Undo remains an accessible action. See [`docs/testing.md`](./docs/testing.md).
Work columns wrap within narrow content panes; small-window transcript toasts sit above
the composer so retained drafts, model selection and send controls remain reachable.
Components is a preview-only catalog: 94 blocks, 31 screen families, 30 motion entries;
at most three thumbnails mount. Bot Studio keeps refused saves editable; preview Bot appearance,
activity and drafts share temporary renderer state, cleared on reload, locale change or exit.

| Area | Screens (ids) | Live engine wiring today |
| --- | --- | --- |
| Chat (`chat`) | `home`, `chat`, history, library, research, canvas, voice, image… | Chat home + transcript stream from the engine |
| Work (`work`) | `work-home`, `work-task`, `automations`, `approvals`, `inbox`, `activity`… | Tasks handed to bots, permission approvals |
| Bots (`bots`) | `bot`, `bot-new`, `bot-studio`, `bot-roster`, `bot-settings` | Bot CRUD, mascot, memory |
| Files (`files`) | `upload`, `file-pdf`, `file-docx`, `file-xlsx`, `file-image`… | Viewers are preview-only; live routes show `upload` |
| Cortex Code (`code`) | `code`, `code-session`, `code-tasks`, `code-review`… | Home picks a folder (native dialog) and starts a `code` session |
| System (`system`) | `settings`, `search`, `command`, `projects`, `login`, `about`… | Settings → **Providers & models** and **Connection** are live |

**Blocked on design** — the engine has routes, the app has **no dedicated screen**:
**Space** (`/api/space`), **Scheduled** (the standalone list; `/api/tasks` is used today
only by Work → Automations and bot routines), **Plugins & skills** (`/api/plugins`,
`/api/skills`, `/api/mcp`; the computer-use preset therefore cannot be enabled from the UI
yet). Approved delivery remains pending in `/root/cortex-ui/DESIGN-REQUESTS.md` (outside this repo);
the design owner's live drafts are not integration inputs.
Their native Go entries are disabled. Do not build stand-in screens; say "not yet" honestly.

Cortex Cloud sign-in has no engine route yet: the live login submit says it is unavailable
(`packages/app/src/screens/system/account.tsx`).

- **No seeded data in live mode.** Fixtures live in
  `packages/i18n/locales/<locale>/fixtures/*.json` and are loaded only in preview
  (`#/gallery`, `?preview`, `?shot`) via `packages/app/src/preview.tsx`; the title bar then
  shows a state picker.
- **Connection modes**: `local` (default), `cloud` (`https://api.cortex.foundation`),
  `selfhost` (URL). Selection/probing only: prompts still use the local engine and provider
  settings; remote auth is not wired, `signedIn` remains false. Backend URLs must be HTTP(S)
  origins without credentials, paths, queries or fragments; probes refuse redirects. Self-host
  discovery lists configured registry models. See [`docs/connection-modes.md`](./docs/connection-modes.md).
- **Providers** come from models.dev; keys are entered only in Settings → Providers & models.
  Chat retains drafts/attachments when the engine rejects a send; retry includes the original
  files. Capability refusals never silently discard images. See [`docs/providers.md`](./docs/providers.md).
  Code/Work/Bot text drafts also wait for accepted sends; missing models, cancelled folder
  selection and engine refusals retain the draft.
- **Computer use** via Cua Driver is registered disabled; input actions always ask and
  "always" is never stored. See [`docs/computer-use.md`](./docs/computer-use.md).
- **i18n**: English source; catalogs and preview fixtures exist for all eight locales:
  `en fr es de ja zh-Hans pt-BR ko`. Translation review limits and source-stamp exclusion:
  [`docs/i18n.md`](./docs/i18n.md). Runtime labels localize mascot states, built-in tool names,
  todo counts and duration/model formatting; raw tool errors never become terminal UI copy.
  Untitled sessions store an empty title for the renderer's localized fallback.

## Design reference

The UI is ported from a local design reference (a separate checkout, not in this repo).
`ScreenDef.variants` carries the design variant id; `scripts/compare-shots.mjs --shots <freeze>/shots
--out <new-directory>` pixel-diffs gallery states plus five interaction shots, validates frozen
source/image hashes and records per-row provenance. Historical `evidence/compare/` stays revision-scoped.
Theme values are CSS variables in `packages/app/src/kit/styles.css`. Targeted small-window
regressions live in `tests/e2e/responsive.spec.ts`; full visual acceptance stays partial.
The frozen reference `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674` registers 205 states;
the app's 213 include eight additional Settings variants. Use its verified capture manifest,
not the changing live checkout. Home A7-final/B7-final approve their verified/inherited scope;
original-reference fidelity and missing-surface drafts remain outside that approval. See
[`evidence/compare/reference-status.md`](./evidence/compare/reference-status.md).
For installed-Mac verification, launch via `open -na /Applications/Cortex.app` in the GUI
session; direct SSH binary launches did not reliably exercise native appearance/fullscreen.

## CI, packaging and releases

`.github/workflows/ci.yml` is the only workflow:

| Job | Runner | Runs |
| --- | --- | --- |
| `checks` | `vars.CORTEX_LINUX_X64_RUNNER` (CodeBuild label pattern `codebuild-…-<run_id>-<attempt>`), else `ubuntu-latest` | lint, typecheck, test, audit:i18n |
| `e2e` | `blacksmith-4vcpu-ubuntu-2404` | build + `test:e2e` under `xvfb-run` |
| `macos` | `blacksmith-6vcpu-macos-26` | build, E2E, unsigned arm64 package, `node scripts/smoke.mjs mac` |

**Release and signing are not configured.** The old build/publish workflows were removed;
CI packages with `--publish never`, `-c.mac.identity=null`, `-c.mac.notarize=false`.
The old publish actions, `publish:` block and workflow README are removed. No auto-updater
is wired in main; no Windows CI job exists. Workflow configuration is not a passing run.

electron-builder packs `packages/desktop/dist` + `packages/app/dist`, copies locales to
`resources/locales` without source stamps or fixtures; `skills/summarize/SKILL.md` goes to
`resources/skills`. Catalog/preview loaders exclude source stamps ([i18n.md](./docs/i18n.md)).
Verify a packaging change by running the binary:
`bun run pack && node scripts/smoke.mjs linux`.

## Engine behaviour worth knowing

See [`docs/engine.md`](./docs/engine.md). In short: event log + projections in SQLite,
deltas are live-only, pending permission asks and running loops die with the process,
`bash` runs with the user's rights (no sandbox), plugins run in-process with host privileges.
