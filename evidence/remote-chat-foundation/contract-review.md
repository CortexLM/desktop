# Remote Chat contract review

**Verdict: bounded DTO approval against `d6c71de1`; one confirmed P2 HTTP-error semantic defect.** Public Cloud discovery remains the coordinator-owned compatibility gate. No Library `201` or optional-versus-null mismatch found.

## Reviewed bytes / provenance

- Desktop working-tree `packages/desktop/src/remote-chat.ts`: SHA-256 `6d58248c5e1546b20de74cc001d1c8f4eeb17ecff4259c619507b9c6069f49bc` (403 lines).
- Backend Git repository read-only: `/root/.local/share/opencode/worktree/77e7f3a6389915e58f4ac7433a96efadcf1c8c67/goal-sdk`.
- Handler pin: `d6c71de1d99197c5e0ee5c59d0a089842d760cea`. Read via `git show`/`git grep`, never the changing checkout's handler files.
- SDK pin: `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31`, installed SDK `0.3.5` / API-types `0.2.0`.
- Read `evidence/sdk-035-admission/{README.md,contract-delta.json,verification.json}` plus `owner/{contract-disposition.md,HANDOFF.md,receipt.json,delivery.json}`. Canonical schema blob remains `c8f6a7f0257858306a885c71202c13420f40725f`; precise generated Cloud/history DTOs remain absent.
- Freshly compared installed SDK `src/gen/types.gen.ts`, `src/client.ts`, API-types `src/index.ts` byte-for-byte with the SDK Git pin: all match. Generated types SHA-256 `dac1a8a77ecccc12ffabf464bbd0c18cd309bd65a3b62f98f9fbca4f93350222`.
- Fresh backend hash comparisons match the admission receipt; the following are also byte-identical between handler pin and SDK pin:

| Backend source | SHA-256 |
| --- | --- |
| `server/src/api/catalog.ts` | `69e437e8a1265ad23bc292fbf8dfaa81179285b36d460170364d3294043dccd8` |
| `server/src/api/library/index.ts` | `8ae09e41fc76a674b503fe313e4042e0e5cf16707ac29c65a9dc6e23a97efbfa` |
| `server/src/api/conversations.ts` | `4472959e8281074b1265c3842c59137ff0a4011f0d7177ce6beb9619bc445c82` |
| `server/src/api/self-host.ts` | `ae8149caade028ee044dc398b134f75d8abb39e1c513b7eed049f782e62532bb` |
| `server/src/inference/registry.ts` | `030e2dc4acef34edcff9b7bc553937b028e0128bf5aab044069feb7dbfb2d0d3` |

## Confirmed finding

### P2 — HTTP 403 is not an authentication verdict

**Location:** `packages/desktop/src/remote-chat.ts:157`.

Every 403 becomes `Refused("provider_auth_failed", ...)`. The actual Library handler emits 403 for attachment entitlement refusal even for a valid signed-in principal:

- `server/src/api/library/index.ts:300–305`: `enforceAttachmentQuota()` calls `entitlementRequired("attachment_bytes", ...)`.
- `server/src/billing/problem.ts:59–68`: explicitly a plan/capability refusal, not sign-in failure.
- `server/src/core/error.ts:16–29`: auth failures are 401; 403 additionally covers forbidden, entitlement, safety, content-policy and jurisdiction restrictions.
- Turns can also receive this entitlement refusal through `turns/create.ts:188–193` / `billing/quota.ts:consume()`.

**Effect:** the only sanitized discriminator supplied to the consumer incorrectly says authentication failed. Current English copy for that code is “The model refused the key” / “Check the key in Settings” (`packages/i18n/locales/en/chat.json:192–193`). The adapter correctly retains the active identity on 403, so this is error semantics, not account invalidation.

**Minimal patch intent:** keep `Refused` and draft-release behavior; change the 403 code to `provider_error` (or the coordinator's eventual neutral remote-access code). Keep 401 as authentication failure. No raw problem detail or new generic problem parser needed. Existing 403 expectations in `packages/desktop/test/remote-chat.test.ts:256` should change with the implementation.

**Isolated actual-source reproduction:** `/tmp/opencode/remote-chat-contract-review/http-contract.test.ts`; config alongside it. Uses actual `remoteChatFetch`, actual core error class, native Request/Response, injected pinned-shape 403 body. No network.

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node /root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/vitest.mjs run --config /tmp/opencode/remote-chat-contract-review/vitest.config.mjs
```

Executed on Node `v22.23.3`: **1 test failed, exit 1**, expected `provider_error`, actual `provider_auth_failed`; identity invalidation assertion passed. This expected-red regression remains runnable. No existing source suite rerun.

## Verified contract facts

### HTTP success and Library

- Library POST success is **200, not 201**: `library/index.ts:369–382` calls `json(payload)`; `http/context.ts:113–116` defaults to 200. SDK `src/gen/types.gen.ts:5469–5474` explicitly binds 200 to `LibraryUploadResponse`; backend `server/test/api/projects/library.test.ts:27` also expects 200. `remoteChatFetch`'s exact 200 gate therefore matches this pin.
- Discovery, model/registry lists, conversation detail/messages likewise return JSON 200. The native test fixture's use of 200 is contract-correct here, not proof of live deployment.
- Uploaded `access:"owner"` is present unconditionally. For this adapter's image-only, no-project upload, `kind:"image"` and `source:"upload"` match `classify()` / `upload()` (`library/index.ts:88–93,342–382`).
- `conversation_id` and `project_id` are **omitted when unbound** (`library/index.ts:376–377`); SDK fields are optional strings with the same omission semantics (`types.gen.ts:110–129`). No nullable relaxation is warranted. Since this adapter never submits a project binding, its `project_id: z.never().optional()` is consistent with its own operation.
- Raw Blob + `query.filename` is correct; backend uses bytes and filename, not request MIME. Packing may change returned filename, byte count and raster type (`library/index.ts:323–339`, `media.ts:28–59,121–141`). The adapter appropriately trusts validated stored metadata rather than requiring byte/name equality with the input.
- Backend upload limit is 10 MiB; vision limit is 8 MiB (`media.ts:11–12`). The adapter intentionally accepts a narrower 8 MiB input subset and enforces the stored vision cap. PNG/JPEG/WebP/GIF exactly match `VISION_TYPES` (`library/index.ts:37`).

### Cloud and registry

- Cloud names, description, token limits and capability booleans match `catalog.ts:27–71`. `kind` is emitted by this pin, with DB constraint `chat|image` (`migrations/0076_cortex_image_1.sql:9–22`). Offering only explicit `kind:"chat"` is correct; absent kind is not guessed.
- Unconsumed public fields (`is_preview`, optional fallback/attribution/banner) are safely stripped by the narrow schema. This is a consumer projection, not a claim of a canonical generated model DTO.
- `Instance`'s mode/auth consistency matches `self-host.ts:24–37`: Cloud uses `cortex`; `required` is exactly `mode !== "none"`. Self-host can use cortex/local/none. Ignoring unconsumed provider/version metadata is appropriate.
- Registry selection must follow instance `mode`, not `registry.enabled`. Disabled or failed upstream registry still supplies operator extras (`registry.ts:123–135,152–184`). Current adapter does this correctly.
- `configured:true`, page limit 500, boolean `has_more`, optional opaque `next_cursor`, source enum all match `self-host.ts:136–179`, `registry.ts:14–33,205–220`, SDK `RegistryModelPage` / query declarations. The last page omits cursor rather than returning null.
- Operator extras have all three flags false and both limits zero, including on `cache`/`cache_stale` pages (`registry.ts:163–184`). Treating that combination as unconfirmed capabilities is conservative and source-backed. Do not invent positive context/output/cost values or gate unknown handling solely on `source:"unavailable"`.
- Rejecting unauthenticated operator mode is an explicit bounded product limit, not a malformed backend DTO. No silent Cloud model fallback on empty/unavailable self-host registry.

### History and detail

- `conversations.ts:164–194,208–233,356–358` emits active-path `id`, `role`, `text`, RFC3339 `created_at`, numeric `version_index`, numeric positive `version_count`, `is_active_version:true`. Empty text is legitimate, including a just-admitted assistant.
- `model_name` is the stored **slug**, not display name. `model_name`/`finish_reason` map SQL null to undefined then disappear during serialization, not JSON null (`conversations.ts:221,232,357`).
- Current generation normalizes upstream reasons to stop/length/tool_calls (`upstream.ts:181–183`); interruption/error storage matches the adapter enum (`chat/turn.ts:21–27,100–103`, `turns/generate.ts:409–425`). No newly invented finish reason is required for this pin's ordinary Chat path.
- Timestamp serialization produces `+00:00`, with fractional milliseconds only when nonzero (`billing/problem.ts:31–37`); `z.iso.datetime({offset:true})` correctly admits both forms.
- Attachments use exactly `file_id`, `filename`, `content_type`, numeric `byte_size`; empty arrays disappear (`conversations.ts:328–330,356–358`). Input admission caps attachments at 20. No optional/null mismatch found.
- Default messages window is latest 100, maximum 200 only on an explicit query; `has_more:false` is hardcoded and supplies no cursor (`conversations.ts:57–64,167–168,358`). Calling SDK messages without an untyped invented query is correct for the bounded latest-100 operation.
- SQL deliberately excludes reasoning/tool blocks (`conversations.ts:192–194`). Adapter's `projection:"text-and-attachments"`, `limited:true`, `reasoningAndTools:"omitted"` accurately declare its narrower projection. They must remain visible to later consumers.
- Detail supplies `id`, title string, stored `model_slug`, numeric `message_count` (`conversations.ts:67–101,134–141`). Effort is absent. Locking known process-created conversations to admitted choices avoids inventing recovered effort.
- `message_count` counts all message rows, including inactive versions (`migrations/0003_content.sql:408–435`), not the active projected page length. The adapter validates its type without incorrectly equating it with `items.length`.

### One history strictness caveat; no current-path regression established

`remote-chat.ts:54` additionally requires `version_index < version_count`. The wire handler emits two independently derived quantities: stored index and sibling count. `chat/tree.ts:45–55,78–81` expressly uses `max(index)+1`, not count, to avoid reusing indexes after deletion; the DB only constrains index to be nonnegative. Thus this relation is not a general persisted-data contract. Ordinary current Chat creation/regeneration is contiguous; no exposed partial-version deletion path or failing current-process scenario was established in this review. Minimal defensive cleanup would delete that extra `.refine`, keeping both integer validations. Do not claim a production failure from this caveat alone.

## Known deployed-discovery gate — coordinator owns fix

Coordinator-supplied observation: public `https://api.cortex.foundation/v1/instance` returns 404; `/v1/models` returns 200 with two Chat choices, vision false. No fresh request performed here.

`remote-chat.ts:240` requires instance discovery first, so those deployed bytes cannot currently reach model parsing. The pinned handler does provide `/v1/instance`; this is deployment/backward-compatibility scope, not evidence that the pin emits a different DTO.

Minimal recommendation: either require deployed instance discovery before enabling the feature, or permit a narrowly named-origin compatibility path **only for the normalized canonical Cloud origin and an explicit instance 404**. Arbitrary/self-host origins must still require validated instance discovery; never infer Cloud from their missing endpoint. Do not fallback on malformed discovery, auth failure or other HTTP errors. Keep Chat-kind filtering and vision refusal.

## Limits

Readonly repository/backend review. Writes confined to this report and its temporary repro directory. No credentials, owner-branch writes, network, Mac, build, full suite, commits or recursive delegation. Existing 19-test pass was not repeated. Identity/security and immutable SSE/media-tail review belong to the other assigned executors. No architectural refactor requested; move/freeze the seam types only through coordinator ownership.

## Correction readback — 2026-10-03 05:54 UTC

**Current application contract: bounded APPROVE. Original P2 fixed; history overconstraint removed; canonical-only discovery exception matches the recommendation. One stale repository test expectation remains below.** Earlier sections and original failed result remain unchanged as historical evidence, not the current application verdict.

Working tree reviewed: `/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite`. Final hashes captured at `2026-10-03T05:54:22.717900+00:00`:

| Current file | SHA-256 |
| --- | --- |
| `packages/desktop/src/remote-chat.ts` (411 lines) | `4b2674007b8e634b371bf30322b713c8ab9e00ba2309b6b833783a39fe1d8b12` |
| `packages/desktop/src/remote-session.ts` (284 lines) | `2394cd1f9cf8852808168b4bff48aadbc51d76202524dccdbe63b40723d063d6` |
| `packages/desktop/test/remote-chat.test.ts` (500 lines) | `e65fb3817a36dbff50703a3182910f1c347d36bcfdb77c4e1c2c7db9a855160d` |

These supersede the earlier application hash only for this correction readback. Owner/coordinator changes since that snapshot are legitimate intervening work.

### Reviewed corrections

- `remote-chat.ts:157–158`: 401 still invalidates and returns `provider_auth_failed`; 403 now throws `Refused("provider_error", ...)`. `Refused` identity remains intact, preserving pre-admission draft/reservation release at `:348`. No need to parse or expose the remote problem body.
- `remote-chat.ts:49–54`: unsupported `version_index < version_count` refinement is deleted. Nonnegative safe integer index, positive safe integer count, active-version literal and the remaining message-field checks remain. This matches independent persisted index/sibling-count semantics described above.
- `remote-chat.test.ts:198–200`: existing native-HTTP history path replaces the messages response with a valid previously projected message carrying `version_index:3, version_count:1`, then calls actual `binding.history(cnv)` and checks both values. It exercises the removed overconstraint through the adapter, not a duplicated schema. Source-reviewed only here; coordinator owns execution of this repository case.
- `remote-chat.test.ts:398`: ordinary turn HTTP 403 expectation is corrected to `provider_error`.
- Canonical compatibility: private `InstanceNotFound` (`remote-chat.ts:99`) is constructed only for actual HTTP 404 on GET `/v1/instance` (`:160–161`), after transport-origin/redirect validation. `models()` catches it only when bound `origin === CLOUD_URL` (`:243–248`). Malformed instance JSON, 401/403/500 and models-route 404 cannot satisfy that marker; self-host 404 still refuses. Normalized origin comes from `RemoteSession.state()` (`remote-session.ts:89–92`) and reaches the binding at `:164`; `CLOUD_URL` is the existing `https://api.cortex.foundation` constant (`core/src/connection.ts:6`). Explicit Chat-kind filtering and vision false handling remain at `remote-chat.ts:254–256,292`. Owner's added positive/negative tests at `remote-chat.test.ts:120–160` are source-reviewed, not rerun here.

### Concrete remaining test correction

`packages/desktop/test/remote-chat.test.ts:149` still expects `status === 403 ? "provider_auth_failed" : "provider_error"` in **“refuses legacy fallback for malformed/forbidden/failed Cloud discovery and missing self-host discovery”**. Actual implementation now returns `provider_error` for all three loop cases `[200,403,500]`. Minimal coordinator fix: expect `{ code: "provider_error" }` unconditionally. Preserve the request-path assertion proving no fallback. This is a source-confirmed stale assertion, not a fresh application contract defect; this reviewer did not execute that repository test.

### Reproduction now green

Re-ran the exact command from the original report at `05:53:54 UTC`, native Node `v22.23.3`: **1 passed, exit 0**, 342 ms total / 30 ms test. Actual adapter returns `provider_error`; unauthorized callback remains uncalled. Original failed run remains recorded above.

The repro test itself is unchanged: `/tmp/opencode/remote-chat-contract-review/http-contract.test.ts`, SHA-256 `6c2b56c2e12dff20710a607f8b4998947bed818b57d3365b2b859cef8288fe58`. Its isolated alias resolves the actual core error class; this one test exercises HTTP 403, not Cloud fallback. No application source edits or repository/global suite runs. The coordinator's planned 17+8 focused cases and all-unit checks remain separate verification.

Current UI still has no public remote Chat caller. This approves the reviewed internal adapter contract corrections only; no claim of live remote Chat/inference, native UI or deployed end-to-end acceptance.
