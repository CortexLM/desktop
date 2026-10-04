# Remote Chat: one minimal process-lifetime phase

**Decision:** add explicit remote Chat dispatch inside `SessionService`, backed by one main-only `RemoteChat` binding and an in-memory projection. Reuse existing session routes, IPC/events and Chat presentation. Never repoint local providers or infer remote execution from the global mode on an existing session.
**Release gate:** SDK0.3.4 final HOLD supplied by coordinator; no release/owner poll here. Implement/review contracts independently; ship only an admitted SDK revision plus the UI dispositions below.

## 1. Verified inputs and current traps
- G3 narrow-validation permission: saved `/tmp/opencode/g3-remaining-contracts-031-comment.json`, comment `5964672516`, source `d6c71de1d99197c5e0ee5c59d0a089842d760cea`.
- Canonical `openapi/cortex.openapi.json`: original G2 `70a3056f`, blob `d6d46014`, SHA `93806bd0…`; screenshot-only G3 `af36085c`, blob `c8f6a7f0`, SHA `b2495d1d…`. Neither defines precise Chat turn/catalogue/history/account DTOs. Do not label a consumer zod schema canonical generation.
- Handler/readback pins: backend `d6c71de1`; adopted SDK0.3.1/API-types0.2.0. Auth/catalogue/turn/history handler bytes match the earlier 0.3.1 readback; successor schema only describes screenshots.
- Current `RemoteSession` keeps `#active.client` private. `#create` Fetch consumes **every** response before returning, caps 1 MiB, applies 10s auth timeout and auth-specific success status. Passing this client unchanged to Chat would buffer/abort SSE and reject large catalogues/downloads.
- `ConnectionService` currently manages selection/auth only. `SessionService.prompt` always resolves local catalogue/provider and runs local tools; `main.ts` passes no remote prompt service.
- `Bus.publish` commits `session.*`, `message.updated`, `part.updated` to SQLite before listeners. Reusing it unmodified would persist remote account content despite an ephemeral policy.
- `Home.send` creates a session before admission; `LiveChat.retry/regen` resubmits the user prompt; `StopBtn` claims stop. Those semantics cannot be inherited blindly for remote turns.
- Scheduler creates some `kind:'chat'` sessions directly. Global mode-based routing in `SessionService.create` would accidentally send routines remotely.

## 2. Freeze this seam before parallel implementation
One core-owned host type, SDK-free; DTOs are zod-inferred shared types. These are named operations, not arbitrary URL/Fetch access:
```ts
type RemoteChat = { bind(origin: string): RemoteChatBinding };
type RemoteChatBinding = {
  epoch: string; signal: AbortSignal;
  models(): Promise<RemoteModel[]>;
  upload(file: RemoteImageInput): Promise<RemoteFile>;
  turn(input: RemoteTurn, observer: {
    admitted(ids: { conversationID: string; assistantID: string }): void;
    event(event: RemoteChatEvent): void;
    cursor(id: string): void;
  }, signal: AbortSignal): Promise<void>;
  history(conversationID: string): Promise<RemoteHistoryWindow>;
};
```
- `bind` closes over the **current validated active identity**, origin and random epoch; it throws if signed out/expired/mismatched. No SDK/client/token getter. Binding callbacks and requests check the same epoch before updating anything.
- `RemoteModel`: slug/name, confirmed-or-unknown vision/reasoning/tools, optional limits/cost, discovery source; never auth metadata. `RemoteImageInput`: bounded bytes/name/MIME. `RemoteFile`: validated lbf ID and sanitized upload metadata. `RemoteTurn`: original allowed path/body/key/cursor. `RemoteHistoryWindow`: validated message projection plus literal limited-window/omitted-reasoning flags. `RemoteChatEvent`: normalized safe event subset/unsupported marker; raw errors/SDK generics never leak through the seam.
- Main assigns epoch on successful session promotion; preserves active epoch during a pending/refused new sign-in; invalidates on successful replacement/logout/origin switch/expiry/401. No email/JWT-subject cache key. Core subscribes to binding `signal` to clear its remote maps.
- Core owns `RemoteChatSessions`: synchronous `create/get/list/messages`, async `prompt/detach/history`, transient projections and admission/replay ledger. `SessionService` delegates **only tagged remote IDs/explicit remote creates**; otherwise existing local methods remain authoritative. Core host option `remoteChat?: RemoteChat` is wired to the same `RemoteSession` instance already owning auth.
- `SessionCreateInput` adds optional `remote: { epoch, modelSlug, effort?: 'low'|'medium'|'high' }`; permitted only for explicit foreground Chat, no directory/parent/Bot/agent override. Main/core validate epoch and model against bound catalogue, never renderer origin/auth claims. Existing internal callers remain local by omission.
- `Session.remote?` carries `{epoch, conversationID?, modelSlug, effort?}` plus explicit `transcriptScope:'process'`. Preserve old `Session` shape for local callers; remote view's compatibility `model` is `{providerID:'cortex-remote', modelID:modelSlug}` and `agent:'remote'`, **view identifiers only**, never registered providers/agents or input to `resolveModel`/`getAgent`.
- `PromptInput` adds optional `remote: {epoch, effort?}`. Remote dispatch rejects local `reasoning:boolean`, agent override or changed model/effort after first admission; local dispatch rejects remote options. No silent field dropping.
- Add `GET /api/connection/models` for sanitized `RemoteModel[]`; leave local `/api/catalog/*` and `/api/providers/*` intact. Remote model view is a distinct DTO, not a cast to `ModelInfo` with guessed prices/capabilities.
- Add `source:'local'|'remote'` list filter (default local), `POST /api/sessions/:id/resume` with no prompt body, `POST .../detach`; remote `/abort` refuses. Existing `/prompt` stays an admission acknowledgement, not a buffered remote response.
- Route-level remote create requires selected connection and valid epoch; tagged session operations always verify its binding. Foreground HTTP prompt to old local Chat refuses while remote is selected; internal scheduler calls remain local. Persisted local session IDs never become remote when mode changes. In remote Chat navigation list only current-epoch remote records; Code/Bot/routines and provider settings retain their local service.
- Remote view supports current-process list/get/messages and backend reload for **known** conversation IDs. Do not add pre-login/full-account history import in this phase. Remote rename/delete/regen currently refuse visibly until explicitly implemented; disable their existing menu actions with honest copy, no success toast or new prompt substitute.

## 3. Main transport: keep auth ownership, split response policy
- Add privileged named methods to `RemoteSession`; keep client/cookies/pending factors private. Revise its Fetch wrapper by admitted endpoint class: preserve current bounded auth JSON path; bounded non-auth JSON/Blob path; streaming SSE path returning the body immediately.
- Every class pins origin, rejects redirects and unexpected final origin, omits platform cookie storage, composes request + account cancellation. SDK's main-only cookie jar remains the sole cookie store. Renderer supplies neither URL, headers nor credentials.
- SSE needs header deadline plus cancellable reader/idle policy, **not** auth's 10s total/1 MiB buffer. Stream abort must cancel reader even if injected Fetch ignores signals. Never copy an authenticated raw `Response`, cookie or error detail into IPC.
- No automatic refresh in this phase; main service currently has none. A 401 invalidates active epoch and asks sign-in; no replay under newly acquired account. Local expiry stays server `expires_at`; no unverified JWT-expiry inference.
- Signed-in Cloud/self-host-cortex paths first. Do not silently create a guest. Self-host-none needs an explicit main operator epoch based on validated instance mode before use; it must not claim `signedIn:true`. Local-password UI remains separately gated.

## 4. Narrow validated DTOs, exact limits
| Boundary | Validate/map; never cast `unknown` |
| --- | --- |
| Cloud model page | zod object `{items: Model[],has_more:false}`. API-types `Model` fields: slug/display_name/description strings; context_tokens/max_output_tokens nonnegative integers; supports_reasoning/tools/vision booleans; optional is_preview/kind/fallback_slug/attribution/banner_url. Current backend emits kind; offer only `kind:'chat'`, do not guess missing/unknown kind or select image-generation models |
| Registry | Validate `RegistryModelPage`; paginate `configured:true,limit:500,cursor` until false; reject repeated/missing cursor. Select by `instance.mode==='self_host'`, never registry.enabled. Empty remains empty; no Cloud fallback |
| Capabilities | `true` supports input; all-false/zero operator models are **unconfirmed**, not a guessed model. This can occur even on a cached page for operator extras. Preserve source and unknown/unsupported display state; require confirmed vision/reasoning for these features. Never invent positive limits, cost or price zero |
| IPC image | Only explicitly selected bytes/data URL; validate base64 structure, byte count and raster MIME. Reject arbitrary file/http URLs rather than fetching them in main. ≤20 attachments total, decoded upload 1–10 MiB; practical IPC aggregate cap must be explicit and retain files on refusal |
| Library upload | `client.library.create({body:Blob,query:{filename,conversation_id?}})` raw bytes; omit conversation_id before first turn, later bind only verified owned cnv ID. Validate typed metadata/id/filename/content_type/byte_size and owner access. Images may be repacked: stored supported raster must be ≤**8 MiB** vision limit, even though upload allows10 MiB. Begin with PNG/JPEG/WebP/GIF; refuse unsupported/oversized images visibly, never send an image that backend silently skips |
| Turn body | zod strict bounded subset `{message,model_slug,reasoning_effort?,attachment_ids}`; trim message, `[...message].length≤50_000`, ≤20 validated lbf IDs, text or attachments required. Allow image-only send. Add only owner-confirmed fields if needed; no `continue`, research, Code/project automation in this phase |
| Upload ownership | Main keeps accepted upload IDs under origin+epoch, refuses foreign/stale submitted IDs. Backend independently enforces caller ownership. Reuse acknowledged uploads for retry within epoch; failed/malformed/ambiguous upload keeps originals, no automatic bulk cleanup of possibly-used files |

Library and model schemas validate incoming data before projecting whitelisted fields. Zod input schemas prevent UI fields disappearing; response schemas strip harmless unknown fields but reject malformed fields relied on. Cost/usage unknown is represented as unknown, not a billing claim.

## 5. Admission and identity: exact new-chat sequence
1. Core allocates local ephemeral view ID and one busy reservation **before** catalogue/upload awaits. No `Storage` write, inference, provider fallback or server conversation creation at `create` time.
2. Snapshot selected slug/effort, bytes and account epoch; validate capabilities before upload. Retain original composer until accepted. Preserve uploaded IDs and immutable prompt identity across eligible retry; do not regenerate keys on every click.
3. New turn uses `POST /v1/conversations/turns`; follow-up uses `POST /v1/conversations/{id}/turns`. Backend has no standalone Chat create endpoint. Main `streamTurn` starts only when iterated; constructing the generator is not admission.
4. `ResumeOptions.onResponse` verifies successful SSE/body plus **both** headers using API-types `isId/parseId`: `x-conversation-id:cnv_…`, `x-message-id:msg_…`. Backend `turns/create.ts:43–44,281` supplies them after transaction admission. The message header is **assistant**, not user. Follow-up/replay must match previously bound IDs.
5. After valid headers/current epoch, map cnv and assistant to local IDs, emit admitted user/assistant state, resolve existing `{messageID}` with the **local user** ID. Never impersonate a backend user ID; reconcile later with history. Validate any event `message_id` against the header before projecting; events do not supply a universal new-conversation ID.
6. Missing/mismatched headers after POST mean **ambiguous outcome**, not a safe refusal. Keep text/files and original request ledger, block fresh-key resend pending reconciliation. Pre-admission 4xx retains draft; errors after acknowledged admission remain transcript failures.
7. Ledger: `{origin,epoch,localSessionID,conversationID?,assistantID?,originalPath,body,key,cursor}` in memory. On new-conversation reconnect reuse original no-ID path, **not** newly learned cnv follow-up path. Freeze body and key. A later user turn gets a new key.
8. `resume` reads that ledger only; no renderer-supplied replay body/URL. `stream_expired` reloads known history, marks incomplete delivery, never starts a replacement turn. Backend idempotency mapping is post-commit/TTL-bound, so exactly-once across lost mapping/process restart is not claimed.

## 6. Ephemeral projections and stream mapping
- In-memory maps keyed by `(origin, random account epoch, server cnv/msg IDs)`; local view IDs prevent accidental collision with SQLite IDs. Draft handles precede cnv assignment. Re-auth always gets a fresh epoch; no persisted remote IDs/messages/files/email-cache keys.
- Add internal `Bus.publish(type,properties,{source:'remote'})` tag: skips persistence; default local semantics unchanged. Subscribers may filter source; existing plugin hook subscribes local-only. Update in-memory snapshot **before** publishing. All remote session/message/part/status/reset events use this path; test SQLite event/session/part counts and plugin delivery unchanged.
- On identity loss: abort uploads/readers, reject pending admission, clear maps and remote catalogue, emit transient removal/reset events; renderer invalidates by epoch. Suppress late promises/events/old snapshot reads. `useMessages` currently swallows initial failures and can overwrite live events with a late snapshot; add generation checks and explicit load/reset recovery.
- IPC continues pumping normalized existing bus events, never raw remote SSE. Root subscription remains shared; internal source tag need not cross IPC. Merely skipping SQLite is insufficient: filter plugin dispatch explicitly so remote account content is not forwarded to local plugins.
| Remote event | Local projection / truth |
| --- | --- |
| `text_delta` | Allocate stable text part; append `.delta` to field `text`. Equal numeric SSE IDs can represent distinct frames: do not deduplicate solely by ID |
| `reasoning_delta`, `reasoning_done` | Stable reasoning part, append text; record actual duration if exposed. Existing renderer uses full message duration: do not label that reasoning duration; leave duration hidden until explicit metadata wired |
| `usage` | input/output/reasoning/cached counts parsed as finite nonnegative values; remote cost unknown. Schema needs optional unknown-cost metadata or remote discriminator; never imply zero cost |
| `done` | `stop` completes; `length` is truncated; `interrupted/error` not successful; do not equate every terminal event with Done. Store finish reason, settle open tools. Success timestamp only on confirmed successful completion |
| `error` | Map bounded code to local remote-specific error. Strip detail/title/raw message. `stream_expired` drives transcript recovery; no automatic new turn |
| tools | Display remote status only; **never execute local tools**. Unknown result payload cannot be cast to terminal output. Known textual result can use existing tool block, otherwise report unsupported structured result without dropping text |
| permissions | Fail closed; no synthetic local `PermissionService.reply`, no invented Always grant. Unsupported action state must be visible; backend prompt can remain pending and this client cannot claim completion |
| disclosure/safety | These can appear in ordinary Chat (new-chat disclosure is emitted unconditionally). Explicit neutral notice mapping using existing text/note treatment; localized product strings/referral fields, no raw error copy. Blocking notice cannot be silently discarded |
| image_generation/artifact/structured events | Image **input** phase does not imply generated-media acceptance. Map a verified finished file via main-only download/IPC bytes when supported; otherwise visible unsupported-output state and known-history recovery. SDK0.3.1 tail defect remains a gate for generated-media completion; do not fake finality |

## 7. History, detach, UI approval gates
- Phase list is only current-process known chats, visibly limited; no exhaustive remote history claim. `history(cnv)` is owned recovery/reopen, bounded latest100/max200 active-path projection. `has_more:false` is hardcoded despite caps; no cursor. Reasoning/tools omitted. Preserve in-process reasoning while reconciling matching messages; after process restart it is unavailable, never reconstructed/faked.
- Backend detail includes stored model slug but omits effort. Known newly created threads retain chosen effort in memory; recovered old threads use truthful “server setting unknown” and must not send a falsely chosen effort. First phase therefore does not import unknown prior conversations for continued sends.
- Existing follow-up body model/effort is ignored by backend. **Minimal phase locks both to first admitted choices**, with New chat for changes. Do not silently map current picker changes to ignored fields or introduce one-off semantics without explicit UI.
- `detach` cancels this delivery reader only; backend continues. Store detached status (new explicit status/error code), suppress spinner/success and disable another turn until resume/history reconciliation. `remote /abort` must not show existing `chat.stopped`; original local stop remains unchanged.
- **Approval needed before functional UI:** existing popup has boolean Thinking switch, not Low/Medium/High. Request design-owner permission to replace its remote-only row with labeled three-value radio/segmented control, default Medium explicitly; no Off, no “On=medium” silent mapping. Omit effort for nonreasoning models; preserve local boolean control unchanged.
- Request same bounded approval for remote-only locked follow-up choices; Detach/Resume labels + “generation continues” copy; session-only/limited-history notice; ambiguous admission/reconnect state; unsupported remote actions. Reuse existing popup/radio/segmented/toast/note/error components only after disposition; component availability is not screen/state approval.
- Reusable without new layout: chosen remote model list with confirmed badges, file chips, existing reasoning/text transcript, sanitized errors and existing login/Connection path. Remote no-model/auth failures link Connection/login, **not** local provider-key Settings.
- `ModelComposer` needs explicit source/epoch, remote model DTO branch, effort union, locked follow-up selection, image-only `hasContent`, separate per-source selection memory. Epoch-keyed drafts must not auto-upload old-account attachments; retain accessible failed draft through explicit recovery, clear outgoing visible account content on successful switch.
- `Home/LiveChat` must bind send target from tagged session, not current connection. Old local chat navigation under remote mode cannot silently send locally with remote-looking controls: require switching to Local before send. Remote Chat sidebar, History and global Search Chat results query current epoch/source; clear stale local Chat rows on mode change. Code/Bots/routines remain explicitly local.

## 8. Exact ownership and bounded proof
Freeze seam/DTOs first; after that independent lots may proceed. No worker invents overlapping interfaces.
| Exclusive lot | Files | Deliverable |
| --- | --- | --- |
| Contract/core coordinator | `packages/schema/src/index.ts`, `packages/core/src/{connection,index,session,bus}.ts`, new `remote-chat.ts`; `packages/{protocol,server,client}/src/index.ts` | Above host binding/DTOs; explicit source dispatch, ephemeral ledger/projection/bus, routes/reset/status; local callers untouched |
| Main adapter after type freeze | `packages/desktop/src/{remote-session,main}.ts`, new narrow `remote-chat-contract.ts`; focused desktop remote tests | Private identity binding, split Fetch policies, zod catalogue/upload/history/headers, streaming callbacks, expiry/late-response isolation |
| UI after owner disposition | `packages/app/src/screens/chat/{model-composer,live-chat,pages}.tsx`, `screens/system/search.tsx`, `state/live.ts`, `shell/shell.tsx`; affected Chat actions | Reused render tree, source/epoch guards, explicit effort/locked choices/detach/limited-history, safe retry; no new screens |
| One copy/docs owner | Eight locale `chat/system` catalogues, `AGENTS.md`, matching `.rules`, `docs/{connection-modes,architecture,providers,testing}.md` | Remote-specific neutral errors and truthful process/history/reasoning semantics |
| Verification after implementation | Focused core/desktop tests + one remote Electron case | No SQLite remote persistence/local provider requests; header refusal/draft retention; account-switch late-callback suppression; same-key resume; length/error/detach semantics; known image+reasoning output |

Minimal new error codes/copy: `remote_auth_required` (Connection), `remote_connection_changed`, `remote_request_failed`, `remote_admission_uncertain`, `remote_stream_detached`, `remote_resume_expired`, `remote_action_unavailable`; keep model/input/count limits on existing accurate codes where possible. Core owns codes, one catalogue owner supplies all8 locales; renderer never uses remote `detail`.
Real proof still needs supplied Cloud account/OTP access or eligible self-host identity, actual configured vision/reasoning model and server-side inference credential/quota. Presence-only check below records existing proof variables absent; local-provider keys would not establish remote authentication.
Runnable fixture: `/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node --experimental-strip-types /tmp/opencode/desktop-remote-routing-contract/check.mjs`.
Result: **PASS, Node22.23.3** — Cloud field validation/kind filter; 50,000 Unicode code points;20 attachment ceiling; image-only/boolean-effort refusal; cnv/assistant header validation; actual API-types parser to local Event text/reasoning shapes/equal-ID frames; truncated finish; stripped error detail; epoch isolation. This validates contract examples, not network/engine integration.
No repository code, dependency, release, CI, build, Mac or commit action performed. Small checks/manifest live in `/tmp/opencode/desktop-remote-routing-contract/`.
