# CI 37097480122 — SDK 0.3.5 and narrow Code approvals

**All three jobs passed on attempt 1. Linux and macOS each passed 96/96 Electron
cases without retries.** The SDK dependency is pinned to **0.3.5**, with API-types
**0.2.0**. Authentication evidence uses controlled loopback HTTP through the real
SDK/engine; **it is not credentialed Cortex Cloud or remote-inference proof**.

Run: <https://github.com/CortexLM/desktop/actions/runs/37097480122> · 2026-10-03.
This review used downloaded artifacts and pinned Git objects. No new application,
test, build, Mac session, upstream network test or CI rerun was started.

## Provenance and dependency version

| Item | Verified value |
| --- | --- |
| Run head | `78857365a509d78af10ebdda5b52348a2e50e961` |
| Actual checkout, all three jobs and both reports | `83ca246c73ca185adae5fb657b54893193be637c` (`pull/36/merge`) |
| Head and checkout tree | `67dd35f563da6a8efcd72d658734199c0c9ce481` — identical |
| Previous head | `ffc118a2e58df66f430f3078e00f6e931dd910cf` |
| Renderer fingerprint | `6a17e5001e296fcf502782e0641d00b9d169f112c210663b6b79da02e2afebdc` — 473 pinned files |
| SDK archive | `vendor/cortex-sdk-0.3.5.tgz`, 164,809 bytes, 59 file members |
| SDK SHA-256 | `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8` |
| API-types archive | `vendor/cortex-api-types-0.2.0.tgz`, 70,243 bytes, 81 file members |
| API-types SHA-256 | `3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877` |

Both archive package manifests identify those versions; SDK declares API-types
0.2.0 as its optional peer. Independently computed SHA-512 integrity matches
`bun.lock`; desktop's manifest selects the same local tarballs. All three jobs
successfully ran `bun install --frozen-lockfile`. Source-build Electron tests ran
after the build; the pinned esbuild configuration bundles imports into main with
only Electron external. `RemoteSession` imports `@cortex/sdk` directly.

This establishes the **checkout/frozen-install/build chain for SDK 0.3.5**.
Test artifacts contain no `node_modules` inventory, runtime SDK-version print or
packaged ASAR; this audit does not independently attest installed package members.
The upstream schema blob `c8f6a7f0` is a reference in the pinned vendor README,
not a schema or upstream-service re-verification here.

See [source-binding.json](source-binding.json), [source-pins.json](source-pins.json)
(45 files), [sdk-binding.json](sdk-binding.json), [sdk-archives.json](sdk-archives.json).

| Download | Artifact ID | Bytes | Files | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Linux tests | `11264664293` | 25,630,879 | 343 | `b6810a8f0b48073803995fe3a00f9038b86c551fad3032468c6c2f78459ce527` |
| macOS tests | `11265500428` | 24,878,140 | 347 | `d33dff81e8444a990318d5dfd780bb5e56842aadeda60339c82d3498f501dbb7` |
| Run logs | — | 92,662 | 52 | `44563a3923da9329a6f431793e1045e425d9b83381a405ffbbf08bfd1d5eae44` |

Test ZIP digests match API metadata and upload logs. CRCs, unique member names,
safe extraction paths and every extracted member hash passed. The logs ZIP digest
is locally computed; its API supplies no digest.

## Exact results and source delta

| Check | Result |
| --- | --- |
| Lint / typecheck | Both successful, no lint/type diagnostics |
| Unit tests | **201 passed, 1 skipped; 202 total, 18/18 files passed** |
| i18n audit | **64 files, 2,272 used keys, 3,405 English keys, 0 problems** |
| Linux E2E | **96 passed, 96 attempts; 0 retries, skips, flaky or unexpected results**; 4 workers |
| macOS E2E | **96 passed, 96 attempts; 0 retries, skips, flaky or unexpected results**; 1 worker |
| Registered-state render case | **426 visits per OS**, both themes; content/raw-key/page-error checks pass |
| Package and smoke | Unsigned arm64 package and process/renderer smoke pass; **native display capture fails** |

Both reports contain 22 test files, zero runner errors and configured `retries: 0`.
All earlier 92 case identities remain; the only four additions per OS are Code
approval descriptions at **960×640 and 1024×686, light and dark**. The optional unit
skip remains `lists models from a real backend` (`CORTEX_TEST_BACKEND_URL`).
Remote-session unit tests pass 8/8; remote discovery has 44 passes plus that skip;
core connection passes 5/5.

Compared with `ffc118a`, application source changes are exactly one class addition
in `lot-code.tsx` and two CSS rules under `max-width: 1200px` in `lot-code.css`.
Desktop main/preload/auth/probe, auth UI, Work and preview-lifetime sources are
unchanged. The dependency manifest/lock and SDK archive changed separately.
The test delta is four generated cases in `responsive.spec.ts`; the source diff
is retained losslessly in [source-delta.patch.gz](source-delta.patch.gz).

Observed versions: Bun `1.4.2`; Node `22.23.3` for checks, `22.22.0` Linux E2E,
`22.22.3` macOS; Playwright `1.63.0`; Electron `44.5.1`. Actual runners are
`ubuntu-latest`, `blacksmith-4vcpu-ubuntu-2404`, `blacksmith-6vcpu-macos-26`.

## Refreshed scoped proof

- **Approval layout:** all eight new captures are distinct. Both descriptions sit
  below their titles, fit their text boxes and avoid the adjacent controls in
  **16 row records / 48 true geometry assertions**. Keyboard Tab reaches the
  `Deep code` selector then `Notify approvals`; each is fully in the viewport and
  passes trial-click actionability. At 960px the model description wraps to two
  lines; at 1024px it fits one. These are preview settings, English, sidebar shown,
  reduced motion. Trial clicks establish reachability, not a saved setting or a
  notification delivery. Wide-reference fidelity is not re-proven by this CI.
- **SDK-backed auth:** all six auth cases pass on each OS using the real SDK with
  loopback HTTP. Refusal, resend, duplicate submission, renderer reload, device
  sign-out, process-restart expiry, unavailable continuations, mode/origin changes
  and delayed reads retain their assertions. Fixture secrets stay absent from the
  inspected public state, DOM/storage/cookies and top-level persisted files;
  renderer HTTP remains empty. Main's bounded private transport is unchanged.
  Device sign-out does not establish server revocation; no real account is used.
- **Code / Work / preview:** the refreshed terminal case passes raw output,
  metadata, localization, reload and model replay. All twelve OS/theme/size tail
  records are bounded, scrollable and hit-testable. All 24 diff-header records pass;
  real wheel scrolling reaches actual file-write tails. Work font readiness and
  wheel-preservation pass both themes; preview departure records `errors: []` at
  live `#/code`. Those last two cases retain measurements, not success screenshots.
  The terminal tail check uses `scrollTop`, not wheel input.

Work settles at `top=392, height=1051, viewport=659, gap=0` in both themes/OSes;
wheel-preserved final gaps are 163px Linux and 162px macOS. At 960px, terminal
`clientHeight=456`, `scrollHeight=58964`, `scrollTop=58508`; the localized tail is
at `y=575..591`, inside 640px. The deliberate native-transition callback-error test
retains two route and one theme error per OS as expected injected failures.
Original reports and [scoped-assertions.json](scoped-assertions.json) retain the details.

## Images and drift

Inspected **all 231 unique PNGs through 20 contact sheets**, then **37 originals
at full resolution**: 18 Linux, 19 macOS. Retained targets comprise **8 approvals,
12 auth** (signed-in/refused/unavailable, both themes/OSes), **4 diffs, 4 terminals,
4 Work tasks, 4 preview Bot states and 1 packaged renderer smoke**. All 37 WebPs
preserve dimensions and decoded RGBA exactly.

| Image inventory | Linux | macOS | Total |
| --- | ---: | ---: | ---: |
| PNG files, including report copies | 341 | 342 | 683 |
| Unique PNG hashes | 115 | 116 | 231 |
| Full-resolution originals inspected | 18 | 19 | 37 |

Both unavailable-continuation pairs are byte-identical within each OS this run;
the four new approval images per OS occur once as report data and also appear
base64-encoded in the JSON report. macOS adds the smoke image. The seven-image
increase over the earlier 224 is eight new approval images minus one former
macOS unavailable-state distinction. No image is byte-identical across OSes.

The 29 retained comparable targets were also checked against prior CI decoded
pixels: **23 exact matches, 6 differences**. All sampled Code diff, terminal,
Work task, preview Bot and smoke frames match exactly. All six Linux auth frames
match exactly. Five macOS auth frames differ by only **29 or 37 pixels** in sidebar
glyphs. macOS dark unavailable differs by **15,340 pixels**, confined to the
`Use another address` button bounds `(466,392)..(826,436)`; its fill/outline differs,
text and layout remain readable. Capture-state cause was not isolated. These are
ambient CI diagnostics, not frozen-reference scores or exhaustive visual parity.
See [image-drift.json](image-drift.json).

The changed approval labels and controls are clear at both widths. Auth refusal
digits and recovery copy are legible. Preview Bot toasts still cover part of the
transcript above the composer. Contact sheets retain narrow draft prefixes,
stacked refusal toasts and the partially clipped login logo. The 426 render visits
do not supply 426 screenshots or full-product visual acceptance.

## Native-capture negative and retention

Packaged smoke records `Cortex cortex://app/index.html`, the empty Chat shell,
`No model` and `SMOKE OK`. It also records **`could not create image from display`**
and **`screencapture failed: Command failed: screencapture -x out/smoke-screen.png`**.
The script catches that error; no native screenshot exists. The 1440×900 CDP
renderer capture does not prove native chrome, menus or installed interactions.

The only `.ips` is the same historical **simulated Setup Assistant** diagnostic
dated 2026-03-16, SHA-256
`384ea4db6324dc5b8ab6a0fd5a4594b620e76ec694e0f0bb75495595824f90dd`.
Its system process and `EXC_GUARD` / `WEBKIT` termination are not a Cortex crash.
No Cortex diagnostic appears; the tolerant crash-copy step is not a crash-free guarantee.

Application-package artifact **11265650279** is coordinator-owned, not downloaded
here. API/upload metadata records 144,641,037 bytes and SHA-256
`bf69e3dd27b82526184f2358529df6f80589900499f03ff627fd80e07bcbd04e`.
Package-member, installed-Mac, SDK media/upload and real-Cloud acceptance remain
separate. Earlier `ffc118a` / `b0e6d78` results retain their original scope.

Original JSON reports, inventories and API receipts are retained. Complete job
logs and `smoke.log` have normalized readable copies plus lossless original gzip
copies; [log-retention.json](log-retention.json) records both hashes. Crash bytes
are also losslessly gzipped. [images.json](images.json),
[target-images.json](target-images.json), [visual-review.json](visual-review.json),
[audit.json](audit.json) and [SHA256SUMS](SHA256SUMS) record coverage and integrity.
Downloads, pinned copies and runnable audit scripts live under
`/tmp/opencode/ci-7885736-review/`.
