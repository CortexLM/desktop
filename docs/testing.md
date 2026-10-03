# Testing

Native view-transition regression in `tests/e2e/navigation.spec.ts` forces real
`skipTransition()` for route and theme updates with motion enabled. It verifies both
callbacks still commit, expected `ready` AbortErrors are handled and async callback
failures remain reported. The original macOS `749bc0c` failure is retained separately.

## Suites

| Command | Scope | Notes |
| --- | --- | --- |
| `bun run test` | Vitest (`vitest.config.ts`): `packages/*/test/**/*.test.ts`, `tests/unit/**/*.test.ts`, `packages/app/src/**/*.test.{ts,tsx}` | Node environment, 20 s timeout. Prefix `NODE_ENV=test` if the host exports `production` |
| `bun run test:e2e` | Playwright (`playwright.config.ts`), `tests/e2e` | Launches `packages/desktop/dist/main.cjs` via `_electron`; **run `bun run build` first**. Workers: `E2E_WORKERS` (default 1 on macOS, 4 elsewhere). Reports: `playwright-report/`, `test-results/` |
| `bun run audit:i18n` | `scripts/audit-i18n.mjs` | See [i18n.md](./i18n.md) |
| `bun run lint` | `eslint packages scripts tests` | |
| `bun run typecheck` | `tsc -p tsconfig.json` | Includes tests and scripts |

Linux headless E2E: `xvfb-run -a -s "-screen 0 1920x1080x24" bun run test:e2e` (as CI).

## Unit tests

| File | Covers |
| --- | --- |
| `packages/schema/test/schema.test.ts` | contracts |
| `packages/core/test/{catalog,capabilities,session,services,computer-use}.test.ts` | catalog cache/offline, capability gates, session loop, services, computer use |
| `packages/protocol/test/protocol.test.ts` · `packages/server/test/server.test.ts` · `packages/client/test/client.test.ts` | routes, binding, client + SSE |
| `packages/desktop/test/remote.test.ts` | SDK probe; real backend only with `CORTEX_TEST_BACKEND_URL` |
| `packages/desktop/test/credentials.test.ts` | Credential round trips, restrictive permissions, corrupt-store refusal and failed-write preservation |
| `packages/core/test/mcp.test.ts` | Main-only connection storage, legacy migration/refusal, metadata-write failure, pending reconnect/removal races and redirect-header refusal |
| `packages/core/test/scheduler.test.ts` | Interrupted routine outcomes, duplicate admission, file-backed restart recovery and deleted-history preservation; server tests verify route conflict responses |
| `tests/unit/locales.test.ts` · `tests/unit/audit-i18n.test.ts` | locale parity, Node source-stamp exclusion, audit behaviour |
| `tests/unit/runtime-copy.test.ts` | mascot names/tool labels plus metadata-bound shell annotations across eight locales; raw output, legacy records and model replay remain intact |

The static Code render fixture includes the real model composer: translator, typed session model,
empty catalog and read-only browser preferences. It restores stubbed globals after each test;
Node 22 has no implicit `localStorage`, unlike some newer Node environments.

Engine tests use `createCore({ dataDir: ":memory:", credentials: memoryCredentials() })`
and the catalog fixture `packages/core/test/fixtures/catalog.json`.
Session admission regressions submit concurrent prompts and hold credential lookup while
aborting/deleting. They verify one admitted turn, no late persisted prompt/provider request,
no leaked busy state and successful follow-up after release. All three fail before the fix.
Additional regressions fail before their fixes for parent cancellation while child deletion waits,
synchronous model-update listener cancellation, and historical image/PDF capability refusal.
Cancellation checks inspect the durable event journal as well as the current message projection.

## E2E

- `tests/e2e/fixtures.ts` — `launch()` gives each app a fresh temp `CORTEX_DATA_DIR`, sets
  `CORTEX_START_HASH` and `CORTEX_LOCALE`.
- `tests/e2e/fake-provider.ts` — local OpenAI-compatible streaming endpoint (reasoning then
  text deltas) that records requests.
- `CORTEX_TEST_PROVIDER_BASEURL=<providerID>=<url>` points one provider at it; main ignores
  it when packaged. `CORTEX_TEST_PICK_DIRECTORY` stubs the folder dialog.
- `tests/e2e/engine.spec.ts` — catalog through the bridge, a streamed exchange with a
  thinking- and image-capable catalog model through the **local fake provider**, image
  refusal for a model without image input. Checks request serialization, key redaction,
  reasoning/text deltas and persisted parts.
  MCP save/list/reload/delete also verifies sanitized IPC responses and no raw connection material
  in fresh SQLite/WAL or the host credential file; it does not certify secure deletion of legacy pages.
- `tests/e2e/ui-flows.spec.ts` — Settings key entry/masking, composer model and thinking
  selection, image attachment and streamed reply through the **same local fake**. The
  predetermined answer is not evidence that a real model understood an image.
  Both themes also cover draft/file retention after capability refusal on home and in a
  conversation, pending/failed file reads, then a rejected provider response and historical
  image-preserving retry after another prompt. A text-only follow-up after selecting a non-image
  model is refused when history contains an image, retaining its draft without a provider request.
  That 960×640 regression
  uses the repository catalog fixture and retains screenshots as test attachments.
- `tests/e2e/screens.spec.ts` — enumerates every registered screen/variant in dark and
  light, currently **426 theme/state renders**. Checks theme selection, nonempty body,
  uncaught page errors and raw i18n keys in visible/accessibility/tooltip copy in preview;
  it does not exercise every control.
- `tests/e2e/chrome.spec.ts` — native window title/minimum bounds, English/French menus,
  macOS traffic-light position `{x:20,y:15}` through Electron APIs; reload records CSP
  violations before application initialization, including forbidden evaluation probes.
  A reduced-motion startup case checks inherited heading colors in both themes, zero-duration
  transitions and retained 1ms animations. This is a separately delivered accessibility fix;
  the original frozen design files are unchanged.
- `tests/e2e/responsive.spec.ts` — 960/1024×640 in both themes: scroll to and apply a Code
  suggestion, read split-diff line endings, use Canvas selection/version controls, operate
  Work computer controls. Also forces preview navigation before startup subscription to
  ensure fixtures gate the first render. Six Work board cases cover 960/1024/1440 in both
  themes: no horizontal page overflow, vertical-wheel access to all columns/cards, opening
  task content and reaching empty drop zones; 1440 retains four columns. These regressions
  wait for renderer width/layout after native resizing and for the prior React screen to
  detach after hash navigation. Review's inline comment can remount independently; its wheel
  distance is sampled only from a connected element. Viewport/hit assertions are unchanged.
  These cases do not certify every screen.
- `tests/e2e/navigation.spec.ts` — real anchor and native-menu navigation, distinct engine
  chat identities through back/forward, variant parameters, history branching and Gallery
  return. macOS fullscreen uses AppKit's injected command; native captures verify that entry.
  Gallery checks bound loaded frames, retain the top scroll position, unload scrolled previews
  and require the exit link to respond within five seconds.
  A held view-transition callback proves unrelated shell updates preserve the outgoing Work
  tree/draft, then restore the prior sidebar Bot activity when navigation commits.
  A second held callback proves a newer keyboard tab choice survives an older route commit;
  Back to another entry with the same tab label cancels that pending choice. These three
  regressions fail on their respective pre-fix builds.
  Capture manifests are revision-specific; a later targeted capture does not refresh the full sweep.
- `tests/e2e/keyboard.spec.ts` — both themes at 960×640: theme radio arrow/Home/End selection
  with one Tab stop, reduced-motion theme changes, hidden sidebar/focus controls and collapsed
  project chats reject focus. Hiding the sidebar dismisses its open mode menu. A keyboard-activated
  Undo preserves the real engine session. A motion-enabled case covers interrupted tab selection,
  settled indicator geometry and retained keyboard focus, vertical theme selection, OS appearance
  changes and mode-menu closure. Focus mode excludes the native drag region above content actions.
  Settled keyboard route sequences await the rendered target and selected tab; the URL changes
  earlier than React's view-transition commit. The separate held-callback regression covers
  input during that gap.
- `tests/e2e/composer-safety.spec.ts` — both themes at 960×640: Code directory cancellation,
  missing models, Code/Work/Bot engine refusal, locked pending admission, duplicate-submit
  suppression and accepted-send clearing. Work's empty-board transition preserves its draft.
  Code, Chat and Work refusal checks require immediate composer control access while the toast remains
  visible; Chat changes the model while keeping the draft/image. Transcript toasts anchor
  above the actual composer dock, including nested Work transcripts and attachment rows;
  popup menus render above notifications so model selection remains reachable.
  Live Work tests distinguish refused/empty tasks from successful, subsequently failed and aborted tasks,
  verifying both the board and transcript badges after reload.
- `tests/e2e/code-models.spec.ts` — both themes at 960×640: actual configured model choice on new
  Code tasks and follow-ups, reasoning payload, keyless endpoints, folder cancellation and duplicate
  submission locking. Reopening uses the session model despite a different global preference;
  disabled, missing and unsupported models keep the draft without fallback or provider traffic.
  Long-filename image refusals retain the file and keep removal/model controls above the toast;
  choosing an image-capable model admits the original file once.
- `tests/e2e/routines.spec.ts` — both themes at 960×640: permission-held Running state, duplicate
  start refusal, aborted Failed state after reload, latest-eight chronological outcome dots and
  accepted-only run feedback. Deleted-task run/delete refusals use the real engine; delayed request
  serialization tests pending duplicate suppression without substituting an API response.
- `tests/e2e/search-bots.spec.ts` — both themes at 960×640: real Bot name/persona matching,
  case/accent normalization, mixed category keyboard order, exact identity navigation, filtering
  and deletion/reload. Separate real missing-record refusals cover each source list and Retry;
  request URLs change, engine responses are not substituted.
- `tests/e2e/work-routine-source.spec.ts` — both themes at 960×640: original Work instructions,
  nondefault Bot/model/agent/folder, Cancel, explicit Create, pending duplicate suppression,
  reload/edit preservation and a real scheduled run through the controlled provider. Reassignment,
  deleted sources/Bots and attachment refusal preserve source data. Held response parsing checks
  stale source navigation and late-save completion without replacing engine responses.
  A real Bot-list refusal plus held retry verifies disabled Create, editable retained instructions,
  localized recovery and correct-Bot persistence after the list returns.
- `tests/e2e/approvals-recovery.spec.ts` — both themes at 960×640: a real list-request refusal
  shows recovery rather than claiming pending permissions are handled. Retry restores the
  still-pending engine permission; aborting that session verifies both actual engine removal
  and refresh of the visible list through the existing session-status event.
- `tests/e2e/work-scroll.spec.ts` — both themes: held real font responses verify the Work
  initial bottom position after reflow, warm-font reentry, user-wheel ownership and cancellation
  on variant change/departure. Font/layout diagnostics remain distinct from frozen pixel scores.
- `tests/e2e/frozen-composer.spec.ts` — both themes at 960×640: preview menus, selected-model
  handoff, same-URL personal/fixture history, refresh, edit/pin/delete/Undo and honest Code
  demonstrations. Live composer checks all eight locale labels, capsule geometry, reduced
  motion and real-engine image-capability refusal/retry through the fake provider. Geometry
  equality allows 0.005 CSS-pixel compositing rounding, not a visible layout change.
- `tests/e2e/bot-safety.spec.ts` — 960/1440 × both themes: real rejected Bot writes preserve the
  studio draft/dialog; pending writes lock controls and reject duplicate submission. Shared preview
  appearance/activity/pause, draft restoration, onboarding and locale/live isolation are separate cases.
  Live Studio awaits `api.bots.update` before saved state, success feedback or guard navigation.
  Preview appearance/draft state is memory-only; desktop has no prototype `useBot` localStorage
  setter. These cases do not simulate a SQLite write failure or a browser-storage quota error.
  Core Bot updates synchronously persist the new document before returning it; they publish no
  Bot event. The persistence ordering is a source observation, not an injected-failure E2E claim.
  Leaving onboarding cancels delayed navigation, including a departure from preview into live mode.
  Work task previews publish their activity to the sidebar, then restore prior background activity;
  an explicit pause, saved appearance and draft survive this temporary activity.
  Saved-look toasts must leave every Chat composer control reachable at both window sizes.
- `tests/e2e/memory-safety.spec.ts` — both themes at 960×640: real refused Add retains exact
  drafts; pending Enter/blur submits once; stale Bot responses cannot clear newer drafts. Real
  missing-entry deletions verify single/bulk refusal, partial batch settlement, surviving entries
  and accepted retry/reload. System Memory keeps rows pending/refused and reports accepted-only success.
  Held owner/list reads also cover initial Add gating, cross-owner privacy, return navigation
  after accepted deletion and load-refusal recovery without duplicate writes.
- `tests/e2e/terminal-copy.spec.ts` — French live Code, real approved shell commands through a
  controlled provider: localized exit/truncation annotations, preserved stdout lookalikes,
  unchanged model replay and identical persisted messages after reload.
- `tests/e2e/components.spec.ts` — 94 blocks, 31 real-screen families, all offered variants in both
  themes, inert thumbnails and a continuously checked three-iframe ceiling. Minimum-window checks
  exercise native clipboard, keyboard navigation, forms, palette, edits, Undo and motion filtering.
- `tests/e2e/interaction-states.spec.ts` — frozen-reference semantic end states at 960/1440 in both
  themes: switches, history delete/Undo, reasoning disclosure, file drops, approval Undo, image
  comparison and nine mascot states; Kanban drag at 1440. No frame-accurate timing claim.

Each launch also gets an isolated Electron user-data directory: renderer locale/theme/model
preferences cannot leak between parallel test processes or the developer's installed app.
macOS defaults to one worker to limit foreground-app contention among this suite's Electron apps.
Assertions, capture requirements and timeouts remain unchanged. A Linux-only hidden-window probe
records restored frame availability after showing the window; it does not reproduce either macOS
CI stall or establish its cause.
The engine is real in these E2Es; the inference endpoint is fake. Catalog calls use
models.dev unless `CORTEX_CATALOG_URL` overrides it. No real-provider chat, thinking or
image-inference proof is recorded by these tests.
Provider key save/reload/removal checks use a deterministic catalog, both themes and
960/1024/1440 widths. Text ranges and hit testing reject clipped/covered key labels and saved
  hints; model rows also require complete name/context/cost/badge text through range geometry
  and hit testing. The wide key row stays inline. Both regressions first failed in both themes at 960px.

### Real-provider verification

`scripts/verify-real-provider.mjs` uses Playwright Electron against the existing build.
Set `CORTEX_REAL_BASE_URL` and `CORTEX_REAL_API_KEY` in the environment, then run
`xvfb-run -a node scripts/verify-real-provider.mjs` on Linux. Credentials enter main only;
temporary credentials/history are removed. The loopback proxy changes only the catalog
model ID to the configured gateway's `cx/gpt-6-astra`; response bytes pass through unchanged.
The live models.dev capabilities are not altered. At most two requests, 120 seconds each.

`evidence/real-provider.json` records a successful real `/v1/responses` SSE exchange:
9 text deltas, 1 reasoning delta, persisted image/text/reasoning parts, correct blue/red
image answer, no tools. Reasoning content, key and private endpoint are omitted. This proves
the built Electron bridge and local engine path, not packaged/UI interaction acceptance.

## Packaged and visual checks

- `node scripts/smoke.mjs <mac|linux|win>` — launches the binary from `dist/` with a
  debugging port, waits for a window, checks it stays up and renders the Cortex shell,
  screenshots to `out/`. This is a packaged-launch check, not a full flow or signing check.
  Linux: `bun run pack` first; on a headless host run `xvfb-run -a node scripts/smoke.mjs linux`.
- `node scripts/compare-shots.mjs --shots <freeze>/shots --out <new-directory> [--base http://localhost:5299/] [--only id,id] [--merge]`
  — renders every gallery state plus five interaction shots (French locale, 1440×900 @2x):
  home mode menu and history second-row menu in both themes, file-image ask panel in light.
  Explicit output keeps historical `evidence/compare/` intact. The reference must have matching
  `freeze.json`, `shots/manifest.json` and source/image hashes. The script records per-row capture
  timestamps, app/design/diff hashes, renderer source and served-asset fingerprints in
  `provenance.json`; it rejects source changes during capture and incompatible merges.
  Missing approved optional references remain explicit gaps. There is no pass/fail pixel threshold.
  Console errors or missing theme/content fail capture; absent preview API transport is recorded
  separately. `node scripts/compare-shots.test.mjs` checks provenance refusals without a browser.
  Optional `--clock 2026-10-02T12:09:00Z --timezone UTC` pins browser Date before navigation while
  timers keep running. Clock policy is recorded per capture/run and in provenance; incompatible
  policies cannot merge. Without the option, wall clock/timezone remain ambient. Frozen manifests
  omit their original browser timezone, so a supplied clock is an explicit comparison control,
  not proof of the reference's original mount time. Earlier night/day Work wallpaper outliers stay
  retained; a controlled rerun receives its own output directory.
- `scripts/mac/capture.sh <routes-file> <out-dir>` — runs on a remote Mac, captures each
  route with native window chrome in light and dark. `scripts/mac/artifact-url.sh <run-id>
  <artifact>` prints a download URL for a CI artifact (needs `gh`).
- `scripts/mac/capture-connected.mjs <ssh-host> <cdp-url> <capture-url> <out-dir>` — reuses
  the installed app's CDP connection for navigation, then takes real native window pixels
  through `scripts/mac/capture-server.py`. Start that loopback-only Python helper via
  `mac-computer` so it inherits Screen Recording permission. Forward ports 9444 (CDP)
  and 9445 (capture) over SSH; acquire/release the shared Mac lease. The script asserts
  the theme/content, records renderer errors and writes `<out-dir>/manifest.json`. An optional
  final comma-separated screen list narrows a regression capture; copied evidence keeps its build hash.
  Launch the installed app through LaunchServices in the GUI session, for example
  `open -na /Applications/Cortex.app --args --remote-debugging-port=9444`. A direct SSH
  binary launch produced unresponsive native appearance/fullscreen changes on the remote Mac;
  the same artifact launched through LaunchServices rendered dark menus and entered fullscreen.
  Inspect native menu pixels and accessibility state; an OS preference or filename is not proof.
  Stop the helper and close debug ports after verification.
  The [current full installed sweep](../evidence/mac/f9aca44/full/README.md) records 426
  native states at 1024×686, fourteen menus and accessibility-confirmed window actions
  on package `f9aca44`; it retains the failed initial minimize attempt separately.
- `scripts/dev-smoke.mjs` — quick local launch + screenshot of the built app.

The recorded `evidence/compare/report.json` contains **431 renders**: 426 registered
theme/states plus five interactions. **421** have reference shots (mean differing pixels
**0.04%**, maximum **0.78%**, pixelmatch threshold 0.15); **10** Settings renders have none
(Providers & models, Connection, Bot, Notifications, Privacy in both themes). The 13 other
reference PNGs are mascot review boards, not routed screens. These figures describe that
report, not a fresh run or acceptance of every interaction.

The delivered freeze has 410 registered screenshots. A full frozen comparison of the current
431 jobs consequently has 21 reference gaps: eight additional Settings variants in both themes
and five click-opened extras. Older screenshots are not used to fill those gaps.

The reference registry has 205 states, the app 213: Settings has one registered reference
state versus nine app variants. The other 204 states match. Existing clicked Appearance,
Shortcuts and Account sections have shots; Bot, Notifications and Privacy do not; Providers
and Connection still await approved designs. The source freeze `2026-10-02-7b388e2d9674`
replaces the changing live checkout as the comparison input. Home's final reviews cover their
verified/inherited scope; matching older PNGs does not prove alignment with the freeze. See
[`evidence/compare/reference-status.md`](../evidence/compare/reference-status.md).

## CI

`.github/workflows/ci.yml`: `checks` (lint, typecheck, test, audit:i18n) on the runner
named by `vars.CORTEX_LINUX_X64_RUNNER` (CodeBuild labels get `-<run_id>-<run_attempt>`
appended; fallback `ubuntu-latest`); `e2e` on `blacksmith-4vcpu-ubuntu-2404`; `macos` on
`blacksmith-6vcpu-macos-26` (build, E2E, unsigned arm64 package, packaged smoke). No
release, publish or signing jobs exist.

The workflow describes configured checks, not the latest result. Use the PR's run and
uploaded artifacts for revision-specific evidence; there is no Windows CI job.

## Acceptance gaps

- **Real providers:** CI bridge/UI inference tests use a local fake. The separate real
  inference evidence above uses a transparent test-only model alias. The SDK probe log
  records backend model metadata, not remote-mode authentication or remote sessions.
- **Visual coverage:** the 426-render sweep is preview smoke coverage. It does not prove
  pixel fidelity, 960×640 usability, native window chrome, all interactions or all locales.
  `evidence/compare/report.json` records comparisons and missing references; inspect the
  relevant screenshots, including native Mac captures, for the revision being accepted.
- **Missing product surfaces:** Space, standalone Scheduled and Plugins & skills still
  await designs in `/root/cortex-ui/DESIGN-REQUESTS.md`. Their absence from the registry
  means a complete registered-screen sweep cannot establish their acceptance.
- **Connection/auth:** mode selection and probes work at the code-path level; sessions
  still run locally. Remote auth and remote inference remain unimplemented
  ([connection-modes.md](./connection-modes.md)).
- **Locales:** all eight catalog/fixture sets exist. Key/placeholder parity does not prove
  translation quality or complete localized layout coverage ([i18n.md](./i18n.md)).
