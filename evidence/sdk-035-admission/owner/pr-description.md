## Summary

Adds the generated TypeScript SDK, account-bound auth/streaming runtime, embedded Fetch API, real-backend integration and executable examples. **SDK 0.3.5 / api-types 0.2.0**, source **`5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31`**.

Stacked on #446; G2 ancestor `70a3056f7223a7eb9257d984848d4d33fee7ec12` retained. Canonical screenshot correction source `af36085cc96b182950ca4bf15161dcf2c3951da1`; schema blob `c8f6a7f0257858306a885c71202c13420f40725f`, SHA-256 `b2495d1d8ec631d143c5dcc5d200aeb0d288f69beae31ba671b3a7856f663d5b`. All 422 operation IDs retained; 421 public SDK methods across 51 groups, excluding the internal host callback.

- Pinned `@hey-api/openapi-ts@0.99.0`, deterministic generation, bytewise failing drift CI. Names derive from HTTP method + path, collisions fail.
- Precise discovery/self-host/OTP/MFA/Library/screenshot contracts. Remaining legacy DTOs explicitly unknown; generated five turn/edit/regenerate methods accept unknown JSON bodies instead of unusable `never`.
- Binary returns Blob, SSE-only raw ReadableStream, 204 undefined; AgentEvent list pins JSON. HTTP never claims a WebSocket upgrade. Custom transport on `client.http`.
- Configurable Cloud/self-host origin, optional Bearer/guest cookie auth. Refresh/replay/account cancellation preserve identity; native Node 22 sign-in JSON and minimum Node 20.9 headers remain readable/intact.
- Auth JSON is read once and detached before account invalidation, removing native response cloning that reproduced Node 20.9 shutdown hangs. Read/abort errors and bodyless 204 are preserved; the unsuccessful shutdown hook is removed.
- Parsed turns preserve original POST/body/key/numeric cursor; AgentEvent UUIDs use query since, realtime numeric Last-Event-ID. Announced images remain readable after turn done, final cursor acknowledged; ordinary completion prompt. Low-level SSE empty-id reset removes the earlier cursor header.
- Native Headers/tuple method inputs and explicit object null removals retained. Screenshot upload sends raw bytes with required filename.
- Embedded and partial bootstrap failures dispose acquired resources while preserving errors. Integration setup/teardown failures release isolated resources without hiding prior test exit codes.
- Tarballs publish from private staging with atomic no-clobber links; existing destination bytes survive a concurrent arrival. Packed consumer checks have bounded subprocess lifetimes.

## Why

Canonical transports, conditional sign-in continuations and account replacement require explicit boundaries. Independent G1/G4 probes found late images dropped, screenshot File serialized as JSON, and generated turn bodies forbidden by types. CodeRabbit and independent review found startup/test lifecycle and minimum-Node issues. Each demonstrated defect has a bounded correction and regression; generated sources come only from the generator.

## Immutable delivery

Directory `/root/cortex-goals/releases/sdk-0.3.5-5b7e9d1c3fa2/` contains tarballs, SHA256SUMS, ten-check receipt, independent source/package review, remote CI/CodeQL evidence, review disposition and retained negative evidence.

- `cortex-api-types-0.2.0.tgz`: `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877`.
- `cortex-sdk-0.3.5.tgz`: `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8`.

Install both together; exact optional peer 0.2.0. Older archives retained, never overwritten. G1/G4 own adoption and consumer commits. Historical desktop `9e5b8da` demonstrated a real backend SDK 0.2.0 call; new-pair adoption requires fresh evidence.

## Contract boundaries

[G1/G2 exact handler/schema disposition](https://github.com/CortexLM/backend/pull/447#issuecomment-5964672516) is explicit: legacy password/register/refresh, Cloud model/account/history DTOs remain partly unknown; me has no stable public account ID; Chat history is bounded and omits reasoning/tool blocks, with no complete pagination. This PR does not invent those contracts. G1 can validate bounded responses and isolate identity per process; durable cross-login cache/exhaustive sync need the server additions.

Abort old auth.signal before external account replacement; pass refresh callback signals through. Reader abort detaches Chat delivery, not generation. No Chat cancellation route or portable reasoning Off. Replay requires original body/key/cursor and transcript reload on stream_expired; server idempotency/buffer durability limits remain. Existing SSE parsing has no explicit per-frame size ceiling; hostile-server memory bounding remains separate protocol hardening. Integration uses real API/datastores with controlled identity/inference/models.dev fixtures; route coverage includes typed refusals, not proof of every live hosted workflow. UI/design/live compute/production acceptance separate.

## CodeRabbit review

- [x] CodeRabbit reviewed the final source; source-bound summary and successful status retained in `coderabbit-final.json`.
- [x] Every actionable CodeRabbit finding fixed and answered, including outside-diff integration setup cleanup and stream-collection deadlines. Independently adjudicated Cortex findings have specific replies; the real duplicate empty-SSE-id issue is fixed. No unresolved review threads at final readback.

Risk focus: identity replacement during refresh/mutation; original replay request/cursor; late-image cancellation; raw uploads; native headers; partial bootstrap and integration cleanup.

## Test plan

- API-types: 40 tests.
- SDK: `npm test` — 71 passing (34 runtime plus readiness/lifecycle/pack cases); public consumer types; 16 generated files matching.
- Minimum Node 20.9 and Node 22/Bun packed consumers: 34 runtime tests each, public declarations pass; package subprocesses have a bounded deadline.
- Real API integration: 48 tests; 421/421 methods, 171 dedicated calls, 51/51 groups; four examples pass.
- Bootstrap/embedded/OpenAPI: 19 tests; server typecheck/lint; type drift; workflow regression; indexed pre-commit checks.
- [CI 37094557684](https://github.com/CortexLM/backend/actions/runs/37094557684), attempt 1: all 11 substantive jobs pass, server 2,414/0, clean migrations verified. Conditional CodeQL-probe skipped as designed.
- [CodeQL 37094557772](https://github.com/CortexLM/backend/actions/runs/37094557772), attempt 1: all three languages pass.
- Independent last-push review verifies source/schema/artifact identities, packaged source and read-only compiled output, all generated/log hashes. Earlier failed/cancelled/superseded evidence remains separately attributed; a prior Node 20.9 package process hung after successful assertions and is retained as failed.

## Agent attestation

- [x] I read `AGENTS.md` and every file in `.rules/` before opening this PR.
- [x] User-facing errors use product language (no vendor names).
- [ ] Responsive checked at 390 / 768 / 1440 — N/A: no UI changes.
- [x] Security: no secrets, fail closed, no production mocks.
- [x] `AGENTS.md` / `.rules/` updated if this PR changes how agents should work.
- [x] I verified the change carefully (commands and bounded results listed above).


<!-- This is an auto-generated comment: release notes by coderabbit.ai -->
## Summary by CodeRabbit

* **New Features**
  * Added a TypeScript SDK for typed Cortex API requests, authentication, resumable event streams, and embedded-server access.
  * Added examples for quickstarts, self-hosted and embedded use, and resuming event streams.
  * Added bug screenshot uploads with validated image formats, file sizes, and filenames.
  * Added MFA requirement details to API errors and options to cancel streams or stop after terminal events.
* **Documentation**
  * Added SDK setup and usage guidance.
* **Bug Fixes**
  * Stream readers now respond to cancellation signals and clean up after use.
  * Embedded API startup failures now clean up acquired resources while preserving the original error.
<!-- end of auto-generated comment: release notes by coderabbit.ai -->