# Engine

`@cortex/core`, created with `createCore(opts)` (`packages/core/src/index.ts`). Nothing
touches the network or starts timers until `start()`, which registers the computer-use
preset (when a driver was found), scans plugins, connects enabled MCP servers and starts
the scheduler tick. `close()` stops the scheduler, aborts sessions, closes MCP and storage.

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

## Bots, scheduler, space, connection

- Bots (`bot.ts`): persona, mascot, permission and tool filters, bounded memory injected
  as reference data, routines = scheduled tasks with `botID`.
- Scheduler (`scheduler.ts`, `cron.ts`): `cron` (5-field), `daily`, `weekly`, `once`. A
  run creates a session and prompts it; history persisted. Missed runs are not
  backfilled; the timer lives only while the app runs. Work → Automations and bot routines
  use these routes; the standalone Scheduled screen still awaits design.
- Space (`space.ts`): pages, sites, images and recents. No screen yet.
- Connection (`connection.ts`): saved mode and remote probes only. Sessions still use local
  provider settings in every mode; remote auth/inference is not wired
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

Space, standalone Scheduled and Plugins & skills designs remain absent in
`/root/cortex-ui/DESIGN-REQUESTS.md`. Engine routes and the builtin skill do not provide
those screens; the computer-use preset cannot be enabled from the UI yet.

## Limits

- Deltas are not replayed; a crash mid-stream loses the unflushed tail.
- Pending asks and running loops are in memory; a restart drops them.
- `bash` has no sandbox.
- `webfetch` strips markup for model text; it is not an HTML sanitizer. Tool/model text
  must remain escaped if displayed. Removed script/style blocks become spaces so adjacent
  text and tag fragments do not concatenate.
- Error `message` is developer English; the UI maps `code` ([`.rules/02-errors.md`](../.rules/02-errors.md)).
