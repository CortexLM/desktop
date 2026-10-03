# Remote prerequisites — 2026-10-03 09:47 UTC

**No actionable unblock observed.** One-shot readback: **four GETs**, zero retries or followed redirects.
Cloud observations **09:47:19 UTC**; G2/G3 comment feeds **09:47:18 UTC**.

## Public runtime
| Exact unauthenticated GET | Status | Observation |
| --- | --- | --- |
| `https://api.cortex.foundation/v1/instance` | **404** | `not_found`, `No such endpoint.`; discovery/version compatibility remains **unknown** |
| `https://api.cortex.foundation/v1/models` | **200** | **3 models**, `has_more:false`; body byte-identical to 05:35 readback |

| Chat model | Reasoning | Vision |
| --- | --- | --- |
| `cortex-1-mini` | **yes**, explicit `supports_reasoning:true` | **no**, explicit `supports_vision:false` |
| `cortex-teutonic-1` | **yes**, explicit `supports_reasoning:true` | **no**, explicit `supports_vision:false` |
Chat vision totals: **yes 0 / no 2 / unknown 0**. `cortex-image-1` is `kind:image`, not image-input Chat.
Instance body SHA-256: `2886efb051fefb18e5e9b0b65e6803abcbf73237aff393f2ca8c45238843b818`.
Models body SHA-256: `d145822586d77fa2f394eef63b89cffbc2d11d0676f4e106b88c35d2805b68f3`.
Each public route: one GET, **10-second / 4-MiB cap**, no authentication/cookies; actual bodies **219 / 995 bytes**.

## Owner/design delta
- GET `repos/CortexLM/backend/issues/446/comments?since=2026-10-03T08%3A55%3A46Z&per_page=100`: **200, []**, no Link; one page, complete.
- GET `repos/CortexLM/backend/issues/447/comments?since=2026-10-03T08%3A55%3A46Z&per_page=100`: **200, []**, no Link; one page, complete.
- No new/updated comment in that window supplies an immutable SDK pair/schema, cursor contract, image hydration or deployment answer. Prior asks **5966017500 / 5966307621 / 5966488098 / 5966461570** remain unresolved by these observations; discarded-frame limitation remains.
- `/root/cortex-ui/DESIGN-REQUESTS.md`: **93 lines**; named G1 remote-controls request remains at **90**, without permission reply. Added **92–93** are G4 consumer requests. Draft/scoped deliveries do not grant G1 remote or Space/Scheduled/Plugins import permission.

## Required unblock / receipts
Need compatible discovery/deployment, eligible **vision + reasoning Chat** model, authorized account/entitlement; owner SDK discard-hook delivery, cursor/hydration disposition and named G1 design permission.
Public metadata establishes **no account, entitlement or real-inference acceptance**. No auth/inference attempt, secret search, CI query, Mac operation, repository edit or owner post.
Raw response/header/body gzip, public JSON, normalized headers, request timestamps/hashes, source-pinned design excerpt and offline verification: `/tmp/opencode/remote-prerequisites-0945/`.
Prior evidence remains intact. Findings stop at the recorded timestamps; no later-absence claim.

Coordinator-normalized readable files retain exact originals beside them as `.original.gz`;
`readable-retention.json` records any normalization and both hashes.
Duplicate `.headers.raw` files are omitted; their exact CRLF bytes remain in `.headers.gz`.
Prepared verification helpers retain their original temporary-directory assumptions.
