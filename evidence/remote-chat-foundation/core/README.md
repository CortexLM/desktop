# Internal remote Chat core seam — implemented

**Ready for coordinator integration review.** Six owned source/test files changed; no build, native run, CI query, commit or public route/UI activation. All **90 existing dist members** still byte-match frozen `78857365a509d78af10ebdda5b52348a2e50e961`.

## Exact files

- `packages/schema/src/index.ts`: separate remote models/files/create/prompt/views/outcomes/history schemas; `remote.session.changed` and `remote.session.removed` carry only `{sessionID,epoch}`. Existing local Session/Message/Usage/input schemas remain unchanged.
- `packages/core/src/remote-sessions.ts`: new process-only `RemoteSessionService`; SDK-free `CoreRemoteHost`, `CoreRemoteBinding`, `CoreRemoteDelivery`.
- `packages/core/src/index.ts`: optional host injection, service construction/export, synchronous remote close before storage shutdown. Existing remote bus/local-only plugin filter preserved.
- `packages/core/src/connection.ts`: `remoteOrigin()` uses the selected validated normalized origin; local mode refuses.
- `packages/desktop/src/main.ts`: one `RemoteSession` instance supplies both `remoteAuth` and `remoteChat`; workspace compilation checks structural compatibility with the actual main adapter, including `admissionState`.
- `packages/core/test/remote-sessions.test.ts`: 17 focused cases using an actual in-memory core/SQLite plus a controlled structural host, no SDK replacement.

## Internal API

```ts
core.remoteSessions.models(): Promise<{epoch: string; models: RemoteModel[]}>
core.remoteSessions.create({epoch, modelSlug, effort?}): RemoteSessionView
core.remoteSessions.upload(id, {body: Blob, filename}): Promise<RemoteFile>
core.remoteSessions.prompt(id, {message, attachmentIDs}): Promise<{
  messageID: string; done: Promise<RemoteOutcome>
}>
core.remoteSessions.resume(id): Promise<{messageID: string; done: Promise<RemoteOutcome>}>
core.remoteSessions.detach(id): RemoteSessionView
core.remoteSessions.history(id): Promise<RemoteHistoryWindow>
core.remoteSessions.get(id): RemoteSessionView
core.remoteSessions.list(): RemoteSessionView[]
core.remoteSessions.messages(id): RemoteMessageView[]
core.remoteSessions.close(): void
```

Create is synchronous after `models()` caches a valid catalogue. Inputs reject unknown fields. Epoch, selected model and exact effort semantics validate before creation; uploads are session-owned immutable Blob/file snapshots. Conversation IDs/model choices come from the stored view. Original selected upload bytes stay private until epoch/close cleanup.

## Admission and truth

- One unresolved turn per binding; synchronous reservation before host work. User/assistant records remain private until valid headers. Admission resolves the **local user ID**, never the server assistant ID.
- `admitted` is idempotent across repeated matching headers: IDs/parts/usage survive. A failed first admission callback can receive headers again on replay. No pre-header retry acknowledgement.
- Typed main `admissionState` releases only definitive refusal; ambiguous/detached/history-needed turns retain the original `Delivery`. Resume uses its new promise, never its old completion, a new turn, upload, key, body or cursor. Attempts serialize until the prior wire promise settles.
- **Every resume marks the projection partial** with a nonblocking history marker. Numeric cursor suffix loss can repeat equal-ID frames; no text/ID-only deduplication or exact reconstruction claim. Same handle preserves main's same-key generation semantics. `stop` after resume remains `complete:false`.
- Text/reasoning deltas preserve ordered notice boundaries; usage is a validated snapshot, not accumulated on replay. Unknown usage/cost/timing stays absent. `done` remains provisional until main completion, including image tails; length/interrupted/error/tool_calls never claim successful completion.
- Structured/tool results, permission actions, generated media and unknown events become typed partial/blocking markers. Raw payloads, labels/error details, signing metadata and actionable URLs are excluded. Bounded disclosure/safety strings retain referral addresses as **plain text**, without HTML/link fields. Local tools/providers/permissions/plugins are never invoked.
- Known-only history retains latest100/limited/text-and-attachments/omitted-reasoning flags and original roles. It neither overwrites richer live parts nor guesses user IDs. Recovery of an interrupted admitted assistant remains partial; no invented timestamp/usage.
- Binding abort/close synchronously clears records/files/catalogue/listeners, aborts operations and emits remote-tagged removals. Every continuation checks owner/record/attempt identity; same-epoch catalogue/history races also reject stale results. Get/list revalidate selected origin and active binding. Snapshot returns are clones.

## Checks actually run

Node **22.23.3**, `NODE_ENV=test`; retained logs/JSON under `/tmp/opencode/remote-chat-core-implementation/`.

| Check | Result / retained file |
| --- | --- |
| Initial focused tests | 12/13; stale `aborted` metadata after successful replay admission found, corrected. `tests-initial.{log,json}` retained |
| Core + server + client regression | **91 passed / 12 files**, including then-current 13 remote cases; `core-server-client.{log,json}`. This existing suite also ran its pre-existing live models.dev catalog case; no Cloud/auth probe |
| Final focused tests after replay ceiling/order/retention changes | **17/17 passed**; `tests-replay.{log,json}` |
| Workspace typecheck against actual main exports | **PASS**; `typecheck-replay.log` |
| Six-file ESLint | **PASS**; `lint-replay.log` |
| Scoped diff check | **PASS**; `diff-check.log` |
| Frozen dist comparison | **90/90 unchanged**; `dist-unchanged.json` |

Tests cover normal admission/deltas/equal IDs/reported usage, refusal versus ambiguity, original-handle detach/replay, repeated admission without duplicate content, pre-header detach, finish reasons/partial output, malicious/invalid event fields, known history, clone isolation, immediate epoch/close cleanup, late callbacks and same-epoch read races. SQLite event/session/message/part counts and local provider/network/plugin/tool/permission spies remain untouched by remote operations. Existing local server/client/session tests pass.

Source hashes: `source-hashes.json`. Initial typecheck failures were local optional/narrowing issues; corrected. No test assertions were weakened to manufacture success; replay completion expectation changed to the explicitly supplied cursor ceiling.

## Remaining integration limits

Internal service only. Public source routing, view consumption, upload IPC, source-aware reset and approved effort/detach/partial-history copy/UI remain coordinator work. No real account/inference, backend cancellation, durable history, account-wide import, generated-file download, parallel remote turns or remote mutation APIs. Main retains all credentials, wire validation, transport limits and retry identity. Packaging/native/CI acceptance is not established for these unbuilt source changes.
