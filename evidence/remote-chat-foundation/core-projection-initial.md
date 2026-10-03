# Remote core projection review

**HOLD: three concrete contract/projection defects.** The promoted HTTP integration test preserves its original assertions; its retained pass is valid for that fixture. It does not cover nullable backend usage, SDK-discarded frames or dangling tools after history recovery.

## Source / scope

Read actual `packages/core/src/remote-sessions.ts`, remote schemas in `packages/schema/src/index.ts`, current main adapter/session, installed SDK/API-types streaming/ID source, core fixture tests, promoted `packages/desktop/test/remote-core.test.ts`, and `/tmp/opencode/remote-chat-core-implementation.md`.

Review starts at core SHA-256 `8e3e53995063042b7174d639541b2b5b55675355bea51baa79a2c3ac378fe72a`. Another owner's in-progress correction subsequently changes core to `5d14e25bd6732b80c2139ac66c1e8de77b9d4240f11bc3deaf3b8d3462a6e559` (observed `2026-10-03T06:39:17.155302+00:00`). Re-read the three relevant blocks afterward: defects remain; line numbers below use that latter snapshot. This reviewer made no source edits.

| Reviewed final source | SHA-256 |
| --- | --- |
| `packages/core/src/remote-sessions.ts` | `5d14e25bd6732b80c2139ac66c1e8de77b9d4240f11bc3deaf3b8d3462a6e559` |
| `packages/schema/src/index.ts` | `09fa14a9a35a9f1479c50ab841cacba9c6f2074e10e366e8bdf628b493e87161` |
| `packages/desktop/src/remote-chat.ts` | `733860681cb7d1681460d0b4820bd020f76c6d54aaa0ebd86afdbf7a22a1a725` |
| `packages/desktop/src/remote-session.ts` | `2394cd1f9cf8852808168b4bff48aadbc51d76202524dccdbe63b40723d063d6` |
| `packages/desktop/test/remote-core.test.ts` | `dc0b6cc26131c384ca90516456a7da1144bea0ca2601ab13b340d75edacf0c60` |

Full source/SDK/backend hashes: `/tmp/opencode/remote-core-projection-review/source-hashes.json`. Backend source was read with Git at `d6c71de1d99197c5e0ee5c59d0a089842d760cea`; usage-generation/upstream bytes freshly verified identical at SDK `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31`.

## Findings

### P1 — Valid backend `reasoning_tokens:null` aborts ordinary completion

**Location:** `packages/core/src/remote-sessions.ts:326–328`.

Core requires `reasoning_tokens: Count.optional()`. Actual pinned `server/src/api/turns/generate.ts:415–425` emits `reasoning_tokens: usage.reasoningTokens ?? null` immediately before `done`. `server/src/api/upstream.ts:190–199` omits `reasoningTokens` when upstream did not report it, a valid normal response even for a reasoning-capable model.

API-types' `usage` validator checks the three required numeric counts, not this optional field (`packages/desktop/node_modules/@cortex/api-types/src/streaming.ts:798–804`); the original object is yielded (`:903–904`). Main clones it unchanged. Therefore `null` reaches core, which throws, cancels delivery and reports `uncertain`, partial, `provider_error`, without processing the following valid `done`.

**Actual integration repro:** `projection.test.ts`, “accepts the pinned backend null reasoning count as unknown without losing done”. Actual core + `RemoteSession` + installed SDK; native Request/Response with controlled Fetch. Failed: expected settled stop, got uncertain/partial; expected `{input:7,output:4,cached:2}`, got undefined. No external network.

**Small fix:** accept `Count.nullish()` at the incoming event boundary; project reasoning only when `u.reasoning_tokens != null`. Keep outgoing reasoning omitted for unknown; never convert null to zero. Keep nonnegative safe-integer validation for present numeric values. Add `reasoning_tokens:null` to one actual-SDK integration turn; assert completion reaches stop, required counts survive, no `usage.reasoning` field.

### P2 — SDK-discarded frames can still produce a fully complete projection

**Boundary:** SDK `src/stream.ts:171–182` → API-types `src/streaming.ts:945–961` → main `remote-chat.ts:299` → core `remote-sessions.ts:287`.

API-types silently skips malformed JSON, invalid known events and unknown types, with an optional `onDiscardedFrame` notification. SDK 0.3.5 `ResumeOptions` does not expose that callback and `turnStream()` does not forward one. Consequently core's unknown-event marker (`remote-sessions.ts:359`) cannot catch such frames from this actual main adapter. A subsequent valid `done/stop` resolves `complete:true`, `partial:false`, and stamps a successful completion time despite discarded transcript content.

**Two actual integration repros fail:** valid `text_delta("Before")`, followed by either `{type:"text_delta",message_id}` missing required `delta`, or a future structured event, then valid `done`. Both retain “Before” but report `complete:true`. These use the real SDK, not the structural fake that directly invokes core's unknown-event branch.

**Smallest honest correction:** SDK owner exposes/forwards the existing `onDiscardedFrame` hook; main fails the current delivery closed on any discard or passes an explicit sanitized incomplete-projection signal. Core then cannot certify complete/full output. No second SSE parser or DTO guessing. Until that SDK capability is admitted, an explicit conservative projection ceiling is needed; source-only unknown-event handling is not end-to-end evidence. A discarded-frame test through the actual SDK is necessary because a fake host cannot reveal this gap.

This does not require treating supported plain-text notice URLs as HTML; the failure is hidden loss before core sees an event.

### P2 — History settles the turn while its tool remains `running`

**Location:** `packages/core/src/remote-sessions.ts:373–379`.

Normal `finish()` converts dangling remote tools to `interrupted` (`:282–285`). History recovery bypasses that step. Sequence: admitted reasoning + tool_start; stream ends before terminal; valid known-history response contains the same assistant with `finish_reason:"stop"`. Core releases the pending reservation and sets session `settled`, but the retained tool part still says `running` forever. This is a contradictory recovered snapshot; a later turn cannot finish that old invocation.

**Actual integration repro:** “history recovery preserves roles and richer live text without leaving remote tools running” fails only the final tool-status assertion. Role preservation (`system`, `tool`, `assistant`), gapped version 3/count 1, history flags, partial settled outcome, retained reasoning and absent completion timestamp/usage all pass.

**Small fix:** in the matching-assistant history settlement branch, convert retained `running` tool parts to `interrupted`, as normal completion already does. Leave duration absent if never received. Keep partial/history marker; do not fabricate tool success. Extend the existing recovery test with a dangling tool_start and this final assertion.

## Verified semantics / bounded acceptance

- Incoming numeric counts use finite safe nonnegative integers; durations use finite nonnegative numbers. Present zero stays a real reported zero; omitted usage/cost/timing stays absent. Repeated usage replaces the snapshot, not sums it. Nullable reasoning is the exception above.
- Supported tool-end failures preserve `error|timeout|refused|interrupted`, duration; raw `error_detail`, labels and payload are stripped. A failed tool can be followed by a legitimate completed assistant answer; the distinct tool status remains visible. No extra issue inferred solely from that distinction.
- `permission_required` becomes a blocking unsupported-action marker, partial output; no local permission reply or execution. The meaningful probe used an event that passes the actual SDK's required prompt fields, unlike a deliberately minimal fake-host fixture.
- Disclosure and safety notes preserve arrival order relative to text; text on either side remains separate. Bounded referral/plain text is retained verbatim, including angle brackets/addresses, without adding HTML/href fields. Fresh actual-SDK probe passes this behavior.
- Tool-result/structured metadata/media are explicitly omitted with partial markers. `done.metadata` is stripped before result comparison but sets blocking structured partial state. Raw signing metadata never appears in projected parts.
- `done` remains provisional until host completion and terminal/admission revalidation. A known announced image tail marks the projection partial; main additionally tracks pending images before resolving delivery. Missing-tail failure cannot become full success through core. No image URL/download claim is made.
- Terminal error codes entering core are the three sanitized main codes; recovery `history` keeps `history_required`. Unknown finish reasons fail validation. Length/interrupted/error/tool_calls outcomes stay non-successful; only confirmed, nonpartial stop stamps `time.completed`.
- Every resume is deliberately partial because numeric replay cursors can repeat equal-ID frames. Content is preserved without invented deduplication or exact reconstruction. This ceiling is explicit and appropriate.
- Known-only history returns a separate limited projection, keeps original roles/attachment metadata and gapped version indices, preserves richer in-memory parts; it does not guess user IDs or manufacture server timing/counts. A returned history window is not silently substituted for complete transcript sync.
- `remote.session.changed` / `remote.session.removed` contain only local session ID and epoch; snapshots carry content. Remote bus tagging avoids SQLite/local plugin dispatch. Promoted HTTP proof checks raw event equality as well as Event parsing, so Zod stripping cannot hide a leaked field.
- ID body expression in schema `remoteID()` is byte-equivalent to API-types `ID_BODY`: 26 Crockford characters, case-insensitive alphabet excluding I/L/O/U. Fresh 528 comparisons across all ASCII substitutions plus prefix/length/uppercase checks pass for `cnv`, `msg`, `lbf`, `tci`. Neither side enforces a stricter numeric first-character ceiling; no new mismatch introduced.

## Promoted HTTP test audit

Compared `/tmp/opencode/remote-core-http-proof.test.ts` to `packages/desktop/test/remote-core.test.ts`. Changes are workspace/relative imports, accurate header/name, required `signedIn:false` connection input, synchronous create call, and an **additional** `complete:false` assertion. No original behavioral assertion was removed or weakened.

Retained `/tmp/opencode/remote-chat-integrated/remote-core-http.log`: **1 passed**, start `06:29:09`, 970 ms total / 173 ms case. Read receipt only; not rerun here. It proves controlled native HTTP/SDK/core upload/admission/stream/projection isolation for its exact fixture. That fixture emits no usage event, so it cannot establish compatibility with the pinned backend's null reasoning count. It exercises tool_result partiality, not silent SDK discard or history recovery.

## Checks actually executed

Native Node `v22.23.3`; temporary Vitest config aliases actual repository core/schema; actual installed SDK/main are imported. Tests use only native in-memory Request/Response and injected Fetch; no owner/public HTTP call.

| Execution | Result | Evidence |
| --- | --- | --- |
| First five isolated semantic cases | **3 failed / 2 passed**, exit 1 | `remote-core-projection-review/projection-initial.{log,json}` |
| Added history-recovery case only | **1 failed**, exit 1; five filtered cases not rerun | `remote-core-projection-review/history-recovery.{log,json}` |

Runnable current six-case file: `/tmp/opencode/remote-core-projection-review/projection.test.ts`.

```sh
NODE_ENV=test /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node /root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/vitest.mjs run --config /tmp/opencode/remote-core-projection-review/vitest.config.mjs --reporter=verbose
```

All negative results retained. No application edits, build/global suite, Mac, CI, owner HTTP, commit or delegation. Epoch/lifetime races remain other reviewers' scope. Internal service scope is intentional; renderer absence is not a finding.
