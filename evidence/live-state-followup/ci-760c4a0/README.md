# CI 37110253688 — live-state, Bot ownership and Linux glyph audit

**Scoped approval:** all three jobs pass at application **`760c4a0`**. Both OSes pass
**103/103 Electron cases**, including the six unchanged negative regressions. Linux
CJK provisioning, actual fallback selection and rendered glyphs now pass. The prior
Linux missing-glyph images remain historical failures. **Native CI screen capture
still fails**; package/installed-native verification has a separate owner.

Run: <https://github.com/CortexLM/desktop/actions/runs/37110253688>, attempt 1,
2026-10-03. Completed metadata read once; no polling or rerun.

## Source and build binding

| Bound input | Verified value |
| --- | --- |
| Application/run head | `760c4a046ce454bc8b0ab2fd85c941fec321c3ea` |
| Actual checkout, all three logs/both reports | `520da2689bdccfdbbaba2378961784be3ba40cb1` |
| Checkout/application tree, equal | `7afa416fd06381c4abcacdc9153177732592c50f` |
| Renderer comparator fingerprint, 473 inputs | `39a06106e8d3545e1131ed64dddf5c60013581ffb2f1465f5c67399892669609` |
| Frozen main SHA-256, unchanged from `f5bf305` | `f0fc4522cde726dd8b88dcbb56f4116ba93dc87e1e9e29163502d25e522512c7` |
| Original four-case Chat regression SHA-256 | `842804966f6cd584834c728c92c495ccc52ece47bce2dcd128df912f98c83710` |
| Original two-case Bot regression SHA-256 | `21af3392fad947945861063d93625d6115675f288ff43273568ea1fe4c50cdff` |
| Auth/font test SHA-256 | `653016add38f51d766dfec52c205790de4b941c02739a993315c282469b1b0cb` |

All **514 frozen input hashes** match committed bytes; Git modes/blobs recorded.
All **90 frozen build members** match `/tmp/opencode/build-live-state-final/`, with no
unlisted members. Against the prior application inputs, only
`packages/app/src/state/live.ts` and `packages/app/src/screens/bots/bot.tsx` differ.
The original Chat/Bot tests equal their retained negative-baseline bytes exactly.

[Checkout binding](checkout-binding.json), [source pins](source-pins.json),
[input bindings](provenance/input-bindings.json), [renderer inputs](provenance/renderer-inputs.json)
and [build members](provenance/members.json) preserve this chain. This is byte-verified
source/frozen-build provenance, not a reproduced build. The test artifacts contain
neither main bundle nor ASAR; CI package-member equality is outside this audit.

## Downloads and counters

| Archive | Artifact ID | Bytes | Extracted files | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Linux tests | `11269436951` | 29,519,419 | 409 | `6bbf9091a1d2362b62b47ab76fef0d8b2f38af47b9ace81b0d0557b850117323` |
| macOS tests | `11269637206` | 28,542,049 | 411 | `90f474aa0476ca8956508875be825317bf06fd844c6c95f4496b9f3b6737d45b` |
| Complete run logs | — | 96,072 | 52 | `f6284ba169b0116a6277782484f8f9e2f1e925e3781463cd11ab9fdb909033b4` |

Raw ZIPs fetched through `gh api`. Supplied and API/upload artifact digests and sizes
matched **before extraction**; CRCs, unique/safe paths and extracted member hashes
verified. The log ZIP digest is locally computed. [Download receipt](downloads.json).

| Check | Verified result |
| --- | --- |
| Lint / types | Successful steps, no diagnostics |
| Units | **245 passed + one optional skip**, 246 total, **22 files** |
| i18n | **65 files / 2,272 used keys / 3,405 English keys / zero problems** |
| Linux Electron | **103 passed / 103 attempts**, four workers, **204.573s** |
| macOS Electron | **103 passed / 103 attempts**, one worker, **569.547s** |
| Both Electron reports | **Zero retries, skips, flaky/unexpected results or runner errors** |
| Gallery case | **426 render visits per OS**, not 426 retained images |
| Locale case, each OS | **48 primary states / 80 measurements / 384 text rows / 144 Tab stops** |
| Glyph sentinel, each OS | **Six CDP font records / twelve passing 400/500-weight checks** |

The same 103 case identities cover 24 files per OS: prior 97 plus four Chat races and
two Bot-owner cases. No glyph case was added. Optional unit skip remains
`lists models from a real backend`, gated by `CORTEX_TEST_BACKEND_URL`.
Node: checks **22.23.3**, Linux E2E **22.22.0**, macOS **22.22.3**; Bun **1.4.2**,
Electron **44.5.1**. OS: Linux **Ubuntu 24.04.3**, macOS **26.3**.
[Checks](checks-summary.json), [E2E counts](e2e-summary.json), [cases](cases.json).

## Six unchanged regressions — actual ownership/history

**Bot, light/dark on each OS:** held response is the real successful Beta session list.
While held, Beta's heading/composer are visible with **zero transcript users/answers**.
After release, only `Beta saved request` appears. The next actual POST goes once to
Beta's exact session; Alpha remains two messages, Beta becomes four.

| OS/theme | Actual follow-up POST |
| --- | --- |
| Linux light | `/api/sessions/ses_01a100e99df10000814164a67dd952e2/prompt` |
| Linux dark | `/api/sessions/ses_01a100e99e140000b3b63d8da4b73111/prompt` |
| macOS light | `/api/sessions/ses_01a100e92a5500000646e19af5125f8d/prompt` |
| macOS dark | `/api/sessions/ses_01a100e93a6700003ef415cbcf9b3c6c/prompt` |

Every Bot trace has **13 DOM observations, 11 under Beta**; none shows Alpha transcript
text under Beta. Final Beta users are exactly `Beta saved request` and
`Intended for Beta after navigation`; Alpha retains `Alpha first request`.
All three assistant completions per case are error-free and complete. The six soft
ownership assertions per case remain active; all twelve per OS pass.
[Decoded Bot checks](bot-checks.json), [complete attachments](scoped-attachments.json).

**Chat, stream/delete in both themes per OS:** the held real snapshot contains the
earlier exchange. Stream traces retain the newer completed exchange through release,
then show both exchanges in order. Each has **26 deltas, 14 part updates, eight message
updates, four status events**, two completed assistants. Linux samples 14 DOM states,
macOS 13; all three non-setup samples retain the newer content.

Deletion traces contain the actual deletion event; all **three DOM samples stay empty**,
before and after history release. No observed revival. All recorded page/console error
and renderer-HTTP arrays are empty. Observation is bounded by the test's real IPC fence
and animation frames, not an exhaustive CPU-instant guarantee. [Chat checks](chat-checks.json).

## Linux CJK repair is exercised in this CI

Apt logs record **previously unselected** `fonts-noto-cjk` installed at
**`1:20230817+repack1-3`**; `fontconfig` is **`2.15.0-1.1ubuntu2`**.
Uploaded inventory contains **87 font patterns / 61 font files**. Every selected Noto
PostScript name matches its inventory entry; its charset covers the actual heading and
sentinel characters. [Packages](fonts/packages.tsv), [font inventory](fonts/fontconfig.tsv),
[provisioning binding](font-provisioning.json).

| Locale | Linux actual heading fallback | macOS actual heading fallback |
| --- | --- | --- |
| Japanese | `Noto Sans CJK JP` / `NotoSansCJKjp-Regular` | `Hiragino Kaku Gothic ProN` / `HiraKakuProN-W3` |
| Simplified Chinese | `Noto Sans CJK JP` / `NotoSansCJKjp-Regular` | `蘋方-簡` / `PingFangSC-Medium` |
| Korean | `Noto Sans CJK KR` / `NotoSansCJKkr-Regular` | `Apple SD Gothic Neo` / `AppleSDGothicNeo-Medium` |

Both themes agree. Korean also uses one Geist glyph for its space. The Chinese Linux
selection is **JP**, as reported; regional glyph-form preference is not certified here.

All pairs **あ/ア, 한/글, 汉/字** have ink, distinct RGBA rasters and neither equals
the U+10FFFF missing-glyph raster at **400 and 500**. No failure-glyph PNG was emitted.
CDP names/counts supplement the raster assertions; positive counts alone are not glyph
proof. All **sixteen full-size locale originals** were inspected: actual glyphs, refusal
copy, retained digits and focused Cancel are visible. [Font records](font-records.json),
[locale counts](locale-summary.json), [geometry](locale-geometry.json).

Against prior same-OS CI, **all eight macOS PNGs and five Linux Latin PNGs are exact**.
Linux ja/ko/zh-Hans change **27,965 / 35,228 / 15,823 pixels** respectively, now displaying
glyphs. The [previous tofu failures](../../remote-chat-foundation/ci-1076c25/README.md)
remain intact. Current provisioning is proved; historical absent-package versus fontconfig
cause remains unisolated. [Exact drift measurements](locale-image-drift.json).

## Image review and retention

**271 unique PNGs reviewed in 24 contact sheets; 44 required full-size views reviewed.**
Linux: 405 file copies / 135 unique; macOS: 406 / 136. Full-size scope per OS is **six Bot,
eight Chat, eight locale views**. Deleted before/after captures are identical within each
theme, so 44 views represent **40 unique images**. Other images received contact review.

All 271 images have decoded RGBA-exact canonicals: **122 existing images reused by relative
path, 149 new lossless WebPs**. Per OS, reuse/new is Linux **99/36**, macOS **23/113**.
The image index preserves original hashes, artifact aliases/copies, dimensions, RGBA hashes,
canonical paths and retention hashes. [Image index](images.json), [full-size targets](fullsize-targets.json),
[review receipt](visual-review.json), [browseable contact index](image-index.md).

No new ownership contradiction, blank app frame or target glyph failure found. Known
qualifications remain: email-step decorative-logo clipping, stacked Code toasts,
preview/transcript toast overlap and scrollport fades/tails. This is bounded artifact
acceptance, not full-resolution approval of every screen or translation accuracy.

## Native failure and evidence limits

macOS unsigned arm64 package step and process/window/renderer smoke pass, including
`SMOKE OK`. The same log records **`could not create image from display`** and
**`screencapture failed: Command failed: screencapture -x out/smoke-screen.png`**.
No native display PNG exists; cause remains unknown. Renderer capture does not establish
native chrome/menu/installed interaction. [Smoke/crash receipt](smoke-and-crash.json).

Only uploaded `.ips` is historical **simulated Setup Assistant**, **2026-03-16**,
`EXC_GUARD` / `WEBKIT`, hash
`384ea4db6324dc5b8ab6a0fd5a4594b620e76ec694e0f0bb75495595824f90dd`.
No Cortex crash diagnostic appears; tolerant crash-file collection is not a crash-free
guarantee. Deliberately injected native-transition callback errors remain expected test
evidence, separate from runner errors. Node deprecation/SQLite warnings remain in logs.

Coordinator-owned package **11269856853**, 144,676,546 bytes, API/upload digest
`257fb7b54e362efae0a7c053183955fd6362228338c0a203874778d4b3d5e1df`, was not downloaded.
macOS runs no private-core unit suite; auth/renderer smoke is not remote Chat HTTP or real
Cloud inference acceptance. Previous cancelled/failed revision receipts remain unchanged.

Original reports, complete job logs, HTTP receipts, font inventory and diagnostic retain
lossless gzip copies; normalized text is whitespace-clean. [Retention hashes](retention.json),
[checksums](SHA256SUMS), [audit summary](audit.json). Raw ZIPs/extracted originals and runnable
offline verifier: `/tmp/opencode/ci-760c4a0/`.

No production/test/workflow edits, build/test/CI rerun, Mac operation, owner post or commit.
