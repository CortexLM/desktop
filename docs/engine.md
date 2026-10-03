# Engine

`@cortex/core`, created with `createCore(opts)` (`packages/core/src/index.ts`). Nothing
touches the network or starts timers until `start()`, which registers the computer-use
preset (when a driver was found), scans plugins, connects enabled MCP servers and starts
the scheduler tick. `close()` clears host authentication, stops the scheduler, aborts sessions,
closes MCP and storage. The optional `remoteAuth` host owns process-local credentials;
`ConnectionService` persists only mode/origin, deriving `signedIn` from sanitized host state.

Service table and file map: [`packages/core/README.md`](../packages/core/README.md).

## Storage and events

- `node:sqlite`, WAL. Append-only `event` table with transactional projections `session`,
  `message`, `part`; a JSON `doc` table holds config (providers, approvals, connection,
  bots, tasks, space, settings).
- The bus (`bus.ts`) commits durable events (`session.*`, `message.updated`,
  `part.updated`) before listeners run. `part.delta`, `session.status`, `permission.*`,
  `mcp.status`, `task.run` are live-only.
- `GET /api/events` is the SSE stream of the bus. The renderer keeps one subscription
  (`packages/app/src/state/live.ts`).
- New record IDs retain the prefix/time/counter format with a 64-bit Web Crypto random
  suffix; old IDs remain valid. They identify records, not authentication sessions.

## Sessions

`POST /api/sessions` (`kind`: `chat` | `code` | `bot`, `model`, optional `agent`,
`directory`) then `POST /api/sessions/:id/prompt`. The loop (`session.ts`) calls
`streamText` with tools, up to 25 steps, streams deltas on the bus and persists full parts
at close. `POST /api/sessions/:id/abort` stops it and marks open tool calls errored.
Untitled sessions store an empty title; the renderer supplies localized fallback copy.
Existing titles stay data, including legacy English defaults whose origin cannot be distinguished
from user-authored titles. They can be renamed through the UI.
The first admitted text prompt still sets an automatic title; capability refusals do not
persist messages or change it.
Admission reserves the session before asynchronous catalog/key lookup. A concurrent prompt
receives `session_busy`; validation failures release the reservation. Abort and deletion wait
for pending admission to settle and prevent it from writing a late prompt or starting inference.
Parent deletion cancels its own admission before waiting for descendants; synchronous model-update
listeners can also cancel before the first message is persisted. Capability checks include every
historical user attachment that will be replayed, not just newly attached files.

Capability gates (`llm.ts`), from the catalog entry of the model:

| Gate | Result |
| --- | --- |
| image attachment, no image input | `model_no_image_input` |
| PDF attachment, no PDF input | `model_no_pdf_input` |
| estimated input > context window | `context_window_exceeded` |
| model without `tool_call` | called without tools |
| model with `reasoning` | provider thinking options set (Anthropic budget, OpenAI effort, …) |
| always | `maxOutputTokens` clamped to the model and remaining context |

## Agents and tools

Agents (`agent.ts`): `build` (default), `plan` (read-only; write/edit/bash denied),
`general` and `explore` (subagents). Tools (`tool.ts`): `read write edit list glob grep
bash webfetch todowrite task skill`. File tools exist only when the session has a
`directory`; paths outside it ask `external_directory`. `task` spawns a child session;
children never get `task`. MCP tools are exposed as `<server>_<tool>` and always ask.

## Permissions

Rules `(tool, pattern, allow|ask|deny)`, last match wins, default ask. Order: defaults
(`bash`, `write`, `edit`, `external_directory` ask) → user rules
(`/api/permissions/rules`) → agent → bot. A configured deny beats saved approvals.
Replies: `once`, `always` (saved per project directory), `reject` (stops the loop and
cancels the session's other pending asks). Computer-use input tools never save `always`
([computer-use.md](./computer-use.md)).
The live approval list distinguishes read failure from an empty list and offers Retry;
a failed read cannot claim outstanding requests were handled.
Permission views also refresh when sessions change status or are deleted, removing cancelled
asks even when no explicit permission reply was sent.

## Bots, scheduler, space, connection

- Bots (`bot.ts`): persona, mascot, permission and tool filters, bounded memory injected
  as reference data, routines = scheduled tasks with `botID`.
  Bot Studio leaves its editor only after an accepted save; rejected writes retain the
  draft and confirmation dialog. Pending saves lock editing and duplicate submissions.
  Memory Add likewise keeps its exact editable draft on refusal and clears it only after
  persistence. Bot-wide deletion waits for every request to settle, refreshes survivors and
  reports success only if every delete succeeded. Single-entry Bot/System deletion reports
  failures and keeps pending/refused rows; pending/stale-owner responses cannot overwrite newer UI.
  Preview Bot appearance, activity and unsaved studio drafts share renderer-only state
  during navigation. They reset on reload, locale changes or leaving preview; they never
  create or update engine Bots. Preview onboarding saves into that same temporary state.
  Onboarding completion navigation is cancelled if the user leaves before its display delay ends.
  Work preview activity temporarily replaces the sidebar status; leaving the task restores prior
  activity without resuming an explicitly paused Bot. No engine Bot or session is written.
  Live Work completion comes from the latest persisted assistant message, not an idle process.
  Refused/empty and failed/interrupted tasks stay outside Done; transcript failures remain visible
  after reload. The board currently reads each root Bot session's history until a bulk summary exists.
  Global Search reads saved Bot names/personas and session titles through the existing list routes.
  Matching is case/accent-insensitive; opening a Bot carries its exact ID. Grouped keyboard navigation
  follows visual order. Either list failure replaces results with retryable, localized error copy;
  recently opened items remain session-only. This is not a transcript/full-text index.
- Scheduler (`scheduler.ts`, `cron.ts`): `cron` (5-field), `daily`, `weekly`, `once`. A
  run creates a session and prompts it; history persisted. Missed runs are not
  backfilled; the timer lives only while the app runs. Work → Automations and bot routines
  use these routes; the standalone Scheduled screen still awaits design.
  Manual run admission rejects an already-running routine before creating a second session.
  Interrupted runs retain an `aborted` error instead of claiming success; running history stays
  Running until a completed outcome arrives. Prompt-and-wait callers receive cancellation errors.
  Startup marks persisted, no-longer-active Running records interrupted; it does not replay them.
  Deleting a routine removes its history; an already-running session may finish but cannot recreate it.
  Work task options can prefill the existing routine editor from a root Bot session. It uses the
  first user request's non-synthetic text, the source Bot, model, agent and directory; follow-ups
  are not concatenated. The name is capped to the editor's 60-character limit without renaming
  the session. Create is explicit, Cancel writes nothing, pending saves reject duplicate clicks.
  File-bearing histories, missing sources and deleted source Bots refuse conversion. Source files
  are checked again before Create; refused saves retain the editable draft. Reassigning a new
  routine to another Bot uses that Bot's model without inheriting the source agent/directory.
  Editing with the same assigned Bot preserves the persisted model, agent and directory.
  Create stays disabled until the selected Bot is available; a failed Bot list offers Retry while
  retaining the editable draft.
- Space (`space.ts`): pages, sites, images and recents. No screen yet.
- Connection (`connection.ts`): saved mode, remote probes and an optional main-only auth host.
  Email-code sign-in is process-local; chat sessions still use local provider settings in every
  mode. Remote inference is not wired
  ([connection-modes.md](./connection-modes.md)).

## Skills, plugins, MCP

- Skills: `SKILL.md` frontmatter discovery, builtin → public → personal → project
  `.cortex/skills`; later shadows earlier. `/api/skills`. Desktop configures builtin and
  personal directories; `skills/summarize/SKILL.md` ships as a builtin, enabled by default.
  Core supports a public directory but desktop does not configure one.
- Frontmatter supports single-line `key: value` entries, empty values and paired quotes;
  malformed lines are ignored. Large malformed whitespace input has a regression check.
- Plugins: a directory with `package.json` and a module exporting hooks (`tools`,
  `chat.params`, `tool.execute.before`, `tool.execute.after`, `event`). In-process, host
  privileges. `/api/plugins`.
- MCP (`mcp.ts`): stdio and streamable HTTP via `@modelcontextprotocol/sdk`. `/api/mcp`.
  `POST` accepts complete connection configuration; every response exposes metadata only.
  Command/arguments/environment/URL/headers live in the host's separate credential store;
  SQLite stores an opaque reference. Remote URLs must be HTTP(S); redirects are refused so custom
  credential headers cannot be forwarded to another origin. Legacy inline configurations
  are immediately redacted on reads and migrated at startup before connection; failed credential
  writes preserve the original document and report failed status. Migration does not erase old
  SQLite pages, WAL history or external backups. Disabled records are migrated without execution.
  Replacement persists a new credential record before switching the SQLite reference. Failed
  metadata writes preserve the prior connection; concurrent replacement/removal rejects stale saves.
  Removal/disable invalidates pending connections before waiting for transport shutdown; stale
  shutdown/connection results cannot override a newer saved configuration or status.
  Superseded credential cleanup is best effort;
  a failed cleanup can retain an unreferenced credential, never a public value.

Space, standalone Scheduled and Plugins & skills have candidate designs but still lack approved
source/state integration in `/root/cortex-ui/DESIGN-REQUESTS.md`. Engine routes and the builtin skill do not provide
those screens; the computer-use preset cannot be enabled from the UI yet.

## Limits

- Deltas are not replayed; a crash mid-stream loses the unflushed tail.
- Pending asks and running loops are in memory; a restart drops them.
- `bash` has no sandbox.
- `webfetch` strips markup for model text; it is not an HTML sanitizer. Tool/model text
  must remain escaped if displayed. Removed script/style blocks become spaces so adjacent
  text and tag fragments do not concatenate.
- Error `message` is developer English; the UI maps `code` ([`.rules/02-errors.md`](../.rules/02-errors.md)).
