# Desktop admission CI review

**PASS — scoped source, CI, renderer regression review.** No blocker found for the admission/history-capability correction. **Native-pixel verification remains blocked in this CI run:** macOS `screencapture` failed; the available smoke capture is renderer-only. This review grants no full-page/design acceptance.

Reviewed 2026-10-02, terminal executor, GPT-6 Astra. Read `AGENTS.md`, all nine `.rules/*.md`, relevant source/tests/workflow. Source/evidence read-only. No builds, tests, app launches, Mac access, baseline changes, PR/board changes, or delegation performed.

## Provenance

- Run: <https://github.com/CortexLM/desktop/actions/runs/37055151545>, attempt **1**, `pull_request`, PR **36**, completed **success** at `2026-10-02T19:40:18Z`.
- Run head/local HEAD: `f2754bed27cfcc821a7e5bba8ce0d69cfa7e66f7`.
- Actual checkout in all job logs and both Playwright reports: synthetic merge `ccfdb6a05513d2ad59ec3b2b97f857de8886bf77`.
- GitHub commit API confirms merge parents: base `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d`, head `f2754bed27cfcc821a7e5bba8ce0d69cfa7e66f7`.
- Merge tree and local head tree both **`31d9c5877da700f9f80348ce98b05d543e3e79b5`**. CI therefore tested identical tracked source, despite the different commit ID.
- Renderer unchanged from `cc758a6`: `packages/app` tree at both revisions is `88dabd4a20c969d8b18b8a115618b20356fa13ce`. `packages/desktop` also unchanged: `a81b98c854308e006a3a2d7957fe9a58140d7a37`. The changed product implementation is `packages/core/src/session.ts`; relevant tests are `packages/core/test/{session,capabilities}.test.ts` and `tests/e2e/ui-flows.spec.ts`.
- Inputs: `/tmp/opencode/desktop-admission-ci/{e2e-linux,macos,cortex-mac-arm64-zip}`. Independently fetched all three GitHub artifact archives into memory, verified their published SHA-256 digests, then compared **every extracted local file** byte-for-byte by SHA-256. No archive copies written.

| Artifact | GitHub artifact ID | Published outer ZIP SHA-256, independently verified | Local/archive files matched |
| --- | ---: | --- | ---: |
| `e2e-linux` | 11248846386 | `5a074faec40c688e00abae0a847253b551578ef008b4105c75be26d0d9eb0df4` | 140/140 |
| `macos` | 11248082593 | `9652c817a83b5cebc47225670445b3a40bba7003ef70b421a43d3afe90ad9065` | 144/144 |
| `cortex-mac-arm64-zip` | 11247882942 | `3525ee40ca4c538eba09a2d18feb2b39bdd7674aecd435b02aac07218c94c44c` | 1/1 |

The packaged inner `Cortex-0.2.0-arm64-mac.zip` is **144,901,135 bytes**, SHA-256 `0ec445254581effe9a6de71b330b29c85625c847a31128c9085a85dcff9c8dab`. ZIP directory contains `Cortex.app/Contents/MacOS/Cortex`, `Contents/Resources/app.asar`, and `Contents/Info.plist`. Package was not executed by this reviewer.

## CI and report readback

All **3/3 jobs** and every returned step report `success`; no skipped/cancelled/failed job or step.

| Job | ID | Verified result |
| --- | ---: | --- |
| Lint, typecheck, unit tests, i18n audit | 110997907248 | All four check steps successful. Vitest **13 files passed; 138 tests passed, 1 skipped, 139 total**. Session and capability files each **11 tests passed**. |
| E2E (Playwright + Electron, Linux) | 110997907603 | Build successful; Electron E2E **50/50 passed** under Xvfb. |
| macOS build, package, launch | 110997907536 | Build successful; source-build Electron E2E **50/50 passed**; unsigned arm64 `dir zip` packaging successful; packaged smoke successful. |

Both original `test-results/e2e.json` files independently traversed through every nested suite/spec/test/result; embedded HTML report ZIPs independently decoded and checked.

| Metric | Linux | macOS |
| --- | ---: | ---: |
| Specs / tests / result attempts | 50 / 50 / 50 | 50 / 50 / 50 |
| Expected tests / passed results | 50 / 50 | 50 / 50 |
| Unexpected / flaky / skipped | 0 / 0 / 0 | 0 / 0 / 0 |
| Retry-positive attempts | 0 | 0 |
| Top-level / result errors | 0 / 0 | 0 / 0 |
| Test annotations / captured stderr entries | 0 / 0 | 0 / 0 |
| HTML report total / expected / `ok` | 50 / 50 / true | 50 / 50 / true |
| Logged registered theme/state renders | 426 | 426 |
| PNG attachments | 46 | 46 |
| New-history-containing UI test duration | 10,264 ms | 12,668 ms |

JSON SHA-256: Linux `6eceb3385d3a56c73c87035be8f016dde53acda98b164b1fceca75d41066d183`; macOS `7f82aa314b74ec278b22be64ad8cefe7244fb257efbcea5cb78d61827c763f1d`.

The one **unit** skip is `packages/desktop/test/remote.test.ts:177`, `it.skipIf(!process.env.CORTEX_TEST_BACKEND_URL)("lists models from a real backend", ...)`. It is outside the zero-skip E2E claim. CI logs contain deprecation/experimental warnings; no `##[error]`, `::error::`, or `SMOKE FAIL:` entries. Do not describe this run as having no warnings or no skipped tests overall.

### Packaged macOS smoke limit

Packaging log: Electron **44.5.1**, `platform=darwin`, `arch=arm64`, unsigned PR package, `--publish never`, notarization disabled. Smoke log reports `window: Cortex cortex://app/index.html`, renderer shell text, then **`SMOKE OK`**. `scripts/smoke.mjs:23-38` checks window discovery, process survival for ten seconds, renderer text containing Cortex; captures web contents through CDP.

Native capture failure is explicit: **`could not create image from display`**, **`screencapture failed: Command failed: screencapture -x out/smoke-screen.png`**. No `smoke-screen.png` exists in the artifact. `out/smoke-renderer.png` exists and was inspected full-size. It shows the light-theme 1440×900 fresh shell, empty recents, `No model`, intact composer. It proves renderer output, not native chrome, traffic lights, OS appearance/fullscreen, signing, or distribution acceptance.

The sole uploaded `.ips` file is a simulated **Setup Assistant** incident dated **2026-03-16**, predating this run; no Cortex crash report appears in the artifact. This is not a comprehensive no-crash assertion.

## Changed regression: assertions and source

**PASS.** `tests/e2e/ui-flows.spec.ts:64-187` uses the real Electron bridge/local engine with a controlled HTTP provider. The new branch is inside an existing test, so **50 tests remains correct**; both themes execute within that test.

- `:67-71` clones the catalog and raises the text-only model context limit to `100000`, avoiding a small-context refusal masking the historical-image capability check.
- `:117-135` establishes persisted image history: failed image request, accepted text follow-up, retry of the original image. Exactly **3 provider requests**; first and third last-user contents include the image and original draft.
- `:138-148` selects **Plain Text**, types **`Follow up on the earlier image`**, sends, asserts **`This model can’t read images.`**, exact draft retention, enabled input, **zero `.chat-att-img` composer thumbnails**, provider request count still **3**, then captures each new history-refusal image.
- `:149-183` retains existing current-attachment recovery: `again.png`, retained draft, request count still 3, input/model/send/remove controls fully in viewport and trial-clickable during refusal, successful model-menu selection while refusal stays visible, unreadable-file failure preserving the prior attachment/draft. `:184` asserts no page errors.
- E2E directly proves draft/composer/refusal/request-count behavior. It does **not** directly query persisted history/model equality in this branch. Full-size screenshots show **Plain Text remains the composer selection**; that is distinct from the stored session model.
- `packages/core/test/capabilities.test.ts:81-106` supplies the persistence proof separately for historical **image/png and application/pdf**: text-only follow-up rejects with the correct capability code; messages **and durable event journal unchanged**; stored model remains the prior **reasoner**; busy reservation released; provider request count stays **1**.
- `packages/core/src/session.ts:124-163` reserves before asynchronous catalog/provider lookup, checks proposed input plus historical user-file parts before model update/admission, checks cancellation before/after model update, releases on refusal/completion. `:100-106` cancels a parent's pending admission before waiting for child deletion.
- `packages/core/test/session.test.ts:13-138` verifies concurrent admission refusal/recovery, abort/delete during gated credentials, parent cancellation while child deletion waits, synchronous model-update cancellation. These are five cases; historical image/PDF add two capability cases. CI logs confirm the containing suites passed.

**Inference scope:** `tests/e2e/fake-provider.ts:7-34` binds `127.0.0.1`, records requests, deliberately rejects the first request, emits canned reasoning/text. “I can see the attached image” and “Hello from the streaming test provider” are fixture text, not actual image understanding or remote inference. No Cortex Cloud sign-in/authentication or remote routing is established here.

## Image counts and actual visual inspection

- **46 unique E2E PNGs per OS; 92 unique E2E PNGs combined**, independently SHA-256-deduplicated. Each OS has **138 physical E2E PNG files**, three identical copies per image: original output, test attachment, HTML report data. All original/attachment/report copies matched. Decoded RGBA uniqueness also equals 46 per OS.
- Each OS: **36 images at 960×640**, **10 at 1440×900**. Across both: **72 small + 20 large**.
- macOS adds **one** 1440×900 smoke PNG: **139 physical PNG files / 47 unique images** in that artifact. Combined inspection total: **93 unique images**, comprising 92 E2E + one smoke; **277 physical PNG files** are not 277 independent screenshots.
- All **92/92 E2E images visually inspected** using **16 derivative contact sheets** in `/tmp/opencode/desktop-admission-ci-review/`: `e2e-linux-01.jpg` through `e2e-linux-08.jpg`, `macos-01.jpg` through `macos-08.jpg`. Each sheet has two columns, up to three rows; uncropped thumbnails are 640 px wide. Sheets 01–07 contain six images each; sheet 08 contains four.
- **12/92 E2E originals additionally opened full-size**: per OS, `history-image-refusal-{light,dark}.png`, `draft-kept-{light,dark}.png`, `chat-draft-kept-{light,dark}.png`. These are the two new history-refusal captures plus four existing recovery captures per OS. The other **80 E2E originals received contact-sheet inspection only**.
- `macos/out/smoke-renderer.png` additionally opened full-size. Thus **13 originals full-size**, including smoke; repeated sheet/full-size views are not counted as additional unique images.

### Contact-sheet coverage, identical filename order for each OS

| Sheet | Image indices | Filename stems inspected |
| --- | --- | --- |
| 01 | 01–06 | `bot-draft-kept-dark`, `bot-draft-kept-light`, `bot-save-refused-1440-dark`, `bot-save-refused-1440-light`, `bot-save-refused-960-dark`, `bot-save-refused-960-light` |
| 02 | 07–12 | `chat-draft-kept-dark`, `chat-draft-kept-light`, `code-draft-kept-dark`, `code-draft-kept-light`, `code-session-draft-kept-dark`, `code-session-draft-kept-light` |
| 03 | 13–18 | `draft-kept-dark`, `draft-kept-light`, `frozen-chat-history-dark`, `frozen-chat-history-light`, `frozen-code-history-dark`, `frozen-code-history-light` |
| 04 | 19–24 | `frozen-focus-dark`, `frozen-live-capsule-dark`, `frozen-live-capsule-light`, `frozen-theme-dark`, `history-image-refusal-dark`, `history-image-refusal-light` |
| 05 | 25–30 | `image-compare-quarter-960-dark`, `image-compare-quarter-960-light`, `kanban-dropped-1440-dark`, `kanban-dropped-1440-light`, `keyboard-dark`, `keyboard-light` |
| 06 | 31–36 | `mascot-paused-1440-dark`, `mascot-paused-1440-light`, `preview-bot-shared-1440-dark`, `preview-bot-shared-1440-light`, `preview-bot-shared-960-dark`, `preview-bot-shared-960-light` |
| 07 | 37–42 | `reasoning-expanded-960-dark`, `reasoning-expanded-960-light`, `undo-dark`, `undo-light`, `upload-drop-ready-960-dark`, `upload-drop-ready-960-light` |
| 08 | 43–46 | `work-draft-kept-dark`, `work-draft-kept-light`, `work-task-draft-kept-dark`, `work-task-draft-kept-light` |

### Full-size source hashes

All twelve E2E originals reside at `<artifact>/test-results/artifacts/ui-flows-rejected-sends-ke-f168b-nts-retry-resends-the-image/<stem>.png` beneath `/tmp/opencode/desktop-admission-ci/`.

| Artifact | Stem | SHA-256 |
| --- | --- | --- |
| Linux | `history-image-refusal-light` | `b57b0bb654b98474533ed2799de772f7b3d0474d7ebff725430e368d48350132` |
| Linux | `history-image-refusal-dark` | `b9c29d314ef22cd3c6838e579fcfeb0913abbe093273d2385dd49ce7be0375b4` |
| Linux | `draft-kept-light` | `4c4c0d8f6d1f65d2d52456d5fa7d4bab645a14db60dbe3df0f17d27a3a0133b7` |
| Linux | `draft-kept-dark` | `263a78543ab2ac733ee6d8b0c55bb6e53504891718b0e6f0f37bce243c1f1981` |
| Linux | `chat-draft-kept-light` | `d7c736fb48dcda045b7eea8cf1965dbe623acb2742ebcffecb6ae9976a3ccd33` |
| Linux | `chat-draft-kept-dark` | `784b5268556c5df2c36f4c005aaf03e053e5b42ce36fbacbffbe7e72090a1513` |
| macOS | `history-image-refusal-light` | `0740e6ed8eedcf90a6354ca7f1965378495b5b157c6ba29cc5995217fe1b8564` |
| macOS | `history-image-refusal-dark` | `7b5a9ef9d94c7644e8380e195edf9cda8c7a8f744289f3f585f8645472bdd190` |
| macOS | `draft-kept-light` | `5b4ec8d43cd855fbefc377bed84ddcf376e6de1f96d6a66e325ede32c83bba16` |
| macOS | `draft-kept-dark` | `c8401da81f6a8a088d14a661a881c555c96e07dfa3100819e21e2e9e07da57b7` |
| macOS | `chat-draft-kept-light` | `9d6318cc260adecf33d53e037c1f37246b6e5dd2a784d5c7c2f88140b030e133` |
| macOS | `chat-draft-kept-dark` | `7eb15598b00701e7d0e3734b6efae71346c002e18aa6ff63e7b0241dc253a8b2` |
| macOS | `out/smoke-renderer.png` | `bb69536bf3b15ff6bd53db88c9c3197711ef1a5cae4ac36e2036e35deb0651da` |

### Visual observations and limits

- Four new full-size history-refusal images consistently show the earlier image in the transcript, retained **`Follow up on the earlier image`** draft, **Plain Text** selection, no current attachment chip, readable refusal, clear input/model/send controls. Toast sits above the composer; it partly overlays older transcript text, not recovery controls.
- Eight existing recovery originals consistently show retained `dot.png` on Home or `again.png` in Chat, preserved draft, readable refusal, visible removal/model/send controls in both themes on both OSes. Image thumbnails remain visible. No blank renderer or gross broken recovery layout observed.
- Contact sheets show rendered Bot save dialogs, Bot/Work drafts, Code states, preview history, focus/theme states, keyboard focus, Undo, image comparison, uploads, reasoning and wrapped Work boards. Modal background blur, narrow input text clipping, scrolling panes, and stacked transient toasts are visible states, not proof of lost data. No additional blocking visual defect identified at this inspection scale.
- Existing refusal body says **“Pick a model with image input, or remove the image.”** With only a historical attachment, no composer removal control is present; choosing a capable model is the applicable recovery. Generic copy is unchanged; history-specific wording is not verified by this change.
- The **426** count comes from `tests/e2e/screens.spec.ts`, which checks registered state rendering, selected theme, nonempty content, raw localization keys, and page errors. It is **not 426 captured or manually accepted screens**. Contact sheets cannot establish pixel fidelity, complete copy legibility, dynamic motion quality, or whole-page accessibility. No frozen-baseline pixel comparison performed.
- Every inspected capture is renderer content. Native UI verification remains the coordinator's separate work. No Windows verification, remote inference, full-page acceptance, or complete-product approval follows from this report.

## Deliverables

Only `/tmp/opencode/desktop-admission-ci-review.md` and the sixteen derivative contact-sheet JPEGs in `/tmp/opencode/desktop-admission-ci-review/` were written. Source, original artifacts, repository evidence, baselines, docs, PR and board remained untouched by this reviewer.
