# Productivity draft: local desktop contract map

**Draft reference; independent review pending. Direct import has contract blockers.** Scope: nine routes, 72 receipt states. Mapping uses the current desktop working tree, HEAD `99249111df0db5a1e086d9f5783afc9ad27b3dfa`, and existing local schema/protocol/core only. Remote G4 contracts and G2 auth/upload schema blob `d6d46014` supply no local capability here.

## Later local MCP contract correction

The table below is the historical readback. Current correction moves complete MCP configuration
to main's separate credential store; SQLite keeps metadata/reference, every route returns only
name/type/enabled/status/tools/error. This removes the raw env/header/argument/URL return/storage
conflict. Legacy migration preserves data on failed writes; it does not erase prior database pages
or backups. POST still upserts and can connect; it is not a validation-only operation. Save-versus-
connect, independent design integration and the remaining lifecycle/consent contracts stay open.
See [engine contract](../../docs/engine.md#skills-plugins-mcp).

## Evidence attestation

Read `/root/cortex-ui/review/productivity-delivery.md`, `/tmp/opencode/productivity/results.json`, `/tmp/opencode/productivity/build-source.json`. Hash verification: **2026-10-02T16:42:52Z**.

- **Owned source:** receipt and build manifest agree on both hashes. Current CSS matches; current TSX **drifted**. Drift cause/extent not established by hashing.
- **Captures:** **288/288 PNG SHA-256 values match** under `/tmp/opencode/productivity/shots/`; 288 distinct receipt combinations, exactly 72 states × light/dark × 1440/1024, height 900; no missing/extra combinations. Receipt timestamp `2026-10-02T13:29:50.735Z`; recorded `errors` and `externalRequests` are empty. These stored captures bind the earlier receipt source, not the changed TSX. Hash verification is not a fresh visual/interaction review.
- **Build:** manifest timestamp `2026-10-02T13:22:52.846Z`; explicitly excludes `src/screens/lot-public.tsx`. Delivery reports isolated Vite success and zero Productivity TypeScript diagnostics. Its earlier full-build pass predates final integration diagnostics: missing `lot-public.css`, unused `lot-travail.tsx:23` `botId`. **No current full integrated-build attestation follows from this receipt.** Other manifest inputs/output bundles were not rehashed.
- **This review:** static contract inspection and hash checks only. No build/test execution. Native CI, navigation/toast verification remain coordinator-owned. Only this report was written.

Owned-source hashes relative to `/root/cortex-ui`:

```text
src/screens/lot-productivity.tsx
  receipt/build: 18ac1eadad5106ff6d63cbd5b3125381924e04f3aa37b3a29aa1044189322e58
  current:       79f725c9d1eb3dabc9bb1ec626a03dd5901b6670e5bc6b02ef355170c0b4b23a
src/screens/lot-productivity.css
  all three:     1ebae214a4d46892981c22d52cdd4a5f4deec1d4f2d9dd6682629fc970987b5d
```

## Nine-route mapping

Methods/paths below exist today. Exact payloads follow the table. Common loading/error states can follow local requests; network `offline` alone must not disable local storage operations.

| Draft route | Receipt state IDs | Existing local operations | Fit / missing contract |
| --- | --- | --- | --- |
| `space` — 8 | `home`, `first-run`, `sites`, `images`, `loading`, `empty`, `error`, `offline` | `GET /api/space?kind=…` (`page`, `site`, `image`); `GET /api/space/recents?limit=…`; `POST /api/space`; `DELETE /api/space/:id` | `SpaceItem` covers three kinds, title, text/URL, timestamps. Search is client-side; no search endpoint. First-run can derive from emptiness; no onboarding flag. No asset upload/site publishing. |
| `space-page` — 7 | `editor`, `preview`, `new`, `cover`, `loading`, `error`, `offline` | `GET /api/space/:id`; `POST /api/space`; `PATCH /api/space/:id` including `{opened:true}` | Title/body map to `title`/`content`; literal preview, clipboard, draft guard are renderer behavior. GET does not record opening. **No cover field/storage operation**; do not repurpose `url` implicitly. |
| `scheduled` — 10 | `list`, `active`, `paused`, `failed`, `suggestions`, `consent`, `loading`, `empty`, `error`, `offline` | `GET /api/tasks` with optional `botID`; `PATCH /api/tasks/:id` `{enabled}`; `DELETE /api/tasks/:id`; `POST /api/tasks/:id/run` (202); `GET /api/events` emits `task.run` | Active/paused derive from `enabled`; failure from run history, not a task-status field. Search/filter client-side. **No suggestions, dry-run or task-level consent contract.** Run executes inference; enabled tasks also run automatically. |
| `scheduled-edit` — 4 | `new`, `edit`, `error`, `offline` | `GET /api/tasks/:id`; `POST /api/tasks` (201); `PATCH /api/tasks/:id` with partial creation fields; model discovery through `GET /api/catalog/providers/:id/models` or `/api/catalog/search` | Daily/weekly supported, plus cron/once. Model requires `{providerID,modelID}`. **No timezone field**; computation uses engine-host local time. A valid edit recalculates `nextRun`, does not erase failed runs. Demo Paris zone, 200/4000 limits and 50-plan ceiling are not engine guarantees. |
| `scheduled-history` — 7 | `populated`, `detail`, `failure`, `loading`, `empty`, `error`, `offline` | `GET /api/tasks` or `/api/tasks/:id` returns embedded `runs`; result through `GET /api/sessions/:id/messages` using `run.sessionID`; retry via existing `POST /api/tasks/:id/run` | Latest 50 runs exposed **per task**, not a 50-task quota. `TaskRun` has no result text, denied state, consent record or retry ancestry. No separate history/result endpoint. Cancel is session-level `POST /api/sessions/:id/abort`; completion caveat below. |
| `plugins` — 7 | `installed`, `public`, `personal`, `loading`, `empty`, `error`, `offline` | `GET /api/plugins`; `POST /api/plugins/rescan`; `PATCH /api/plugins/:id` `{enabled}`; skills/MCP lists are separate `/api/skills`, `/api/mcp` | `source` supports tab filtering, but `public` means a configured local directory, **not a downloadable marketplace**. MCP records are not Plugin records. No catalogue discovery/download/authentication contract. |
| `plugin-detail` — 10 | `installed`, `disabled`, `available`, `permissions`, `installing`, `uninstall`, `uninstalled`, `loading`, `error`, `offline` | Select detail by `id` from `GET /api/plugins`; toggle via `PATCH /api/plugins/:id`; rescan via `POST /api/plugins/rescan` | Name/description/hook names/tool names/error available. **No plugin GET-by-id, install, uninstall, progress/cancel, permission manifest or install-acknowledgement operation.** Disabled hooks do not prevent module execution during scanning. |
| `skills` — 13 | `list`, `editor`, `upload`, `upload-error`, `scanning`, `clean`, `flagged`, `unknown`, `catalog`, `loading`, `empty`, `error`, `offline` | `GET /api/skills?directory=…`; `PATCH /api/skills/:name` `{enabled}` | Metadata/list/toggle only. **No content-read, import/upload, edit/save/delete, scan/verdict/findings/acknowledgement contract.** Core discovery defaults enabled; builtin is not immutable/always-on. Prototype gates cannot be represented or enforced by these endpoints. |
| `mcp-add` — 6 | `stdio`, `url`, `progress`, `error`, `success`, `offline` | `GET /api/mcp`; `POST /api/mcp` (201); `PATCH /api/mcp/:name` `{enabled}`; `DELETE /api/mcp/:name`; `POST /api/mcp/:name/connect`, `/disconnect`; `mcp.status` events | UI URL transport maps to `type:"remote"`. POST upserts by name; PATCH cannot edit configuration. **Enabled POST/connect executes a command or contacts a server**, unlike the demo. No validation-only probe/pending-check cancellation. Raw env/header values persist and return in listings; masked/name-only demo storage is not the local contract. |

## Exact local fields and semantics

`?` means optional. All errors use `{error:{code,message}}`; render localized `code` copy, not `message`.

- **Space:** `SpaceItem = {id, kind:"page"|"site"|"image", title, content?, url?, time:{created,updated,opened?}}`. Create accepts `{kind,title,content?,url?}`; `title` nonempty. Update accepts `{title?,content?,url?,opened?}`; kind immutable. URL is an unconstrained string here. Recents default 10, query limit 1–100; sorted descending by `max(opened ?? 0, updated)`. An opened-only patch preserves `updated`.
- **Tasks:** create `{title,prompt,schedule,model,agent?,botID?,directory?,enabled=true}`; title/prompt nonempty, no maximum lengths/task-count limit in these contracts. Update is partial creation input. `model = {providerID:string,modelID:string}`. Schedule is `{type:"daily",time}` / `{type:"weekly",day,time}` / `{type:"cron",expr}` / `{type:"once",at:number}`; daily/weekly time matches `^\d{1,2}:\d{2}$`, then core validates hour/minute ranges; weekly day 0–6, Sunday 0; once uses epoch milliseconds. Five-field cron supports `*`, lists, ranges, steps; day-of-week 0/7 Sunday, restricted day-of-month/day-of-week use OR. No timezone input. Read adds `{id,lastRun?,nextRun?,runs,time:{created,updated}}`.
- **Runs:** `{id,taskID,sessionID?,status:"running"|"success"|"error",error?:{code,message},time:{start,end?}}`. Core `run()` creates a fresh chat/bot session, prompts it, returns the finished run; route declares 202, with `task.run` events for changes. History view slices latest 50; this is not retention pruning. Timer defaults 30 seconds; process-local execution, no per-occurrence backfill. Manual core run does not require `enabled`. Task deletion removes its run documents.
- **Plugins:** `{id,name,description,source:"installed"|"public"|"personal",enabled,hooks:string[],tools:string[],error?:{code,message}}`. All three sources discover local package directories; metadata comes from `package.json` and imported hooks. Enabled defaults true. Rescan imports module code/factories with full host privileges; enablement controls active hooks/tools, not a permission sandbox.
- **Skills:** `{name,description,path,source:"builtin"|"personal"|"public"|"project",enabled}`. Local `SKILL.md` directories; precedence builtin, public, personal, project (`<directory>/.cortex/skills`), later names shadow earlier. Enabled state keyed only by name, defaults true. Internal `load()` reads enabled content but has no corresponding protocol route. Frontmatter parser only recognizes simple `key: value` lines; no strict upload decoding, size ceiling, forbidden-field/URL enforcement, scanner or verdict persistence.
- **MCP:** common `{name,enabled=true}` with name regex `^[A-Za-z0-9_-]+$`. Stdio adds `{type:"stdio",command:string,args:string[]=[],env?:Record<string,string>}`; remote adds `{type:"remote",url:string,headers?:Record<string,string>}`. URL uses generic `.url()` validation, not the demo's scheme/userinfo/query/fragment restrictions; command/env/header values have no demo bounds. Read returns this configuration plus `{status:"connected"|"failed"|"disabled"|"disconnected",tools:{name,description?}[],error?:{code,message}}`. POST stores before connecting, catches connection failure, returns a record whose status can be `failed`; request success is not handshake success. Enabled servers reconnect on engine start. No separate secret-reference field.

## Highest import blockers

1. **Skills contract absent for most states.** Upload/editor/review gates need a product/backend decision. Existing toggle accepts a boolean; it cannot enforce unknown/flagged acknowledgements, revoke activation on edits, or preserve an immutable global catalogue. Remote scan/import endpoints cannot be assumed to exist locally.
2. **MCP security and side effects differ.** Actual `env`/`headers` values enter SQLite document JSON and are spread back into `McpServer`; masking the form does not make them write-only. Secret handling/redaction and save-versus-connect semantics need resolution before binding this form. POST can overwrite an existing name and attempt execution immediately. Demo checks are not main-process enforcement.
3. **Scheduling consent/timezone are demonstrations.** Timer directly starts due tasks. Existing `GET /api/permissions` / `POST /api/permissions/:id/reply` with `{reply:"once"|"always"|"reject"}` handles pending **tool calls**, not whole scheduled executions; ordinary tool approvals may persist. No task consent record/gate exists. Paris cron, 50 plans and per-run consent must not become asserted engine behavior through a UI import.
4. **Plugin acquisition/permission flows have no operations.** Available/installing/uninstall/permissions states cannot imply successful installation or confinement. Public/personal labels identify local discovery roots. Rescan itself executes plugin modules, including disabled ones.
5. **Result accuracy needs care.** `promptAndWait()` deliberately does not throw assistant `aborted`; scheduler subsequently marks the run `success`. History must not equate that flag with a persisted successful assistant completion. Read transcript completion/error for presentation; no backend fix performed here.
6. **Space cover + draft persistence mismatch.** Core supports text/URL items, not cover metadata/assets. Prototype `sessionStorage`, fixtures, French literal copy and simulated success must be adapted to engine persistence, preview-only fixtures and English-source i18n before integration. Local CRUD availability is independent of internet status.

## Contract anchors

- `packages/schema/src/index.ts:242–319,346–355,410–426,439–442` — extension/task/Space fields, mutation inputs, events.
- `packages/protocol/src/index.ts:53–64,75–112` — existing routes; `:159–198` validation/error handling.
- `packages/core/src/space.ts:8–42` — recents and mutations.
- `packages/core/src/scheduler.ts:8–112`; `packages/core/src/cron.ts:3–109` — history exposure, execution, local-time schedules.
- `packages/core/src/skill.ts:6–71`; `packages/core/src/plugin.ts:39–122` — discovery, enablement and missing lifecycle/review contracts.
- `packages/core/src/mcp.ts:35–113,135–138`; `packages/core/src/storage.ts:157–166` — configuration persistence/return, connection effects, JSON storage.
- `packages/core/src/permission.ts:59–108`; `packages/core/src/session.ts:158–164`; `packages/core/src/index.ts:95–101` — tool approvals, aborted-completion caveat, startup connections/timer.
