# Persistent Memory pause — independent engine review
**APPROVED within the assigned engine/API/test scope. No blocking finding.**
Review base: `74579d574646aff5dbd462247b4fd47a99dd2cdd`; previously tested application `f82a648` does not verify this new behavior.
Only this report written. Source/diff/hash inspection only; no tests, typecheck, build, network, CI or Mac execution.
Renderer settings hook, live UI, catalogs and documentation implementation remain outside this review.

## Trust and persistence
- `packages/schema/src/index.ts:139–140,476–477`: strict boolean-only stored shape; strict required boolean update plus optional literal `initializeOnly:true`. Unknown keys, coercible strings and false/null initialization flags are rejected.
- `packages/core/src/index.ts:60–69`: only absent (`undefined`) storage defaults true. Invalid JSON/null/missing or malformed flag/extra fields become neutral `CortexError("internal")`, never enabled fallback.
- `index.ts:70–82` plus `storage.ts:67–76`: validation precedes synchronous `BEGIN IMMEDIATE`; absence/read/write share one transaction. Competing initialization cannot replace either saved true or saved false; request flags are never persisted.
- Equal persisted values and initialize-only against existing settings perform no write/event. First explicit true while absent legitimately creates a stored choice, preventing later legacy-false override.
- `changed` becomes true only after `putDoc`; publication occurs only after `tx` returns from COMMIT. Insert/update/commit refusal exits before publication and rolls back; prior settings/notes survive.
- `bus.ts:12–22` isolates synchronous listener throws; `storage.ts:25` excludes `settings.changed` from durable events. Existing plugin bridge catches rejected event hooks (`index.ts:114`).
- `protocol/src/index.ts:53–54,175–185`, `server/src/index.ts:55–56`, `client/src/index.ts:143–146`: typed GET/PUT use existing validation/error/IPC path. Bad writes are400; corrupt settings/storage failures are500 with neutral developer copy, not raw persisted data.

## Admission/context invariants
- `core/src/index.ts:104` is the sole production `bots.context` caller; it supplies validated engine preference. Standalone `BotService.context`'s default true preserves its prior interface without bypassing the production gate.
- `bot.ts:68–86`: off skips saved-note lookup entirely; persona/name, tools and permissions remain. Manual list/add/delete and existing history are untouched.
- `session.ts:173–188`: session reservation precedes synchronous Project and Bot snapshots, both before the first catalog await. Corrupt settings refuse before catalog/key work; catch203–205 releases reservation without prompt writes.
- `storage.ts:159–167` JSON-parses each read; Bot tools/permission arrays are detached values, not shared mutable service state. Later Bot edits or preference changes cannot mutate the admitted context.
- `session.ts:199,315,347,351–356`: runner reuses that same Bot snapshot for system/tools/permissions and input/output estimates; Bot context is counted once per estimate, not duplicated in history.
- Existing budget estimation remains approximate and does not add cumulative per-tool-step re-estimation; this change establishes the reserved note contribution, not a new complete budgeter.
- Ordinary Chat without `botID` receives no Bot context (`session.ts:181`). Delegated children preserve parent's Bot identity (`238–246`); routines preserve configured Bot identity (`scheduler.ts:79–89`), each consulting the gate at its own admission.
- Existing Project root resolution/admission, child tool restrictions, global permission rules and historical message replay remain intact. Pause affects future admissions; already-shared notes in messages remain replayable.

## Eight meaningful server cases (298-line existing-Vitest suite)
- `runtime-settings.test.ts:46–73`: actual typed client/protocol strict rejection, absent default without seeding, committed SSE publication, same-value no-event and live-only journal behavior.
- `75–97`: two Bots' exact notes/IDs/times survive off/on and two real SQLite reopens; manual add/forget remains available while paused.
- `99–119`: concurrent initialize-only writes in both boolean orders, existing-value precedence and explicit-write versus legacy initialization race.
- `121–155`: real SQLite AFTER INSERT/UPDATE abort triggers, rollback/no extra events, five corrupt document forms, preserved bytes/notes, admission release and zero catalog calls/messages.
- `157–191`: actual serialized provider payloads distinguish two Bots, pause/resume, unchanged persona/tool allow-list and retained prior assistant reference; ordinary Chat receives neither Bot.
- `193–234`: held catalog and credential awaits, note/persona/tools/permission edits after reservation, original restriction denial and subsequent-turn refresh.
- `236–268`: memory-caused admission refusal before writes, released busy state, paused admission, exact output budgets44/18 and snapshot preservation despite later toggle/note growth.
- `270–297`: real delegated child and routine runs under on/off; inherited Bot identity, no recursive task tool and paused Bot permission denial.
- No assertion bypass/new dependency or implementation-mirroring-only suite found. No additional targeted test is required by this source review.
- Author-reported Node22 result:8/8 targeted cases and scoped TypeScript check passed. Not rerun here; integrated renderer, packaged/native and broader regression acceptance remain separate.

## SHA-256 — reviewed bytes
- Contract `/tmp/opencode/g1-memory-implementation-contract.md`: `67f3a9681f453719871b4c7bc7318e531c8fb8dc2693f585797b35119d5cac17`
- `packages/schema/src/index.ts`: `36109b67fdee6a6e677bdc47fab5987458920ceed2daccdf5d6e29c3731f3e10`
- `packages/core/src/index.ts`: `2826f3cb9d6ce251a13edd176e16edb8166e30b6dc15dca77a28ac87930c99dd`
- `packages/core/src/bot.ts`: `0adfedf5a512462d2850cc756e181e445125d2e65d6ed8d354371fa0fb26f535`
- `packages/core/src/session.ts`: `04169701dad72016aeb87b3f6ad4a802ecec0c30bcff720605d37280135a5aa8`
- `packages/client/src/index.ts`: `8134f2b0a1254745a998de64e8801e8d0ad53da2f8db8f39a86824c1118d7be3`
- `packages/protocol/src/index.ts`: `2cbc676c034c48659f2f923ae0d59d445a2e20449290307e8044337bcbbc6fc9`
- `packages/server/src/index.ts`: `9b0e6bcf6bfe002e8679bcbad8ddb7ffcaf907bbf8b6cf7678e191f30bfc14e2`
- `packages/server/test/runtime-settings.test.ts`: `a7fbc646cb7844075c14a50b9eb19455cc1016b63267edcae64e0fe0976cb79b`
