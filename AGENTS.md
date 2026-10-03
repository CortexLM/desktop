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
| `packages/desktop` | Electron main + preload, credentials, menu, Cortex Cloud probe and process-lifetime sign-in |

`vendor/` holds unmodified `@cortex/sdk` 0.3.5 and its optional peer `@cortex/api-types`
0.2.0, used by the main-process remote probe ([`vendor/README.md`](./vendor/README.md)).
The SDK-owner handoff against schema blob `c8f6a7f0` passes scoped desktop admission;
earlier archives remain retained. Main owns email-code sign-in and sanitized authentication state.
The new SDK fixes media-terminal delivery, raw screenshot upload, generated turn-body typing
and native auth response cloning. Precise account/history contracts remain incomplete.
An internal `RemoteSession.bind(origin)` supplies epoch-owned model discovery, raw image
upload, streamed turns/replay and limited known-history reads. Core's `remoteSessions` service
keeps projections in memory, admits local user IDs only after backend headers and marks
resumed/unsupported output partial. SDK 0.3.5 hides discarded-frame notifications, so its
projection always remains limited. Fresh image-history follow-ups refuse pending backend
pixel hydration. It has no public route or renderer caller yet.
Remote model routing/inference and continuation screens remain active delivery work; the dependency
handoff and main-only implementation sequence are tracked in [`docs/connection-modes.md`](./docs/connection-modes.md#active-remote-integration).

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
| `E2E_WORKERS` | `playwright.config.ts` | Playwright workers (default 1 on macOS, 4 elsewhere) |

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
- **MCP connection configuration is write-only.** Main stores command/arguments/environment/URL/
  headers in separate `mcp-credentials.json`; SQLite holds metadata and an opaque reference.
  `McpServer` returns name/type/enabled/status/tool metadata only. Legacy records migrate after
  successful credential storage; failed migration preserves data and refuses connection. Hosts
  with persistent storage must supply `mcpCredentials`; in-memory engines use an in-memory store.
  See [`docs/engine.md`](./docs/engine.md).

## Product scope (do not invent a different app)

Two modes in the sidebar switcher: **Cortex** and **Cortex Code**
(`packages/app/src/kit/ui.tsx` `Mode`). Screens live in
`packages/app/src/screens/<area>/index.tsx`, each exporting `SCREENS`, collected by
`packages/app/src/registry.tsx`. Hash routes use native browser history, preserving query parameters.
Route and history-entry identity are one React snapshot; deferred navigation keeps the outgoing
screen and its draft mounted until the new route commits.
An earlier tab's route commit preserves a newer pending selection.
Work preview/context lifetime follows that committed route snapshot through departure;
the live commit clears preview mascot state before rendering live content.
Hidden sidebar/focus-mode controls and collapsed project chats are inert. Theme radios use
one Tab stop plus arrow/Home/End selection; reduced motion skips theme view transitions.
Reduced motion disables CSS transitions entirely to avoid stale inherited theme colors;
animations retain 1ms so completion hooks fire.
Skipped native view transitions consume only the `ready` AbortError; route/theme updates
still commit, while update-callback failures remain observable.
Toast Undo remains an accessible action. See [`docs/testing.md`](./docs/testing.md).
Work columns wrap within narrow content panes; transcript toasts anchor above the actual
composer dock, including attachments and nested Work transcripts at every window width.
Components is a preview-only catalog: 94 blocks, 31 screen families, 30 motion entries;
at most three thumbnails mount. Bot Studio keeps refused saves editable; preview Bot appearance,
activity and drafts share temporary renderer state, cleared on reload, locale change or exit.
Work preview task activity temporarily updates the sidebar Bot; leaving restores its prior
activity while preserving an explicit pause and saved appearance.
Work end-state previews settle their initial bottom scroll after fonts load; user input or
departure cancels that delayed adjustment.
Live Work marks Done only after a persisted successful assistant completion; refused,
failed, interrupted and unread tasks remain outside Done, including after reload.
Routine history likewise keeps active runs Running and interruptions Failed; an active routine
refuses duplicate manual starts before creating another session.
Startup marks abandoned persisted runs interrupted; deleted routine history cannot reappear on completion.
Live Cortex Code sends its selected catalog model and reasoning choice. Reopening restores the session's
model; unavailable selections retain the draft instead of silently choosing another model.
Code's right pane stays within the window; terminal output and individual diff bodies scroll
independently, keeping diff headers visible even for long tool results.
Preview Code Settings approval descriptions stack within narrow panes, staying clear of
the model selector and notification switch; wide frozen-reference geometry is retained.
Global Search matches saved Bot names and personas alongside session titles; results open the exact
Bot, and keyboard order follows visible category groups. Failed source lists offer Retry.
Live Work's **Turn into a routine** opens the existing editor with the original text request,
assigned Bot and execution context. Only Create writes a routine; file-dependent histories refuse
conversion. Re-saving with the same Bot preserves the model, agent and folder.
Failed approval-list reads show recovery with Retry instead of claiming pending requests
have been handled.
Permission views refresh on session status/deletion so cancelled asks disappear without a reply.
Transcript snapshots merge with newer live messages by ID, preserving earlier history.
Session deletion clears the transcript and invalidates pending reads; changing sessions hides
the previous session's messages/status immediately. A midstream mount receives earlier
live-only tokens when the final full part arrives, not from the initial stored snapshot.
Selecting a different Bot remounts its live page so its draft, session selection and
pending reads cannot cross to another Bot or send into the previous Bot's session.
Deleted Chat links use the existing missing-page copy rather than promising retained-message
retry. Code's settled badge reads the latest persisted assistant error, preserving Failed
after reload; an active follow-up shows Running and a successful result returns Ready.
Memory drafts clear only after accepted writes; refused/partial deletion retains surviving entries
and reports failure. Pending mutations reject duplicate submissions and stale-owner UI updates.

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
Platform's eight-route/94-variant draft receipt is verified separately in
[`evidence/recovery-followup/platform-receipt.json`](./evidence/recovery-followup/platform-receipt.json).
Its original captures and later scoped correction hashes are distinct; simulated authentication,
diagnostics, streams and approvals establish no API availability.

Email-code sign-in uses the main-only `RemoteSession`, exposed by `GET/POST /api/connection/auth`.
Only sanitized status, active `signedIn` and email cross IPC; sessions expire on process exit.
Local-password, email-verification and MFA/enrollment screens await approved integration;
unsupported continuations say unavailable. Chat/model routing still uses local providers.

- **No seeded data in live mode.** Fixtures live in
  `packages/i18n/locales/<locale>/fixtures/*.json` and are loaded only in preview
  (`#/gallery`, `?preview`, `?shot`) via `packages/app/src/preview.tsx`; the title bar then
  shows a state picker.
- **Connection modes**: `local` (default), `cloud` (`https://api.cortex.foundation`),
  `selfhost` (URL). Prompts still use the local engine and provider settings; email-code auth
  is process-local to main, `signedIn` derives from its active validated session. Backend URLs must be HTTP(S)
  origins without credentials, paths, queries or fragments; probes refuse redirects. Self-host
  discovery lists configured registry models. See [`docs/connection-modes.md`](./docs/connection-modes.md).
- **Providers** come from models.dev; keys are entered only in Settings → Providers & models.
  The key row wraps within narrow Settings panes so its label and saved last-four hint stay readable.
  Model rows likewise wrap capability badges below their name/context/cost when space is narrow.
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
  New shell results carry exact output-boundary metadata for localized exit/truncation annotations.
  Command output and unverifiable legacy records remain verbatim; model replay retains its original text.
  Untitled sessions store an empty title for the renderer's localized fallback.

## Design reference

The UI is ported from a local design reference (a separate checkout, not in this repo).
`ScreenDef.variants` carries the design variant id; `scripts/compare-shots.mjs --shots <freeze>/shots
--out <new-directory>` pixel-diffs gallery states plus five interaction shots, validates frozen
source/image hashes and records per-row provenance. Historical `evidence/compare/` stays revision-scoped.
Optional comparator `--clock <UTC ISO> --timezone UTC` fixes browser Date while timers keep running;
clock policy is recorded and incompatible merges refuse. Frozen browser timezone is not attested,
so controlled reruns preserve earlier ambient-clock outliers as separate evidence.
Theme values are CSS variables in `packages/app/src/kit/styles.css`. Targeted small-window
regressions live in `tests/e2e/responsive.spec.ts`; full visual acceptance stays partial.
The frozen reference `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674` registers 205 states;
the app's 213 include eight additional Settings variants. Use its verified capture manifest,
not the changing live checkout. Home A7-final/B7-final approve their verified/inherited scope;
original-reference fidelity and missing-surface drafts remain outside that approval. See
[`evidence/compare/reference-status.md`](./evidence/compare/reference-status.md).
Later design correction/assembly, glyph and iOS-web receipts are tracked there with separate
source pins; they do not expand desktop's approved frozen reference or live product scope.
The scoped 63-unit/PUBLIC/Product closures resolve the earlier handoff-count conflict; the
unified package remains pending. See [`evidence/recovery-followup/scoped-design-closures.md`](./evidence/recovery-followup/scoped-design-closures.md).
For installed-Mac verification, launch via `open -na /Applications/Cortex.app` in the GUI
session; direct SSH binary launches did not reliably exercise native appearance/fullscreen.
Admission correction `f2754be` has green Linux/macOS CI plus two installed-Mac history-refusal
captures; its renderer source matches `cc758a6`. See [`evidence/admission-followup/README.md`](./evidence/admission-followup/README.md).
Later MCP correction `ca08282` passes serial macOS CI at `de623fd` and installed credential
save/reopen/decrypt/remove checks. Provider-row correction `9d704ee` passes CI and two installed
960×640 captures with sidebar shown; renderer differs from `cc758a6` only in that row.
See [`evidence/mcp-followup/README.md`](./evidence/mcp-followup/README.md). Earlier failed CI
capture/stability attempts retain their negative results and unknown causes.
Code/routine correction `d635fcf` passes 61 Electron cases per OS plus macOS package/smoke;
its overall CI fails eight Node 22 locale-render fixtures. Test-only `ea1c54b` corrects those
fixtures with no application delta; CI 37076113707 passes at documentary `93c1e78`.
Twelve installed-Mac Code/routine captures and scoped
frozen comparisons are retained in [`evidence/live-behavior-followup/README.md`](./evidence/live-behavior-followup/README.md).
Work conversion/Search correction `f9aca44` passes 70 Electron cases per OS and installed-Mac
context/Retry/identity checks with ten native captures. Separate fixed-clock comparisons retain
the original night/day wallpaper outliers; see [`evidence/live-actions-followup/README.md`](./evidence/live-actions-followup/README.md).
At documentary/comparator `6d96535`, CI 37082159189 also passes. A fresh installed `f9aca44`
sweep captures 426 registered states at 1024×686, fourteen native menus and native window actions;
see [`evidence/mac/f9aca44/full/README.md`](./evidence/mac/f9aca44/full/README.md).
A full fixed-clock comparison at that pin covers 410 references/21 explicit gaps. Its bounded
diagnostic reproduces Work's 1px font-readiness/scroll-anchoring offset; historical images keep
their original scores and scheduling limits. See [`evidence/current-full-followup/compare/README.md`](./evidence/current-full-followup/compare/README.md).
Main-only email-code sign-in and native-discovered preview/Code corrections ship at `ffc118a`;
CI `37094538845` passes all three jobs. Matching installed checks pass 28 native captures
across auth, Code, terminal, recovery and Work; controlled fixtures establish no real Cloud
account or remote-inference acceptance. See
[`evidence/remote-auth-followup/README.md`](./evidence/remote-auth-followup/README.md).
SDK 0.3.5 and narrow Approvals correction `7885736` pass CI `37097480122`; the matching
installed artifact passes six sign-in and two minimum-window Approvals captures.
See [`evidence/sdk-035-admission/README.md`](./evidence/sdk-035-admission/README.md).
Internal remote foundation `f5bf305` passes CI `37105137365` at documentary `1076c25`:
97 Electron cases/426 render checks per OS, 245 units plus one optional skip. Matching Mac
checks pass six English auth captures and 48 locale states/144 Tab stops with sixteen
further native captures. Linux CJK images still show missing glyphs despite passing geometry;
see [`evidence/remote-chat-foundation/README.md`](./evidence/remote-chat-foundation/README.md).
Transcript/Bot correction `760c4a0` passes 103 Electron cases per OS in CI `37110253688`;
six matching installed Chat/Bot captures pass in both themes. Its Linux CI verifies CJK
fonts and glyph rasters; artifact review covers 271 images/44 full-size target views. See
[`evidence/live-state-followup/README.md`](./evidence/live-state-followup/README.md).
Terminal-state correction `2956564` passes 107 Electron cases per OS in CI `37113961621`;
six matching native Chat/Code captures verify missing-page copy and persisted failure/recovery.
CI artifact review covers 284 images/28 full-size target views; all sixteen locale images
match `760c4a0`. See [`evidence/terminal-state-followup/README.md`](./evidence/terminal-state-followup/README.md).

## CI, packaging and releases

`.github/workflows/ci.yml` is the only workflow:

| Job | Runner | Runs |
| --- | --- | --- |
| `checks` | `vars.CORTEX_LINUX_X64_RUNNER` (CodeBuild label pattern `codebuild-…-<run_id>-<attempt>`), else `ubuntu-latest` | lint, typecheck, test, audit:i18n |
| `e2e` | `blacksmith-4vcpu-ubuntu-2404` | build + `test:e2e` under `xvfb-run` |
| `macos` | `blacksmith-6vcpu-macos-26` | build, E2E, unsigned arm64 package, `node scripts/smoke.mjs mac` |

Linux E2E installs system CJK fallback fonts and retains a font/package inventory. Its auth
locale test checks glyph rasters at weights 400/500; layout geometry alone can pass with
missing glyphs. See [`docs/i18n.md`](./docs/i18n.md).

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
Prompt admission reserves the session before asynchronous catalog/key lookup; concurrent sends
receive `session_busy`. Refusals release it; abort/delete prevent pending admission from writing
a late prompt or starting inference.
Model capability gates include attachments replayed from history, including text-only follow-ups.
The bus's internal remote source skips SQLite persistence and local plugin event hooks;
ordinary live subscribers still receive the unchanged event. Existing publishers default local.
