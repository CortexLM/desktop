# SDK0.3.5 desktop admission readback

**Bounded ADMIT for the coordinator's next authorized dependency intake.** Final owner delivery verified; no candidate compatibility blocker found against desktop `ffc118a`. Repository still uses SDK0.3.1/API-types0.2.0. Adoption, real-backend acceptance remain pending.

## Exact delivery
| Item | Verified value |
| --- | --- |
| SDK source | `5b7e9d1c3fa2bc89b1d74343ece0a014eaa65c31` |
| Immutable owner directory | `/root/cortex-goals/releases/sdk-0.3.5-5b7e9d1c3fa2/` |
| SDK0.3.5 SHA-256 | `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8` |
| API-types0.2.0 SHA-256 | `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877` |
| Receipt SHA-256 | `6bb1af0ae2412b00e7415ad76b259951ee0460449cbe46b96e8b00afffd93aba` |
| Desktop service/test source | `ffc118a2e58df66f430f3078e00f6e931dd910cf` |

- Final handoff is explicit: `delivery.json` says `delivered_for_owned_consumer_adoption`; earlier 0.3.3 candidate/0.3.4 HOLD does not describe this pair.
- Exact optional peer `@cortex/api-types: 0.2.0`; no runtime `file:` dependency. Packed manifest equals pinned source plus the documented peer transformation.
- **35/35 packaged TypeScript sources** match Git source; **16/16 generated files** match Git, archive and receipt; SDK README matches Git.
- **102/102 compiled files** byte-match isolated TypeScript6.0.3 emission from those source/config bytes: SDK38 + API-types64, including maps. No owner-checkout build.
- **10/10 owner log hashes**, all **50 delivery-file hashes**, artifact sizes, read-only archive modes verified. Isolated offline npm install: **140/140 installed members** match archives.
- Owner CI37094557684 and CodeQL37094557772 receipts bind this exact head; 11 substantive CI jobs/3 languages green. Source-bound final review receipt reports zero unresolved threads. These are retained receipts, not fresh remote polling or reruns.

## Checks actually executed
All runtime commands use native **Node22.23.3**; exact commands/exits/timings in `logs/*.json`.

| Check | Result | Evidence |
| --- | --- | --- |
| Isolated public consumer declarations | PASS; source-owner public fixture plus both prior desktop signature probes | `logs/public-types.*` |
| Desktop TypeScript5.9.3, strict, declarations checked (`skipLibCheck:false`) | PASS; public declarations and copied main service/schema/error | `logs/desktop-compiler-types.*`, `logs/main-typecheck.*` |
| Exact final-source SDK runtime file | **34/34 PASS**, zero skipped/cancelled; natural process exit0 in0.365s | `logs/sdk-runtime.*` |
| Unmodified actual `RemoteSession` tests | **8/8 PASS**, native HTTP/Fetch; exit0 in11.082s, including real10s body timeout | `main-service.json`, `logs/main-service.*` |
| Previous exact desktop media/upload/turn fixture | PASS; media **3/3**, final cursor **`3`**; screenshot/Library raw bytes; all five JSON POST bodies/headers | `consumer/consumer-check.json` |
| Additional real HTTP loopback consumer | PASS; auth, Library, screenshot, new-turn SSE; zero successful-auth clone calls; cookie/bearer preserved | `consumer/native-http.json`, `logs/native-http-final.*` |
| Source/compiled/archive identity | PASS | `verification.json`, `compiled-identity.json`, `packed-members.json` |

### Main-service isolation
- `remote-session.ts`, its test, real core `error.ts` and shared schema were copied byte-for-byte once; all four match `ffc118a`. No service/test rewriting or mock SDK.
- `vitest.config.mjs` aliases `@cortex/sdk` and API-types exclusively to this output directory's installed0.3.5/0.2.0 pair; `@cortex/core` resolves the copied real error module; schema is copied real source. Zod/Vitest are existing desktop dependencies, read-only.
- `resolution.setup.ts` verifies imported client identity equals the absolute candidate entry, SDK version0.3.5, public peer error constructor identity, Node major22. Receipt: `main-service-resolution.json`. Repository SDK0.3.1 cannot satisfy these checks.
- Eight unchanged cases cover origin/request pinning/private cookies; failed-account replacement/code retry; typed email/MFA continuations; private enrollment; local expiry/logout bearer; cancel/logout/origin/clear late-response isolation; duplicate/unfinished-body timeout; invalid origins/redirects/malformed success/error sanitization.

## Auth correction disposition
Pinned `packages/sdk/src/client.ts:155–166` reads successful non-bodyless auth JSON with **one `arrayBuffer()`**, creates a detached response, inspects those same bytes, then permits account invalidation. The former `res.clone().json()` path is removed. Stream-read errors propagate; malformed JSON still fails public parsing;204 remains bodyless.

This is compatible with desktop's existing bounded transport: it already consumes native auth bytes, checks origin/status, caps1MiB and enforces10s before returning its detached response. **Keep that wrapper.** The SDK fix does not replace desktop limits or make this auth-only transport suitable for Chat SSE.

The34 runtime cases specifically pass native successful-auth no-clone, original read-error/account-abort identity, bodyless204/malformed JSON, delayed account replacement, headers and empty-SSE-ID reset. The eight real main-service tests pass independently with the unchanged desktop wrapper.

### Node20.9 exit claim
Source diff removes the failed shutdown `after(setImmediate)` workaround and adds the actual single-read fix. Retained diagnostic shows baseline hangs versus12/12 single-read natural exits. Hash-verified owner minimum-runtime/isolated-package logs finish34/34 with exit0; package harness has60s deadline. Isolated log distinguishes Node20.9/npm from subsequent Bun runtime; npm emits its minimum-version warning, then checks complete.

**Node20.9 was not rerun here.** Fresh consumer proof is Node22.23.3 natural exit. Prior0.3.4 twelve-minute hang/failure archives remain negative evidence; copied under `owner/previous-*-verification-failure.json`.

## Precise contracts and preserved negatives
- Canonical source remains `af36085cc96b182950ca4bf15161dcf2c3951da1`, blob **`c8f6a7f0257858306a885c71202c13420f40725f`**, SHA-256 `b2495d1d8ec631d143c5dcc5d200aeb0d288f69beae31ba671b3a7856f663d5b`.
- Original0.3.1/G2 blob **`d6d46014d1c436b96540529dca2a3005556ae920`** stays distinct. Only screenshot POST and `BugScreenshotUploadResponse` changed; all422 operation IDs retained. `schema-delta.json` records the comparison; 421public methods is the owner SDK-surface count.
- **128 auth/discovery/Library/account/history-related declarations remain unchanged** from0.3.1. Six relevant handler sources are byte-identical to G3's `d6c71de1` disposition. `contract-delta.json` records names/hashes.
- Screenshot requires raw `Blob | File` plus `query.filename`; returns `BugScreenshotUploadResponse`. Missing filename/JSON body remain compile errors.
- Five generated turn/edit/regenerate methods now accept **`body?: unknown`**, return raw `ReadableStream<Uint8Array>`. Both earlier positive probes pass; this is transport permission, not canonical `TurnBody` validation.
- Password/register/refresh, Cloud models, account/history remain imprecise. Negative type assertions prevent claiming those responses as typed auth/session/model/history. Existing precise OTP/MFA/local auth/registry/Library contracts remain usable.
- Original0.3.1 screenshot `{}` corruption and2/3 media result remain hash-preserved in `previous/031/consumer-check.json`; prior0.3.2 five-signature TS2322 evidence stays unchanged. New results supersede the defects only for verified0.3.5 bytes.
- Media acceptance covers **announced image generations after `done`**, not arbitrary post-terminal events/reconnect. Abort detaches delivery, not backend generation. No invented cancel or portable reasoning Off.
- No stable public account ID; history stays capped, hardcoded `has_more:false`, missing reasoning/tool replay. G3 narrow runtime-validation permission still applies; no casts or fabricated DTO fields added.

## Remaining gate / next batch
**No package/main-auth compatibility blocker found.** Coordinator can authorize a separate intake pin for both archive references/lockfile/docs, preserving `ffc118a` + SDK0.3.1 native evidence as its own revision.

Owner asks for a consumer commit, both hashes and a current real-backend call. This readback supplies candidate hashes and isolated consumer compatibility only. Known verification environment flags remain absent (`environment-presence.json`); loopback fixtures establish no real Cloud account, hosted inference, packaged/native or full remote-workflow acceptance.

Repository source, dependencies, lockfile and archived0.3.1 pair checked unchanged: `desktop/unchanged.json`. Writes stayed under `/tmp/opencode/desktop-sdk-035-readback/`; no commit/push, owner-branch change, Mac action, CI/server-suite rerun or root install. Existing coordinator documentation/evidence changes remain outside this executor's work.

## Coordinator intake and integrated checks

Adopted in `78857365a509d78af10ebdda5b52348a2e50e961`.
[CI 37097480122](https://github.com/CortexLM/desktop/actions/runs/37097480122) passes all three jobs;
[Artifact review](ci-7885736/README.md) verifies 96 cases/426 renders per OS, zero retries,
201 unit passes plus one optional skip, and 37 full-resolution originals from 231 unique PNGs.
[New-pair installed verification](../mac/7885736/README.md)
passes six sign-in and two narrow Approvals captures. The original read-only admission statement
above describes the earlier handoff, before this authorized intake.

[Authorized intake](intake/README.md) applies the exact SDK archive and unchanged peer;
52 actual-root probe/auth cases pass with one optional backend skip. The lockfile delta is
SDK-only. Historical archive bytes remain unchanged.

Integrated checks pass: lint/types/i18n, **201 Node 22 units + one optional skip**, ten
Electron auth/approval-layout cases, rebuilt Linux package/smoke and all 90 embedded members.
The four narrow approval screenshots show separated labels/descriptions and reachable controls.
The earlier [28 installed captures](../mac/ffc118a/README.md) remain pinned to SDK 0.3.1;
changed-pair CI and eight installed captures now pass; [independent native review](../mac/7885736/review.md)
verifies all images and packaged source bindings. A separate [eight-locale layout check](approvals-locales/README.md)
passes all 16 theme/locale views at 960×640 with exact text geometry and real Tab traversal;
Linux fonts and two corrected rows only, not all-surface translation/native acceptance.
The separate [live-auth locale check](auth-locales/README.md) passes all 48 wrong-code,
signed-in and unavailable-continuation views, plus all seven new auth keys, with private
state checks and 144 Tab stops. French/German/Japanese email Cancel initially clips 6px;
six follow-ups prove Tab reveals it and Enter returns Home. Both original clipping and
Linux-only scope remain explicit.
One [repository regression](auth-locale-regression/README.md) now repeats the 48 primary
states and 144 Tab stops through the existing E2E suite. Its initial focused run passes on
the frozen `7885736` build; next-revision CI remains separate.

A separate real `https://api.cortex.foundation` SDK probe passes on 0.3.5 and returns three
model IDs. [Log](integrated/real-probe.log): one selected case passed; 44 cases excluded by
the explicit test-name filter, not retried failures. This is unauthenticated discovery,
not a real sign-in, streamed response or inference proof.
The consumer commit, archive hashes and real discovery receipt were returned to the SDK owner
in [G3 #447](https://github.com/CortexLM/backend/pull/447#issuecomment-5965633627).

Later [public contract readback](public-cloud-readback.json), 05:35 UTC: `/v1/instance` is 404,
two `kind:chat` models declare reasoning but no vision, the third is an image-generation card.
The probe's documented 404-only legacy fallback explains reachability. This metadata does
not supply a vision-capable Chat model or authenticated transport acceptance.
