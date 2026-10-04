# MCP follow-up — green CI at `de623fd`

**Scoped pass:** [run 37063183382](https://github.com/CortexLM/desktop/actions/runs/37063183382),
attempt 1, completed **2026-10-02T20:58:06Z**. Linux/macOS source E2E, checks and unsigned
macOS packaged renderer launch passed. Native packaged screen capture failed. This receipt
covers the pinned revision; later source changes require separate evidence.

## Provenance

- Head: `de623fdb18551b634f1c388fda7fe1481c9563a8`.
- All three jobs checked out PR 36 synthetic merge `44c9ead8c77ce2cf52fb3e8ba430ea7d36fbaf70`.
  Parents: base `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d`, that head.
- Merge/head tree both `e95f4f337a94d10335d1fb69cb55f66d2f56be83`; GitHub commit API,
  checkout logs and both Playwright reports agree. Local `main` remains the base above.
- Compared with `ca0828276ea6897cef00a4a376b0176ef87b5e2d`, packages/app/tests/scripts,
  vendor SDK, dependency lock/root package and workflow are identical. Shared object pins
  are in [receipt.json](receipt.json). Executable configuration changes only the default
  macOS Playwright workers from four to one; override, assertions, timeouts and capture
  requirements remain identical. Other changes are documentation/evidence.

## Verified results

| Job | Actual runner label | Result |
| --- | --- | --- |
| [111024490963](https://github.com/CortexLM/desktop/actions/runs/37063183382/job/111024490963) | `ubuntu-latest` | Lint/typecheck/i18n passed; 173 unit tests passed, one optional real-backend test skipped; 15 files passed |
| [111024490649](https://github.com/CortexLM/desktop/actions/runs/37063183382/job/111024490649) | `blacksmith-4vcpu-ubuntu-2404` | 51/51 E2E, four workers, 426 theme/state renders |
| [111024490837](https://github.com/CortexLM/desktop/actions/runs/37063183382/job/111024490837) | `blacksmith-6vcpu-macos-26` | 51/51 E2E, one worker, 426 renders; unsigned arm64 package and smoke passed |

Both E2E reports contain exactly one passed attempt per test: **zero retries, flaky,
skipped, unexpected, report/result errors or stderr entries**. [e2e-results.tsv](e2e-results.tsv)
retains all 51 test names, durations and attachment counts per OS. MCP save/reload/removal
passed on both; unit logs include 11 MCP and 23 credential tests. The sole unit skip is
`packages/desktop/test/remote.test.ts:177`, `lists models from a real backend`, guarded by
`!process.env.CORTEX_TEST_BACKEND_URL`. i18n: 63 files, 2,265 used keys, 3,395 English keys,
zero problems. [checks.log](checks.log) retains selected original log lines.

## Screenshot inspection

All **92 distinct E2E PNGs** (46 per OS; each uploaded three byte-identical times) were
reviewed on eight contact sheets. Then **19 E2E originals plus the smoke renderer** were
inspected full-size. [screenshots.tsv](screenshots.tsv) records every distinct hash, size
and review depth; duplicate files were verified by SHA-256. Contact sheets remain temporary.

- Frozen dark-theme Work and subsequent focus-mode captures are present and nonblank;
  board columns, selected Work tab and composer are readable. The formerly failing test
  passed in 8,812 ms Linux / 7,902 ms macOS.
- The formerly failing native-menu/chat-identity navigation test passed in 12,858 / 9,244 ms.
  It attaches no PNG; French preview Chat/Code history captures are separate tests.
- Chat home/transcript/history-image refusals retain visible drafts/attachments and model/send
  controls in light/dark at 960×640. Toasts cover some transcript content, above the composer.
  Work refusal and Bot save-dialog controls remain visible. Code's split-pane draft input is
  narrow at 960px; preservation/access assertions passed, full draft text is not visible at once.
- Provider key masking and composer-driven thinking/image exchange passed on both OSes.
  Those tests attach no Settings/happy-path PNG; the inspected refusal/retry captures show
  the fake-provider transcript. No independent Settings visual acceptance follows.
- No new blocking renderer defect identified in these captures. Native title/minimum bounds,
  English/French menus and macOS traffic-light position passed source-build API assertions;
  renderer PNGs do not prove OS chrome pixels.

## Package and limits

`Cortex-0.2.0-arm64-mac.zip` SHA-256:
`2a55a0a4b363d0ccfe7524e71c23dcd06e960785bb20015fc8697dfbaf954058`.
All three downloaded artifact ZIP hashes match GitHub digests; all 285 extracted members
match the ZIPs. Artifact IDs/expiry, outer hashes, report hashes, executable and `app.asar`
hashes are retained in [receipt.json](receipt.json).

Smoke found `Cortex cortex://app/index.html`, stayed alive for ten seconds and captured a
readable 1440×900 empty local Chat home with `No model`. Native `screencapture` returned
`could not create image from display`; `out/smoke-screen.png` is absent. The script catches
that failure, then reports `SMOKE OK`: packaged renderer proof, **not native-screen proof**.
Packaging logs also record the default Electron icon; signing/notarization/publishing are off.
The sole uploaded `.ips` is a simulated **Setup Assistant** incident dated **2026-03-16**,
bundle `com.apple.SetupAssistant`, `EXC_GUARD` / `WEBKIT`; no Cortex/Electron reference.
No uploaded Cortex crash report was found; absence does not establish no crash/hang.

[Earlier `1e91a43`](../ci-1e91a43/README.md) remains failed (macOS 49/50, screenshot timeout).
[`ca08282`](../ci-ca08282/summary.json) remains failed (50/51, navigation stability timeout).
Their causes remain unproven; this green one-worker run establishes no causal diagnosis.
The 426-render sweep is preview smoke, not full visual/product acceptance. CI inference uses
a local fake. Windows, Linux packaging, installed-Mac native verification, missing approved
surfaces and remote authentication/inference are outside this receipt.

Review used existing CI artifacts/logs/API metadata and pinned source only. No tests/builds
or CI reruns were launched. Verify retained evidence from this directory with
`sha256sum -c SHA256SUMS`.
