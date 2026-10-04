# Main remote Chat — bounded Cloud/signature/cursor correction

**PASS; uncommitted.** Same three assigned repository files. **25/25 native Node22.23.3 tests pass**:17remote Chat +8unchanged auth. Strict workspace typecheck and focused ESLint pass. Original19-case report, intermediate24-case proof and raw failures remain retained.

## Source changes
- Import existing `CLOUD_URL` from `@cortex/core`; no second hardcoded production origin.
- Private `InstanceNotFound` marker is emitted only for actual HTTP404 on `GET /v1/instance`. Neither problem-body status nor another endpoint can create this exception.
- `models()` falls back to Cloud catalogue only when the active binding origin equals `CLOUD_URL` and that exact marker was received. Malformed200,403,500, noncanonical/self-host404 and catalogue404 remain refusals. Binding still requires successful private authentication; no implicit guest or self-host auth assumption.
- Private constructor now takes `createRemoteChatBinding(client, origin, epoch, signal, check)`. `RemoteSession` passes its validated normalized origin. **Exported binding/DTO/observer/delivery signatures unchanged**, verified by exact text comparison.
- PNG fixture now uses the same complete1×1 PNG bytes as `tests/e2e/engine.spec.ts`; the adapter's explicit8MiB input/stored-image ceiling remains.
- Security P2 fixed: `Buffer.from(header).toString("ascii")` → `.toString("latin1")`. High bits are preserved in GIF/WebP magic comparison. No extra decoder/dependency/abstraction.

## Added source-backed checks
1. Canonical Cloud instance404: test-only injected Fetch asserts canonical request origin, remaps socket to native HTTP loopback, rewraps response with original canonical URL. Two reasoning Chat rows, vision false, image card filtered; text turn accepted, image turn refused. No live authenticated backend call.
2. Canonical malformed200/403/500 cannot fall back even when response body claims404. Arbitrary/self-host origin404 cannot fall back. Models404 remains a refusal.
3. Equal-ID text A/B delivers **AB**. Callback order: `event:A`, `cursor:1`, `event:B`; only one cursor1 acknowledgement. After disconnect, retained original new-chat path/body/key plus cursor1 is verified. A replayed same-ID B remains visible; no ID-only dedup or exactly-once claim. Draining terminal iteration acknowledges final cursor2.
4. Observer event failure on B retains acknowledged cursor1; replay delivers B again. Observer cursor failure on2 likewise preserves cursor1, allowing at-least-once B replay. Both use identical private original body/path/key; raw observer error text is sanitized. Two registered cases.
5. High-bit GIF `c7c9c6b8b9e1` and WebP `d2c9c6c6b0b0b0b0d7c5c2d0` both reject `invalid_request`, produce **zero Library calls**, cannot populate owned-file IDs. Normal GIF/WebP magic succeeds unchanged over actual SDK/native HTTP. Positive fixtures are explicitly **header-only transport checks**, not full image decoding/inference proof.

The six new registered cases extend the earlier19 to25. All five vectors in `/tmp/opencode/remote-chat-contract-traps.md` were read; the unchanged implementation retains its explicit incomplete-media, ambiguous-admission, epoch/expiry and owned-history policies.

## Before/after evidence
- `high-bit-before.json`: expected negative test,1failed/16filtered skips; both invalid payloads returned `accepted` and reached authenticated Library. Raw log retained as `high-bit-before.log`.
- `tests.json`: intermediate24/24 green before the new signature regression.
- `security-corrected-tests.json`: final25/25 green, zero skipped/failed; eight original auth tests untouched.
- `security-corrected-focused.*`, `security-corrected-typecheck.*`, `security-corrected-lint.*`: exact commands/exits/timing.
- `security-corrected-receipt.json`: current source hashes, test counts, preservation checks. Earlier `receipt.json` remains the24-case revision.
- Reviewer-owned `/tmp/opencode/remote-chat-main-security-review.md` and `/tmp/opencode/remote-chat-security-review/probes.test.ts` were read, not edited or rerun. Independent three-probe rerun remains reviewer's delivery.

## Boundaries
Public readback `/tmp/opencode/remote-public-contract/readback.json` is unauthenticated discovery at05:35UTC, not authentication/inference evidence. Its vision-false fields remain meaningful refusals; catalogue image cards are not Chat selections.

All90 prior app/desktop dist hashes remain unchanged, as do `main.ts`, dependencies/lock, probe and existing auth test. Original report `/tmp/opencode/remote-chat-main-implementation.md`, its tests/raw failures and manifest hashes remain unchanged. No core/schema/renderer/routing/new-status edits, build/E2E/full tests/Mac/CI/commit/push. Other DTO review remains coordinator-owned.
