# Saved Bot memory — final CI artifact audit

**Scoped pass:** [CI 37139741944](https://github.com/CortexLM/desktop/actions/runs/37139741944),
application **`96df66ce727c42ddf647b2dcb4eeeff04fda4927`**; three successful jobs.
Independent offline artifact/source review. Full goal remains incomplete; matching installed
package/native acceptance belongs to the coordinator.

## Derived results

| Evidence | Linux | macOS |
| --- | ---: | ---: |
| Electron cases / attempts / passes | 125 / 125 / 125 | 125 / 125 / 125 |
| Registered theme/state render visits | 426 | 426 |
| Retries / skips / flaky / unexpected / runner errors | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Workers / duration | 4 / 228.116047s | 1 / 700.389922s |
| PNG copies / unique PNG and RGBA images | 511 / 169 | 512 / 170 |

Complete report/stdout counts; 426 means visits, not images. **260 units + one optional
real-backend skip**, 24 files, eight new settings contract tests. Lint/types pass; i18n:
**66 files / 2,277 used keys / 3,412 English keys / zero problems**. Both reports and **128 embedded
JSON attachments** parse. [E2E](e2e-summary.json), [cases](cases.jsonl), [checks](checks-summary.json).

## Archive and source binding

| Artifact | Bytes / extracted files | Independently verified ZIP SHA-256 |
| --- | ---: | --- |
| Linux `11280245496` | 36,867,973 / 515 | `2a13488a144285d4353ec65d4f28e9415a15cdb5a76b8157755264fe90164de5` |
| macOS `11280625395` | 35,714,635 / 517 | `1b2e024b01f63c9a3c35bf577ce68fe808fb72aff149a119b20a7c0d5de12318` |

Metadata/upload digests, CRC, safe unique paths, exact extracted file sets/bytes verified.
All job logs/reports name checkout **`348745898568d1c54293e9c5a8074adbec1a822a`**.
Coordinator Git API readback proves checkout/head tree **`4883cea275b3d670292cb04515250e38cd2d26d1`**;
receipt copied exactly, checkout/logs and head/Git independently matched offline. Raw API response
not supplied: no independent commit-object/signature reconstruction claimed.

Verified complete **516 input / 474 renderer input / 90 build-member** sets against Git `96df66c`
and frozen `/tmp/opencode/build-memory-final`. Renderer fingerprint:
`64a314be9950c61466f8beec1b1ef50aa7f5b60a7f67d67bc3deff805a5800ef`.
Local receipt reports ASAR `b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44`;
no CI Mac ASAR equality asserted here. [Downloads](downloads.json), [binding](checkout-binding.json),
[input pins](provenance/input-pins.jsonl), [package boundary](package-scope.json).

## Behavior and retained negatives

Compared with `f82a648`: **31 existing E2E files unchanged**; seven new cases comprise six runtime
settings cases plus one eight-locale case. CSS/dependencies/workflow/workers/smoke unchanged.
Per-theme fake-provider payloads prove own-note injection, paused omission with persona retained,
resumed own-note injection and ordinary-Chat isolation. Real restart, exact note/history retention,
manual add while paused, Retry, pending-write exclusion, stale reads and legacy import are asserted.
Two initial sends use UI; resumed/ordinary-Chat probes use IPC. This establishes no real Cloud inference.

Original baseline reproduces ignored Privacy-off and Memory-off resetting on reload; its initial
selector failure stays separate. Later five-case pre-API baseline fails all five: two explicit 404s,
one default-switch assertion, two missing gate waits; not five independently reproduced implemented bugs.
Initial **14 targeted / 124 full** passes remain historical at renderer `30ec7f97…`.
The further canceled-preview regression has **one failure / two assertions**: accepted GET leaves
no switch; accepted PUT false leaves checked/disabled true. Final **278-line** test remains exactly
`a3749931aa28b459844b9c4ab24bb52d8762a079210a379de524416624acffe8`, including its original 218-line prefix.
Only the runtime-settings hook changes between initial/final 516-input receipts. Separate local
**21 targeted / 125 full** passes precede these fresh CI passes; both OS attachments now show correct,
enabled, visible GET/PUT controls. [History](historical-results.jsonl), [binding](negative-to-positive.json),
[context checks](memory-context-checks.json). Intentional navigation callback errors are test fixtures,
not crashes or runner failures: [exact observations](intentional-callback-errors.jsonl).

## Visual and locale review

Inspected **339 unique images / 30 contacts**, **24 primary Memory/Privacy originals full-size**
(eight dark locale frames + four English two-theme frames per OS). Saved note text remains legible,
normal-opacity while paused; off descriptions/banner explain retained notes and future-turn scope.
Eight safety-copy frames, three current/prior drift pairs and the historical navigation image also
opened full-size. CJK glyphs visibly render; German terminology varies, Chinese/Korean line breaks
differ across OSes. No native-speaker/contrast certification. [Image index](image-index.md), [review](visual-review.json).

**76 new lossless WebPs; 254 exact prior canonicals; nine exact local-target canonicals** (Linux only).
Reuse requires original PNG/hash and full decoded RGBA equality; ultimate canonical paths retained.
**326 same-OS aliases: 264 exact / 62 changed**. All 14 old safety frames/OS compared: four/OS reflect
new copy/plain age/layout; Linux adds a 28-pixel unexplained difference. Seven new live keys/locale;
all existing catalog values unchanged. Other drift gets no assumed cause. Toast overlap/stacks,
decorative login-logo clipping, narrow Code input truncation and scrollport limits remain qualified.

Memory locale assertions cover **64 states / 112 text rows per OS** in both themes; photographs show
dark paused states only. All **16 auth-locale PNG/RGBA frames exactly match `f82a648`**, inheriting its
hash-bound full-size review. Auth per OS: **48 states / 80 measurements / 384 text rows / 144 reachable
Tab stops / 12 passing glyph probes**. Linux font inventory: **87 patterns / 61 files**, exact prior bytes.
[Memory locales](memory-locale-summary.json), [auth inheritance](auth-locale-review-inheritance.json).

## Smoke and integrity

Unsigned arm64 Mac process/window/renderer smoke passes. Native display capture **fails**, cause unknown:
`could not create image from display`; `screencapture failed: Command failed: screencapture -x out/smoke-screen.png`.
Only diagnostic: historical simulated Setup Assistant **EXC_GUARD / WEBKIT**, same bytes as `f82a648`;
no Cortex diagnostic is not a crash-free claim. Full reports/log retained gzip; scoped logs retain
line numbers/errors. Offline audit performed no app tests/builds/captures/network/source edits.
Integrity: `python3 evidence/memory-preference-followup/ci-96df66c/verify.py`.
[Audit](audit.json), [retention](retention.json), [diagnostics](smoke-and-crash.json), [SHA256SUMS](SHA256SUMS).
