# Provider-draft correction — CI artifact audit

**Scoped pass:** [CI 37118586276](https://github.com/CortexLM/desktop/actions/runs/37118586276),
all three jobs successful, application **`37c22c2fcff92fb76b10ffc97ec0643ac325d62f`**.
Both OSes pass **111 cases / 111 attempts / 426 registered render visits**, zero retries,
skips, flaky/unexpected results or runner errors. Four unchanged new provider cases resolve
all eight original failed assertions per OS; all prior 107 cases remain registered and green.

## Revision and artifact binding

All three complete job logs and both reports identify checkout
`411c56d1f8c340af88513eb1a34a7296293c6bef`; its tree and application's tree equal
`e64dcbf7df5cccd03e09b57c8aeb2ec919851d48`.
Verified **514 frozen inputs / 473 renderer inputs / 90 build members**, including exact
build file-set equality, against `/tmp/opencode/build-provider-draft-final`.
Renderer fingerprint: `5538c5298dbad432d82cf18781b9f7e62b5a861311ad61c6fc518c0cdb6e1ae7`.
Main SHA-256: `f0fc4522cde726dd8b88dcbb56f4116ba93dc87e1e9e29163502d25e522512c7`.
Only package-input change from `2956564`: `packages/app/src/screens/system/settings.tsx`.
This is source/frozen-receipt binding, not build reproduction or CI ASAR equality.

| Test artifact | Bytes | ZIP SHA-256 |
| --- | ---: | --- |
| Linux `11272631081` | 31,852,809 | `e798876b6831c79c3be73f37bf06a4f8f1ee169092e2724a988df8592008a3ef` |
| macOS `11272621686` | 30,850,660 | `db102fe295afbc38dad02e97a8285d0339feea86085576236defe5d82b102eff` |

Each downloaded once; supplied/API/upload digests agree **before extraction**. ZIP CRC,
unique safe member paths verified: **445 Linux / 448 macOS files**. Complete log ZIP:
97,908 bytes, `b278777e86aa1f01d91455901c9ada68f754d3507df604b9e9b7eb410b8a0541`,
52 files; no API log-ZIP digest exists, so its recorded digest is locally computed.
Original ZIPs/extractions remain only under `/tmp/opencode/ci-37c22c2/`.
Package **11272761294** is coordinator-owned; not downloaded or inspected here.
[Downloads](downloads.json), [checkout binding](checkout-binding.json), [source pins](source-pins.json).

## Checks and corrected behavior

Lint/types pass; **245 unit passes + one optional real-backend skip**, 22 files.
i18n: **65 files / 2,272 used keys / 3,405 English keys / zero problems**.
Linux Electron: four workers, 209.070333s; macOS: one worker, 613.473778s.
macOS private-core HTTP unit behavior is not exercised by this workflow.

- Settings `221/224/237`: credential success clears only the unchanged captured raw draft;
  Enable passes `false` to opt out of clearing. No additional product change is claimed.
- **Toggle, both themes/OSes:** exactly **PUT A 200, PATCH false 200, PATCH true 200, PUT B 200**.
  Both preference writes preserve B and saved hint `1111`; neither conditional refill occurs.
  Explicit Save changes hint to `2222`, clears the accepted draft. Only sanitized config
  fields are observed; no key request bodies retained. No prompt/message route is observed.
  Zero main HTTP fetches after observation installation is not a startup network audit.
  The unchanged toggle test installs no page-error listener; error absence is not established.
- **Pending replies, both themes/OSes:** original main handler completes real credential writes;
  a PUT/DELETE response is held before IPC delivery. Independent GET sees accepted `2222` /
  keyless config while renderer hint is still old. Editable newer C/D survives release.
  Passing source assertions `81/98` compare delivered **status, headers and exact body string**
  against held response; attachments retain held wire and the equality flag, not a second wire copy.
  Exactly six writes: **PUT A 200, PUT B 200, DELETE 200, PUT D 200, oversized PUT 400, DELETE 200**.
  First four accepted operations reach D/`4444`; 4,097-character real `invalid_request` refusal
  retains its draft/config; ordinary Remove clears unchanged draft and leaves keyless config.
  Five total accepted writes, one validation refusal. C/D preservation makes both conditional
  recovery refills unnecessary; no separate refill counter exists in this test.
  Page/console errors and renderer HTTP requests are empty; password input stays masked.
- Toggle test SHA-256: **`bf57e5cdb18d53f31572ec04ec7727130574a1c33cbdf9cc3b6fcb4733365c3a`**.
  Pending test SHA-256: **`bcafa61de982af883954f648123c06370021b0dab8c8aca5003a2ec06d3d7477`**.
  Both exactly match their final negative-baseline source snapshots: four toggle failures
  at `99`, four pending failures at `84/101`. Original negatives and setup failures remain intact.
- Prior Chat/Bot race tests retain their original bytes and pass. Their decoded history/ownership
  traces remain checked. Terminal-state Chat/Code test hashes also remain unchanged and pass.

[Toggle traces](toggle-checks.json), [pending traces](pending-checks.json),
[negative-to-positive](negative-to-positive.json), [baseline receipts](negative-baselines.json),
[Chat traces](chat-checks.json), [Bot traces](bot-checks.json), [checks](checks-summary.json),
[case list](cases.json), [supplemental checks](supplemental-checks.json).

## Fonts and image review

Linux installs **`fonts-noto-cjk 1:20230817+repack1-3`**, proven by complete job log and
inventory: **87 patterns / 61 files**. Normalized package/fontconfig inventories exactly
match CI295. Actual Japanese/Chinese headings select Noto Sans CJK JP; Korean selects KR.
Per OS: **48 primary states / 80 measurements / 384 readable text rows / 144 reachable Tab stops**;
six font records, **12 passing glyph-weight checks**, zero glyph-failure PNGs.
All **16 locale PNGs** exactly match CI295 original PNG hashes and decoded RGBA: zero changed
pixels. All sixteen originals were inspected full-size; CJK glyphs are visible.

**884 PNG copies / 296 unique images:** Linux **147**, macOS **149** including renderer smoke.
All **26 contact sheets** inspected; all **28 required full-size originals** inspected:
two toggle, four pending-response and eight locale views per OS.
Retained **54 new lossless WebPs**, reused **242 RGBA-exact canonicals**; no tolerance or overwrite.
Every source path/attachment maps to its original hash and canonical in [images](images.json).
Same-OS comparison against CI295 records **291 comparable attachment aliases / 49 changed**
(Linux 28, macOS 21); individual causes remain unknown. Aliases are not unique-image counts.

Provider target field, masked draft and hint are visible in all twelve new full-size views.
Toggle screenshots partly crop the lower Enable row; pending success toasts overlap the lower
Models list. These are scoped capture qualifications, not full-row or whole-page acceptance.
Existing decorative email-step logo clipping, toast stacks, narrow Code placeholder truncation
and scrollport crops remain visible in contacts. Translation accuracy, Chinese regional glyph
preference and full-resolution non-target acceptance are outside this review.
[Image index](image-index.md), [visual review](visual-review.json),
[locale comparison](locale-image-drift.json), [font provisioning](font-provisioning.json),
[font inventory comparison](font-inventory-comparison.json), [font records](font-records.json),
[prior-image comparison](prior-image-comparisons.json).

## Native and historical limits

CI process/window/renderer smoke passes; **native display capture fails** with
`could not create image from display` and
`screencapture failed: Command failed: screencapture -x out/smoke-screen.png`.
Cause unknown; no `smoke-screen.png`. Renderer smoke cannot replace native proof.
Only retained `.ips`: simulated **Setup Assistant, 2026-03-16, EXC_GUARD / WEBKIT**;
no Cortex diagnostic in this artifact does not prove crash-free operation.
Earlier glyph failures, cancellations, native negatives and unknown drift causes keep their
original evidence/dispositions. Controlled fixtures establish no real Cloud account,
remote-inference, server-revocation or full-product acceptance.

Original report/job-log/HTTP gzip and normalized whitespace-clean text retained here;
full ZIPs, pinned source and offline helpers under `/tmp/opencode/ci-37c22c2/`.
Local-final audit and installed-Mac proof are separate coordinator-owned deliveries.
No application/test/workflow changes, builds, test/CI reruns, Mac operations, owner posts or commits.
[Audit](audit.json), [retention](retention.json), [native diagnostics](smoke-and-crash.json), [SHA256SUMS](SHA256SUMS).
