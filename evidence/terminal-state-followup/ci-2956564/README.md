# Terminal-state correction — CI artifact audit

**Scoped pass:** [CI 37113961621](https://github.com/CortexLM/desktop/actions/runs/37113961621),
all three jobs successful, application **`2956564fbe31f882014d74ff3a7f920e839fd634`**.
Both OSes pass **107 cases / 107 attempts / 426 registered render visits**, zero retries,
skips, flaky/unexpected results or runner errors. Four new unchanged cases resolve all
eight original failed assertions per OS; all prior 103 cases remain registered and green.

## Revision and artifact binding

All three complete job logs and both reports identify checkout
`bb2e68fddc3e3b24d9916996a9d1a3e22aa4fd0e`; its tree and application's tree equal
`6ab74e389cc439b5b651d21208aa0b2e68d8f095`.
Verified **514 frozen inputs / 473 renderer inputs / 90 build members**, including exact
build file-set equality, against `/tmp/opencode/build-terminal-state-final`.
Renderer fingerprint: `e288e023805e998f276b224f10f63a5b448082d7a31174020b943f70815c028e`.
Main SHA-256: `f0fc4522cde726dd8b88dcbb56f4116ba93dc87e1e9e29163502d25e522512c7`.
Only package-input changes from `760c4a0`: `screens/chat/live-chat.tsx` and
`screens/code/code.tsx`. This is source/receipt binding, not build reproduction or CI ASAR equality.

| Test artifact | Bytes | ZIP SHA-256 |
| --- | ---: | --- |
| Linux `11271321969` | 30,460,854 | `59659384474f81c63e6884b4cf0e6e79b986b98acb215dde06438dc96292d74e` |
| macOS `11271237777` | 29,477,194 | `f86bfc50a4e2cf65b981c78e5dbc2eec6431ff6039049b0ca4ab1f74d2dfafd9` |

Each downloaded once; supplied/API/upload digests agree **before extraction**. ZIP CRC,
unique safe member paths verified: **427 Linux / 430 macOS files**. Complete log ZIP:
96,997 bytes, `0229d2c4066a68a2278e90b2bd8ea95bbb711ed59c84ae8f9c528cf9989c1036`,
52 files; no API log-ZIP digest exists, so its recorded digest is locally computed.
Original ZIPs/extractions remain only under `/tmp/opencode/ci-2956564/`.
Package **11271217895** is coordinator-owned; not downloaded or inspected here.
[Downloads](downloads.json), [checkout binding](checkout-binding.json), [source pins](source-pins.json).

## Checks and corrected code paths

Lint/types pass; **245 unit passes + one optional real-backend skip**, 22 files.
i18n: **65 files / 2,272 used keys / 3,405 English keys / zero problems**.
Linux Electron: four workers, 208.310071s; macOS: one worker, 610.774051s.
macOS private-core HTTP unit behavior is not exercised by this workflow.

- **Deleted Chat, both themes:** real admitted exchange, DELETE 200, reloaded session/history
  GETs **404 / `not_found`**. Alert reads **“Page not found” / “This link goes nowhere, or the
  page has moved.”** Empty transcript; absent generic retained-message promise and Retry.
  New chat opens editable empty Home; session list stays empty. Direct literal catalog calls
  at `live-chat.tsx:45`, preserved `not_found` at `:297`; no new copy or layout.
- **Code, both themes:** actual controlled-provider **HTTP 400** persists `provider_error`.
  Initial/reloaded badges **Failed / `badge err`**; follow-up **Running / `badge run`**, then
  **Ready / `badge ok`**. Four messages retain the exact first failed pair; two provider requests;
  **13 successful-assistant SSE deltas**, statuses **busy, error, idle, busy, idle**. Banner clears,
  draft empties, complete answer renders. Latest-assistant error derives settled state at
  `code.tsx:227–228`; busy takes precedence at `:252`. This is not the earlier native 401 scenario.
- Exact negative-test hashes: Chat **`a9bdc8e86f3ede94f0b54dc6a5d8b45142a62b98ad9fd0af2515c96bddb3d994`**;
  Code **`ff1bc7e7e6d08f59d713f0c7fccfb79fa35c02b682a870b804988145ae107ff5`**.
  Original Chat failures at **55/56**, Code at **327/335**, both themes, remain retained.
- Four prior Chat snapshot races and two Bot ownership cases retain original test bytes and pass.
  Streams retain **26 deltas / 14 part updates / eight message updates / four status events**;
  deleted snapshots stay empty. Actual Bot follow-up POSTs target Beta; Alpha history remains
  two messages, Beta four. Page/console and renderer HTTP errors are empty in these cases.

[Terminal traces](terminal-checks.json), [negative-to-positive](negative-to-positive.json),
[baseline receipts](negative-baselines.json), [Chat traces](chat-checks.json),
[Bot traces](bot-checks.json), [checks](checks-summary.json), [case list](cases.json).

## Fonts and image review

Linux installs **`fonts-noto-cjk 1:20230817+repack1-3`**, proven by job log and uploaded
inventory: **87 patterns / 61 files**. Actual Japanese/Chinese headings select Noto Sans CJK JP;
Korean selects Noto Sans CJK KR. macOS uses Hiragino, PingFang SC and Apple SD Gothic Neo.
Per OS: **48 primary states / 80 measurements / 384 readable text rows / 144 reachable Tab stops**;
six CDP records, **12 passing glyph-weight checks**, zero failure PNGs. Glyph pairs contain ink,
differ from each other and U+10FFFF at weights 400/500. All **eight locale PNGs per OS** exactly
match CI `760c4a0` original PNG hashes and decoded RGBA: **16 comparisons, zero changed pixels**.
All sixteen locale originals were inspected full-size; CJK glyphs are visible.

**848 PNG copies / 284 unique images:** Linux **141**, macOS **143** including renderer smoke.
All **24 contact sheets** inspected; all **28 required full-size originals** inspected:
two missing-Chat, four Code failure/recovery, eight locale views per OS.
Retained **45 new lossless WebPs**, reused **239 RGBA-exact canonicals**; no tolerance or overwrite.
Every source path/attachment maps to its original hash and canonical in [images](images.json).
The extra macOS unique auth image is the distinct MFA/verification-unavailable light capture;
Linux aliases those views to one image. macOS differs by **15,375 pixels**, bounds
`[466,392,826,436]`; prior CI aliases both views to the verification image. Cause unknown;
no callback/timing attribution. [Exact comparison](auth-alias-difference.json).
Known qualifications: decorative email-step logo clipping, toast stacks/overlap, narrow Code
placeholder truncation and scrollport crops remain visible. Chinese regional glyph preference,
translation accuracy and full-resolution non-target acceptance are outside this review.
[Image index](image-index.md), [review](visual-review.json), [locale comparison](locale-image-drift.json),
[font provisioning](font-provisioning.json), [font records](font-records.json).

## Native and historical limits

CI process/window/renderer smoke passes; **native display capture fails** with
`could not create image from display` and
`screencapture failed: Command failed: screencapture -x out/smoke-screen.png`.
Cause unknown; no `smoke-screen.png`. Renderer smoke cannot replace native proof.
The only retained `.ips` is simulated **Setup Assistant, 2026-03-16, EXC_GUARD / WEBKIT**;
no Cortex diagnostic in this artifact does not prove crash-free operation.
Earlier glyph failures, cancelled runs, native-capture negatives and unknown drift causes keep
their original evidence/dispositions. Controlled fixtures establish no real Cloud account,
remote-inference, server-revocation or full-product acceptance.

Raw report/job-log/HTTP gzip and normalized whitespace-clean text retained here;
full ZIPs, pinned source and offline helpers under `/tmp/opencode/ci-2956564/`.
No application/test/workflow changes, builds, test/CI reruns, Mac operations, owner posts or commits.
[Audit](audit.json), [retention](retention.json), [native diagnostics](smoke-and-crash.json), [SHA256SUMS](SHA256SUMS).
