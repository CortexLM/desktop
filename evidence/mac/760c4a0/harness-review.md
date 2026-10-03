# Prepared installed Chat/Bot harness — independent source review

**Bounded APPROVE. No concrete harness blocker or false-success path found in the reviewed scope.** Preparation only; no native/runtime acceptance implied.

Reviewed against application **`760c4a046ce454bc8b0ab2fd85c941fec321c3ea`**, offline **2026-10-03 08:42–08:45 UTC**. Inspected engine/protocol/renderer sources match that Git pin. CI37110253688 and its prospective package were not queried.

## Exact reviewed helper bytes

| File under `/tmp/opencode/` | SHA-256 |
| --- | --- |
| `live-state-native.mjs` | `1fda40b26c939f471cf3e10f127402c324d5d30771c0219ed626582fd92bdac4` |
| `live-state-native-backend.mjs` | `209e5bcc36d3cf3883b0690ed736dfef2928db76fb8d5d51eee6b65c14466ec9` |
| `launch-live-state-native.py` | `66b375031d82502ed0b657aa93a4e4ff599795e353eb251a48488f00421f4a3f` |
| `live-state-native-runbook.md` | `f15beb55fb7284e7a42d9b5dc4b34e9d141574cebdf796a36f0b4c0f2aabb2f2` |

## API and fixture assumptions hold

- Driver `:59–72` uses the real preload request tuple/header/body contract. Main reconstructs JSON requests; protocol returns JSON for success and refusal. Creates return201, prompt202, ordinary requests200; undefined handler results become `{ok:true}`, not an unparseable empty response. No multipart assumption.
- Fresh `GET /api/providers` correctly returns `[]`: it lists stored configuration rows. `GET /api/providers/fake` independently supplies the default `{providerID,enabled:true,hasKey:false}` without creating a row (`provider.ts:45–55`). `PUT .../key` returns sanitized `ProviderConfig`, including `hasKey`, not the key (`:60–65`). Provider restoration with `baseURL:null` is schema-supported and clears the override (`:72–77`; schema`:484`). The harness honestly permits a remaining keyless metadata row.
- Fixture catalogue fields parse as the sole `fake/reasoner` model. Packaged execution ignores the dev-only provider override; the driver instead uses ordinary provider PATCH/key PUT. Default Bot sessions use agent`build`, but catalogue `tool_call:false` prevents toolset construction (`llm.ts:57`, `session.ts:307–318`). Fixed SSE carries reasoning then text and no tool calls.
- Generic compatible inference has no reasoning-enable request field (`llm.ts:55`); `reasoning_content` creates real stored reasoning parts. The fixture's absent-option-field check is correct. Stored assistant replay deliberately excludes reasoning (`session.ts:458–499`), matching the fixture's exact previous-answer check. This proves receipt/rendering, not a provider-specific reasoning-toggle wire effect.
- The closed ten-turn sequence rejects wrong model/key, owner/theme/order, missing/extra user history and incorrect assistant replay. Eight actual composer sends plus two Beta setup sends are accurately described. Counters/failures survive in the fixture receipt; unexpected requests cannot produce a passing final manifest.

## DOM and ownership checks hold

- `model-trigger`, `thinking-toggle`/`role=switch` match `model-composer.tsx:127–158`. Live reasoning is `.chat-reason` / `.chat-reason-t` with `.chat-reason-p li` (`live-chat.tsx:194–207`); each fixture string is a single line. Single-paragraph answers use `assistant-text` (`shared.tsx:61–63`). Thus two user nodes, two answer nodes, two reasoning roots give the deletion observer's exact **six** initial nodes.
- Both accepted Chat turns require completed, error-free stored messages, exact text/reasoning/model/session IDs, unique IDs, matching visible history, then unchanged snapshots across reload and real Home/Back navigation. Static session titles avoid auto-title drift. Navigation preserves the theme query (`nav.tsx:12–23`); reload retains the URL.
- Real deletion invalidates the session and messages routes with404. On reload, `LiveChat` renders a real `.thread [role=alert]` for the failed session read (`live-chat.tsx:296–297`); its composer remains mounted. The harness correctly avoids inventing a dedicated not-found copy. Observer clearing/no-revival checks are bounded to the observed interval; exact delayed-read races remain separate CI tests.
- Bot roster navigation is an actual click; route ID/title and unchanged `performance.timeOrigin` prohibit a reload substitute. Beta must replace Alpha, send into its existing session, preserve its older pair, leave Alpha's full snapshot unchanged and retain one session per Bot. Mutation observations additionally reject Alpha text under Beta's title. The page-key fix is present at the reviewed application pin (`bot.tsx:167–169`).
- Native capture measures the fixed title, latest Beta pair and empty focused editable composer. Wheel placement keeps the pair32px above the page bottom, outside its24px mask fade; it does not claim the entire tall Bot page is visible. Chat reasoning is inspected expanded, then collapsed for the compact capture. Fonts/finite animations settle; clipping-aware geometry and composer hit testing run before/after pixels.

## Artifact, native identity and cleanup

- Python `:16–58` verifies the supplied ASAR hash, exact complete app/desktop dist-member set and each member's bytes; rejects duplicates, links/unpacked members and invalid offsets. Count comes from the new Mac manifest, not historical90 or a Linux build. The supplied manifest's revision/package provenance remains the coordinator's prerequisite.
- Canonicalized `/tmp`/`/private/tmp` paths bind the sole installed main PID to this fresh engine/profile, catalogue, English locale and debug port; renderer/dev-provider overrides must be absent. Local and Mac member manifests and inspector bytes must match. Existing roots/receipts and occupied ports are refused before launch.
- CDP only uses `SystemInfo.getProcessInfo` for browser-PID identity; the retained f5 native harness already uses that method. No `Browser.getWindow*` call. AppleScript performs sizing/activation; CoreGraphics requires one foreground, on-screen layer0 Cortex window, matching PID and960×640 bounds. This script does not separately record AXFullScreen/AXMinimized flags. Native screenshots come from `screencapture`, with dimension/hash/window checks; there is no browser-pixel fallback.
- Failure cleanup stops its observer, enumerates only recorded Bots' sessions, aborts/deletes owned sessions, removes owned Bots/test key, restores provider settings/appearance/initial route. Cleanup failures force `status:failed`; diagnostic key/Bearer/nonloopback URL redaction and fixture stage-only failures avoid storing arbitrary request bodies. Mac app/helper/tunnel/lease shutdown remains explicitly coordinator-owned.

## Acceptance boundary

No helper executed, syntax recheck, test/build, network/SSH/Mac/CI action or delegation. Only this report written. Zero-error assertions and six captures are **future requirements**, not observed results. Approved for the coordinator's source-bound installed run after the selected artifact is admitted; its completed manifest, six full-size native images and cleanup receipt still require review. Ordinary installed flows complement, rather than replace, the separate103-case CI race coverage.
