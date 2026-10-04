# Next local delivery: read-only Work Activity

Source pin: `96df66ce727c42ddf647b2dcb4eeeff04fda4927` (`96df66c`). Inspected application sources match this commit; concurrent evidence changes excluded.
Decision: **YES — implement a bounded recent Bot-outcome view in existing `#/activity`.** Full Inbox/notification lifecycle is a separate contract, not implicit in this scope.
Source-only assessment; AGENTS/all rules read. No implementation, tests, builds, network, CI or device operations.

## Current behavior, exact routes
- `packages/app/src/screens/work/index.tsx:12–15` registers Inbox, Approvals, Activity, Notifications directly; no redirects. No separate GlobalActivity component/route found.
- `packages/app/src/shell/shell.tsx:139` routes the global Activity rail item to the same `activity`; Work history button does likewise (`screens/work/home.tsx:125–129`).
- `packages/app/src/screens/work/desk.tsx:21–43`: live Inbox seeds `[]`, always renders “All handled”; it never reads pending permissions. That copy can contradict real pending asks (`locales/en/work.json:221–222`).
- `desk.tsx:231–275`: live Activity hardcodes empty data/empty-state; Bot/type filters are preview-only, export disabled. It currently reads no outcome/history source.
- `desk.tsx:282–335`: live Notifications has an empty feed; preview read IDs and local settings switches provide no durable notification preferences/read ledger.
- `desk.tsx:83–130`: Approvals already reads live permissions/sessions/Bots, supports real replies, and shows Retry on permission-list failure. Do not duplicate its mutation flow.

## Existing design reuse
- Frozen incumbent: `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674/src/screens/lot-travail.tsx:721–757`; Inbox `:554–596`. Freeze fingerprint is recorded in `freeze.json:3`.
- Reuse the already-ported Activity header, Bot picker, chips, day groups, timeline rows, skeleton/filter-empty states (`desk.tsx:248–274`, `work.css:249–257`). No changing prototype import.
- Live filters: All + Errors, exact Bot IDs; existing email/CRM/ticket/browsing categories have no trustworthy event classification. Preview variants retain their recorded content/geometry.
- Live row opens exact `work-task?id=<sessionID>` using `useGo`; this is already a live transcript route (`home.tsx:422–468`). Use a native keyboard-operable button/link, not click-only `<li>`.

## Engine facts and limits
- `packages/schema/src/index.ts:158–184`: Session has stable ID/kind/Bot/parent/title and created/updated times; Message has ID, created/completed times and optional typed error. No durable running flag or unread state.
- `packages/core/src/session.ts:174–205,320–330,465–470`: admission refusals precede prompt persistence; accepted turns persist assistant completion/error. Later idle status does not erase persisted failure. Never infer success from idle or session updated time.
- `packages/core/src/storage.ts:5–25,79–85,122–126`: SQLite event rows have timestamps, but internal `events()` omits time and has no public history route. Durable types are session/message/part updates/deletions plus Project deletion.
- `packages/schema/src/index.ts:545–565`, `core/src/bus.ts:12–22`, `server/src/index.ts:9–41`: bus envelopes lack generic event ID/time; `/api/events` is live SSE, not replay. Settings, permission/status and task.run events themselves are not journaled.
- `packages/core/src/scheduler.ts:8–28,70–99,110–121`: TaskRun documents independently persist ID/taskID/sessionID/status/start/end/error; latest 50 exposed per task, not global pagination or retention pruning. Startup recovers abandoned runs as error/aborted.
- `scheduler.ts:56–60`: task deletion deletes run documents but retains its sessions. `core/src/bot.ts:44–49`: Bot deletion removes routines/notes, retains sessions. Historical Bot name/persona is not snapshotted for this feed.
- `packages/core/src/permission.ts:48–108`: asks are process-local, disappear on abort/reply/restart; saved approvals are permission rules, not durable notification history/read receipts.
- Public reads already exist: `protocol/src/index.ts:62–74,103–119`; bindings `server/src/index.ts:64–82,123–145`; typed `client/src/index.ts:154–168,202–222`. No new route needed for the scoped view.

## Minimal proposed product contract
- Label scope explicitly as recent Bot conversation outcomes, not a complete action/audit journal; one latest-outcome row per selected root `kind:"bot"` session. Ordinary Chat/Code and child sessions stay outside this scope.
- Fetch `api.sessions.list({kind:"bot"})` + `api.bots.list()`; filter roots in renderer (`parentID:null` is not accepted by the public query), stable-sort updated time/ID and inspect at most 40 recent roots.
- Read each selected root via `api.sessions.messages(id)`, derive only from its final message. Require final assistant + `time.completed`; no error = completed, error `aborted` = interrupted, other error = failed. Omit trailing user/incomplete assistant rows from this outcomes-only view; never label them Done.
- A crash-incomplete ordinary Bot turn has no provable terminal timestamp; do not invent failure or perpetual Running. Admission refusal with no assistant also creates no fabricated outcome row.
- Row identity uses actual session/message IDs; chronology uses assistant `time.completed`, descending then stable IDs. Localized day/time groups use `common.tsx:47–54`; metadata edits must not retimestamp outcomes.
- Use current Bot metadata by exact `botID`, including duplicate-name-safe filters. Missing/deleted Bot gets neutral localized attribution; never borrow the first Bot’s name/mascot (`common.tsx:81–89` fallback needs care).
- Routine-created Bot sessions already qualify once: do not also append their TaskRun entries. Pre-admission/recovered run failures lacking completed assistants remain visible in existing Automations history, outside this first scope.
- If a later routine-inclusive feed is required, join run.sessionID and suppress duplicate session outcomes; task deletion/history truncation loses that join, so a permanent routine classification needs a persisted origin contract first.
- Render only stored session title, Bot display metadata, localized outcome and completion time. Do not show transcript text, tool arguments/output, permission input, raw error.message, model/vendor failures or full event payloads. Engine-code details use existing neutral localized mappings only.
- Failed session/Bot/history reads show error + Retry, not empty/success. A concurrent history 404 drops that exact deleted session after authoritative refresh; stale earlier reads cannot resurrect it or replace a newer filter/owner.
- Mount/subscription precedes snapshot load; refresh on session changes/deletion and terminal message.updated, not every token/part. Use sequence/owner invalidation. Bot/task CRUD lack change events; remount/explicit refresh rereads metadata; no claimed always-live cross-window metadata guarantee.
- `state/live.ts:18–27` supplies basic request sequencing, not full unmount/dependency snapshot ownership. Keep owner handling local to Activity; no generic feed framework. Separate live/preview component ownership, preserving navigation cancellation behavior.
- State changes are read-only: no mark-read/handled/archive/remind/retry-execution/export behavior implied. Existing disabled export stays unavailable. Display the 40-root scope honestly; full transcripts remain unbounded per root despite bounded fan-out.
- `ponytail:` ceiling should name recent-root/full-history reads; add paginated server summary only when larger histories require it. Do not expose raw SQLite events merely to fill the view.

## Deferred contracts / implementation footprint
- Full Inbox needs stable notification/source IDs, explicit urgency/reason, durable read/handled/archive/snooze acknowledgements, deletion/retry ownership, retention and mutation errors. Pending approvals alone cannot establish “all handled,” success notifications or unseen failures.
- An independent future Inbox correction can show real pending decisions plus existing Approvals navigation; it still cannot ship fake archive/mark-all/reminders. No frontend-only ledger or fixture completion.
- Minimal functional surface: `packages/app/src/screens/work/desk.tsx` + one focused `tests/e2e/work-activity.spec.ts`; optional local pure derivation file only if it simplifies meaningful tests. Reuse existing kit/CSS; no new core/schema/protocol/client service.
- Required same-change copy/docs: all eight `packages/i18n/locales/*/work.json` for exact scope/interrupted/missing-Bot/loading/error copy as needed; `AGENTS.md`, `.rules/06-product.md`, `docs/engine.md`, `docs/testing.md` for live scope/limits.
- Verification before acceptance: persisted success/failure/abort and fresh-process reload; follow-up user/incomplete assistant never Done; Bot duplicate names/deletion; exact session links; session deletion/late reads; real failed-source Retry; filter/40-root limits; no raw-error/tool-content leakage; preview isolation; 960×640/light+dark/keyboard and incumbent frozen geometry.
- Keep this independent of pending remote work and current Memory proof collection. Existing Memory/Projects CI/native results establish no acceptance for Activity.
