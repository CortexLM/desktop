# AGENTS.md

## Read this first (mandatory)

Every contributor to this repository — human or agent — **must** read this file and
the rule files in [`.rules/`](./.rules/) **before writing any code**. They are short
and each one carries bad/good examples taken from real defects in this tree.

| Rule file | Covers |
| --- | --- |
| [`.rules/00-overview.md`](./.rules/00-overview.md) | The map, the non-negotiables |
| [`.rules/01-security.md`](./.rules/01-security.md) | No tokens in the renderer, no secrets in git, guest vs signed-in |
| [`.rules/02-errors.md`](./.rules/02-errors.md) | Never show a vendor name to a user |
| [`.rules/03-responsive.md`](./.rules/03-responsive.md) | 390 / 768 / 1440, dark + light, tokens not raw hex |
| [`.rules/04-structure.md`](./.rules/04-structure.md) | `packages/app` vs `packages/cortex-api`, no fake data, no stand-in screens |
| [`.rules/05-documentation.md`](./.rules/05-documentation.md) | Docs ship in the same PR as the code |
| [`.rules/06-product.md`](./.rules/06-product.md) | Chat ≠ Code ≠ Bot; Code is a real cloud dashboard |
| [`.rules/07-git-and-prs.md`](./.rules/07-git-and-prs.md) | Branches, commits, the required attestation |
| [`.rules/08-testing.md`](./.rules/08-testing.md) | Which suite proves which claim |

Three obligations that apply to **every** pull request:

1. **Attest.** Fill in the attestation block at the bottom of
   [`.github/pull_request_template.md`](./.github/pull_request_template.md). Tick a
   box only if it is true; if a line does not apply, leave it unticked and say why
   on the line. Do not delete the block. A PR without it is closed unreviewed.
2. **Keep this file true.** A PR that changes **product surfaces, routes,
   environment or configuration, or error copy** MUST update `AGENTS.md` in the
   same PR. Documentation is not a follow-up
   ([`.rules/05-documentation.md`](./.rules/05-documentation.md)).
3. **Name things correctly.** The product is **Cortex**, the domain is
   **`cortex.foundation`**, and UI copy is **English**. No other assistant brand
   and no internal codename appears in code, docs, UI copy, commit messages,
   branch names, or PR titles. No vendor name ever reaches a user-facing string
   ([`.rules/02-errors.md`](./.rules/02-errors.md)).

Cursor picks the same entrypoint up automatically via
[`.cursor/rules/00-cortex-governance.mdc`](./.cursor/rules/00-cortex-governance.mdc).

## Cursor Cloud specific instructions

Cortex Code is a single product: an **Electron 42 desktop app** in a **Bun workspaces monorepo**
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
- **Running `electron-builder` breaks the unit suite.** It invokes `@electron/rebuild`, which
  recreates `better-sqlite3/build/Release/better_sqlite3.node` for Electron's ABI — the exact file
  `build:native-dual-abi` moves aside because it *shadows* the ABI-keyed builds. Vitest then fails
  every DB test with `Module did not self-register` / `was compiled against a different Node.js
  version`. It is not a regression in your change: re-run `bun run build:native-dual-abi` (~50s) and
  `bun run verify:native-abi` after any packaging run.

### Packaging
`electron-builder.yml` is the only config — the `build` field was removed from `package.json`
because electron-builder preferred it and silently ignored the yml (so its targets, icons and
signing config never applied).

`node-pty` and `better-sqlite3` are declared in the **root** `package.json` as well as in
`packages/main`. electron-builder resolves `node_modules` from the root manifest rather than from
the `files` globs, so a native addon declared only by a workspace package is linked under
`packages/main/node_modules/` and left out of the asar — the packaged app then dies at import with
`ERR_MODULE_NOT_FOUND: Cannot find package 'node-pty'` while the dev build stays fine. Verify a
packaging change by running the binary, not just by building it:
`npx electron-builder --dir --linux && DISPLAY=:1 ./dist/linux-unpacked/cortex-ide --no-sandbox`.

### Desktop auto-update feed
Packaged Electron checks `https://releases.cortex.foundation/` (generic provider in `electron-builder.yml` `publish.url`, same value as `DEFAULT_UPDATE_FEED_URL` in `packages/main/src/update-policy.ts`). There is no GitHub update provider for production.

On a `v*.*.*` tag, `.github/workflows/build.yml` job `publish-feed` copies electron-builder `latest*.yml`, blockmaps, and installers to R2 bucket **`cortex-releases`** with objects at the bucket root. rclone is installed from a pinned SHA-256 (`RCLONE_SHA256` in `.github/actions/install-rclone`); a checksum mismatch fails the job before extract. Bind the custom domain `releases.cortex.foundation` to that bucket so `https://releases.cortex.foundation/latest.yml` is the object `latest.yml`. A prefix such as `desktop/` on that host would make the app request `/latest.yml` and miss the object; do not use one there.

Staging is a second generic feed, **`https://software.cortex.foundation/staging/`** (`STAGING_UPDATE_FEED_URL`), objects at prefix `staging/` on bucket `cortex-software`. Agents publish it with `workflow_dispatch` on `.github/workflows/publish-staging.yml` from a **full commit SHA that is on `origin/main`**. Optional production mirror: `https://software.cortex.foundation/latest/` when `PRODUCTION_SOFTWARE_BUCKET` is set. See [`docs/runbooks/desktop-staging-prod.md`](./docs/runbooks/desktop-staging-prod.md).

Gates: GitHub Environment `production`, `vars.PRODUCTION_DEPLOY_ENABLED == 'true'`, and a version tag. `staging.yml` (push to the `staging` branch) must not write R2. Staging feed credentials stay on Environment `staging`.

Secrets (environment-scoped, never repo-wide, never in git): `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID`. Optional vars: `PRODUCTION_RELEASES_BUCKET` (default `cortex-releases`), `STAGING_SOFTWARE_BUCKET` (default `cortex-software`). See [`docs/releases.md`](./docs/releases.md).

### Linux Electron dist runs on CodeBuild
Long `electron-builder` jobs (Linux matrix in `build.yml`, `staging.yml` artifacts, `publish-staging.yml` dist) use the GitHub Actions runner label `codebuild-cortex-gha-arm64-${{ github.run_id }}-${{ github.run_attempt }}`, or `x64` when repository variable `CODEBUILD_RUNNER_ARCH` is `x64`. They must not use `ubuntu-latest`. macOS and Windows dist stay on GitHub-hosted runners. If the project is missing, create it with `infra/codebuild-gha/` or `scripts/create-codebuild-gha-runner.sh` (CodeConnections + OIDC; no `aws sso login`).

### Running the Electron app
- Build first: `bun run build` (builds `main`, `preload`, `app`, `test-harness`). `main` loads
  `packages/app/dist/index.html`, so a stale `app` build is the failure mode where you test the
  previous commit's UI.
- Root `package.json` sets `"main": "packages/main/dist/index.js"`, so `bun run start` / `electron .`
  works after a build. In a headless VM, disable the sandbox:
  `DISPLAY=:1 ./node_modules/.bin/electron packages/main/dist/index.js --no-sandbox`
  (the `Failed to connect to the bus` / GPU-process messages are harmless). Desktop first-launch
  lands on `/welcome`; skip or finish sign-in enters a usable signed-out workspace — being usable
  with no account is a product requirement. The local runtime is labelled **This PC**. Cloud and
  SSH starts go through `POST /v1/code/sessions` and do not silently run as a local session.
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
Desktop Google/GitHub sign-in opens the **system browser** (never an identity webview) and
returns through `https://cortex.foundation/desktop/open` → `cortex://auth/callback`. Main
stores the session; the renderer never sees the URL or the cookie. Email/password stays on
the in-app form (`POST /v1/auth/login`, fail closed if the route is missing). The device
flow remains at `/sign-in/device`. The `cortex` scheme is declared in `electron-builder.yml`.
English is the UI source copy; `packages/app/src/i18n/catalogs/fr.json` is for translators
and is not loaded at runtime.

### Provider setup (agent loop)
The session workbench talks to whatever provider is saved in Settings. For a local/dev loop without
cloud keys, configure **Ollama** (default `http://127.0.0.1:11434`) or leave keys empty and the
composer will surface a provider error instead of hanging. Settings → Providers is the only place
API keys are entered; they never appear in logs.

### Tests / lint / build
- `bun run test` (Vitest) is the unit runner. Do not use `bun:test` (see `test:discovery`).
- `bun run test:e2e` (Playwright + Electron) needs `bunx playwright install chromium`; it already runs
  under `xvfb-run`. The fixture clicks through `/welcome` rather than seeding
  `cortex.welcome-seen` (`firstWindow` has already loaded, so an init script is too late).
  Chat | Code | Bot exists in both the title bar and the sidebar — scope queries to
  `navigation[name=Primary]`. `/code` with no history has no composer: the CTA is
  **Start a session**, and the rail has **New session**, not Home.
- ESLint runs via `npx eslint packages` (the root `lint` script only forwards to per-package
  scripts, one of which is a placeholder). `bun run quality:duplication` and
  `bun run quality:circular` are the extra quality probes; there is no `quality:check`.

### Product scope (do not invent a different app)
- One shell hosts two peer products — **Chat** and **Code** — switched by the
  segmented control in `packages/app/src/shell/sidebar.tsx` and, on desktop, in
  the custom title bar (`packages/app/src/shell/title-bar-chrome.tsx`). Code is a
  real cloud dashboard (sessions, review, automations, usage), never a second
  chat transcript. Bot is a separate app (`CortexLM/bot-desktop`); this repo does
  not put it in the switcher. `/code` with no session history is the empty home
  (framed CLI preview + This PC / SSH / Cloud picker that starts a session), not
  a Chat-style composer. See [`.rules/06-product.md`](./.rules/06-product.md),
  `docs/chat.md`, `docs/code.md`, `docs/bot.md`.
- The UI is pixel-matched to the Paper file *Cortex FF1 v1* (`01M0WGA7TGHQFZ2H22QFE3YZ9C`), page
  **Concept 03** (group `C3`); `design/paper/screens.json` is the generated manifest and
  `scripts/paper-sync.ts` is the sync. The routed screens are the artboards: home, sessions inbox,
  session detail, automations, review, usage, settings (+ integrations), sign-in, device
  code, onboarding flows, SSH connect, plus the product splash `/welcome`. `packages/app/src/routes.ts`
  is the source of truth and a test asserts it against the Paper manifest. `NON_APP_SCREENS` in
  `scripts/paper-sync.ts` holds the boards the app deliberately does not draw, so they stay out of
  the manifest, specs and baselines.
- Design values come from `@cortex-ide/tokens`; do not hardcode colours or spacing. Regenerate with
  the `paper:*` scripts rather than editing generated files by hand. Paper MCP credentials come from
  `PAPER_MCP_URL` / `PAPER_MCP_AUTH` (or a local `.cursor/mcp.json` that is gitignored). Never commit
  that file.
- Anonymous use is supported by design: without an account the Cortex models and cloud runtimes are
  *shown and locked*, not hidden — a locked row explains what an account buys, an empty list does not.
  Cloud, SSH, Automations, Review and Usage need a Cortex account. **This PC** Code
  sessions still work unsigned with the user's own provider keys. Leftover `/bot`
  screens stay shown; creating a Bot needs an account.
- **This PC Code sessions** bind to a folder the user picks in the native OS directory dialog. The
  coding agent runs tools against that tree in the desktop harness. There is no working-directory
  fallback and no silent Cloud run. Cloud and SSH starts go through `POST /v1/code/sessions` and
  fail closed if that route is missing. This PC is never a Bot host.
- **No in-app Benchmarks screen.** Provider benches live in `packages/test-harness` (`cortex-test`).
- **No Secrets page in Cortex Code.** There is no `/code/secrets` route and no Secrets screen,
  sidebar item, Home card, Settings row or command-palette entry — and no field anywhere in Code
  that asks the user to paste a token. Provider keys are entered only in Settings → Providers and
  go main → keychain. `/v1/code/secrets` remains in `packages/cortex-api` for other callers; no
  screen reaches it. Bot's secret-request card (`docs/bot-runtime.md`) is a different surface
  ([`.rules/06-product.md`](./.rules/06-product.md) § 6.2.1).
- **Bot mascots are one Kernel pebble** in the leftover `/bot` screens and in
  the dedicated Bot app. Identity is a look (Meadow, Teal, Terracotta,
  Amber, Plum, Slate), a resting face, and a ±5° tilt. Live states (idle, thinking,
  working, notify, success) are procedural SVG + CSS/WAAPI in
  `packages/app/src/screens/bot/mascot-mark.tsx`. The user picks look and face; the
  API is the source of truth. This desktop chrome does not switch to Bot. See
  `docs/bot.md`.
- **This PC is Cortex Code on the desktop app.** The leftover `/bot` computer is a
  cloud farm box. Those screens never offer This PC, This desktop, or SSH as a
  host. SSH stays SSH, on Code. Web Code never offers This PC
  (`docs/web-vs-electron.md`).
- **Leftover `/bot` screens are a teammate workbench**, not a third product tab.
  Those routes keep a Bot sidebar (live roster, honest empty, Studio at
  `/bot/approvals`). Conversation: mascot name in the header, employee bubbles
  (tool dumps hidden), and a right Computer rail that is a **cloud** noVNC stream
  with Take control / Release. This PC is Cortex Code only. The rail is bound to
  the open mascot — switching clears screenshot and stream before the next
  computer loads, and a failed refresh leaves the rail empty rather than the
  previous teammate. Google/GitHub sign-in opens the system browser and returns
  on `cortex://auth/callback` only with an unexpired pending login `state`;
  codes are exchanged with PKCE in main. A bare `?session=` deep-link is
  rejected. Email stays on the in-app form. See `docs/bot.md`,
  `docs/web-vs-electron.md`.
- **No seeded data.** A new account has an empty roster, an empty session inbox and an empty
  library, and each says so honestly. `localStorage` may cache a list the service already returned;
  it is never a source of truth and never holds invented rows
  ([`.rules/04-structure.md`](./.rules/04-structure.md)).
- **Plugins list the services the user connects to**, from the live catalogue. The middleware we
  install through is internal plumbing: it is a field on the catalogue envelope in
  `packages/app/src/state/plugins.ts`, never a card, a label, a subtitle, or an error body
  ([`.rules/02-errors.md`](./.rules/02-errors.md)).
- **Every plugin is assigned to Cortex Chat, Cortex Bot, or both.** The choice is the connection's
  (`surfaces`), sent on connect and changed with `PATCH /v1/plugins/{slug}/connect`; at least one
  surface is always kept. The switches follow the account, not the click — a change is a write, and
  a write that failed leaves them where they were. `packages/app/src/state/plugin-surfaces.ts`,
  `docs/chat.md` § Chat, Bot, or both, `packages/cortex-api/CONTRACT.md` § Plugins.
- MCP `event:mcp-*` channels are emitted by `setupMCPEvents` in `packages/main/src/ipc/handlers/mcp-handlers.ts`.
- The coding-agent loop in `packages/ai-engine` owns Background Task (`explore` /
  `plan` / `worker` — no nested Task, children must not AskUser), plan-mode
  mermaid (`flowchart` or `sequenceDiagram` before ExitSpecMode), artifact
  offload for oversized tool output, and compaction keep-set
  (`open_artifact_ids`, `active_plan`, `open_task_ids`). Plugin tools are
  injected from connections (Chat / Bot / both); Code uses a Code-side catalog
  only when the host supplies one. Do not add a Secrets page for this.
