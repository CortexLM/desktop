# Cortex desktop — bounded final CI review

**Verdict: ACCEPT for the changed-regression scope.** No blocking regression or screenshot-proof flaw found in the reviewed CI evidence. Native installed-Mac acceptance remains the coordinator's separate deliverable.

## Revision and provenance

- Run: https://github.com/CortexLM/desktop/actions/runs/37039827971
- PR head: `cc758a69fe9349d17f6a4bf7accd978421035519`.
- Both reports identify the actual PR merge checkout: `69c83d78ed7be9243108c6fbda6ecfda5bef09b2`. GitHub confirms parents `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d` and the PR head above. This is expected PR-run provenance, not a stale artifact mismatch.
- GitHub run conclusion: `success`; all three jobs green. macOS unsigned arm64 packaging and packaged smoke steps passed; smoke log contains `SMOKE OK`.
- Inputs: `/tmp/opencode/desktop-ci-nav-final/{macos,e2e-linux}`.
- Repository source at review: HEAD `cc758a6`; existing uncommitted evidence preserved. This CI verifies committed source, not subsequent evidence/document edits.

## Report validation

Recursively inspected each JSON report's individual specs, tests, results, annotations, errors, retry configuration and stdout; not merely the green job badge.

| Check | macOS | Linux |
| --- | ---: | ---: |
| Specs / tests / result attempts | 50 / 50 / 50 | 50 / 50 / 50 |
| Passed results / expected outcomes | 50 / 50 | 50 / 50 |
| Unexpected / flaky / skipped | 0 / 0 / 0 | 0 / 0 / 0 |
| Retried attempts / multiple-result tests | 0 / 0 | 0 / 0 |
| Configured retries | 0 | 0 |
| Global report errors / annotations | 0 / 0 | 0 / 0 |
| Sweep stdout | `rendered 426 screen states` | `rendered 426 screen states` |
| Unique E2E screenshots | 44 | 44 |

Report SHA-256:

- macOS `test-results/e2e.json`: `9f3d081c7148e3830b474cfefde7404cc0d7aec87195cda22d73f58e6f8d0e28`.
- Linux `test-results/e2e.json`: `3c9473b727830cce9799f9999374150c9cbe95330e4e628849e37c00670587e5`.

### Image accounting

Each OS has 44 original test PNGs, 44 byte-identical attachment copies and 44 byte-identical HTML-report copies: **132 files represent 44 E2E images**, not 132 independent captures. SHA-256 grouping confirms exactly three copies per original. Decoded RGBA pixel hashes also confirm 44 distinct images per OS. Across the two OSes, 88 originals have 88 distinct file hashes.

macOS additionally has `out/smoke-renderer.png`: **133 total PNG files / 45 distinct images**, of which 44 are E2E and one is the separate packaged-smoke renderer capture. The smoke image was also inspected, excluded from the 88-image E2E total.

## Screenshot inspection

All **88 E2E originals** inspected on these twelve contact sheets:

- `/tmp/opencode/nav-ci-review/macos-01.png` through `macos-06.png`.
- `/tmp/opencode/nav-ci-review/e2e-linux-01.png` through `e2e-linux-06.png`.

`/tmp/opencode/nav-ci-review/image-inventory.json` maps every labeled sheet entry to its original absolute path, dimensions, SHA-256 and duplicate copies. Sheets are review derivatives; originals remain untouched.

**26 selected E2E originals additionally opened full-resolution:** the following 13 per OS:

- `work-draft-kept-{dark,light}.png`.
- `work-task-draft-kept-{dark,light}.png`.
- `chat-draft-kept-{dark,light}.png`.
- `preview-bot-shared-1440-{dark,light}.png`.
- `keyboard-{dark,light}.png`.
- `reasoning-expanded-960-{dark,light}.png`.
- `frozen-focus-dark.png`.

Observed in both OSes:

- Work refusal board retains the draft and one **To do** card; **Done** is zero. At 960×640 the board wraps to two columns with a vertical scroll region. Detail shows **To do**, an empty transcript, retained draft, fully visible composer controls. Refusal toast sits above the nested dock, without covering input/send/model controls.
- Chat refusal retains the attachment, remove-image control, draft, model trigger and send control. Toast clears the whole attachment/composer dock. It overlays transient transcript content, consistent with the notification placement; recovery controls remain clear.
- Wide Chat saved-look captures retain the saved paused mascot in sidebar/transcript. Toast clears the composer at 1440×900; narrow counterparts also clear it on the sheets.
- Keyboard captures show the visible Refresh focus ring in both themes, hidden navigation absent. Work focus mode retains readable cards/header/actions; renderer content clears its exit control. Reasoning disclosures and stop composer remain visible at 960×640.
- All remaining sheet captures have rendered, coherent content. No blank capture, missing theme, obvious new clipped recovery control or changed-screen overlap blocker found. Code's stacked notifications visibly coexist above its composer; Bot refusal dialogs remain visible.

## Changed-regression proof

| Regression | Evidence accepted | Bound |
| --- | --- | --- |
| Outgoing route/tree identity | `navigation.spec.ts:79`: held route callback, unrelated sidebar update, outgoing element stays connected, exact draft survives, destination commits, prior Bot activity restores | Real renderer assertions; transition callback deliberately held for a deterministic race |
| Newest keyboard tab wins | `navigation.spec.ts:46`: select a newer tab before releasing older route commit; final URL, rendered Work, selected tab and focus all asserted | Passed once per OS; independent of older settled-navigation case |
| Back cancels pending same-label intent | `navigation.spec.ts:4`: Back two entries while choice pending; original entry key remains unchanged for 800 ms, beyond 610 ms debounce; Chat selected | Passed once per OS; checks history-entry identity, not only tab text |
| Dock-anchored recovery / popup stacking | `ui-flows.spec.ts:146–159` checks composer hit targets, then actually changes model while refusal still visible; `composer-safety.spec.ts:76–80,129–139` checks Code/Work/Bot controls; `bot-safety.spec.ts:133–140` checks saved-look composer access at 960/1440, both themes | Images corroborate placement; open-popup stacking is assertion-backed, not an uploaded open-popup screenshot |
| Persisted Work Done | `composer-safety.spec.ts:109–121,135–137,156–205`: refused/empty stays To do; successful persisted assistant completion becomes Done; later failure and abort leave Done; board/detail rechecked after reload | Source-build real engine, local fake inference. Refusal images alone do not prove persistence |
| Reduced motion | `chrome.spec.ts:42–54`: both themes, inherited heading color equality, computed transition `0s`, animation `0.001s`; both OS reports pass | Computed-state assertions, not frame-by-frame flash/timing certification |

All **three new navigation regressions** are explicitly present and passed in both current reports. Prior 47-test green runs cannot establish their coverage; this run's **50/50 per OS** does.

## Scope limits

- The 426-state log is registered preview smoke coverage, not 426 screenshot comparisons or complete product acceptance. Its test checks rendering/theme/errors/raw keys; these 44 images are selected interaction captures.
- E2E captures and the packaged smoke PNG show **renderer content**. They do not prove OS-drawn traffic lights, menus, native fullscreen or installed-app appearance. `chrome.spec.ts` passes native API assertions for title/minimum bounds/menu labels and macOS traffic-light position; that is narrower than native pixel verification.
- New navigation race tests have assertions but no dedicated uploaded screenshots. Static keyboard/Work images supplement them; they do not independently reproduce the temporal races.
- CI inference uses the local fake. No real-provider, remote-auth, original-reference fidelity, missing-surface, all-locale or broad product acceptance inferred.
- No tests/builds rerun, shared Mac accessed, source/evidence edited, or delegation performed. Only this report and temporary review derivatives under `/tmp/opencode/nav-ci-review` were written.
