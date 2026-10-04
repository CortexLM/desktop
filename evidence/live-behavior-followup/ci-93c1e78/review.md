# Independent green CI receipt — 37076113707

**CI SUCCESS verified**, [run 37076113707](https://github.com/CortexLM/desktop/actions/runs/37076113707), attempt 1, completed 2026-10-02 23:18:11 UTC.
- Head `93c1e780d20d4fa477a4f3b3e874ad779f19578f`; all three checkout logs and both E2E reports pin merge `b4d966a2f4826b514338272d81197991b9c820d7`.
- GitHub head/merge trees equal `a4308bcd228dd43748d8f540fb4f522ec3a7b9bc`; base parent `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d`.
- Committed application/E2E/build inputs unchanged from `d635fcf34f83db7849a1ee59ab3d790b20f74c9f`. Only non-documentary change: `tests/unit/runtime-copy.test.ts` from `ea1c54bbf212c8edbda348311383792566a6af75`.
- Source computed through `git show 93c1e78`, never current working tree: **473 files**, SHA-256 `822f33bc4fa69476a08baf00509f5ae2b1208a441bcab4eefbaac3d26471c4ed`.

## Results
| Job | Result | Independently checked |
|---|---|---|
| Checks `111066531255` | SUCCESS | Lint/types; **178 pass + 1 optional backend skip**, 16 files; i18n **63 files / 2,266 used / 3,395 English / 0 problems** |
| Linux `111066531020` | SUCCESS | **61/61**, 61 attempts, zero retries/flaky/skips/errors; 4 workers; **426 renders** |
| macOS `111066531258` | SUCCESS | **61/61**, 61 attempts, zero retries/flaky/skips/errors; 1 worker; **426 renders**; unsigned arm64 package + smoke |
- Each E2E report includes five Code-model cases, four routine cases, two native chrome/menu cases and one reduced-motion case. Render count verifies content/copy/errors; no pixel-fidelity claim.
- Optional unit skip is the real-backend test gated by `CORTEX_TEST_BACKEND_URL`. Standalone i18n audit actually ran successfully in this run.
- Historical **37074187552 remains FAILURE**: eight Node 22 SSR `localStorage` fixture errors, 170 passes, one skip, standalone audit skipped.
- **37075722150 remains CANCELLED** at `ea1c54b`: checks/Linux success; macOS canceled during E2E. Log records “The operation was canceled.” after newer documentary push; concurrency remains `cancel-in-progress`.

## Current images and native limits
- Opened all **ten current macOS Code/routine captures at 960×640**, plus **1440×900 smoke renderer**. Each scoped PNG matches E2E attachment and HTML-report copy byte-for-byte.
- Six scoped images plus smoke are byte-identical to earlier reviewed images. Four running/interrupted routine images changed; new timestamps visible, both-theme rows fully painted.
- Code drafts/attachments retained; refusal toast clears remove/model/input/send controls. Long filename ellipsizes; narrow input scrolls horizontally. Routine Running/Failed/refusal states readable. **No scoped visual blocker.**
- Packaged smoke logs `window: Cortex cortex://app/index.html`, `SMOKE OK`; actual image shows complete local empty-state shell and “No model”.
- CI native display capture still fails: `screencapture -x out/smoke-screen.png`, “could not create image from display”; file absent. Native chrome/menu API assertions pass; no chrome snapshots attached.
- Coordinator's twelve installed-Mac images/cleanup remain separately pinned to `d635fcf`, whose ASAR is byte-identical below. This review adds no Mac interaction or broader native acceptance.
- Sole actual `.ips` read: simulated **Setup Assistant**, **2026-03-16 08:32:43 -0700**, system executable, hash `384ea4db6324dc5b8ab6a0fd5a4594b620e76ec694e0f0bb75495595824f90dd`. Historical system incident, no Cortex crash file.

## Current package bytes, bounded download
- Downloaded only **24 MiB** HTTP range from green artifact **11256703406** (`206`, bytes `0-25165823/144612017`); decoded nested ZIP prefix through complete `app.asar`, checked its ZIP CRC and size.
- Current ASAR **28,188,756 bytes**, SHA-256 `aa11177040f5fd1e2367fad84575b23e85416bfdd64572e16e1686b0f166ee08`, identical to installed/prior package.
- All **91 ASAR files** match prior SHA-256 inventory, including **90 build members** (**88 excluding maps**). No inference from source identity alone.
- Full current outer/inner ZIP not downloaded or rehashed. Native executable/resources outside ASAR not compared; previous complete package receipt remains separately scoped.
- Green outer-artifact API/upload-log digests: macOS `5321f67414332acc856b2b5a9fe2e4f6786b6cc175f2d961d1af871f7a516b7d`; Linux `2db3911ebed34a4cd376bedf579df4234f9e956182bcd1bb5427939cc984948e`; package `92d674d943d6a424c79d2d3fc6319f7cd400e9b9880a2d78386797fd0c98a9c8`.

## Deliverables
- `/tmp/opencode/live-behavior-ci-green-review/receipt.json`: machine receipt, full current image hashes/member paths, job/source pins, retained failed/canceled outcomes, exact limits.
- SHA-pinned inventories: `source-pins.json`, `package-asar-members.json`, `linux-members.json` (**188 files**), `macos-members.json` (**192 files**). Download details: `package-prefix-receipt.json`; checksum list: `SHA256SUMS`.
- Runnable artifact/source assertions passed: `python3 /tmp/opencode/live-behavior-ci-green-review/verify-receipt.py`. No tests/builds rerun; no Mac controls; unrelated working-tree changes excluded.
- **Whole product objective remains incomplete.** This receipt closes this batch's CI check, not remote integration, missing-surface delivery or full visual/native acceptance.
