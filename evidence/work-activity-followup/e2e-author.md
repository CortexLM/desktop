# Work Activity E2E — author handoff

- Source: `tests/e2e/work-activity.spec.ts` (new; 208 lines; six registered cases).
- Frozen SHA-256: `0166d765dd10a8c332da09563af8c2418ea995cfd2ee07bcdd19b7438a347851`.
- Contract: updated `/tmp/opencode/g1-work-activity-delivery.md` and `/tmp/opencode/g1-work-activity-contract-review.md`. Earlier completed outcomes remain during a newer unfinished turn.
- Owned writes: this report and the new test source only. No existing-test, product, docs, CI or prototype edits.
- Executed: `./node_modules/.bin/eslint tests/e2e/work-activity.spec.ts` — exit 0. Read-only source assertion confirms 208 lines and six cases. An initial counting assertion matched a regex `.test(` as a test declaration; corrected anchored counting passed with no application/test execution.
- No E2E, app, build, network, native or Mac execution by this author. Source is ready for the coordinator's existing-96df66c baseline, then unchanged rebuilt verification; no runtime-pass claim.

## Six cases

1–2. **Light/dark lifecycle:** two same-name Bots with orange/purple mascots; real success, streamed-error failure, API abort, actual manual routine run. Four rows ordered by completion, one per root/routine session. Only All/Errors classifications; exact Errors membership; disabled export; explicit recent-40 scope. Private prompt/output/error sentinels and persisted developer error copy absent from main Activity. Duplicate-name Bot filter selected by actual mascot, then exact row identity verified. Native Enter/pointer navigate to exact Work session, correct owner mascot. A running follow-up retains the previous full row before/after reload; streamed failure replaces it. Hard process kill during another follow-up preserves the earlier finished record on one restart using the same engine/renderer directories; a never-finished root supplies no row. Two 960×640 captures per theme; horizontal-fit assertions include an accepted long/unbroken title; 1440×900 pointer destination exercised afterward.
3. **Bounded selection:** one older finished root, 40 more recently updated roots, one in-window finished root. Completed child, ordinary Chat and empty-botID roots are ineligible. Observed initial history fan-out must be exactly those 40 eligible roots. Filtering an in-window Bot must not expand to its older out-of-window root. Renaming the older root promotes it into the window through real session events.
4. **Source failures:** session list, Bot list and a still-listed history each receive a real protocol 404; error/Retry appears, no empty or unavailable-Bot fiction. Retry restores the actual completed row. A held 404 history followed by failed authoritative session re-list likewise remains an error until accepted Retry.
5. **Missing attribution:** deleted Bot and never-created dangling botID both retain real completed sessions; Activity says Unavailable Bot, not Deleted Bot. Enter opens the exact Work task; composer uses neutral unavailable identity; no unrelated live Bot mascot/name is borrowed.
6. **Stale ownership:** a held real history arrives after filtering to another Bot and deleting its root; no resurrection. A held history during deferred preview navigation recovers after Back without committing preview or replacing the outgoing main element. Held history 404 after actual deletion yields authoritative recent-empty. Preview filtered fixture mounts without an engine mutation.

## Helpers / assumptions

- Uses existing isolated `launch`/`root`, `__bridgeFetch`, `ipcMain._invokeHandlers`, real `/api/sessions`, `/api/bots`, `/api/tasks`, prompt and abort routes. No database seeding or engine stubs.
- Existing fake-provider helpers have no held-stream control. A 14-line local Node HTTP provider supports completed/held/error SSE; a held response has emitted a real content chunk and remains open until abort, explicit finish or process death. No tools or filesystem actions are offered by the fixture response. Provider responses are the only simulated network dependency.
- Every IPC result comes from the real handler. Source refusals redirect GET to `/api/missing-activity-source`; held responses are actual serialized snapshots. Release awaits callback return, a real health round trip, two animation frames. Errors do not fabricate successful payloads.
- Primary row selector: `button.travail-act`, filtered by unique persisted session title, under the incumbent timeline.
- Filter trigger: exact English catalog `allBots`; options `role=menuitem`. Duplicate Bot option names may include `(1)`/`(2)`; selection uses its actual `.m-shape[fill=...]`, then verifies session identities. Bounded picker is tested only with Bots having a completed in-window row.
- Existing catalog All/Errors/export/loading/error/Retry names; seven new live keys imported from the actual English `work.json`. No new test IDs assumed.
- Destination: `#/work-task?id=<session.id>`, `.content-top .title`, `main .msg-bot-row .m-shape`, existing `composer-input` placeholder. Missing-owner color sentinel is orange, deliberately distinct from the neutral default purple.
- Cancelled-preview transition helper follows the established navigation tests: both route callbacks held, real history delivered under actual preview URL, Back, callbacks released newest first after the original live URL returns.
- Six cases total; four explicit images total. Locale/preview-comparison/native verification remains coordinator-owned.

Baseline failures on missing populated Activity rows/copy establish the old implementation gap. Preserve first failures if any collector bug is discovered; record exact correction and a new SHA before rebuilding or rerunning. The custom held/error SSE fixture and SIGKILL restart are authored source assumptions pending coordinator execution.
