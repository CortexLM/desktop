# @cortex/core — local agent engine

Runs in the Electron main process (Node 22+). No native addons: persistence is `node:sqlite`.

```
schema  (zod contracts, browser-safe)
  ├─ protocol  (Hono route table, validation, public error shape {error:{code,message}})
  ├─ core      (services below)  ──┐
  └─ client    (typed fetch client + SSE parser, browser-safe)
server = protocol routes bound to core handlers → `app.fetch(Request)`; desktop main bridges IPC to it.
```

## Services (`createCore({ dataDir, credentials, fetch?, catalogUrl? })`)

| Service | File | Notes |
| --- | --- | --- |
| `storage` | `storage.ts` | SQLite, WAL. Append-only `event` table (unique `(aggregate_id, seq)`) with transactional projections `session` / `message` / `part`, plus a JSON `doc` table for config domains. `":memory:"` for tests. |
| `bus` | `bus.ts` | Typed pub/sub. Durable events (`session.*`, `message.updated`, `part.updated`) are committed before listeners run; deltas, status, permission asks are live-only. |
| `catalog` | `catalog.ts` | models.dev `api.json`, network first with timeout, cached to `<dataDir>/cache/models.json`, cache fallback offline. `search`, `capabilities`. |
| `providers` | `provider.ts` | Enabled / base URL / key hint per provider. Keys live in the host `Credentials` (safeStorage) and never leave core. `npm` → `@ai-sdk/anthropic` · `openai` · `google` · `openai-compatible` (needs `api`); anything else is listed with `supported: false`. |
| `sessions` | `session.ts` | Prompt admission → `streamText` tool loop (max 25 steps) → deltas on the bus, full parts persisted at close. Capability gates (`llm.ts`): `model_no_image_input`, `model_no_pdf_input`, `context_window_exceeded`, tools only when `tool_call`, thinking options only when `reasoning`, `maxOutputTokens` clamped. Usage and cost from the catalog. |
| tools | `tool.ts` | `read write edit list glob grep bash webfetch todowrite task skill`. File tools only exist when the session has a directory; paths outside it ask `external_directory`. `task` spawns a child session with a subagent; children never get `task`. |
| `permissions` | `permission.ts` | Rules `(tool, pattern, allow/ask/deny)`, last match wins, default ask. Order: defaults (bash/write/edit ask) → user rules → agent → bot. A configured deny beats saved approvals. `always` is saved per project directory. `reject` stops the loop and cancels the session's other asks. |
| agents | `agent.ts` | `build`, `plan` (read-only), `general`, `explore` (subagents). |
| `skills` | `skill.ts` | `SKILL.md` frontmatter discovery: builtin → public → personal → project `.cortex/skills`; later shadows earlier. |
| `plugins` | `plugin.ts` | Directory with `package.json` + module exporting hooks `{ tools, "chat.params", "tool.execute.before", "tool.execute.after", event }`. Runs in-process with host privileges. |
| `mcp` | `mcp.ts` | `@modelcontextprotocol/sdk` stdio / streamable HTTP. Tools exposed as `<server>_<tool>`, `mcp.status` events. Complete connection configuration stays in the host's `mcpCredentials`; public reads return metadata only. |
| `bots` | `bot.ts` | Bot CRUD, memory (append/list/forget, bounded, injected as reference data), routines are scheduled tasks with `botID`. |
| `scheduler` | `scheduler.ts`, `cron.ts` | 5-field cron (no dependency), daily/weekly/once. `run` creates a session and prompts it; run history persisted. Missed occurrences are not backfilled; the timer is process-local. |
| `space`, `connection` | `space.ts`, `connection.ts` | Pages/sites/images + recents. Connection preferences; remote probes start with `GET {url}/readyz`. Optional main-only `remoteAuth` host supplies sanitized process-lifetime auth state; credentials never enter storage. |

## Guarantees and limits

- Deltas are not replayed; the complete text is in `part.updated` at close. Abort marks open tool calls as errored. A crash mid-stream loses the unflushed tail and leaves open tool parts as last written; nothing is re-run.
- Pending permission asks and running loops are in memory; a restart drops them.
- Scheduled run admission is synchronous: an active routine rejects duplicate starts. Interrupted
  prompts propagate cancellation; startup marks abandoned persisted runs failed. Deleted routine
  history is not recreated by late completion of its session.
- `bash` runs with the user's own rights. There is no sandbox.
- Error `message` strings are neutral English for developers; the UI maps `code` to copy.
- New untitled sessions use an empty title for localized renderer fallbacks. Existing titles remain intact; first admitted text supplies an automatic title only for new untitled sessions.
- Prompt admission reserves the session before asynchronous validation. Concurrent prompts receive `session_busy`; refusals release it. Abort/delete also cover pending admission, preventing late writes and inference.
