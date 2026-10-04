# Independent CI receipt — 37074187552

**Overall FAILURE preserved.** [Run](https://github.com/CortexLM/desktop/actions/runs/37074187552), attempt 1, PR #36, completed 2026-10-02 22:54:14 UTC.
- Head `d635fcf34f83db7849a1ee59ab3d790b20f74c9f`; all three checkout logs and both E2E reports pin merge `af35613b11500baa0baf4060a9d1ab60d36463ed`.
- GitHub commit APIs verify identical head/merge tree `1e7597107e0ccf0e4eaeb978b5e88153d48e5756`; merge base parent `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d`.
- Recomputed committed renderer fingerprint: **473 files**, `822f33bc4fa69476a08baf00509f5ae2b1208a441bcab4eefbaac3d26471c4ed`; matches final comparison provenance.

## Exact outcomes
| Job | Result | Evidence |
|---|---|---|
| Checks `111060257567` | FAILURE | Lint/types pass; unit tests **170 pass / 8 fail / 1 skip**, 15 files pass / 1 fail; standalone i18n step skipped |
| Linux `111060257797` | SUCCESS | **61/61**, 61 attempts, zero retries/flaky/skips/errors; 4 workers; 426 registered theme/state renders |
| macOS `111060257853` | SUCCESS | **61/61**, 61 attempts, zero retries/flaky/skips/errors; 1 worker; 426 renders; unsigned arm64 package + smoke pass |
- All eight failures: `tests/unit/runtime-copy.test.ts`, “renders Code tool titles and excludes raw tool errors”, locales `en fr es de ja zh-Hans pt-BR ko`.
- Exact error: `ReferenceError: localStorage is not defined`, `packages/app/src/screens/chat/model-composer.tsx:28:124`, via SSR `LiveComposer`/`useModels`; exit 1. Committed fixture lacks browser storage, session-model shape and full composer i18n mock.
- Unit skip: optional real-backend test guarded by `CORTEX_TEST_BACKEND_URL`. Its skip does not affect the 61/61 E2E counts. `tests/unit/audit-i18n.test.ts` passes; standalone audit step remains skipped.
- Each E2E report includes five Code-model cases, four routine cases, two native chrome/menu cases and one reduced-motion case. The 426 renders check content/copy/errors, not pixel fidelity.
- Concurrent fixture correction belongs to a later receipt. Current application-source diff against this head is empty; this failed run cannot establish the correction passes.

## Inspected image content and native limit
- Opened all **ten 960×640 macOS Code/routine PNGs**, plus **1440×900 packaged smoke renderer**. Every scoped PNG matches its E2E attachment and HTML-report copy byte-for-byte.
- Code: readable both-theme refusal; retained draft, visible model/send; attachment remove remains below toast, unobscured. Narrow input horizontally scrolls; long filename ellipsizes; full values are asserted by tests.
- Routines: Running/Failed badges match history; both interrupted rows fully painted; refusal toast says “Couldn’t start the routine.” with visible controls. Previous blank dark row absent here. **No scoped visual blocker found.**
- Smoke: populated local empty-state shell, “No model”, no blank renderer. Log records `window: Cortex cortex://app/index.html`, process survival and `SMOKE OK`.
- **Native pixel evidence missing:** `screencapture -x out/smoke-screen.png` failed “could not create image from display”; file absent. Chrome tests assert title/minimum bounds/traffic position `{x:20,y:15}`/English+French menus; attach no screenshots. Installed-Mac checks remain coordinator-owned.
- Actual sole `.ips` read: simulated **Setup Assistant**, `com.apple.SetupAssistant`, **2026-03-16 08:32:43 -0700**, system executable. Historical system incident, not Cortex. SHA-256 `384ea4db6324dc5b8ab6a0fd5a4594b620e76ec694e0f0bb75495595824f90dd`.

## Image SHA-256 (full member paths in receipt)
| PNG | SHA-256 |
|---|---|
| code-models-light.png | `302e1ebfc8fea912a48f59bb8aeb9f6e6c22179aeb198932af9b8ea363066e4a` |
| code-models-dark.png | `2699897fd05f2f11fe5bc68d69be29eecd0ce5861331b80d7fb8852ee7241633` |
| code-attachment-refusal-light.png | `646accedfc7590a8871830e0e8b927e624e524f1904c81fc4a9034e62a3ea5bf` |
| code-attachment-refusal-dark.png | `3e3244a761c07d9ddb65216d58789e487823c703e2c9239b409e8de8789d4699` |
| routine-running-light.png | `d78c459110245174ae4ab6805f9362a42be077fa9db07391de87488ced463ee6` |
| routine-running-dark.png | `93ee5953ae7974da4f181155d2ce6549f28f6a0112856f46726b3f6458a09fa0` |
| routine-interrupted-light.png | `d885742f36db86020bc88bbcebf516291fc015cc0126b11755a298abb6df3262` |
| routine-interrupted-dark.png | `855e44c997c1b7e01b047db6d042c1faba8cce83633fcd6dc0194ba6239eedaf` |
| routine-start-refused-light.png | `c291c4357a2faa2594f4cdb64c0062323d52f0a5359b6c36fb26f55706209886` |
| routine-start-refused-dark.png | `ca103cae8ec873b03af51101e38a36962e42bb9114f9f7dc2b5af664e0b06926` |
| smoke-renderer.png | `bb69536bf3b15ff6bd53db88c9c3197711ef1a5cae4ac36e2036e35deb0651da` |

## Package and retained receipt
- Reused coordinator ZIP: 144,905,396 bytes, **697 ZIP entries**, SHA-256 `85192b7fef863e3d3c638d72e44d528ad392e1000bf1a91c46dfb53104b4958d`.
- `app.asar`: 28,188,756 bytes, **91 files**, SHA-256 `aa11177040f5fd1e2367fad84575b23e85416bfdd64572e16e1686b0f166ee08`; all **90 renderer/desktop members** match existing local build, including maps (**88 excluding maps**).
- GitHub outer artifact digests (API + upload logs): macOS `5d46c97651fe32eb097adb9bab47926f71d0940aaa2226adf31fd4f3e35a45ec`; Linux `37960e59845dbd5397b21212ab8e6701afbafe0087eb4f86ac900236554540f5`; package wrapper `0a7d21e3efd84a59ab18e33220fcdc63f0e93ceb9e2e2405dc77b29d3727bcc3`. These differ from inner package/member hashes by design.
- `/tmp/opencode/live-behavior-ci-review/receipt.json`: source pins, image/member hashes, artifact IDs, outcomes. Separate SHA-pinned inventories cover 192 macOS files, 188 Linux files, every ZIP/ASAR member.
- Runnable receipt check passed: `python3 /tmp/opencode/live-behavior-ci-review/verify-receipt.py`. Review only; no test/build reruns, Mac control, design-owner or SDK work. CI failure and native-pixel gap remain open.
