# Final desktop CI artifact review

**46/46 tests passed on each OS, without retries, flaky results or skips. Two visible must-fix findings remain: composer-obscuring toasts; refused Work tasks labeled Done.** Green CI does not establish complete visual acceptance.

## Verified evidence

Run: [37025236580](https://github.com/CortexLM/desktop/actions/runs/37025236580), PR36.

Both JSON reports identify CI merge `9f2541d2b3b5e44b8fc6b5d55f5820058109f046`, whose recorded subject merges head `8b90a8e4b7b5d51274278c6bd204434cef190d25` into `9bf3c002c01f5f1a30cce6fbb9f3c6e4da195a3d`. Local comparison of application-source revision `dc7f529f7a3cce2b375881436ba5a7dae4999c3a` to that head changes only `docs/testing.md` and `tests/e2e/responsive.spec.ts`.

| Artifact | Passed / attempts | Retries / flaky / skipped / unexpected | PNG attachments / unique images | Duration |
| --- | --- | --- | --- | --- |
| `macos/test-results/e2e.json` | 46 / 46 | 0 / 0 / 0 / 0 | 44 / 44 | 181.276s |
| `e2e-linux/test-results/e2e.json` | 46 / 46 | 0 / 0 / 0 / 0 | 44 / 44 | 192.394s |

Root: `/tmp/opencode/desktop-ci-final/`.

- Every test has exactly one result: `passed`, `retry:0`, expected status `passed`, aggregate status `expected`; report/result errors empty.
- Each OS's 44 original PNGs, attached copies and 44 HTML-report data PNGs have matching SHA-256 content sets. Copies are not additional images. Per OS: **34 at 960×640; 10 at 1440×900**.
- Both render-sweep logs say **`rendered 426 screen states`**. These are semantic render checks, not 426 uploaded screenshots or pixel approvals.
- JSON SHA-256: macOS `124b80b19098bd17e324d84e714396f885018e18fa1d2dc29efd15d54f82ee03`; Linux `27ac08749bc632fbf362bf2fe532ee26ca9b334f5f8e7cf68b0a855de04aee1c`.

## Must-fix visible findings

### P2 — Toast protection misses nested Work transcripts and wide Chat

**Both OSes, both themes:**

- **960×640:** `work-task-draft-kept-{dark,light}.png`. The refusal toast occupies approximately `x596–936, y550–616`, over the composer's right half. Model selection, microphone and send control are hidden while the retained draft remains partly visible.
- **1440×900:** `preview-bot-shared-1440-{dark,light}.png`. “Look saved” occupies approximately `x1076–1416, y783–876`, covering Chat's model/microphone/trailing action. This is the same obstruction at the default window size.

Source explanation, checked against reviewed head: `packages/app/src/kit/styles.css:275–279` applies the relocation only below 1100px and only for `.content > .dock .composer` or `.split-l .composer`. Work's dock is nested under `.travail-task > .travail-tl` (`screens/work/home.tsx:425–439`), so it never matches. Wide Chat falls outside the media query.

**Required outcome:** toast-visible composer controls remain visible and pointer-reachable in these demonstrated layouts. The current Work test checks retained value, enabled state and viewport intersection, not obstruction (`tests/e2e/composer-safety.spec.ts:115–124`). Code's equivalent performs trial clicks; Work does not. The wide preview capture tests mascot state, not composer reachability. These gaps explain passing CI.

### P2 — Rejected, never-started Work task is labeled Done

**Both OSes, both themes:** the same `work-task-draft-kept-*` images show a green **Done** badge above an empty transcript, while “Couldn’t send that. Try again.” is visible. `work-draft-kept-*` shows **Done: 1** after the initial send refusal.

This is substantiated by the passed test, not inferred solely from an empty screenshot: `composer-safety.spec.ts:102–112` asserts the refusal and **zero stored messages** for the created task session. The board mapping treats every non-busy/non-approval session as done (`screens/work/home.tsx:42–44`); the task mapping also defaults idle to done (`:402`). Both mappings already existed at `5ced8aa`: **pre-existing defect, not introduced by the test-only final head or the new grid correction**.

**Required outcome:** a never-accepted/refused task must not claim completion. Preserve the draft and distinguish idle/refused from genuinely completed work.

## Correction coverage and remaining evidence limits

- **Work grid:** 960 screenshots show two columns with the remaining row below the vertically scrollable viewport; 1440 drag/drop screenshots show four intact columns. Six responsive cases per OS pass at 960/1024/1440 in both themes, asserting 2×2/4×1 layout, no horizontal overflow and card/drop-target reachability using vertical wheel scrolling. No grid regression demonstrated.
- **Chat/Code small-window recovery:** full-resolution `chat-draft-kept-*` and `code-session-draft-kept-*` show the toast at the top; retained attachment/draft, model and send controls are clear. Code session draft text scrolls/clips inside its narrow input; tests verify its complete retained value. The Work exception above remains.
- **Work preview activity:** the passed shared-Bot cases explicitly assert done activity, saved shape/color, explicit pause preservation and restoration on leaving (`bot-safety.spec.ts:142–167`). Their uploaded PNG is taken earlier, on Chat; therefore this is assertion evidence, not a final Work-done screenshot.
- **Sidebar dimming:** visibly muted first fixture conversation on the Work board and other non-Chat captures; selected fixture conversation remains emphasized in shared-Bot Chat captures. No new dimming defect demonstrated.
- **Code instruction font:** no uploaded `code-settings~instructions` screenshot exists in these 44 images. The render sweep passed; this artifact set cannot visually confirm that specific typography correction.
- **Capture caveat:** `reasoning-expanded-960-dark.png` on macOS and `reasoning-expanded-960-light.png` on Linux do not visibly show the first completed-reasoning panel; the opposite-theme captures do. The test's final reopen waits for child count, not settled visible height (`interaction-states.spec.ts:90–92`). This is an end-state capture gap; the earlier expand/collapse visibility assertions pass. No permanent product failure established from that single frame.
- **Native chrome:** these are renderer `page.screenshot()` images, excluding OS titlebar controls, menus and window shadows. Missing native traffic lights in these PNGs are not a visible regression. Both locale chrome tests pass title/minimum-size/menu assertions and macOS traffic-light position `{x:20,y:15}`; native pixel appearance remains outside this review.
- **Packaged smoke:** additionally inspected `macos/out/smoke-renderer.png`: populated local Chat home, no-model state, no seeded chats. `out/smoke.log` contains only the DevTools startup line; no independent native-pixel or complete smoke assertion follows from that log alone.

## Actual image inspection

**All 88 unique E2E images inspected** in 12 labeled contact sheets:
`/tmp/opencode/final-ci-review/{macos,e2e-linux}-{01,02,03,04,05,06}.png`.

Originals are under each OS's `test-results/artifacts/`. The table lists every filename family inspected; `{dark,light}` means both. **22 originals per OS reopened at full resolution**; 44 total, plus the separate macOS smoke image.

| Filename family | Count per OS | Full-resolution inspection |
| --- | ---: | --- |
| `bot-draft-kept-{dark,light}.png` | 2 | Contact sheets |
| `bot-save-refused-{960,1440}-{dark,light}.png` | 4 | Contact sheets |
| `chat-draft-kept-{dark,light}.png` | 2 | Both OSes/themes |
| `code-draft-kept-{dark,light}.png` | 2 | Both OSes/themes |
| `code-session-draft-kept-{dark,light}.png` | 2 | Both OSes/themes |
| `draft-kept-{dark,light}.png` | 2 | Contact sheets |
| `frozen-chat-history-{dark,light}.png` | 2 | Both OSes/themes |
| `frozen-code-history-{dark,light}.png` | 2 | Both OSes/themes |
| `frozen-focus-dark.png`, `frozen-theme-dark.png` | 2 | Contact sheets |
| `frozen-live-capsule-{dark,light}.png` | 2 | Contact sheets |
| `image-compare-quarter-960-{dark,light}.png` | 2 | Contact sheets |
| `kanban-dropped-1440-{dark,light}.png` | 2 | Both OSes/themes |
| `keyboard-{dark,light}.png` | 2 | Contact sheets |
| `mascot-paused-1440-{dark,light}.png` | 2 | Contact sheets |
| `preview-bot-shared-{960,1440}-{dark,light}.png` | 4 | Both OSes/sizes/themes |
| `reasoning-expanded-960-{dark,light}.png` | 2 | Both OSes/themes |
| `undo-{dark,light}.png` | 2 | Contact sheets |
| `upload-drop-ready-960-{dark,light}.png` | 2 | Contact sheets |
| `work-draft-kept-{dark,light}.png` | 2 | Both OSes/themes |
| `work-task-draft-kept-{dark,light}.png` | 2 | Both OSes/themes |

No additional must-fix visible defect established in this bounded inspection. Preview-only capabilities, blocked product surfaces and the incomplete overall rewrite goal remain unchanged. No application/test/evidence writes, reruns, recaptures, delegation or Mac access; only this report and temporary contact PNGs created.
