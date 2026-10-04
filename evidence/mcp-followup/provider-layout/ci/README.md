# Provider key layout — CI `9d704ee`

**PASS, scoped to the provider-row correction.** [Run 37066222793](https://github.com/CortexLM/desktop/actions/runs/37066222793), attempt 1, completed 2026-10-02T21:28:34Z.

## Pins and checks

- Head: `9d704ee2ec38de71668f0c323dfbe780a8138600`.
- All three jobs checked out PR 36 merge `8eb9387d9c120ff2f0b46325e2615b93fab92dd2`; head/merge tree both `a58c51b9dcec5626fb0add1585d2c2ed6d8ddd73`.
- Compared with `de623fd`, executable changes are limited to `settings.tsx`, provider-specific rules in `system.css`, and `ui-flows.spec.ts`. Engine, desktop, workflow, dependencies and other tests are identical.

| Job | Verified result |
| --- | --- |
| [Checks 111034543848](https://github.com/CortexLM/desktop/actions/runs/37066222793/job/111034543848) | Lint/types pass; 173 unit passes, one optional real-backend skip; i18n zero problems |
| [Linux 111034543702](https://github.com/CortexLM/desktop/actions/runs/37066222793/job/111034543702) | 52/52 E2E, four workers, 426 registered theme/state renders |
| [macOS 111034543841](https://github.com/CortexLM/desktop/actions/runs/37066222793/job/111034543841) | 52/52 E2E, one worker, 426 renders; unsigned arm64 package and renderer smoke pass |

Both JSON reports contain exactly one passed result per test: **zero retries, flaky, skipped, unexpected, report/result errors or stderr entries**. The unit skip is `remote.test.ts:177`, guarded by `!process.env.CORTEX_TEST_BACKEND_URL`.

The two provider tests each exercise 960/1024/1440, save/reload/removal and deterministic catalog data. Range/hit testing rejects clipped or covered text; geometry checks containment, overlap, overflow and the wide inline layout. Six PNG attachments per OS are present.

## Full-size image review

All **12 provider-key originals** were inspected individually at full size: light/dark × 960×640, 1024×640, 1440×900 × Linux/macOS. Label and `Saved · WXYZ` are readable, input/Save are separate and contained; 960/1024 wrap, 1440 stays inline. Only the placeholder remains in the cleared input. No blocking defect found in the corrected row.

Also inspected the macOS packaged 1440×900 empty-Chat renderer and four source-build 960×640 Chat draft/refusal images (both themes per OS). Shell, attachment, draft and composer controls render; refusal toast stays below the composer. Linux CI has no packaged smoke artifact: its source images are identified as source evidence.

[images.tsv](images.tsv) records exact artifact member paths, retained paths, dimensions, SHA-256 and review depth for all **17 images**. [receipt.json](receipt.json) records source, job, artifact, original report and package hashes. [checks.log](checks.log) retains selected log lines.

## Package and limits

All three downloaded artifact archive digests match GitHub metadata; **321 extracted members** match those archives. Inner `Cortex-0.2.0-arm64-mac.zip` SHA-256: `1ca63896aab2827aadad0539037d3100884368d29d922aaecae50aed4062d9fd`.

Smoke found `Cortex cortex://app/index.html`, survived ten seconds and captured the readable renderer. Native `screencapture` failed with `could not create image from display`; `out/smoke-screen.png` is absent. The script catches this, then prints `SMOKE OK`: renderer launch proof only. Packaging also reports the existing default Electron icon. Signing, notarization and publishing were disabled.

The sole uploaded `.ips` is a simulated **Setup Assistant** incident dated **2026-03-16**, not Cortex. No uploaded Cortex crash report was found; this does not establish absence of hangs/crashes.

Earlier [screenshot-timeout](../../ci-1e91a43/README.md) and [navigation-stability](../../ci-ca08282/summary.json) failures remain failures with unknown causes. This green run does not diagnose them. The prior [de623fd image review](../../ci-de623fd/README.md) remains revision-scoped; this receipt reviews the changed provider row plus the named smoke/minimum images. The 426-state sweep is preview smoke, not full visual acceptance. Installed-Mac native correction evidence is recorded separately by its owner.

Existing artifacts/logs/API metadata only; no tests, builds or CI reruns launched. Verify retained bytes here with `sha256sum -c SHA256SUMS`.
