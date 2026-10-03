# Main-only remote Chat adapter — implemented, uncommitted

**Ready for coordinator review/integration.** Three owned files: `packages/desktop/src/remote-session.ts`, new `packages/desktop/src/remote-chat.ts`, new `packages/desktop/test/remote-chat.test.ts`. Existing auth tests unchanged. Native Node22.23.3: **19/19 PASS** (11 transport +8auth); strict workspace typecheck and focused lint PASS.

## Frozen main-internal API
Exports live only in `packages/desktop/src/remote-chat.ts`; shared schemas/core/renderer are not integration inputs from this lot.
```ts
RemoteSession.bind(origin: string): MainRemoteChatBinding

interface MainRemoteChatBinding {
  readonly epoch: string;
  readonly signal: AbortSignal;
  models(signal?: AbortSignal): Promise<MainRemoteModel[]>;
  upload(input: MainRemoteImage, signal?: AbortSignal): Promise<MainRemoteFile>;
  turn(input: MainRemoteTurn, observer: MainRemoteObserver,
       signal?: AbortSignal): MainRemoteDelivery;
  history(conversationID: string, signal?: AbortSignal): Promise<MainRemoteHistory>;
}
type MainRemoteDelivery = {
  readonly completion: Promise<MainRemoteResult>;
  detach(): void;
  resume(observer: MainRemoteObserver, signal?: AbortSignal): Promise<MainRemoteResult>;
};
type MainRemoteObserver = {
  admitted(ids: { conversationID: string; assistantID: string }): void;
  event(event: MainRemoteEvent): void;
  cursor?(id: string): void;
};
```
Callbacks are **synchronous**. Callers must handle `completion` immediately, inspect its terminal discriminator/finish reason; resolution alone is not successful inference. `turn()` can refuse synchronously for invalid/stale/foreign inputs or an unresolved turn. `resume()` returns a new completion promise; the original handle's `completion` retains its original result.

| Type | Fields / semantics |
| --- | --- |
| `MainRemoteModel` | `slug,name:string`; `reasoning,vision,tools:boolean|"unknown"`; `contextTokens?,outputTokens?:number`; `source:"cloud"|"models.dev"|"cache"|"cache_stale"|"unavailable"`; no guessed cost |
| `MainRemoteImage` | `body:Blob` (File accepted), `filename:string`, `conversationID?:string`; no URL/path/base64-fetch input |
| `MainRemoteFile` | validated `id,filename,contentType:string`, `byteSize:number`, `conversationID?:string`; binding remembers ownership independently of this returned copy |
| `MainRemoteTurn` | `message:string`, `modelSlug:string`, `effort?:"low"|"medium"|"high"`, `attachmentIDs:string[]`, `conversationID?:string`; strict runtime object rejects unknown fields |
| `MainRemoteEvent` | Validated API-types `StreamEvent`, except `error` becomes `{type:"error",code:"provider_error"|"provider_auth_failed"|"provider_rate_limited",recovery:"history"|"none"}`; raw error detail/request ID stripped |
| `MainRemoteResult` | `{admission:{conversationID,assistantID},terminal:<done event or normalized error>}`; preserves `length/interrupted/error/tool_calls` rather than inventing success |
| `MainRemoteHistory` | `{conversationID,title,modelSlug,items,limit:100,limited:true,projection:"text-and-attachments",reasoningAndTools:"omitted"}` |

History items: validated `id`, `role:user|assistant|system|tool`, `text`, ISO `created_at`, integer `version_index/version_count`, literal `is_active_version:true`; optional `finish_reason`, `model_name`, `attachments:{file_id,filename,content_type,byte_size}[]`. Other backend fields are intentionally outside this projection. `has_more:false` never becomes a completeness claim.

## Implemented ownership / transport
- Binding requires active validated identity and matching normalized origin. A wrong-origin `bind` refuses without changing the selected account. `state(newOrigin)`/`clear()` invalidate; existing connection-mode owner uses these lifecycle methods.
- Random epoch minted only on successful promotion. Pending/refused replacement retains active binding. Successful replacement aborts old binding and requests. No client/token/cookie/Fetch getter; no credential field on binding or model/file/history output.
- Local expiry now has an unref'ed expiry timer plus operation/state guards. Logout aborts Chat immediately, before local server revocation finishes. Auth transport retains its existing10s/1MiB/status/origin rules; eight original tests pass unchanged.
- HTTP401 invalidates only the originating still-active identity; late old401 cannot clear a replacement. Other failures become existing neutral `CortexError` codes. No automatic refresh/guest/operator epoch.
- Authenticated Cloud reads `/v1/models`; self-host reads configured registry pages (500/page, maximum20pages, cycle/missing-cursor/duplicate-ID refusal). Missing/unknown Chat kind is not selectable; all-zero/all-false registry entries expose unknown capabilities. Auth mode `none` explicitly refuses.
- Named privileged transport allows only instance/models/registry, Library upload, owned conversation detail/messages and Chat turn endpoints. Every request pins origin, refuses redirects/final-origin changes, omits platform cookie storage and preserves private SDK cookie ownership.
- JSON responses:10s complete-body deadline,4MiB cap. SSE:10s headers, immediate stream handoff,60s idle bound,16MiB per connection. Account/caller abort settles even when custom Fetch ignores cancellation; no timeout manufactures `done`.
- Upload accepts PNG/JPEG/WebP/GIF Blob bytes with MIME/signature agreement,1byte–8MiB. This deliberately uses the backend vision ceiling, below its10MiB general upload ceiling. Stored response must confirm owner/image/upload, supported raster, size and expected conversation; only then can its ID be used.
- Turn validates trimmed text≤50,000 code points,≤20 unique privately owned image IDs, text-or-images required. Reasoning-capable model requires an explicit effort; nonreasoning/unknown forbids effort. Selected slug must be in validated catalogue; images require confirmed vision. Known follow-ups retain first model/effort; mismatches refuse instead of sending ignored choices.

## Admission / replay / recovery
- `turn` reserves before async catalogue work; **one unresolved turn per binding** is the explicit first-phase ceiling. No hidden core/local execution.
- Private ledger snapshots validated input, random idempotency key, original new/follow-up path, admitted conversation/assistant IDs and acknowledged numeric cursor. Caller cannot supply path/key/headers/cursor or mutate the snapshot.
- Successful SSE headers must contain valid `cnv_`/`msg_` IDs, match original follow-up/replay IDs. Assistant header is never used as a user ID. Invalid/missing headers cancel reader, keep ambiguous ledger reserved, emit no admission/content.
- Events with message/conversation IDs must match admission. SDK validates known events; tools/results/disclosures/safety/usage/media retain their main-only typed shape. No local tool/permission execution. Future core/UI must interpret these before presentation, especially tool payloads and blocking notices.
- Replay is explicit (`maxReconnects:0`). `resume` uses the same original path/body/key and last acknowledged cursor, even after learning a new conversation ID. Distinct equal-ID frames are not filtered by this adapter. Cursor advances only after observer consumption.
- `detach` aborts this reader, never backend generation. Another prompt remains blocked until same-ledger completion or owned history recovery verifies that assistant has a finish reason.
- Pre-admission400/403/404/413/415/422/429 is a definitive refusal and releases reservation. Network/5xx/bad-header failures remain ambiguous; no fresh-key resend.
- `stream_expired` returns normalized error with `recovery:"history"`; replay is then refused. Terminal-but-incomplete image tails reject; post-terminal resume is deliberately refused. A known-history read can recover the reservation after persisted assistant completion.
- History fetches only IDs admitted in this account epoch; title/model validated against that known conversation, latest100 active-path messages, no query cast. Backend default100 is used because generated history query remains undescribed; server maximum200 is not advertised as synchronized history. No account-wide list/import.

## Tests and proof
Native HTTP loopback + actual installed SDK0.3.5/API-types0.2.0; no fake SDK.
- Promoted identity, model sanitization, private bearer/cookie continuation; failed replacement preserves epoch.
- Raw owned image upload; image-only high-effort turn; immediate header admission; reasoning, tool result/status, disclosure, text and announced post-done image.
- Immutable path/body/key/cursor replay across disconnect and detach; concurrent/fresh resend refusal.
- Missing/mismatched headers/event IDs; normalized expired-stream recovery; truncated finish; EOF/incomplete media refusal.
- Unicode boundary, attachment ownership/count/MIME/size; unknown model/capabilities, fixed follow-up choices, configured registry pagination, unsupported operator mode.
- Definitive403/422/429 refusal, redirects, malformed JSON;401/logout/origin/local-expiry/account-replacement invalidation including late old401 and open-stream replacement.
- Oversized JSON/cancelled upload cannot commit; actual10s JSON deadline while a concurrent SSE remains open beyond10s; accelerated60s idle timer rejects partial delivery.

Evidence: `/tmp/opencode/remote-chat-main-implementation/` — `tests-corrected.json`, `focused-corrected.{json,log}`, `typecheck-corrected.*`, `lint-corrected.*`, `source-hashes.json`.
Earlier failures retained: test-server per-case forced socket closure caused alternate sign-in failures (fixed test cleanup); Zod ID inference exposed branded input types (explicit boolean predicate keeps internal string boundary); account-change SDK abort initially mapped generic failure (fixed cancellation precedence). No auth regression remained.

## Coordinator next work / scope limits
- Freeze above module types for the core adapter; add process-only session projections/dispatch and truthful UI states separately. Current `main.ts` is unchanged: this adapter has no public API/IPC/renderer call site yet.
- No stable backend account ID, exhaustive history/structured history replay, remote rename/delete, generated-file download, parallel per-conversation ledger, persistence or refresh in this phase. Missing admission identity cannot use history; retry is the retained private handle, not a new prompt.
- SDK parser behavior for unknown/malformed SSE variants remains upstream;16MiB connection bound limits accumulation. At-least-once replay/TTL behavior is not exactly-once across process exit.
- Real Cloud credentials/inference, installed acceptance and new copy/error-code approval remain coordinator work. Main-only native HTTP fixtures do not prove hosted inference.
- Source hash check confirms **90 existing app/desktop dist files unchanged**, plus main entry, probe, dependencies/lock and original auth tests. No build/E2E/full tests/Mac/CI/commit/push. Concurrent coordinator/core/documentation changes were not edited by this executor.
