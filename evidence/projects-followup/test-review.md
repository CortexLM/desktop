# Projects discovery/Electron tests — final source disposition

**APPROVED: all five prior findings closed in the actual source. No remaining blocker in this bounded review.**
Stable readback: 2026-10-03 14:27:14–14:29:00 UTC; HEAD `0597848cdbdec362e1441b44c67bf74c525feefa`.
Supersedes `/tmp/opencode/g1-projects-discovery-test-review.md`; original preserved, SHA-256 `6a2edd9cb80d16d034ff41aa8752f1db9976e3d9a8e37b13c98d6120f5e435a9`.
Scope remains three discovery files plus `tests/e2e/projects.spec.ts`; current AGENTS/rule delta and adopted contract considered. Other owners' engine/project-screen implementation is outside this disposition.

## Exact source pins
- `packages/app/src/shell/shell.tsx`: `96cd8f48c55e4f02849ca83939875c5976267743d7b1294dd429176fc548b9e2` (316 lines).
- `packages/app/src/screens/system/search.tsx`: `3d1080ab1c3e79d61e2e50f51ef1cd49497b80a6276fa879d10acd70eea0269b` (219 lines, unchanged from prior review).
- `packages/app/src/screens/chat/pages.tsx`: `6575d12d2393b28987b6b43643e185b97a853c5d0986f44d17de985009e3cb0b` (185 lines, unchanged).
- `tests/e2e/projects.spec.ts`: `a2d30f707d733e1dff8302404f3b2f01860da7fcf491bf75dc031058c09d8c9d` (363 lines).

## Finding closure
1. **Late-result settlement:** `:253–272` forwards each real IPC request once, snapshots held/delivered replies with `structuredClone`, returns the original reply unchanged. `settle()` waits exact delivered equality, a real engine GET, then microtask/two animation frames before B assertions at `:298–307`. Each arm clears prior receipts; no unresolved immediate-pre-release-pass finding remains for production builds.
2. **History exclusion:** `:180–184` waits A's ready `Your history is empty.` copy before zero rows, then B's positive title. Loading/error can no longer satisfy the negative check.
3. **Restart capture/readiness:** `:212–221` verifies one remaining card/name, no main loading/alert, exact HTML theme and 1440×900 viewport before the existing image. `:92–94` installs reopened-window page/console watchers before bridge readiness; case3 also checks both error streams.
4. **Sidebar recovery:** `shell.tsx:250–251` adds one shared session loading indicator and error/Retry path using `sessions.reload`; root Chat membership, ID keys and inert native-button collapsers remain intact.
5. **Actual refusal:** `:116–136` records the unchanged real prompt reply and requires exactly one response, HTTP422/`provider_disabled`, zero stored messages and zero upstream requests. Retry reuses the same session. Current protocol maps `provider_disabled` to422 and `invalid_request` to400; neither expected status is stale.

## Additional checks
- `completed()` now checks successful persisted assistants plus rendered answer count/text. Fixture assertions use system-role content and exactly three upstream requests; all eight planned positive captures remain confined to the two themed cases.
- Case3 retains synchronous duplicate-save guard, newer draft, late A write/read with B unaffected, Back/Forward, one forbidden-field `Request.text` mutation and actual400/`invalid_request`, then recovery.
- Library refusal persists until explicit restoration/Retry; it no longer depends on which subscription performs the first GET. Nested teardown guarantees later restore/close/removal attempts when an earlier cleanup throws; app termination disposes remaining process-local hooks.
- Exactly three Projects cases; two process restarts per themed case reuse engine/renderer directories. Planned captures remain six960×640 plus two1440×900. No new screenshot campaign or original E2E assertion weakening appears in the reviewed changes.
- Search/History/Library discovery approval remains: exact IDs, duplicate-name separation, category-ordered keyboard mapping, committed params, existing clear controls and preview isolation. Registry/component inventory source is unchanged.

## Execution boundary
- One read of `production-targeted.log:1–3` establishes **16 selected cases**: Projects3 + missing Chat2 + live-state4 + remote-auth7. This is a registration count, not a result claim.
- Coordinator reports the earlier development-mode116-case run as109 pass/seven failures, including three Projects passes; retain that negative scope and initial Library fault separately. Correct production-build/StrictMode scope is required for one-shot late-read gates; development duplicate effects do not justify weakening existing assertions.
- Source approval clears this review's commit blocker only. Runtime/full-suite/package/native results remain coordinator-owned; none was rerun or independently accepted here.

Only this final report written. Read-only source/diff/hash/status-mapping/log-header checks; no tests/build/network/CI/Mac, captures, source edits, commits or delegation.
