# Vendored Cortex SDK

## Current pair: SDK 0.4.5 / api-types 0.3.4 (backend trunk)

The only vendored pair, in `trunk/`. Packed with `packages/sdk/scripts/pack.mjs` (umask 077) from a
`git archive` export of backend branch `integration/backend` at `2af7ebba`; byte-identical to the
backend's `apps/web/vendor` copies. Turn resume cursors are full Redis stream IDs (`<ms>-<seq>`); the
SDK refuses any other cursor before opening a request, and the trunk API answers 422 to one. Selected by
`packages/desktop/package.json`, `packages/app/package.json` and `bun.lock` through relative
`file:../../vendor/trunk/...` paths. Every older pair was removed; the provenance below is history only.

| Archive | SHA-256 |
| --- | --- |
| `trunk/cortex-sdk-0.4.5.tgz` | `ea0add5d80bd747bd79d914be81a236eb57c15e33e3af26b8d9d858561d1a487` |
| `trunk/cortex-api-types-0.3.4.tgz` | `d34654dfc6d59342f5c793f4a8fcba1901c9797bbed891550e6e05c12a412e2a` |

## Former pair: SDK 0.4.4 / api-types 0.3.3 (backend trunk at `280d2765`, removed)

| Archive | SHA-256 |
| --- | --- |
| `trunk/cortex-sdk-0.4.4.tgz` | `213cfa10ee93d7beb61b9736f7727a814c2a8168d3fd45a0e786c3f4806fcf8c` |
| `trunk/cortex-api-types-0.3.3.tgz` | `d727777ee9542fb596f7eeaa6e31498cfba3b1d6d749b175b62fa93817d37257` |

## Former pair: SDK 0.4.2 / api-types 0.3.2 (backend trunk at `1e35f614`, removed)

| Archive | SHA-256 |
| --- | --- |
| `trunk/cortex-sdk-0.4.2.tgz` | `c736e87943faa6bbcb39054dab5c4d0bed048c760e0cd7b4a9d9e742d3ebeabc` |
| `trunk/cortex-api-types-0.3.2.tgz` | `51adf60df0fd975e5c4d4bd92deb335e600fa678528b18c7df059f129da6f17f` |

Not published to a registry; not a deployment claim.

# History (removed archives)

## Former pair: SDK 0.4.1 / api-types 0.3.0 (Task6 final contracts, gate round 2)

This pair supersedes the 0.3.5/0.2.0 pair below; those archives stay as history. SDK 0.4.1 replaces the
unadmitted 0.4.0 draft: it restores the approved runtime exports `ActiveVersion`, `ApprovalPolicy`, `Computer`,
`Device`, `PageTools`, `SpendBudget` and `VncTicket` (colliding DTOs are now `<Name>Response`).
It is cumulative: it contains every type, path and method of the approved Task6
pairs (owned channels SDK `4b30c45e`/types `b3401002`, live calls `a283c162`/`81b5c197`,
activity projection `bca20356`/`ed4e5e68`), plus precise DTOs for every account, history,
Bot, Code, approval, task and call route that was still generic, and typed turn bodies
(`ChatTurnRequest`, `EditTurnRequest`, `RegenerateRequest`, `CodeTurnRequest`). The
stream helper keeps `onDiscardedFrame`.

Source: backend branch `cursor/task6-contracts-final` (base `53caa91e`, uncommitted
working tree). Canonical schema `openapi/cortex.openapi.json` SHA-256 `d6b9989c4158d3b61f870bca91adb0c77b3eae50527a0f939f344f4458e81508`.
Public problem codes follow CortexLM/docs `problems/` at `ed7e41f9a2f59182ef73dda2cef718dbb19351f8`
(24 codes, equal to the server's `ERROR_CODES`). Immutable source directory:
`/root/cortex-dev/worktrees/task6-contracts-final/.omo/archive-pair-contracts-final-r2/`.

| Archive | SHA-256 |
| --- | --- |
| `cortex-sdk-0.4.1.tgz` | `226a5f0f5ca437b18fc8adca90a69aafecd0357721b9ee00f5dbf044b90caed8` |
| `cortex-api-types-0.3.0.tgz` | `ccf5007ecd9b301cc99745168d58a1d5fb47ca00d8980a5e36a856fbe6f0fcb8` |

Breaking for callers: `TurnInput.body` is typed per route, and `/v1/conversations/turns`
requires a JSON body. Not published to a registry; not a deployment claim.

## Former Task8 activity-projection successor
## Former Task10 completion pair (streaming calls)

`packages/desktop/package.json` and `bun.lock` select `task10-completion/` through relative
`file:../../vendor/...` paths, so CI resolves it from this checkout. Byte-identical copies of
the read-only Task10 completion pair
`/root/cortex-dev/worktrees/task10-streaming-stt/.omo/archive-pair-task10-completion/`
(worker `st_01a11270`, claim `task10-streaming-stt/.omo/Task10CompletionDoneClaim.json`; base
Task6 r2 sdk 0.4.1 / api-types 0.3.0 plus the streaming delta: `LiveCallCapabilities.stt` admits
`streaming`, `LiveCallEvent.type` admits `partial_transcript`).

| Archive | SHA-256 |
| --- | --- |
| `task10-completion/cortex-sdk-0.4.2.tgz` | `fccf9381dbd91471590f67844778624a063aa59e80cd6fad1a6858d6c1fab398` |
| `task10-completion/cortex-api-types-0.3.1.tgz` | `42e752596047d594487bd456d1ada350a52fb1318bca56a1328b1558d9487285` |

Why: api-types 0.2.0's `parseAudioCapabilities` returns null for the capabilities a producer
with `audio.elevenlabs_api_key` sends (`stt: "streaming"`, `interim_transcripts: true`), which
hid the Bot call. A Task10 independent gate on this pair is pending; until it approves, the
live-calls pair below is the last gate-approved selection.

## Previous Task16 live-calls pair

Selected by `live-calls-st01a10f26/` (relative path). The archives are byte-identical
copies of the independently approved Task6/Task10 pair
`/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-live-calls-st01a10f26/`
(gate `cortex-completion-task6/.omo/evidence/task6-live-calls-gate-review.md`, verifier `st_01a10f49`;
provenance `cortex-completion-task6/.omo/LiveCallsSDKProvenance-st01a10f26.json`).

| Archive | SHA-256 |
| --- | --- |
| `live-calls-st01a10f26/cortex-sdk-0.3.5.tgz` | `a283c1627af0810dc1e312213ccb2b0f31df73e17a05026bcd49e594b3317973` |
| `live-calls-st01a10f26/cortex-api-types-0.2.0.tgz` | `81b5c1977f2f72789296c54254a4183e1705b6bb45d5cb51733c2055654d2bb2` |

Adds the `cortex-live-v1` Bot call contract (`liveMediaUrl`, `LIVE_FRAME`, frame codec,
`parseAudioCapabilities`) to the activity-projection pair below. The generated routines
`Resume` class is renamed `Resume2`; no consumer imports it by name. Older pairs, including
the absolute-path selections recorded below, are historical.

## Previous Task8 activity-projection successor

Exact independently approved pair selected by desktop manifest/lock, vendored byte-identical at
`activity-projection-st01a10ecc/` (`file:../../vendor/...`, lock integrity unchanged) from
`/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-activity-projection-st01a10ecc/`.
SDK SHA-256 `bca203567634ad4e9940bd978d35c5a44d3946afda9f42f28599b86634c56088`;
types SHA-256 `ed4e5e68e221bc43824c8bfc084059a06bd8570d123ea9c26b9e0a1e4df22ae0`.
Gate `cortex-completion-task6/.omo/evidence/task6-activity-projection-gate-review.md`.
Adds only `projectAgentEvent`; wire/OpenAPI/generated SDK equal the owned-channels pair.

## Previous Task8 owned-group-channel pair

Exact e5e independently approved pair:
`/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-owned-channels-st01a10cdc/`.
SDK SHA-256 `4b30c45e767479d3f0c15c4eb6867e715da426aba6f362af3e6355708a27040d`;
types SHA-256 `b34010025fa3170ac6368188ab2f75b54c2b20af62f503958262123258435391`.
Recovered gate `.omo/evidence/task6-owned-channels-sdk-gate-review-recovered.md`.
Five precise metadata operations only; exact200/201, nullable preserve/full member
replacement, foreign404/duplicate409. No enabled/provider settings or transcript POST
admission. Prior inbox/routine/approval/hierarchy/copy/decline/connector pairs retained.
Absolute local archive selection is fixture admission, not portable packaging/full Task8.

## Former Task8 inbox/notifications successor

Exact e2b independently approved pair:
`/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-inbox-notifications-st01a10cdc/`.
SDK SHA-256 `ab6475dc1e53da062d3f3f1451d34a9af12701cbf942aa30fdb72606524c5626`;
types SHA-256 `d95764166d70c45687ba997a5d815b593fe2071dabdb8d9094d418a89d1c57a1`.
Recovered gate `.omo/evidence/inbox-notifications-sdk-pair-gate-review-recovered.md`.
Main adds home inbox/read and notification query/bodyless204 only, uses existing typed
SSE subscribe as invalidation. No arbitrary activity payload or raw generic transport.
Previous routine/approval/hierarchy/copy/connector archives retained, no source changes.
Local absolute archives are fixture admission, not portable packaging/combined runtime.

## Former Task8 Work-routines successor pair

Local manifest selects the exact independently approved `st_01a10dfd` Task6 pair:
`/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-work-routines-st01a10cdc/`.
SDK SHA-256: `ad68ea1b12a915c147bbca4f1be25b1bd45c2f332f57ada0f86db117780e50b0`.
API-types SHA-256: `331121c52ace5c25b8a0ef6ef2693a1a21de162442b47efd9585fbccc8f9b1af`.
Recovered exact report: `.omo/evidence/task6-work-routines-gate-review-recovered.md`.
Ten existing routine CRUD/control/tick/event/history operations become precise; desktop
admits CRUD, bodyless pause/resume, history and authenticated event delivery only.
PATCH requires name/prompt; omitted schedule re-infers, so the editor preserves it.
Timezone is metadata; explicit offset matches, otherwise Paris seasonal fallback.
Event payload is not consumed; no routine-run cancellation exists. Earlier archives,
hierarchy/approvals/copy/decline/connectors/Chat/Code contracts remain retained.
Producer runtime binds through0157 and existing Task4 workers. Absolute paths are
local-only dependency admission, not portable packaging or combined-stack acceptance.
Full Task8 remains open.

## Former Task8 pending-approvals successor pair

Local manifest selects the exact independently approved `st_01a10dde` Task6 pair:
`/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-pending-approvals-st01a10cdc/`.
SDK SHA-256: `ec597226d36b777426fd6ae6cde5ad302a85c3d01fe997d1199ebcb59cb1923c`.
API-types SHA-256: `e38948c1ced7ad8d31a3ad7e3c303cb67896a780964e26fe6b4cafc7a117bb1e`.
Recovered independent report: `.omo/evidence/pending-approvals-sdk-pair-gate-review-recovered.md`.
Adds typed existing account/owned pending lists, linked-widget decisions and policy
evaluation reads. `resumed` is permission, not tool execution success; deny may infer.
No approval GET/outcome/invalidation capability is added. Hierarchy, decline, copy,
connectors, Work receipts and auth contracts remain retained. Personal MCP and full
Task8 remain open; absolute local paths are not portable release acceptance.

## Former Task8 hierarchy successor pair

Local manifest selects the exact approved Task6 archives in
`/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-hierarchy-st01a10cdc/`.
SDK SHA-256: `9f3574e0ad64831fafc8bb8d6637131cbe9899a9b15d2a5523d4e3bed92579d9`.
API-types SHA-256: `1a93ab462d7430128cd1a745914121bd1bbc35d334f27c54f1b847f7af575c9f`.
The independent `st_01a10da9` APPROVE report was recovered from its retained isolation
patch in `.omo/evidence/hierarchy-sdk-pair-gate-review-recovered.md`.
Bot response `lead_id` is required nullable; create omission/null roots, PATCH omission
preserves, null detaches. Existing runtime JavaScript and previous archives stay intact.
Actual desktop runtime proof binds the approved `bot-specialist-hierarchy-st01a10d6d`
producer through0157, not the combined assembled migration stack. Absolute local paths
are not portable package acceptance; full Task8 remains open.

## Former Task8 decline successor pair

The local-only desktop manifest and lockfile select the immutable Task6 archives at
`/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-decline-st01a10cdc/`.
SDK SHA-256: `ec22d9c5656e0e0478233a9cf860c7200adedbbbc3bcb5d9be17e5394ca16276`.
API-types SHA-256: `35750b9acb36a668ecf4ef80bc31a338c95721163f13dd53d6c1c2605909abb2`.
This composes the approved bodyless recipient decline and optional sender decision
fields while preserving connector/plugin, independent-copy, parent, Chat and Code
contracts. The parent's independently approved pair gate path was supplied but its
isolated checkout is absent; this worker verifies archives, not that unavailable report.
Prior vendored pairs remain unchanged. Absolute local paths are not a release package
claim. Task6 contract assembly does not mount decline: desktop proof uses the actual
`bot-share-decline-st01a10d4a` producer with migration 0156. Combined assembled producer
migration-stack acceptance, hierarchy and full Task8 remain open.

## Former Task8 connector/plugin pair

`connector-plugin-st01a10cdc/` adopts the exact immutable Task6 pair independently
approved by `st_01a10d1e`; recovered report:
`.omo/evidence/task6-connector-plugin-gate-review.md`.
SDK SHA-256: `b1cec4b62e9d8f9fced1c63ea182cfa229499356730f068b2c7a824e567bffd3`.
API-types SHA-256: `a26559574af03ff2b32f771d4b98e62fb3c1e8952adc78025c6dda1a8a7411fc`.
Adds precise catalog, account consent/revoke, owned-Bot connector enables and
per-Bot tool rules. Rule upsert may return an attempted ID; re-list before delete.
Connection modes, Bot rule effects and account-global policy remain distinct.
The gate reproduced 453 assertions, 102 negative compile assertions, 44 types tests,
86 SDK tests, 37 consumer tests and 15 OpenAPI tests, not 16. Previous archives remain.

## Retained Task8 independent-copy pair

`bot-share-b1-st01a10cdc/` adopts the immutable Task6 pair independently approved
by `st_01a10ce7`, `/root/.omo/wt/t1b9f8d8009/m/.omo/evidence/bot-share-copy-pair-gate-review.md`.
SDK SHA-256: `c61b0fc566b6bc35006ca7973e3582959689f03c2146046ef3bb9c3f5653f184`.
API-types SHA-256: `20eea90ec5eb96475445fd6c03016dc8c8ce118be09bbab5b85eaa5d675c11cc`.
Adds precise existing owner share/invite/revoke and recipient inbox/preview/accept
contracts. Acceptance creates an independent copy; replay returns 404. No visibility,
expiry, human membership or persistent decline contract. Previous archives stay intact.

## Retained Task8 original-parent pair

`bot-parent-st01a10cad/` is the unmodified additive pair independently approved
by `st_01a10cb6`. SDK SHA-256: `f2cba83e8edc1130f3cc8f83c898a6e702513225453ee7a8f562e05475697b8b`.
API-types SHA-256: `99a625ad8fa0f0282afae968686e8edce310d3987d43f62b13a7af52dce535fd`.
Gate report SHA-256: `ada363c52a0a90f8d2f328e623dce37d06944f4d83ed050245c6d846ae4e9d33`.
The temporary report checkout is absent; its retained patch is recorded in
`.omo/Task8WorkBotParentContractReady.json`. Only existing POST Bot messages
request/response typing changes. Prior pair archives remain unmodified.

## Retained Task8 Bot configuration pair

`bot-config-st01a10c85/` is the unmodified additive pair independently admitted
by `st_01a10c8d`, `.omo/evidence/task6-bot-config-st01a10c85-gate-review.md`.
SDK SHA-256: `bf649ecedc0a53cb884ad6f672ca3a332b481aa2b049520ac3a65bc2271a62a1`.
API-types SHA-256: `ef7805ffde9be58d1af1308442502465fb6e8cadeb6a7dd260c648d8b2be9c2c`.
Source: `/root/cortex-dev/worktrees/cortex-completion-task6/.omo/archive-pair-bot-config-st01a10c85`.
Precise Bot configuration/resource/retained-message DTOs augment the assembled
contract. Prior Code task declarations and every older archive remain unchanged.
`.omo/Task8WorkBotSDKContractReady.json` retains exact gate/hash admission.

## Former Task8 assembled B1 pair

Task8 desktop uses the unmodified `assembled-b1-st01a10bfe/` pair admitted by
`/root/.omo/wt/tae15693b69/m/.omo/evidence/task6-assembled-contract-b1-gate-review.md`.
SDK SHA-256: `360110e29078892ebb7a665348a894bbf08d134a4abdfb74d002960edd90e27c`.
API-types SHA-256: `32a39b6563c9871e5b63ba0e5cab2707951237bb2fcddd81d7814c53a18d3835`.
This supersedes the active package paths below only in Task8. Every older archive remains
unchanged. Task7's approved dirty source baseline and before-image hashes are retained in
`.omo/Task7SnapshotPreimageReceipts.json`.

## Former Task7 pair

The active discovery pair is `discovery-fe79b147/`, admitted by
`/root/.omo/wt/tbedb384524/m/.omo/evidence/task6-discovery-immutable-pair-gate-review.md`.
SDK SHA-256: `b474e7202f4f808244c9dbb6944913f5856a8034fcb51998cc38f73c7e485b83`.
API-types SHA-256: `ba4e183cc2c1793a69ee27bebdf8ea07d98255f7397401fc32828615bb5e0a31`.
Its exact HTTP producer is `cortex-completion-task7-pagination`, not the assembled
Task6 server. Previous archives below are retained unchanged.

## Previous reset-ID pair

The unmodified pair under `reset-id-54835caa/` came from Task6's independently verified reset-ID closure.
The older root archives below remain historical, unchanged.

| Archive | SHA-256 |
| --- | --- |
| `reset-id-54835caa/cortex-sdk-0.3.5.tgz` | `6e27abab0e4e504ae07c27b3ec559442cf3ad0205bd8ea30fb7d2fcec854fe08` |
| `reset-id-54835caa/cortex-api-types-0.2.0.tgz` | `db667f3b381c377c23f249499704b3bbda7ee33af09741bd68065fe08985ff69` |

This pair supplies typed paginated retained history, opaque Redis stream IDs, empty-ID
reset handling, explicit terminal outcomes and `onDiscardedFrame`. It is a local
consumer admission, not a publication, persistent-auth or full Task6 claim.

## Historical pair

`@cortex/sdk` 0.3.5 and `@cortex/api-types` 0.2.0 are vendored unmodified from the
Cortex SDK workstream (`CortexLM/backend`, `packages/sdk`) because this repository's CI
cannot see that checkout.

The SDK declares `@cortex/api-types` `0.2.0` as an exact optional peer;
`packages/desktop/package.json` depends on both tarballs directly. Re-vendor with
`npm run pack:vendor -- <out>` in the backend's `packages/sdk`.

Source: `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31` ([backend #447](https://github.com/CortexLM/backend/pull/447)).
Canonical schema: Git blob `c8f6a7f0257858306a885c71202c13420f40725f` at backend
`af36085cc96b182950ca4bf15161dcf2c3951da1`, SHA-256
`b2495d1d8ec631d143c5dcc5d200aeb0d288f69beae31ba671b3a7856f663d5b`.
Only the screenshot upload contract changed from the earlier `d6d46014` schema;
all 422 operation IDs remain. The immutable owner release is
`/root/cortex-goals/releases/sdk-0.3.5-5b7e9d1c3fa2/`.

| Archive | SHA-256 |
| --- | --- |
| `cortex-sdk-0.3.5.tgz` | `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8` |
| `cortex-api-types-0.2.0.tgz` | `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877` |

Only Electron main imports the SDK. `probeRemote` in `packages/desktop/src/remote.ts`
checks readiness/instance metadata, then calls `client.models.list()` for Cloud or
`client.registry.models.list()` with configured-only pagination for self-host. The transport
pins the origin, refuses redirects and cookie storage, and bounds the whole probe to five
seconds. The probe supplies no auth token. Separate `RemoteSession` uses the SDK's typed
email-code/local-login/continuation operations in main; session material lasts until process
exit. An internal account-epoch Chat binding supplies the process-only core service with
models/uploads/streamed turns and bounded history. Public desktop prompts still use local
providers; see [connection-modes.md](../docs/connection-modes.md).

`packages/desktop/test/remote.test.ts` exercises the SDK against a local stub. Its optional
real-backend case (`CORTEX_TEST_BACKEND_URL`) asserts reachability; the recorded
[`evidence/sdk-real-backend.log`](../evidence/sdk-real-backend.log) contains returned model
metadata, not a generated response or authenticated-session proof.

This pair supplies typed email-code/MFA/email-verification, local sign-in, configured registry
queries and raw Library/screenshot uploads. Screenshot upload requires a filename and returns
typed metadata. Five generated turn/edit/regenerate methods accept `body?: unknown`; this is
transport typing, not a validated turn DTO. Password/signup/refresh, Cloud catalogue, account
and history payloads remain generic. History is bounded and omits reasoning/tool replay;
there is no stable public account ID for durable cross-login caching.

The stream helper preserves announced image completions after `done` and their final cursor;
this does not cover arbitrary post-terminal events or cancel backend generation. Successful
auth JSON is read once before identity replacement, removing the native response-clone
shutdown defect. Desktop's bounded auth transport remains necessary. Scoped Node 22 admission
covers discovery, main-only authentication and consumer transport fixtures; real Cloud
authentication/inference and packaged/native acceptance remain separate.

SDK 0.3.5 hides the parser's discarded-frame notifications. Desktop conservatively marks
every remote projection limited, even after `done(stop)`; [owner follow-up](https://github.com/CortexLM/backend/pull/447#issuecomment-5966461570)
requests the existing callback. No archive modification or second consumer parser is used.
The pinned backend also omits historical image pixels; fresh image-history follow-ups
remain refused pending its separate hydration contract.

The old 0.2.0/0.1.0 and 0.3.1 archives remain historical. SDK 0.3.0 remains on adoption hold for
its Node 22 sign-in regression; the original owner artifacts/failures remain preserved, as do
0.3.1's media/screenshot failures and incomplete 0.3.4 shutdown receipts. Earlier desktop
SDK/native evidence, including `ffc118a` with SDK 0.3.1, does not certify this new pair.
