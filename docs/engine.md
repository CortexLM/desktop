# Engine

`@cortex/core`, created with `createCore(opts)` (`packages/core/src/index.ts`). Nothing
touches the network or starts timers until `start()`, which registers the computer-use
preset (when a driver was found), scans plugins, connects enabled MCP servers and starts
the scheduler tick. `close()` clears host authentication, stops the scheduler, aborts sessions,
closes MCP and storage. The optional `remoteAuth` host owns process-local credentials;
`ConnectionService` persists only mode/origin, deriving `signedIn` from sanitized host state.

Service table and file map: [`packages/core/README.md`](../packages/core/README.md).

## Internal remote sessions

`core.remoteSessions` uses the optional main-only `remoteChat` host; desktop supplies the
same owner as `remoteAuth`. It has no public route or renderer caller yet. Models, selected
effort, uploaded file IDs, local/remote message aliases and snapshots stay in process-only
Maps. No local provider, tool, permission or plugin executes from a remote event.

`models()` returns a catalogue and epoch; `create()` requires that current epoch/model.
`upload()` binds acknowledged file IDs to the process-only session. `prompt()` reserves one
turn across the binding and acknowledges a local user ID only after validated backend
headers. Refusal retains the caller's draft; uncertain admission retains the original
delivery handle. `resume()` reuses that handle; `detach()` closes delivery, not generation.
Repeated admission is idempotent. Numeric backend cursor ambiguity makes every resumed
projection explicitly partial, even if the backend eventually reports `stop`.

Remote views preserve reported text, reasoning, usage, notice copy and tool statuses.
Unknown usage is absent. Tool results, generated media, unsupported actions and structured
metadata receive explicit partial markers; raw payloads and actionable URLs never enter
the projection. Only confirmed `stop` with a complete projection sets successful completion.
The current SDK host always reports a limited projection because discarded frames are not
observable; its terminal results therefore never set `complete:true`. Backend `null` reasoning
usage remains unknown, not zero. Image-bearing conversation follow-ups refuse until the
backend preserves historical pixels, including when its current model supports vision.
Known-history reads retain the latest-100/text-and-attachments limitations and never replace
richer live reasoning or guess user-message aliases. Origin/account loss and `close()`
clear records immediately; late reads, events and settlements cannot restore them.
Recovery settles dangling tool statuses to interrupted. Concurrent session uploads refuse;
detachment rechecks ownership after synchronous change notifications.

`remote.session.changed` / `remote.session.removed` carry only `{sessionID,epoch}`, tagged
remote for live bus delivery. Existing local session routes keep their original execution
and storage behavior in every connection mode. See [connection-modes.md](connection-modes.md).

## Storage and events

- `node:sqlite`, WAL. Append-only `event` table with transactional projections `session`,
  `message`, `part`; a JSON `doc` table holds config (providers, approvals, connection,
  bots, projects, tasks, space, settings).
- The bus (`bus.ts`) commits durable events (`session.*`, `message.updated`,
  `part.updated`, `project.deleted`) before listeners run. `part.delta`, `session.status`, `permission.*`,
  `mcp.status`, `task.run`, `settings.changed` are live-only.
- Internal `publish(type, properties, "remote")` delivers live events without SQLite writes
  or local plugin callbacks. The source tag is a listener argument, never serialized into
  an event. Existing calls default to local. This is a remote-transport prerequisite;
  current prompt routes still use local sessions.
- `GET /api/events` is the SSE stream of the bus. The renderer keeps one subscription
  (`packages/app/src/state/live.ts`).
- New record IDs retain the prefix/time/counter format with a 64-bit Web Crypto random
  suffix; old IDs remain valid. They identify records, not authentication sessions.

## Sessions

The renderer's `useMessages` subscribes before reading stored history, merging that snapshot
with live message/part updates by ID. A late read cannot erase a newer turn or restore a
deleted session. Completed parts/metadata remain authoritative over queued deltas or stale
empty snapshots. Session ownership covers both messages and status. SQLite stores text at
part boundaries; a midstream mount cannot recover earlier live-only tokens until the full
`part.updated` arrives.
The live Bot page is keyed by its route Bot ID, resetting selected-session/draft/query
state at that owner boundary before the new Bot's history resolves.
Missing Chat reads use the existing localized missing-page copy. Code's settled badge
derives failure from the latest assistant's persisted error as well as live status;
the engine's final idle event therefore cannot relabel a failed result Ready.

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

## Saved local image attachments

Local Chat FileParts retain inline base64/data URLs in both the SQLite journal and part
projection. The Files image route reads the existing session and full history, selecting
exact session/message/part IDs and requiring `kind=chat`. It never dereferences arbitrary
URLs or local filesystem paths. No additional engine route, file store or credential
access is involved; viewing works without a current provider or account.

`raster.ts` accepts one inline source, standard canonical padded/unpadded base64 and bare
PNG/JPEG/WebP MIME tokens. Signature/container framing and positive dimensions precede
native decoding. APNG/animated WebP, ambiguous sources, unsupported or malformed headers
are refused. Inclusive viewer ceilings: 50,000,000 base64-decoded file bytes, 40,000,000
encoded pixels and 32,768 per dimension. File bytes remain compressed image data; complete
history IPC, cumulative thumbnails and decoder overhead are not memory-bounded by this gate.
CRC/compressed pixel correctness still requires native decoding. Displayed dimensions may
differ from encoded dimensions through native orientation/density handling.

Saved Chat thumbnails use the same preflight. Open preserves dirty/refused text, files,
pending reads/submissions and header edits by refusing departure with accessible feedback.
Accepted deferred Open latches edits until departure; canceled Back restores interaction.
One pending rename prevents re-entry until its response settles. The filename has its
own bounded keyboard-scrollable header, preserving image and controls for long names.
Live image loading follows the complete committed tuple and independently invalidates on
actual navigation. Deletion tombstones and part updates clear the displayed source, metadata
and download control; stale GET/decode responses cannot restore them. Canceled departure
re-reads the live owner. Source 404 is unavailable; other reads offer Retry.
Sidebar/focus/theme rerenders preserve that same tuple's image, zoom and pending download.

Download freshly revalidates the session, then dispatches original validated Blob bytes
under a bounded MIME-derived basename. Embedded EXIF/GPS/XMP remains; this is not file
sanitization. Its independent URL expires after one minute to allow browser handoff;
there is no renderer completion acknowledgement or success toast. Deletion is not atomic
with dispatch and cannot reliably cancel an already-dispatched download. The live-only
event stream may miss deletions; re-entry/download revalidation bounds that limitation.
Session deletion removes projections, not journal bytes: no secure-erasure claim.
Standalone durable import, file inventory, remote hydration, other format readers and
live image editing/sharing/Ask remain unfinished.

## Local Projects

`GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id` persist local Project
documents in the existing SQLite store. Names are trimmed to 1–48 characters; instructions
are limited to 4000. Icon/color values are the existing creation-form choices. IDs and
timestamps are engine-owned; duplicate names identify distinct projects.

Only root Chat sessions can hold `projectID`. Session creation accepts it; session PATCH
accepts an ID or `null` to detach; session listing accepts a `projectID` filter. Unknown
projects refuse the write. Membership changes and project deletion refuse while a linked
root or descendant is running, including asynchronous prompt admission. Children resolve
their root's membership. Project instructions are snapshotted before asynchronous admission,
included in the model's system context and token budget; later edits affect later turns.
Optional `expectedProjectID` on a prompt (ID or null) verifies the caller's captured context
before admission. A move/deletion mismatch refuses without persisting a message or invoking
the provider; callers omitting the field retain the existing admission contract.

Deletion preserves conversations: a single durable `project.deleted` event atomically
deletes the Project document and removes linked sessions' `projectID` in the same
transaction. Transcripts, models and session timestamps remain intact. Failed storage
writes roll back the event and all projections. Create/update publish live `project.changed`
after the document write; the renderer refreshes both project and membership lists on deletion.

Existing Projects/Project, Library, Search and sidebar surfaces read real records. Project
New chat carries its ID to Home; refused initial sends retain the draft and reuse the created
session. Chat's existing Move selector assigns or detaches by ID. Instructions clear their
editor only after an accepted unchanged draft; newer edits and refused writes remain editable.
Detail ownership follows the committed Project ID, so late responses cannot affect another
project. History's project filter lists only that project's root chats.

Project file storage, sharing, assigned Bot, archive and a metadata-editing surface remain
unfinished. The current UI reports unavailable actions; it does not seed collaborators,
files or descriptions. Folder-scoped tool permissions and skills remain separate from Projects.

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

### Saved Bot memory preference

`GET/PUT /api/settings` reads/writes the strict `{memoryEnabled:boolean}` runtime
document in SQLite. Missing documents default to true; malformed documents report an
internal error. PUT accepts `initializeOnly:true` for an atomic, absent-only legacy
import; an existing stored setting wins. Refused writes preserve the setting and notes.
Accepted changes publish `settings.changed` so Memory and Settings → Privacy refresh
the same engine preference.

Paused memory stops injecting saved Bot notes into future admitted turns. Each Bot keeps
its own notes; persona, tools and permissions still apply. The context is snapshotted
before asynchronous prompt admission and counted in input/output token budgets. A toggle
does not alter an admitted turn, saved notes or existing conversation history, which may
already contain information from earlier notes. Manual Add, review, export and Forget
remain available while paused. Ordinary Chat receives no Bot notes; automatic learning
and a personal cross-Chat memory store remain unimplemented.

The renderer imports the old literal `cortex.pref.privacy.memory=false` only while the
engine setting is absent, then clears that captured legacy value after acceptance.
Pending/refused import gates live screen controls with loading/Retry. Preview never
imports it. This renderer-only preference cannot affect a scheduled admission occurring
before the renderer starts; previously persisted engine settings already govern startup.
The System Memory list still manages the first listed Bot; each Bot's settings exposes
its own saved notes. Neither list ownership nor the global toggle merges Bot memories.

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
  Activity separately selects up to 40 root Bot conversations by updated time and ID, then
  the last finished assistant turn in each stored history. Its historical outcome persists
  during a follow-up; missing completion after process loss creates no new outcome.
  Aborted turns read Interrupted, other errors Failed, no error Completed. These labels
  describe turn termination rather than task/business fulfillment. Routine-created Bot
  roots appear once; child, Chat and Code sessions are excluded. Bot/type filters apply
  inside that same bounded selection. Metadata uses exact Bot IDs; unavailable identities
  remain neutral on Activity and the linked Work transcript. Only titles/outcomes/times
  appear in the feed, never transcript/tool content or raw error messages.
  Session/Bot/history failures show Retry. History 404 requires an authoritative re-list
  before omission; deletion invalidates pending snapshots. Lists remain unpaginated and
  selected transcripts are read in full: 40 limits request fan-out, not payload bytes.
  Activity export and a complete journal/read/handled/notification lifecycle remain absent.
  Global Search reads saved Project names/instructions, Bot names/personas and session titles through list routes.
  Matching is case/accent-insensitive; opening a Bot carries its exact ID. Grouped keyboard navigation
  follows visual order. Any source-list failure replaces results with retryable, localized error copy;
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
