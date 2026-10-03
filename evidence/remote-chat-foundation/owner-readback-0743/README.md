# Owner readback — 2026-10-03

**Delta: no G2/G3 owner reply, new immutable delivery or named G1 design authorization observed.**
GitHub observation: **07:44:25 UTC**; local documentary snapshots: **07:48:48 UTC**. These are separate boundaries, not future absence claims.

## Complete one-shot comment feeds
GET `repos/CortexLM/backend/issues/{446,447}/comments?since=2026-10-03T06%3A20%3A00Z&per_page=100` once each.
Both HTTP 200; `Date: Sat, 03 Oct 2026 07:44:25 GMT`; no `Link` header. One page each: #446 **2 comments**, #447 **1 comment**; pagination complete for the requested window.

| Feed/comment | Created UTC | Classification |
| --- | --- | --- |
| G2 #446 / [5966307621](https://github.com/CortexLM/backend/pull/446#issuecomment-5966307621) | 06:21:05 | G1 request: exact resumable cursor/history contract |
| G2 #446 / [5966488098](https://github.com/CortexLM/backend/pull/446#issuecomment-5966488098) | 06:48:03 | G1 request: historical-image hydration/ownership/capability proof |
| G3 #447 / [5966461570](https://github.com/CortexLM/backend/pull/447#issuecomment-5966461570) | 06:43:55 | G1 request: discarded-frame callback and new immutable SDK package |

All three use login `echobt`; their bodies explicitly identify **G1 requests**, not G2/G3 replies. Updated timestamps equal creation timestamps.
No reply/update to these asks or deployment/vision request **5966017500** appears in this window; that earlier request itself predates the filter.
New authorized immutable SDK pair, canonical schema artifact, delivery pin/path/hash: **none supplied in observed inputs**. No next dependency admission unlocked.

## Design / coordination delta
`COORDINATION.md` ends at line263, the **07:42 G1** QA update; later feed entries are consumer progress, not design-owner permission or backend/SDK delivery.
`DESIGN-REQUESTS.md` ends at line90: **03:32 G1** request for explicit remote effort/detach/history/continuation source-state mapping remains unanswered there.
No new named G1 import/reuse permission for remote controls, Space, standalone Scheduled or Plugins & skills. Public remote UI remains unactivated under the supplied baseline.
Previously delivered candidate `3e99a0452ff7ede092ff3af8fe11cd56bfe13fa5da7a6f18447b59bd5de4dd0a` (line85) is not a new delivery/permission. G4 supplemental directions and scoped Paper/Home receipts do not authorize G1 activation. No newer designer G1 pin explicitly supplied.

## Retained evidence
Directory: `/tmp/opencode/owner-readback-0743/`. `g{2,3}-*.http.gz` preserves original `gh --include` output; separate normalized headers, JSON, readable comments and request receipts retained. `verification.json` verifies decompressed headers/JSON, pagination and artifact hashes.
Local originals retained gzip plus line-numbered readable excerpts. SHA-256: coordination `4337a4a96f029fd05a90f88b96fe78d1c733ea009d155032a4db95aab4c1659e`; design requests `ba7972643b15572da3d0bdde4e4ec442ee8b16d4a9fa0f2877360b9c9133e501`.
Only the two GETs and local documentary reads; no polling, owner post, credential search, Cloud/auth probe, app-repository write, test/build, Mac or CI operation.

Coordinator retention normalizes trailing whitespace in readable excerpts/header files;
their exact pre-normalization bytes remain in adjacent `.original.gz` files.
`readable-retention.json` binds both forms. Original response/document gzip receipts stay unchanged.
