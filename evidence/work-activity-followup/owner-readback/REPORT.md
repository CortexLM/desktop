# G1 owner readback — 2026-10-03 19:24:38 UTC
**No new actionable G2/G3 immutable handoff or exact five-state G1 product-import authority appears in this bounded read.**
Actual collection: `19:24:37.959836–19:24:38.297235Z`; baseline `/tmp/opencode/g1-owner-readback-1805` observed `18:11:13Z`. Earlier Memory readback was `16:53Z`.
Exactly four reads: one issue-comment GET per PR (`since=2026-10-03T18:11:13Z`, `per_page=100`), one unauthenticated public GET per endpoint; no retries, redirects, pagination or posts.

## G2 / G3
- [Backend #446](https://github.com/CortexLM/backend/pull/446): **0** updated comments, completed `19:24:38.293124Z`; [#447](https://github.com/CortexLM/backend/pull/447): **0**, `19:24:38.282896Z`. Both bodies remain `[]`; no pagination indicated.
- Latest explicit G2/G3 coordination entries remain lines **168/239**, text-identical to 18:11. G2 declared source remains `70a3056f7223a7eb9257d984848d4d33fee7ec12`; older consumer-state claims are historical.
- G2 still owes stable account identity/precise DTOs, unambiguous replay cursor or authoritative history, historical-image hydration, compatible instance/discovery deployment. Prior asks: comments `5964672492`, `5966307621`, `5966488098`, `5966017500` on #446.
- G3 remains SDK **0.3.5** / API-types **0.2.0**, source `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31`; no successor exposing `onDiscardedFrame` to [5966461570](https://github.com/CortexLM/backend/pull/447#issuecomment-5966461570).
- Declared archive SHA-256: SDK `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8`; API-types `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877`.
- Schema remains source `af36085cc96b182950ca4bf15161dcf2c3951da1`, blob `c8f6a7f0257858306a885c71202c13420f40725f`, SHA-256 `b2495d1d8ec631d143c5dcc5d200aeb0d288f69beae31ba671b3a7856f663d5b`. These are unchanged documentary pins; archives/runtime were not reopened.

## Design authority
- `ACTIVE-DIRECTION.md` and `DESIGN-REQUESTS.md` remain byte-identical to 18:11; Code/Bot adoption JSON remains prototype-authorized **true**, `productImportAuthorized: false`.
- Exact adoption SHA-256: Code `2e783316e118c4dc96031ae1b2c480e47a3a058001bfed7c7f75b51fb3741fe4`; Bot `b148e7d93ef31d3d24e42bee695e1982cb6b9e05444c95d7c88e3ed3881af266`.
- Reuse report remains `de5c2408b6984123d4556f67b004dfc8aa0e6560ed85b26bb085da2aacca679f`, matching its 16:53 pin. Both named integration docs still describe prototype-only acceptance; current hashes retained without inventing a previous byte comparison. Review-directory metadata scan finds no file modified since 18:11.
- Exact G1 source/route/state/criterion permission remains pending for **stored-thread model/effort**, **one-off model**, **limited history**, **image-history refusal**, **origin/account-bound continuation ownership**. Motif reuse and Code/Bot prototype acceptance do not supply that permission.

## Public deployment
| Endpoint | Status / bytes | SHA-256 / change from 18:11 |
| --- | --- | --- |
| `https://api.cortex.foundation/v1/instance` | 404 / 219 | `661144863f8f741c781ced211bb201733f241a5145fa8ba5e9cd4879c7f39ca2`; only JSON `request_id` changed. |
| `https://api.cortex.foundation/v1/models` | 200 / 995 | `d145822586d77fa2f394eef63b89cffbc2d11d0676f4e106b88c35d2805b68f3`; byte-identical. |
Models: **3 total; 2 Chat, both reasoning; 0 vision Chat; 0 vision+reasoning Chat**; `has_more: false`. Instance/auth-mode discovery remains unavailable on this public route.
Presence only: `CORTEX_REAL_BASE_URL=false`, `CORTEX_REAL_API_KEY=false`, `CORTEX_TEST_BACKEND_URL=false`. Values were neither read nor retained; public metadata proves no signed account or inference.

## Action / retained proof
Continue bounded local Activity closure. External admission gates remain unchanged; no new handoff to integrate or duplicate owner post needed.
Coordination advanced to 506 lines/hash `e4e2cedbf9efd3ae56467158b11060b3ed4e632ce498088dbdaf9f24c275d0d3`, reflecting G1/G4 work. Supplied G1 `9ba8e59`, green CI `37145831654`, 132 local cases and exclusive Mac capture lease were not queried here.
`observations.json` binds capped public bodies, sanitized ordered headers, request times, field comparisons and nine local pins. `readback.py` has an empty-output/one-shot guard; `verify.py` checks receipts offline and prior packet immutability.
Only this output directory was written. No source/coordination/evidence edits, archive/runtime reruns, build, install, CI/device/Paper query, auth/inference or delegation. Absence is bounded to these feeds/files at the recorded times.
