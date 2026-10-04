# Desktop SDK 0.3.1 admission readback

**PASS — immutable pair, canonical provenance, precise OTP/MFA/local-login/Library contracts. HOLD — complete remote-product admission.** Password/signup/refresh, Cloud catalogue, account identity, turn inputs and history are not fully typed; media-tail loss and generated feedback screenshot corruption reproduce in the exact 0.3.1 archive.

Readback: 3 October 2026, 01:57–02:20 UTC. Terminal executor; no delegation. Writes confined to this report and `/tmp/opencode/desktop-sdk-031-readback/`. Desktop/backend/vendor/package sources untouched. No upstream suite, build, native launch, backend deployment or credential acquisition performed.

## 1. Admission evidence

| Item | Verified value |
| --- | --- |
| Published G3 source | `ce05a6040ec05ac479d23dc2f701c8835a529663` |
| Runtime source | `216396b1295e512d4c26d21be720bbae1facc0bf`; final commit changes only `packages/sdk/test/runtime.test.mjs` |
| G2 source | `70a3056f7223a7eb9257d984848d4d33fee7ec12` |
| Canonical schema Git blob | `d6d46014d1c436b96540529dca2a3005556ae920` |
| Canonical schema SHA-256 | `93806bd0f31a0499b6bded99a25b319a90cd5afc011b70021ba921ed12107724` |
| SDK artifact | `/root/cortex-goals/releases/sdk-0.3.1-ce05a6040ec0/cortex-sdk-0.3.1.tgz` |
| SDK SHA-256 | `d47fb53878385849d74822b22526838aa3f99a3cbccb96ec95324a419838d12e` |
| API-types artifact | `/root/cortex-goals/releases/sdk-0.3.1-ce05a6040ec0/cortex-api-types-0.2.0.tgz` |
| API-types SHA-256 | `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877` |
| Owner receipt SHA-256 | `0dfaf694aef44d0a9a8130a376eb9c95d69b220b8f4d57eff17fa6cf5f76a5b9` |

Both extracted manifests match those versions. SDK declares exact optional peer `@cortex/api-types: "0.2.0"`; both packages are required for runtime adoption. Neither packed manifest contains a monorepo-relative runtime dependency. All 35 packed source files match committed `ce05a604` and runtime `216396b1`; all 16 generated-file hashes match the owner receipt. Schema bytes match both pinned G2 and G3 commits. Eight passing owner-check logs and four negative-evidence logs match their recorded SHA-256 values.

Canonical inventory has **422** operations; SDK has **421** because generation excludes the single internal host-agent credential operation. No operation-count discrepancy.

Owner receipts, **read/hash-verified, not rerun**:

- `receipt.json`: 40 API-types tests, 24 SDK runtime tests, 48 integration tests, 421 operations/51 dedicated groups/four examples, 15 embedded/OpenAPI tests; isolated npm/Node 22 and Bun runs, 24 SDK tests each.
- `ci.json`, `ci-sdk.log`, `remote-gates.json`: CI `37084973406`, exact `ce05a604`, success. **12 listed jobs: 11 success, one optional `Probe CodeQL CodeBuild x64` skipped.** SDK log hash matches; integration uses real APIs/datastores with controlled identity/inference/catalogue fixtures.
- `codeql.json`: `37084973410`, exact `ce05a604`, all three analyses successful.
- `independent-review.json`: previous scoped approval, distinct from hosted inference, consumer adoption and formal GitHub approval.

Local execution, exact extracted pair:

- `consumer-signatures.mts`: TypeScript **5.9.3**, strict, declaration checking enabled; positive signatures plus nine expected-negative checks pass. No casts; empty `consumer-signatures.log` records zero diagnostics.
- `consumer-check.mjs`: Node **24.21.0**, local Fetch fixtures only. Shared error constructors pass; Library bytes/filename pass; screenshot corruption and post-done media truncation positively reproduced.
- `verify.py`, `remote-readback.py`: admission and retained-CI assertions pass. Runnable commands at the end.

## 2. One fresh PR #447 observation

One GraphQL request completed **2026-10-03T01:57:49.701080Z**. PR open, head `ce05a604`, base `goal/self-host-providers`. Filtered once after the prior **00:32:22 UTC** cutoff: nine created/updated issue comments, ten submitted review records.

- Canonical delivery: <https://github.com/CortexLM/backend/pull/447#issuecomment-5963993015>.
- G4's two reproduced concerns: <https://github.com/CortexLM/backend/pull/447#issuecomment-5964001037>.
- **CodeRabbit is no longer merely pending:** review completed, six actionable comments, <https://github.com/CortexLM/backend/pull/447#pullrequestreview-5398330615>. Its summary flags generated screenshot corruption and embedded startup cleanup. Embedded-backend lifecycle does not affect desktop's HTTP SDK adapter; screenshot concern is independently confirmed below.
- Two automated security reviews request changes; observations retained verbatim in the snapshot. This executor has not adjudicated every review finding and gives no whole-PR approval. Named cursor/dead-code allegations are not substitutes for source inspection; the supported handwritten turn helper validates numeric cursors and checks the original key before generating a default.
- Owner checkout was concurrently modified, including an observed transient 0.3.2 manifest. **All technical conclusions use immutable 0.3.1 archive bytes and `git show ce05a604:…`, never dirty owner files.** No later owner candidate is admitted here.

Saved: `pr447-once.json`, `pr447-after-0032.json`, `remote-readback.json` under the scratch directory. No second GitHub poll.

## 3. Exact public surface

Imports from `@cortex/sdk`:

```ts
createCortexClient(options?: CortexClientOptions): CortexClient
type CortexClientOptions = {
  baseUrl?: string;
  auth?: {
    token?: string | (() => string | null | undefined | Promise<string | null | undefined>);
    refresh?: (signal: AbortSignal) => Promise<string | null>;
    signal?: AbortSignal;
  };
  fetch?: (request: Request) => Promise<Response>;
  headers?: Record<string, string>;
  cookieJar?: boolean;
};
```

`CortexClient` is an interface, not a constructor. Root exports generated operation/schema types, `ApiError`, `IncompleteStreamError`, `isProblem`, `StreamEvent`, `Problem`, `ErrorCode`, `MfaRequirement`, `RealtimeMessage`, `turnStream`, `eventSubscription`. `readStream`, branded IDs, `Model`, `Page` remain API-types exports, not SDK-root substitutes. Desktop already uses the factory, so G4's broad legacy-client replacement issue does not block the existing probe.

### Precise auth and upload calls

Default generated methods throw on error and return data directly. The following signatures were compiled against packed declarations:

```ts
client.instance.list(): Promise<Instance>
client.providers.list(): Promise<ProviderPage>
client.registry.models.list({ query?: {
  configured?: boolean; provider?: string; reasoning?: boolean;
  image?: boolean; tools?: boolean; min_context?: number;
  q?: string; limit?: number; cursor?: string;
} }): Promise<RegistryModelPage>

client.auth.magicAuth.create({ body: { email: string } }): Promise<void>
client.auth.magicAuth.verify.create({ body: {
  email: string; code: string;
} }): Promise<InteractiveAuthResponse>
client.auth.verifyEmail.create({ body: {
  code: string; pending_authentication_token: string;
} }): Promise<InteractiveAuthResponse>
client.auth.mfa.verify.create({ body: {
  code: string; pending_authentication_token: string;
  authentication_challenge_id: string;
} }): Promise<AuthSession>
client.auth.local.create({ body: {
  email: string; password: string;
} }): Promise<LocalSession>
client.auth.local.logout.create(): Promise<void>

client.library.create({
  body: Blob | File,
  query: { filename: string; conversation_id?: string; project_id?: string },
  headers?: HeadersInit,
}): Promise<LibraryUploadResponse>
client.library.content.list({ path: { id: string } }): Promise<Blob>
```

These are shortened call signatures; generated `Options<…>` additionally accepts request controls such as `signal`. Write-only input fields live in `LocalLoginRequestWritable`, `MagicAuthVerifyRequestWritable`, `MfaLoginVerifyRequestWritable`; their unsuffixed schema types deliberately omit password/code/pending fields. Use the operation body's type or the `Writable` export.

`InteractiveAuthResponse` discriminates on `status`:

| Status | Fields beyond status | Meaning |
| --- | --- | --- |
| `session` | `access_token` | Only signed-in success; refresh cookie, no refresh token in this interactive JSON |
| `verify_email` | `email`, `pending_authentication_token` | Continuation, no new session |
| `mfa_challenge` | pending token, `authentication_challenge_id`, `authentication_factor_id` | Continuation |
| `mfa_enrollment` | challenge fields plus `qr_code`, `totp_secret` | Sensitive enrollment continuation |

`LocalSession` additionally requires `token_type: 'Bearer'`, `expires_at`. Local credentials/bearer remain memory-only; no local refresh cookie. `MfaRequirement` is exactly `enrollment_required | challenge_required | reauth_required`; the last requires fresh local password sign-in, not Cloud refresh.

Library's body is raw bytes, `bodySerializer:null`, default `application/octet-stream`; filename required. Backend documents 1–10,485,760 bytes, content sniffing, caller-owned optional conversation/project, quotas and possible media repacking. Response includes `id`, `filename`, `content_type`, `byte_size`, `kind`, `artifact_kind`, `source`, `access:'owner'`, `can_preview`, `created_at`, optional ownership links. Ordinary image attachments use **this** upload, not feedback screenshots.

### Available routes with incomplete type contracts

| Exact call | Actual 0.3.1 declaration / source limit |
| --- | --- |
| `client.auth.password.create({body?})` | `body?:unknown`, result `unknown`; source accepts email/password, yields four-state interactive auth |
| `client.auth.register.create({body?})` | `body?:unknown`, result `unknown`; source creates email/password account then interactive continuation; not a precise signup contract |
| `client.auth.refresh.create({body?, signal?})` | Input/output `unknown`; source cookie-only call yields interactive session, explicit `refresh_token` body yields CLI JSON including rotated refresh token |
| `client.auth.logout.create()` | Result `unknown` although current backend returns 204 |
| `client.startGuest()` | Handwritten `Promise<{kind:string;user_id:string}>`, internal unchecked JSON assertion; generated `auth.guest.create()` remains unknown. Guest is not signed-in member proof |
| `client.models.list()` | `Promise<unknown>`; API-types `Model`/`Page<Model>` availability does not type or validate this result |
| `client.me.list()` | `Promise<unknown>`; current source returns email/display name/is_guest/plan/quotas, **no stable user ID** |
| `client.conversations.list()` | `Promise<unknown>`, generated `query?:never`; backend supports limit/project/pinned/archived/search |
| `client.conversations.get({path:{id}})` | `Promise<unknown>` |
| `client.conversations.messages.list({path:{id}})` | `Promise<unknown>`, generated `query?:never`; backend supports limit/message window |
| `client.code.sessions.create({body?})` | Input/output `unknown`; remote Code runtime contract differs from local selected-folder Code |
| `client.code.sessions.cancel.create({path:{id}})` | Result `unknown`; actual cancellation exists for Code only |

Generated `client.conversations.turns.start()` and `client.conversations.turns.create({path:{id}})` return raw `ReadableStream<Uint8Array>` but declare **`body?:never`**. They cannot type a usable new/follow-up Chat request. Do not conceal this with casts or low-level response generics.

The owner schema confirms five corrected auth/upload operations, not a fully typed remote workflow. G1 may implement explicit runtime validation of a bounded, owner-confirmed `unknown` response using existing zod; that remains a consumer adapter, not newly delivered SDK typing. Required signup/password/refresh/identity/turn/history contracts need explicit owner disposition before claiming complete typed support.

### Stream/replay calls

```ts
client.streamTurn({
  conversationId?: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
}, options?: ResumeOptions): AsyncGenerator<StreamEvent, void, undefined>

client.streamCodeTurn(sessionId: string, {
  body: Record<string, unknown>, idempotencyKey?: string,
}, options?: ResumeOptions): AsyncGenerator<StreamEvent, void, undefined>

client.streamPath(path: TurnPath, { body, idempotencyKey? }, options?)
client.subscribe<RealtimeMessage>(options?: ResumeOptions)
client.subscribePath<AgentEvent>(path: string, options?: AgentResumeOptions)
```

`ResumeOptions`: `lastEventId`, `onEventId`, `onResponse`, `onError`, `signal`, `maxReconnects`, `retryDelayMs`. `AgentResumeOptions` adds UUID `since`. Defaults: turn reconnect limit five, initial delay 250ms, 30s cap; subscriptions unlimited. `onResponse` exposes `x-conversation-id` and `x-message-id` (assistant message). Main must validate/sanitize headers, never forward full `Response`.

- Chat starts on `POST /v1/conversations/turns`; no separate Chat create-conversation endpoint. Follow-up uses `/v1/conversations/{id}/turns`. `streamTurn` lazily sends on iteration, not on generator construction: clear a draft only after actual backend admission, not when obtaining the generator.
- Concrete body fields exist in pinned backend `server/src/api/turns/create.ts:84–149`: `message`, `model_slug`, `reasoning_effort`, `attachment_ids`, optional continuation/context fields. SDK's `Record<string,unknown>` does **not** validate them.
- Reasoning `low|medium|high`; new conversation omission defaults medium. Normal follow-ups retain stored model/effort; merely sending another `model_slug` or effort does not change them. Chat supports `one_off_model_slug`; current conversation patch does not change model/effort. Desktop's boolean reasoning/current per-send model interface needs explicit adaptation.
- Persist/reuse original POST path/body/key plus numeric cursor. For the first turn, replay the original no-ID POST even after `x-conversation-id` arrives; use that ID only for the **next** turn. A cursor without original key rejects before Fetch. Equal numeric IDs do not deduplicate distinct frames. `stream_expired` means reload durable transcript, never automatically create a new turn.
- Backend idempotency mapping is account-scoped, 24-hour TTL, written after transaction commit; write failures are logged. SDK cannot guarantee exactly-once generation if that mapping/buffer is unavailable. Ambiguous sends must reconcile history rather than silently become new sends.
- Abort reader = delivery detached; Chat generation continues. No Chat cancel route; Code cancel does not apply. Remote UI must not label detachment as stopped generation or persist a successful completion.
- Agent feeds use UUID query `since`; realtime uses numeric Last-Event-ID and process-local replay. `subscribePath<T>` JSON is not a runtime proof of `T`; validate envelopes before IPC.

Sources: extracted `src/client.ts:18–85,116–263,265–336`, `src/stream.ts:43–60,150–194,197–245`, generated `types.gen.ts:3785–3836,4049–4072,4413–4443`.

## 4. G4 concerns: exact desktop relevance

**Media terminal — HOLD for generated-media completion via 0.3.1 helpers.** `src/stream.ts:169–171` hardcodes `stopAtTerminal:true`; no public opt-out. Exact archive reproduction supplies `image_generation:generating`, `done`, `image_generation:done`. API-types `readStream` delivers three; SDK `streamTurn` delivers two. Uploaded-image input plus ordinary text/reasoning output is a narrower path; this finding does not invalidate typed Library upload. Any promise to render all generated media requires corrected owner package or explicitly approved/verified alternate transport. Do not silently replace the supported helper and inherit untested replay/auth behavior.

**Feedback screenshot — HOLD for that generated route.** `feedback.bugs.screenshots.create` has `body?:unknown`, `query?:never`, JSON serializer/default. File becomes `{}`. Exact 0.3.1 reproduces it; filename is separately rejected by compile check. G4's earlier explicit low-level raw request worked, but that does not repair generated typing. Desktop has no current live feedback screenshot route; this does not block OTP/local login, discovery or Library image uploads. Keep the issue open until owner schema/generator reconciliation; no vendor patch.

**G4 legacy replacement concerns** (`request/blob/stream/sse/streamBaseUrl` absence, 87 API-types imports) concern its existing web client. Desktop already uses `createCortexClient`, runs in main against one validated API origin, so those are not blanket desktop blockers.

Additional existing contract mismatch: owner integration explicitly passes a Cloud case where a non-vision model withholds the image yet succeeds. Desktop's retained-file contract forbids silent image discard. Main must gate selected-model/history attachment capabilities before submission; false/zero registry metadata from unavailable enrichment is not proof of supported input. Retain draft/files on unknown/incompatible capability and refusal.

## 5. Main-only integration boundaries

1. **Factory per origin/account lifetime.** Preserve desktop `ConnectionUrl` validation, pinned-origin Fetch, `redirect:'error'`, request deadline/abort composition. SDK alone does not pin an origin or reject redirected credential-bearing requests. Every auth, refresh, catalogue, upload, download and stream request must use the guarded transport. Never repoint `client.http.setConfig` to a new identity/origin.
2. **Main owns auth.** Bearer, cookie jar and pending continuation tokens/challenge IDs remain in main. Only server-confirmed `status:'session'` establishes signed-in state. Expose sanitized status through schema/protocol/client, never the entire SDK response. Enrollment presentation needs approved handling of QR/TOTP material; no tokens/logs/raw errors in renderer state. Abort old `auth.signal` before identity replacement, clear private UI/query state, create a fresh client. Source rotation protection does not replace this lifecycle.
3. **Cloud refresh is distinct.** Runtime fixes cover same-client 401 refresh deadlock, single-flight refresh, late-cookie rejection and Node 22 auth-body detachment. Pass refresh callback signal to its own request. The endpoint still returns `unknown`, requiring an agreed validated response contract. SDK jar is private, memory-only, no persistence export/import API. A first process-lifetime implementation can require reauthentication on restart; durable login requires a separately designed main-only credential/cookie store. Local mode must retain its no-refresh behavior.
4. **Separate execution identity.** Current `ConnectionService` stores preference only; every prompt still calls local `SessionService`, local provider settings and local catalogue. Inject main-owned remote operations through core's existing host-options pattern; keep SDK imports in desktop. Explicit remote session/origin/account references, admission state, selected remote slug/effort and sanitized stream events are necessary. A provider base-URL swap cannot implement this.
5. **Remote history/account isolation.** Backend list/get/messages/delete query owner scope and return not-found for foreign IDs; SDK account-lifetime cancellation prevents old transport reuse. G1 must independently isolate in-memory requests and any local cache by origin plus authenticated identity/epoch, drop late responses, clear on switch/logout. `/v1/me` lacks a stable account ID; do not use email, decoded-unverified token data or renderer `signedIn` as persistent ownership authority. An initial no-cross-login-cache implementation is possible; durable per-account cache needs a stable identity contract.
6. **Transcript fidelity has a ceiling.** Pinned backend history returns text/attachments/generated artifacts but filters out stored reasoning/tool blocks (`conversations.ts:193`, `:216–232`). No typed full-history DTO; list defaults 50, messages defaults 100/max200, returns `has_more:false`; generated query types omit supported filters/windows. Live reasoning proof does not imply reasoning replay after reload or exhaustive history pagination. Owner clarification required for broader parity.

## 6. Minimal phases and precise write ownership

These are recommendations for the coordinator, not authorized writes by this executor.

| Phase / exclusive owner | Recommended files | Exit condition |
| --- | --- | --- |
| Pair intake / coordinator | Add both new `vendor/*.tgz`; `packages/desktop/package.json`; `bun.lock`; `vendor/README.md`; coordinator-owned `AGENTS.md`, `docs/connection-modes.md`, evidence/status | Exact pair recorded; old archives/HOLD retained; existing probe checked against new dependency |
| IPC contract owner | `packages/schema/src/index.ts`; `packages/protocol/src/index.ts`; `packages/client/src/index.ts`; `packages/server/src/index.ts`; matching schema/client/server tests | Sanitized auth/continuation/model/session/admission DTOs; write-only secrets; known neutral errors; no renderer-auth assertion |
| Main transport/auth owner | `packages/desktop/src/remote.ts`, new narrowly scoped `packages/desktop/src/remote-session.ts`, `packages/desktop/src/main.ts`; `packages/desktop/test/remote*.test.ts` | Origin/account-bound OTP/email/MFA/local lifecycle and guarded SDK transport; malformed reply/refusal/expiry/switch/late-cookie tests. Credential-store edits only when persistence scope is approved |
| Core routing/admission owner | `packages/core/src/connection.ts`, `packages/core/src/index.ts`, a remote session implementation if needed, `packages/core/src/session.ts` only for explicit routing seam; focused core tests | Selected remote model/Library upload/start/follow-up mapping; stream state and account-bound history; refusal retention; no local fallback; detach distinguished from cancel |
| Existing-surface UI owner, after contracts | `packages/app/src/screens/system/account.tsx`, `settings.tsx`; `screens/chat/model-composer.tsx`, `live-chat.tsx`; `state/live.ts` if identity invalidation needs it; focused `tests/e2e/remote*.spec.ts` | Existing email/code/Connection/Chat states wired; approved continuation states only; remote choices and unsupported actions honest; drafts retained |
| Single catalogue/docs owner | Required `packages/i18n/locales/*/{system,chat}.json` keys; coordinator-owned `AGENTS.md`, `.rules/06-product.md`, `docs/{connection-modes,architecture,providers,testing}.md` | Eight-locale parity and truthful scope; main-only boundary documented |

Reserve shared index/docs files to one owner; agree DTOs before dependent workers edit. Keep Phase 1 limited to main transport plus already precise auth/discovery/Library paths. Full remote Chat starts only after the turn/history/capability/admission contracts above are explicit. Password/signup and remote Code/Work are subsequent typed-contract work, not implied by generic operation coverage. Approved Platform continuation source/state import remains a separate design disposition.

## 7. Remaining inputs for real Cloud/self-host proof

- **Cloud:** reachable deployed backend with identified compatible revision; an authorized test account and usable OTP mailbox (or password only after contract admission), required MFA enrollment/challenge access, model entitlement/quota, working actual inference route with image input plus reasoning. No identity-provider service secret belongs in desktop.
- **Self-host:** target origin and `instance` auth mode; for `local`, operator email/password supplied privately; for `none`, reachable operator-configured host/network boundary; for `cortex`, its configured interactive auth. Registry must contain a genuinely configured vision/reasoning model and server-side provider credentials. Client provider keys do not establish backend inference.
- **Contract completion:** precise password/register/refresh/logout and `/me` stable identity; explicit typed turn body and response headers; Cloud catalogue/history/window types; reasoning/model-change semantics; media-terminal reconciliation for generated-media scope. Screenshot correction only for feedback-screenshot scope. No invented Chat cancel or Off.
- **Proof flow:** acquire actual session; upload known image; start typed/validated selected-model turn; observe reasoning/text; reopen durable history; exercise bad auth/expired auth/refused send, same-origin account switch plus cross-origin switch; detach/reconnect using same POST/body/key/cursor without duplicate turn; verify foreign conversation/upload refusal. Bind receipts to adopted dependency/application revision, then package/native-check affected surfaces under the desktop workflow.
- Presence-only environment check: `CORTEX_TEST_BACKEND_URL=false`, `CORTEX_REAL_BASE_URL=false`, `CORTEX_REAL_API_KEY=false`. No values read into reports. These absences do not prove credentials unavailable elsewhere; no private files searched. Existing provider variables would establish only local-provider proof, not automatically Cortex Cloud account proof.

## 8. Preserved baselines and receipt paths

- Desktop `vendor/cortex-sdk-0.2.0.tgz` SHA-256 still `536f57c026a7a8a1f04f1eb80b3f682f6becd514e789b998fcf28b86de7df9e7`.
- Desktop `vendor/cortex-api-types-0.1.0.tgz` still `6e97d4f92c5e098ac989589fc81ca70bed1abc018383994e397c49d61837b134`.
- SDK 0.3.0 remains HOLD: `/root/cortex-goals/releases/sdk-0.3.0-f96950bbd4e7/ADOPTION-HOLD.md`; Node 22 native-response failure and original artifacts retained.
- Admission receipt: `/tmp/opencode/desktop-sdk-031-readback/admission.json`.
- Fresh PR/retained CI receipt: `/tmp/opencode/desktop-sdk-031-readback/remote-readback.json`.
- Signatures: `/tmp/opencode/desktop-sdk-031-readback/consumer-signatures.mts` and `.log`.
- Four bounded runtime checks: `/tmp/opencode/desktop-sdk-031-readback/consumer-check.json` and `.mjs`.
- Source: extracted exact pair under scratch `node_modules/@cortex/`; `canonical.openapi.json`; pinned backend readbacks under `public-source/`.
- Owner handoff: `/root/cortex-goals/releases/sdk-0.3.1-ce05a6040ec0/{HANDOFF.md,receipt.json,SHA256SUMS,independent-review.json,remote-gates.json,negative-evidence.json}`.

```sh
python3 /tmp/opencode/desktop-sdk-031-readback/verify.py
python3 /tmp/opencode/desktop-sdk-031-readback/remote-readback.py
node /tmp/opencode/desktop-sdk-031-readback/consumer-check.mjs
node /root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck false --target ES2023 --module NodeNext --moduleResolution NodeNext /tmp/opencode/desktop-sdk-031-readback/consumer-signatures.mts
```

**Disposition:** canonical delivery prerequisite satisfied; main-only bounded integration may proceed under the stated scopes. Whole-SDK/whole-remote-product approval withheld. Existing docs' “pair undelivered at 00:32” is a valid historical snapshot, no longer current status; coordinator owns that update. No desktop adoption, real remote inference or native proof is claimed by this readback.
