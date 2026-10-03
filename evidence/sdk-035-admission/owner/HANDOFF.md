## G3 final replacement: SDK 0.3.5 / api-types 0.2.0

**Source `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31`**, PR https://github.com/CortexLM/backend/pull/447.

Immutable directory: `/root/cortex-goals/releases/sdk-0.3.5-5b7e9d1c3fa2/`

| Archive | SHA-256 |
| --- | --- |
| `cortex-sdk-0.3.5.tgz` | `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8` |
| `cortex-api-types-0.2.0.tgz` | `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877` |

Install both together. SDK declares exact optional peer `@cortex/api-types: 0.2.0`. API-types bytes match earlier 0.2.0 deliveries. Receipt SHA-256: `6bb1af0ae2412b00e7415ad76b259951ee0460449cbe46b96e8b00afffd93aba`. Logs, generated hashes, independent review and remote receipts sit beside the pair.

Schema source `af36085cc96b182950ca4bf15161dcf2c3951da1`, retaining G2 ancestor `70a3056f7223a7eb9257d984848d4d33fee7ec12`; blob `c8f6a7f0257858306a885c71202c13420f40725f`; SHA-256 `b2495d1d8ec631d143c5dcc5d200aeb0d288f69beae31ba671b3a7856f663d5b`. All 422 canonical operation IDs retained; 421 public SDK methods.

### Consumer corrections

- G4/G1 late-image frames remain visible after turn `done`; final cursor acknowledged, ordinary completion prompt, reader/account abort preserves its original error.
- Screenshot upload accepts raw File/Blob plus required filename and returns metadata. Library raw upload retained.
- Generated five turn/edit/regenerate methods accept legacy JSON bodies as `unknown`, fixing the reproduced `body?: never` declaration bug. Parsed helpers retain the original replay body.
- Node 20.9 request headers and generated Headers/tuple inputs preserved; object null header removals retained.
- Successful auth JSON is read once and detached before identity replacement. This removes the native response-clone trigger reproduced in Node 20.9 shutdown; original read/abort errors and bodyless 204 remain intact. The failed shutdown-hook workaround is removed.
- Low-level `client.http.sse` removes a previous Last-Event-ID after a server empty-id reset; caller initial cursor remains intact until the server replaces it.
- Embedded/partial startup releases acquired resources. Examples close in finally, handle empty catalogues and require the same account for cross-invocation resume. Integration cleanup covers early setup and individual teardown failures; original failure codes survive cleanup errors. Tarball publication uses atomic no-clobber links from private staging.

### Verification

Ten exact-source release checks pass:

- API-types: 40 tests. SDK: 71 checks, including 34 runtime tests.
- Public consumer declarations; 16 generated files match without drift.
- Real API integration: 48 tests, 421/421 operations, 171 dedicated calls, 51/51 groups; four examples.
- Bootstrap/embedded/OpenAPI: 19 tests.
- Isolated npm/Bun public types and 34 runtime tests each, on Node 22 and minimum Node 20.9.

[CI 37094557684](https://github.com/CortexLM/backend/actions/runs/37094557684), attempt 1: all 11 substantive jobs pass; full server 2,414/0; clean migration step verified. Conditional CodeQL-probe skipped as designed. [CodeQL 37094557772](https://github.com/CortexLM/backend/actions/runs/37094557772), attempt 1: all three languages pass. [CodeRabbit final-source review](https://github.com/CortexLM/backend/pull/447#issuecomment-5942876011) completed with no new actionable comments; prior findings corrected or individually answered, zero unresolved threads. `coderabbit-final.json` binds that exact source.

**G1/G4 adoption remains owner-owned.** Record consumer commit, both hashes and a current real-backend SDK call; preserve drafts/history. Historical desktop 0.2.0 evidence does not certify this pair.

Canonical limits remain explicit: [G1/G2 handler/schema disposition](https://github.com/CortexLM/backend/pull/447#issuecomment-5964672516). Legacy DTOs remain partly unknown; `/me` has no durable public account ID; Chat history is bounded, lacks reasoning/tool blocks and complete pagination. Process-lifetime identity isolation and narrow response validation are appropriate; exhaustive sync/durable cross-login cache are not implied.

Abort old auth.signal before account replacement; pass refresh callback signals through. Chat reader abort detaches delivery, never generation. No invented Chat cancel or portable reasoning Off. Replay retains original path/body/key/cursor; stream_expired requires transcript reload. Existing SSE parser has no explicit per-frame size ceiling; this release does not claim hostile-server memory bounding. UI/design, hosted inference, live compute and production acceptance remain separate. PR remains open; no merge/deploy.
