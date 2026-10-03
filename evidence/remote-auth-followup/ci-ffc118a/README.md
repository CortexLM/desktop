# CI 37094538845 — `ffc118a` audit

**Verified: all three jobs passed, first attempt.** Linux and macOS each passed
92 Electron cases without retries. Authentication used controlled HTTP fixtures,
**not a credentialed Cortex Cloud account**. Packaged macOS smoke passed its
process/renderer checks; **native display capture failed**.

Run: <https://github.com/CortexLM/desktop/actions/runs/37094538845> · 2026-10-03.
This is an audit of downloaded artifacts and pinned Git objects. No application,
build, test, Mac session or CI rerun was started for this review.

## Revision and artifact binding

| Item | Verified value |
| --- | --- |
| Run head | `ffc118a2e58df66f430f3078e00f6e931dd910cf` |
| Actual checkout, all three jobs | `9615aa0ca582aad3ee2395a81fd51832bca9c7f3` (`pull/36/merge`) |
| Head and checkout tree | `71ab70b2c16d43d43728ca3bac54fd47ff862a10` — identical |
| Merge parents | `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d`, then the run head |
| Renderer source fingerprint | `da9e8ed2dc6722fb34f27a64f5071e1fe0e5c1b95cb9cae9b9852fedc371cf0d` — 473 pinned files |

All checkout logs record the merge commit; both Playwright reports identify the
same commit. GitHub commit objects and local head-tree lookup agree. The renderer
fingerprint uses the pinned comparator's sorted `path:SHA256` algorithm. These are
source checks, not an installed-ASAR equality claim. See [source-binding.json](source-binding.json),
[source-pins.json](source-pins.json) (37 relevant files), and the retained commit objects.

| Download | Artifact ID | Bytes | Files | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Linux test artifact | `11264045278` | 24,930,818 | 339 | `e3cb089016fb586d1eac3c868751a143908a2bb80d465a6536cafe5d079cea40` |
| macOS test artifact | `11262754604` | 24,234,945 | 344 | `9038d9dcb5d397d4e7f6dbe26428026e8e3fa00b506dd0033436eadd9f2bef7f` |
| Run logs archive | — | 92,624 | 52 | `e314a45f6afe16f48482d7c488fe9d0a06ac94b49c5f63f2141c7b71af1d5b5d` |

Both test ZIP digests match GitHub metadata and upload logs. Archive CRCs, unique
member names, safe extraction paths and every extracted member hash were checked.
The log archive has a locally computed digest; its API supplies no digest.

## Exact results

| Check | Result |
| --- | --- |
| Lint | `eslint packages scripts tests` — successful step, no lint diagnostics |
| Types | `tsc -p tsconfig.json` — successful step, no type diagnostics |
| Unit tests | **201 passed, 1 skipped, 202 total; 18/18 files passed** |
| i18n | **64 files, 2,272 keys used, 3,405 English keys, 0 problems** |
| Linux E2E | **92/92 passed**, 92 attempts, 0 retries/skips/flaky/unexpected results; 4 workers |
| macOS E2E | **92/92 passed**, 92 attempts, 0 retries/skips/flaky/unexpected results; 1 worker |
| Registered-state rendering | **426 per OS**; both themes, content/raw-key/page-error assertions passed |
| macOS package | Unsigned arm64 directory and ZIP produced; package step succeeded |
| macOS packaged smoke | Window, process liveness, shell text and renderer screenshot passed |
| macOS native screenshot | **Failed**; `out/smoke-screen.png` absent |

Both reports contain 22 test files, zero runner-level errors and configured
`retries: 0`. The 426 renders are visits within one E2E case per OS, not 426
screenshots or a frozen-reference comparison. Exact case counts live in
[e2e-summary.json](e2e-summary.json); original JSON reports are retained.

The single unit skip is `lists models from a real backend`, guarded by
`CORTEX_TEST_BACKEND_URL` in `packages/desktop/test/remote.test.ts`.
The log reports that file as 45 cases with one skip; the new remote-session file
passed 8 cases and core connection passed 5.

Observed toolchain: Bun `1.4.2`; Node `22.23.3` for checks, `22.22.0` for Linux E2E,
`22.22.3` for macOS. Playwright `1.63.0`; macOS packaging used Electron `44.5.1`.
Actual runners: `ubuntu-latest`, `blacksmith-4vcpu-ubuntu-2404`,
`blacksmith-6vcpu-macos-26`. Retained logs include their warnings.

## Changed behavior: bounded proof

| Area | What the passing cases establish | Limit |
| --- | --- | --- |
| Email-code auth, 6 cases per OS | Send/refusal/resend, duplicate-submit suppression, signed-in renderer reload, device sign-out, cancelled replies, unavailable MFA/email-verification continuations, restart expiry, mode/origin isolation and delayed initial reads | Controlled loopback HTTP through the real SDK/engine. No real Cloud credentials, remote inference or server-side logout/revocation acceptance |
| Auth privacy assertions | Public state has only status, signed-in state and optional email; fixture secrets absent from inspected response/headers, DOM, browser storage and cookies; no renderer HTTP requests; inspected top-level data files contain none of the fixture secrets | A scoped boundary regression check, not an exhaustive persistence/security audit |
| Work preview departure | Real browser `ViewTransition` callback held during same-document Work-preview to live-Code navigation; outgoing context/draft survives forced rerender, then unmounts; live UI has no preview controls/data; engine bots/sessions remain empty | Light-theme assertion case. No success screenshot; `preview-departure-errors` records `errors: []` and `cortex://app/index.html#/code` |
| French Code terminal | Exact raw output and metadata, lookalike text, localized suffix, reload equality and original model replay all pass; tail bounded, scrollable and hit-testable at 960×640, 1024×640 and 1440×900 in both themes | Tail positioning uses `scrollTop`; this case does not establish wheel input or installed-window chrome |
| Code diffs | Three actual file writes, unequal diff bodies, real mouse-wheel tail access and visible/hit-testable headers at 960×640 and 1440×900, both themes | Source-build Electron with controlled inference |
| Work initial scroll, 2 cases per OS | Cold-font completion, warm remount, pre-readiness wheel intent, variant change and departure cancellation pass | Preview fixtures at 1360×840, DPR 2; JSON measurements, no success screenshots |

Terminal measurements are identical across OS reports: at 960/1024 widths,
`clientHeight=456`, `scrollHeight=58964`, `scrollTop=58508`, pane bottom `621`,
tail `y=575..591` within the 640px viewport. At 1440 width, client height `716`,
scroll top `58248`, pane bottom `881`, tail `y=835..851` within 900px.
All twelve OS/theme/size records set `bounded`, `scrollable`, `markerVisible` true.
All 24 diff-header records set `withinCard` and `hitTest` true.

Work's cold/warm final position is `top=392, height=1051, viewport=659, gap=0`
in both themes on both OSes. Wheel preservation ends at `top=229, gap=163`
on Linux, `top=230, gap=162` on macOS. Native-transition error-injection coverage
deliberately records two `Native route callback failed` and one
`Native theme callback failed` page errors per OS; these expected errors are
retained, not counted as unexpected failures. See [scoped-assertions.json](scoped-assertions.json).

## Image inspection

Inspected **all 224 unique PNGs through 20 contact sheets**, then **58 original
PNGs at full resolution**: 28 Linux, 30 macOS. Targeted images cover auth, terminal,
diffs, refused Code drafts, shared preview Bot state, Work task source and smoke.

| Inventory | Linux | macOS | Total |
| --- | ---: | ---: | ---: |
| PNG files, including report/attachment copies | 337 | 339 | 676 |
| Unique PNG hashes | 111 | 113 | 224 |
| Named E2E originals | 113 | 113 | 226 |
| Full-resolution originals inspected/retained as lossless WebP | 28 | 30 | 58 |

There are no cross-OS byte-identical images. Both Linux unavailable-continuation
pairs share bytes; macOS shares only the light pair. macOS additionally contains
the packaged renderer screenshot. These duplicates explain the differing totals.
All 58 WebPs preserve the original dimensions and decoded RGBA exactly.

Visible terminal suffixes and all three diff tails/headers fit the captured
panes. Refused auth retains all six digits and recovery copy; signed-in and
unavailable states are readable in both themes. Preserve these observations:

- At 960×640, the cancelled initial-auth read returns to a scrollable login form
  whose logo is partially clipped at the top. The email field and cancel action
  are visible; this is not an unclipped whole-form capture.
- The canonical-origin field is horizontally scrolled while focused, so the
  screenshot does not display the complete URL. Assertions check the full value.
- Refused Code screenshots show stacked toasts and only a narrow visible prefix
  of the draft. Preview Bot toasts cover part of the transcript at 960px while
  remaining above the composer. These frames are not unobstructed transcript proof.
- The 426-state render case, successful preview-departure case and Work font-scroll
  cases produce no dedicated success screenshots. Other Work/preview images
  cannot substitute for them.

See [images.json](images.json) for every original hash, dimensions, aliases and
contact-sheet placement; [target-images.json](target-images.json) for the 58
original/WebP/RGBA hash triples; [visual-review.json](visual-review.json) for review coverage.

## Package smoke and negative evidence

The macOS log records `window: Cortex cortex://app/index.html`, shell text and
`SMOKE OK`. The full-resolution 1440×900 renderer capture shows the empty Chat
home with `No model`. The pinned smoke script spawns the packaged executable,
waits ten seconds after window discovery and captures over CDP.

It also records `could not create image from display` and
`screencapture failed: Command failed: screencapture -x out/smoke-screen.png`.
That error is caught by the script; the step remains green. **Native capture did
not pass.** No native menu, traffic-light, display-compositing or installed-app
interaction acceptance follows from the renderer screenshot.

The only uploaded `.ips` is a **simulated Setup Assistant** diagnostic dated
2026-03-16, months before this run. Its body identifies the system Setup Assistant
process and `EXC_GUARD` / `WEBKIT`; no Cortex diagnostic appears in this artifact.
The crash collection command tolerates copy failures, so absence is not a
crash-free guarantee. Its original bytes are retained as lossless gzip.

Package artifact `11263628650` (`cortex-mac-arm64-zip`, 144,638,433 bytes) is recorded
in API/upload metadata with digest
`eb5c88db8629ba80f1b9da329d429628ec0df1d640fc7cf547f8c510fc633136`.
The application package was not downloaded or inspected in this audit.
Installed package/ASAR/native verification belongs to the separate coordinator
receipt. Signing and notarization were disabled. Details: [smoke-and-crash.json](smoke-and-crash.json).

## Retention and scope

Three complete job logs plus `smoke.log` have readable normalized copies and
lossless original gzip copies. [log-retention.json](log-retention.json) records
original, compressed and normalized hashes and the exact transformations.
Original reports, member inventories, API receipts, targeted images and contact
sheets remain revision-scoped here. Downloads, pinned source copies and the audit
scripts remain under `/tmp/opencode/ci-ffc118a-review/`.

Audit reproducibility and file-integrity checks are recorded in
[audit.json](audit.json); [SHA256SUMS](SHA256SUMS) covers the retained files.
Earlier `b0e6d78` native failures retain their own disposition. This run supplies
new CI regression evidence; it does not turn those earlier captures into passes,
replace matching installed-Mac proof, establish frozen-reference fidelity or
close full-product/real-Cloud acceptance.
