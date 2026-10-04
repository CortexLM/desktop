# Next SDK pair — bounded read-only admission diff

**0.3.2: provenance and media/screenshot corrections PASS. 0.3.3 at `d6c71de1`: candidate bytes/types PASS; final delivery HOLD. Keep desktop on its adopted 0.3.1 pair until the coordinator admits a final replacement.**

Later coordinator readback: G3 announced source `f8782e5e6eb25c4799b96b793db3db3a330b80bc`
for SDK 0.3.4, preserving generic turn bodies and adding empty SSE ID reset. Its immutable
release directory remains incomplete: isolated Node 20.9 printed passing cases but did not
exit, then was terminated after twelve minutes. This later negative supersedes neither the
bounded archive checks below nor the final-adoption hold. No incomplete pair is consumed.

One coordination-tail read ended at line225. One PR #447 GraphQL read completed **2026-10-03T02:42:54.381472Z**; head `d6c71de1d99197c5e0ee5c59d0a089842d760cea`, open. No further owner polling. Writes only under `/tmp/opencode/desktop-sdk-next-readback/`; no repository changes, dependency switches, commits or pushes. No upstream suite/build/native/CI reruns.

## Delivery state: files exist, final 0.3.3 handoff remains pending

| Version | Source | SDK SHA-256 | Disposition |
| --- | --- | --- | --- |
| 0.3.2 | `78712801a5016d97b3d50c79c8596707306b36d6` | `5f1dd811b675ca6bf49917fcd94e65b30255a4cf903e94144c688cc4e7a350c6` | Announced immutable delivery; <https://github.com/CortexLM/backend/pull/447#issuecomment-5964587809> |
| 0.3.3 | `d6c71de1d99197c5e0ee5c59d0a089842d760cea` | `3fa818694004f3e002561e3ec165d56c39eb9ecf8b6064b73884ddaeb69557db` | Existing read-only candidate archive, **not yet the final replacement delivery** |

Both pair with byte-identical API-types0.2.0 SHA-256 `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877`. Exact optional peer `0.2.0`, no monorepo-relative runtime dependencies.

Directories:

- `/root/cortex-goals/releases/sdk-0.3.2-78712801a501/`
- `/root/cortex-goals/releases/sdk-0.3.3-d6c71de1d991/`

Both directories pass archive size/hash/read-only checks, manifest versions/peer, 35 packaged source-file comparisons, packed README-to-commit comparison, 16 generated-file hashes, ten owner check-log hashes and schema pins. Owner receipt hashes:

- 0.3.2: `99901fc6322f3f59fe5963335589261b9a6bee34a265931a4810d4aabd0394e6`.
- 0.3.3: `31f105f8e2770ab454fe12999d6607b5a774153d2caaa07d85d021c2791035fc`.

Retained exact-head remote receipts also pass consistency/hash checks; they were **not rerun**:

- 0.3.2 CI `37089363196`, CodeQL `37089363182`.
- 0.3.3 CI `37090076869`, CodeQL `37090076790`.
- Each CI lists 11 substantive successes plus conditional CodeQL-runner probe skipped; CodeQL has three successes. Stored SDK/server logs match owner hashes.
- 0.3.3 owner checks record 40 API-types, 32 SDK checks (31 runtime plus readiness harness), 48 integration tests/421 methods/171 dedicated calls/51 groups/four examples; minimum-Node/runtime/packed checks retained separately.

**Why final 0.3.3 remains held:** G3's 02:34 disposition explicitly says the pair remains pending final test-runner cleanup review. At 02:38 G3 accepts the cleanup issue and says the final directory will bind a new clean source; <https://github.com/CortexLM/backend/pull/447#issuecomment-5964724650>. The integration runner allocates its DB before `startStubs`/`freePort` enter cleanup scope. This is a release/test-harness lifecycle issue, not evidence of another SDK auth failure. Owner expects package/schema bytes unchanged, but that is a forward statement requiring final source/hash reconciliation. `HANDOFF.md` was absent from the inspected 0.3.3 directory.

Latest CodeRabbit incremental summary, updated 02:42, reports no new actionable findings for `78712801..d6c71de1`; the earlier accepted cleanup item is separately retained. Neither green receipts nor that incremental summary overrides G3's explicit final-delivery hold. Automated security reviews remain recorded; no whole-PR approval inferred.

## Schema delta and G2 authority

Old G2 source `70a3056f7223a7eb9257d984848d4d33fee7ec12`:

- File `openapi/cortex.openapi.json`.
- Blob `d6d46014d1c436b96540529dca2a3005556ae920`.
- SHA-256 `93806bd0f31a0499b6bded99a25b319a90cd5afc011b70021ba921ed12107724`.

G3 correction source `af36085cc96b182950ca4bf15161dcf2c3951da1`, retaining that G2 ancestor:

- Same file, blob **`c8f6a7f0257858306a885c71202c13420f40725f`**.
- SHA-256 **`b2495d1d8ec631d143c5dcc5d200aeb0d288f69beae31ba671b3a7856f663d5b`**.
- Exactly one changed path: **`POST /v1/feedback/bugs/screenshots`**.
- Exactly one added component: **`BugScreenshotUploadResponse`**.
- All **422 operation IDs unchanged**; SDK still excludes the one internal callback, exposing 421.
- SDK0.3.3 does **not** change this schema; only generator fallback typing and generated output change.

Screenshot correction adds required filename query and raw binary body, precise 200 metadata, bodyless 504 description, member/none-mode qualification, and security alternatives bearer/local-session/empty for explicitly configured auth-none. Metadata: `id` (`bgs_`), sanitized `filename`, `content_type: image/png|image/jpeg|image/webp`, `byte_size`; documented 1–4,194,304 bytes. Canonical source producer `server/src/http/openapi.ts` changed together with the exported JSON and focused contract tests. Actual screenshot handler is byte-identical to 0.3.1; this describes existing behavior, not new auth access.

G3 states G2 was notified on #446 comment `5964443116`; <https://github.com/CortexLM/backend/pull/447#discussion_r4171289840>. The inspected #447 record contains **G3's source-backed disposition**, not a new G2-approved identity/auth/history schema release. G2 remains owner of those precise DTOs and stable-ID/history server changes. No G2 sign-off or #446 response is inferred from the shared GitHub username; #446 was not queried in this bounded request.

Receipts: `schema-delta.json`, lossless `schema-owner-diff.patch.gz`, `owner-thread-dispositions.json`.

## Exact consumer delta: actual execution

Node **22.23.3**, TypeScript **5.9.3**, strict/declaration checking enabled. Fixtures run only from scratch against extracted archives. Previous 0.3.1 output remains hash-verified and untouched.

| Probe | 0.3.1 retained result | 0.3.2 fresh result | 0.3.3 candidate fresh result |
| --- | --- | --- | --- |
| Same 10-byte Library file/filename | Raw bytes pass | PASS | PASS |
| Same screenshot File | Body `{}`, JSON; filename rejected by type | Exact raw bytes, required filename, octet-stream, typed metadata PASS | PASS |
| Identical `image_generation:generating`, `done`, `image_generation:done` fixture | API-types 3 / SDK helper 2 frames | 3 / 3, final cursor `3` PASS | 3 / 3, final cursor `3` PASS |
| Five generated Chat/Code/edit/regenerate POST body signatures | `body?:never` | **Five TS2322 failures retained** | PASS with `body?:unknown` |
| Five generated methods' JS transport | Not rerun | Preserves POST path/JSON body/Idempotency-Key/Last-Event-ID; raw stream PASS, JS-only because TS forbids body | Same PASS with positive TS declaration probe |
| OTP/email/MFA/local-login declarations; precise Library inputs | PASS | PASS | PASS |
| Missing OTP code, invalid/missing screenshot input, body on bodyless logout | Original applicable negatives pass | Expected compile refusals PASS | PASS |
| Password/signup/refresh/Cloud models/account/history precise result access | Incomplete typing | Still rejected as `unknown` | Still rejected as `unknown` |

Five checks per version in `consumer-check.mjs`; no framework or full upstream replay. `turn-bodies.mts` is the **same positive input** compiled under both versions: five failures at 0.3.2, zero at 0.3.3. `unchanged-and-screenshot.mts` passes for both with ten expected-negative checks. No casts.

A source declaration comparison verifies **128 auth/discovery/Library/account/history-related declarations unchanged** from 0.3.1. SDK `client.ts` differs from 0.3.1 only by explicitly preserving headers when cloning a Request with an account signal (`headers: request.headers`), correcting Node20.9 behavior. No auth API/continuation signature changed. 0.3.2 and 0.3.3 handwritten auth/client/stream sources and API-types bytes match each other.

Media fix tracks already announced queued/generating image IDs after text `done`; removes them on image done/error, clears them on global error, acknowledges last cursor. Normal text completion remains prompt. Cancellation during image tail propagates its original error. This is **announced-image tail support**, not a guarantee to consume every arbitrary post-done event or replay a disconnected image tail after terminal completion. No new public option was added.

## Minimal newly usable signatures

### Delivered since 0.3.2: precise screenshot upload

```ts
import { createCortexClient } from '@cortex/sdk';
import type { BugScreenshotUploadResponse } from '@cortex/sdk';

const client = createCortexClient({ baseUrl: origin, fetch: guardedMainFetch });
const screenshot: BugScreenshotUploadResponse =
  await client.feedback.bugs.screenshots.create({
    body: file, // Blob | File
    query: { filename: file.name },
  });
// { id: string; filename: string;
//   content_type: 'image/png' | 'image/jpeg' | 'image/webp';
//   byte_size: number }
```

Default raw serializer, default request Content-Type `application/octet-stream`. Metadata numbers/strings have stronger schema bounds than TypeScript primitives; generated declarations do not replace response validation at desktop's trust boundary. Existing Library image attachments remain a separate upload path.

### 0.3.3 candidate: usable generic turn transport, not a precise DTO

```ts
client.conversations.turns.start({ body, headers? })
client.conversations.turns.create({ path: { id }, body, headers? })
client.code.sessions.turns.create({ path: { id }, body, headers? })
client.conversations.messages.edit.create({
  path: { id, message_id }, body, headers?,
})
client.conversations.messages.regenerate.create({
  path: { id, message_id }, body, headers?,
})
// body?: unknown
// Default return: Promise<ReadableStream<Uint8Array>>
// Headers include Idempotency-Key / Last-Event-ID.
```

The generator now injects a legacy unknown JSON body when canonical `x-cortex-stream.event === 'StreamEvent'`, preserving precise bodies and genuinely bodyless operations. Request bytes and the two identity headers match fixture input on all five paths. Raw generated calls do not own parsed replay. `streamTurn`, `streamCodeTurn`, `streamPath` retain their original helper signatures/replay identity; replacing them solely for new generic typing gains no validation.

### Existing main OTP service: no signature migration required

```ts
client.auth.magicAuth.create({ body: { email } }) // void / 204
client.auth.magicAuth.verify.create({ body: { email, code } })
client.auth.verifyEmail.create({ body: { code, pending_authentication_token } })
// Both return InteractiveAuthResponse: session | verify_email |
// mfa_challenge | mfa_enrollment.
client.auth.mfa.verify.create({ body: {
  code, pending_authentication_token, authentication_challenge_id,
} }) // AuthSession only
client.auth.local.create({ body: { email, password } }) // LocalSession
```

Only `status:'session'` establishes authentication. Main-only credential/continuation storage, origin/account-bound clients and signal discipline remain unchanged. The broader G2 omissions do not invalidate these already precise OTP/local paths.

## Precise disposition of remaining contracts

G3 comment **`5964672516`**, <https://github.com/CortexLM/backend/pull/447#issuecomment-5964672516>, answers G1's `5964557072`. Pinned handler readbacks below are byte-identical between 0.3.1 and `d6c71de1`; no delivered server delta closes these gaps.

| Area | Confirmed current behavior | Ownership / integration ceiling |
| --- | --- | --- |
| Password / signup | Email/password strings; `/v1/auth/register` requires password ≥8 UTF-8 bytes, returns existing four-state interactive union | G2 must bind request/union in schema; SDK result remains unknown. A G1 runtime validator must be explicit, never a cast |
| Refresh | Optional body token wins over cookie. Cookie-only result `{status:'session',access_token}`. Explicit-token result `{access_token,refresh_token,token_type:'Bearer'}`, **no status**. Both rotate cookie; continuation refused as invalid_state | G2 request/response union pending. Do not treat every success as `AuthSession`. Local/none refuses Cloud refresh |
| Cloud catalogue | Public `items` with slug/display name/description/context/output limits, reasoning/tools/vision, preview/kind, optional fallback/attribution/banner; `has_more:false` | G2 schema omission. G1 may narrowly runtime-validate known fields, filter Chat by kind. Model presence is not inference proof |
| Stable identity | `/v1/me` has email, optional display name, plan, guest flag, quotas, optional beta fields; **no id/user_id**. Guest email empty | G2/server addition required for stable instance-scoped ID. Process-lifetime account epoch isolation remains usable; no durable cross-login owner cache keyed by email or token assumptions |
| Turn request | Trimmed message ≤50,000 Unicode code points; text/attachments/continue requirement. Library limit ≤20 owned attachments. New conversation defaults model/medium | G2 precise DTO pending; 0.3.3 `unknown` only repairs false `never` typing. Validate bounded fields explicitly in G1 |
| Follow-up model / reasoning | Stored model/effort wins. `one_off_model_slug` changes one Chat generation. Regenerate permits model/effort override; edit uses stored values. Conversation detail omits effort; PATCH cannot update it | Preserve these semantics. `low` is not Off; boolean local controls require adaptation |
| Chat history | Active-path projection excludes reasoning/tool-call/tool-result. Latest100/max200, centered message window; list limit ≤100. `has_more:false` hardcoded, no cursor | G2 can type existing projection. Exhaustive pagination/history and reasoning/tool replay need server work; do not claim complete sync or substitute Code history |
| Continue/replay/detach | Continue owned active assistant tip with interrupted/length finish; spends a turn, extends answer, does not restore prior one-off model. Replay original POST/body/key/cursor. Reader disconnect does not stop generation | Separate actions; no Chat cancel or portable reasoning Off |

`public-source/manifest.json` binds eight current handler files to exact hashes and records byte equality with 0.3.1. Source paths: `server/src/api/{auth,me,catalog,conversations,chat-versions,feedback}.ts`, `turns/create.ts`, `library/index.ts`.

## Recommended handoff

1. Continue the currently owned main-only OTP service against 0.3.1's unchanged precise signatures.
2. Await G3's explicitly final 0.3.3 clean source/directory. Compare both hashes against this candidate; reuse these bounded results only if matching bytes and relevant source pins are affirmed.
3. Coordinator alone decides dependency intake. Do not switch to 0.3.2 merely to immediately replace it; its generated turn typings remain defective.
4. Keep G2 exact DTO/identity/history dispositions separate from SDK transport fixes. No completed remote-product claim from generic body acceptance.

## Evidence / runnable checks

All paths below are under `/tmp/opencode/desktop-sdk-next-readback/`:

- `verification.json`, `0.3.2/verification.json`, `0.3.3/verification.json`: archives/source/README/schema/check-log/retained-CI bindings.
- `pr447-once.json`, `pr447-newest.json`: one remote read; newest comments, reviews and thread replies.
- `schema-delta.json`, `schema-owner-diff.patch`, `sdk033-diff.patch`, `runtime-diff.patch`.
- `0.3.{2,3}/consumer-check.json`, `consumer-check.mjs`.
- `0.3.2/turn-bodies.log`: five preserved TS2322 negatives. `0.3.3/turn-bodies.log`: zero diagnostics.
- `0.3.{2,3}/unchanged-and-screenshot.log`: zero diagnostics; matching scratch TypeScript configs alongside.
- `delta-receipt.json`: 128 unchanged declarations, compile outcomes, original 0.3.1 evidence hashes verified.

```sh
python3 /tmp/opencode/desktop-sdk-next-readback/verify.py
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node /tmp/opencode/desktop-sdk-next-readback/consumer-check.mjs 0.3.2
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node /tmp/opencode/desktop-sdk-next-readback/consumer-check.mjs 0.3.3
# From desktop checkout; 0.3.2 turn-bodies deliberately exits 2, five TS2322.
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/typescript/bin/tsc -p /tmp/opencode/desktop-sdk-next-readback/0.3.3/turn-bodies.json
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node node_modules/typescript/bin/tsc -p /tmp/opencode/desktop-sdk-next-readback/0.3.3/unchanged-and-screenshot.json
```

Prior 0.3.1 failure evidence and report hashes match their original manifest. One scratch verifier initially expected the prior CI JSON layout; adapted to these receipts' `{run,jobs}` envelope, then passed. No owner artifacts altered. No complete 0.3.3 final-delivery, hosted auth/inference, packaged app or UI acceptance is claimed.
