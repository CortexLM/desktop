# Active remote integration — SDK handoff readback

**Remote auth, model routing and Cortex inference remain active, incomplete deliverables.**
Current prerequisite: G3's corrected, versioned SDK/api-types pair. G2's five typed auth/upload
bodies are delivered. Desktop session acquisition, remote prompt routing and proof remain G1-owned.

## Current SDK observation — 20:01–20:07 UTC

Read-only snapshot: **2 October 2026, 20:01–20:07 UTC**. One PR #447 metadata/comments query:
head `7633f7e2fa4df197a3bd19e5316943be20ec6722`, open, last updated **16:45:11 UTC**;
zero returned issue comments created/updated since 19:15. The canonical versioned SDK/api-types
pair remained absent from the inspected delivery at **20:07 UTC**.

Local metadata at 20:02–20:03 still shows `df4aca1836b5298cba01c302d9fdfea1bf141457`, four
tracked generated/public-error modifications and SDK0.2.0/api-types0.1.0. The worktree schema
is still blob `d3837ef436a5888b329aa0e5b3eb3bcc3f0b3b5d`, not canonical `d6d46014`.
At **20:03:13 UTC**, `/tmp/opencode/pack/` contains only the October 1 pair, independently
rehashed to the package hashes below. No new version/path/hash announcement was found;
generated contents and runtime behavior were not re-audited. Receipt:
`/tmp/opencode/desktop-current-gates-2000.md`. This SDK timestamp is separate from later
design-ledger updates and conveys no new runtime verification.

## Earlier SDK observation — 19:10–19:15 UTC

Read-only snapshot: **2026-10-02T19:10:53Z–19:15:55Z**. PR #447 metadata was queried once:
head remains `7633f7e2fa4df197a3bd19e5316943be20ec6722`, open, last updated 16:45:11 UTC;
no comments after 18:20 UTC. No replacement versioned pair was delivered in the inspected handoff.

Local G3 checkout `goal-sdk` remains at `df4aca1836b5298cba01c302d9fdfea1bf141457`, with
committed schema blob `d3837ef436a5888b329aa0e5b3eb3bcc3f0b3b5d`, four dirty generated/public-error
files and unchanged SDK0.2.0/api-types0.1.0 versions. `/tmp/opencode/pack/` still contains the
October 1 pair matching the hashes below. This owner work is not a canonical `d6d46014` release.
The exact owner gate remains the source/schema-bound pair and checks listed below; no SDK edits
or runtime re-verification occurred in this snapshot.

## Earlier SDK observation — 18:23–18:24 UTC

Independent read-only check: **2026-10-02T18:23:48Z–18:24:44Z**.

- [Backend PR #447](https://github.com/CortexLM/backend/pull/447) remains at
  `7633f7e2fa4df197a3bd19e5316943be20ec6722`, open, base `goal/self-host-providers`.
- Returned SDK checks are historical October 1 results. They do not establish regeneration
  against `d6d46014`. No advanced remote commit was found, so no full source audit was repeated.
- No replacement immutable pair was announced in the inspected coordination tail or comments
  updated since 15:05 UTC. The latest inspected comment is G2's
  [16:45 canonical-schema confirmation](https://github.com/CortexLM/backend/pull/447#issuecomment-5956979013).
  This is a bounded handoff check, not a claim that no artifacts exist anywhere.
- That readback did not inspect the G3 worktree. Its historical `df4aca18` and uncommitted edits are
  not a published delivery. Existing source-backed runtime findings remain open handoff items,
  not freshly reproduced failures.

Required owner delivery: source commit and canonical schema pin, both versioned tarballs with
locations/SHA-256/package-peer metadata, generation/drift/build checks, reconciled public
`Problem`, five typed auth/upload serializer checks and targeted runtime receipts. Those include nondeadlocking
401 refresh, origin/account isolation, original turn replay and AgentEvent UUID `since` recovery.
Generated streaming/default parsing and mode-based discovery documentation remain part of that handoff.

Protocol distinction: AgentEvent feeds use GET plus UUID `since`; turn StreamEvent reconnects
reuse the original POST/body/Idempotency-Key plus numeric `Last-Event-ID`. Realtime frames use
numeric cursors and do not promise durable replay after their room disappears.

## Desktop baseline rechecked — 18:23–18:24 UTC

Archive metadata and SHA-256 still match the PM baseline; neither package was installed or executed:

| Package | Version | SHA-256 |
| --- | --- | --- |
| `vendor/cortex-sdk-0.2.0.tgz` | 0.2.0 | `536f57c026a7a8a1f04f1eb80b3f682f6becd514e789b998fcf28b86de7df9e7` |
| `vendor/cortex-api-types-0.1.0.tgz` | 0.1.0 | `6e97d4f92c5e098ac989589fc81ca70bed1abc018383994e397c49d61837b134` |

`packages/desktop/package.json` references both. Main's `remoteProbe` supplies no auth token;
`ConnectionService.get/set` forces `signedIn:false`; `SessionService.prompt` still resolves local
providers. These source reads confirm incomplete integration, not new runtime results.
Application/test/build inputs at documentation HEAD `00ff621` match `cc758a6` by Git diff.

## Historical evidence remains dated

- `/root/cortex-goals/CONTRACT-READBACK-2026-10-02-PM.md` is a **15:05:49–15:05:50 UTC remote-head
  snapshot**, with separately timed local observations. Its heads, missing-body findings and
  native inventory are not current-status claims.
- The later `/root/cortex-goals/CONTRACT-HANDOFF-2026-10-02-LATE.md` records the G2 correction at
  `70a3056f`, schema blob `d6d46014d1c436b96540529dca2a3005556ae920`, with 422 preserved operations.
  [Desktop contract receipt](backend-contract.json) binds the SHA-256. This closes those five
  schema omissions, not SDK regeneration or desktop auth/inference.
- [Real-provider evidence](../real-provider.json) uses the local engine's configured provider.
  [SDK reachability evidence](../sdk-real-backend.log) is discovery only. Neither proves an
  authenticated Cortex remote image/reasoning exchange.
- [5ced8aa](../mac/5ced8aa/README.md) remains the 426-capture native baseline. Already-committed
  [cc758a6](../mac/cc758a6/README.md) supplements it with 18 native correction captures from
  artifact `11242356217`, CI `37039827971`, ASAR
  `019a846b01c127da1cd612f6c16c21fd6b42e534454328c1095f7defd6dec5a7`.
  Those captures prove their documented recovery scope, not remote authentication/inference.

Next implementation sequence and exact boundaries: [Connection modes](../../docs/connection-modes.md#active-remote-integration).
The next remote proof must use the changed dependency/application revision and native package.
No product tests, builds, CI reruns, installations or native actions were repeated for this readback.
