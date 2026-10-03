# CI 37091082338 — skipped-transition recovery

**PASS, with native-capture limits below.** [Run / attempt 1](https://github.com/CortexLM/desktop/actions/runs/37091082338)
completed successfully at API update `2026-10-03T02:58:37Z`.

## Revision binding

- PR head: `b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874`.
- Actual checkout: `c2e737a4a47feed85a3f7be5a858708a5473e500`, confirmed in all three checkout logs and both Electron reports.
- Head and merge have the **identical complete tree** `a9bffe5628d8bcbfa3de27df80ba81431fb588d6`; merge parents include that head.
- [Source binding](source-binding.json) retains API commit objects and hashes for the pinned workflow, tests, smoke script and transition sources. Only committed source was read for this audit; uncommitted authentication integration is outside this result.

## Verified results

| Job | Observed result |
| --- | --- |
| Checks, `ubuntu-latest` | Lint/typecheck PASS; **16 unit files, 188 passed / 1 skipped**; i18n **63 files / 2269 used keys / 3398 English keys / 0 problems** |
| Linux, `blacksmith-4vcpu-ubuntu-2404` | Build PASS; **84/84 Electron cases**, four workers; **426** registered theme/state render iterations |
| macOS, `blacksmith-6vcpu-macos-26` | Build PASS; **84/84 Electron cases**, one worker; **426** registered theme/state render iterations |
| macOS unsigned arm64 package | PASS; application ZIP artifact published with `--publish never`, signing disabled |
| macOS packaged smoke | Process/window/renderer PASS; **native desktop screenshot failed** |

Both reports have exactly 84 attempts, every `retry: 0`, no skipped/flaky/unexpected
cases, no runner-level or test-result errors. [Case lists](linux-cases.json),
[macOS case list](macos-cases.json), [summary](e2e-summary.json) retain those counts.
The optional unit skip is `remote.test.ts`'s real backend listing when
`CORTEX_TEST_BACKEND_URL` is absent. The catalog test whose title contains “skipped
offline” is reported passed, not an additional skip.

The 426 iterations occur inside one test per OS: nonempty content, selected theme,
raw translation-key checks and collected page errors. They are not 426 retained
screenshots, complete interaction passes, frozen-reference comparisons or visual approval.

## Transition and Work evidence

[Decoded JSON attachments](json-attachments.json) preserve all ten attachments per OS:

- Normal native skips: route and theme each invoke one update callback; both native
  `ready` rejections are handled as `AbortError`; `unhandled: []`, `errors: []`.
- Controlled failing updates: the test deliberately throws after awaiting the original
  callback. Exactly `Native route callback failed` twice and `Native theme callback failed`
  once reach page-error reporting. Native promise identity records the route's
  `updateCallbackDone`/`finished` and theme's `updateCallbackDone`. These are intentional
  asserted fault markers, not spontaneous application failures or filtered errors.
- The pinned test calls real `skipTransition()`, returns the native transition and observes
  handlers without substituting promises. It explicitly uses `no-preference` motion.
- Work-scroll light/dark both pass, including the final empty-page-errors assertion.
  Cold-font bottom: Linux top **409→392**, macOS **410→392**, final height 1051,
  viewport 659, gap **0**. Warm reentry stays at 392/gap 0.
- User-wheel position remains **229** on Linux, **230** on macOS after font readiness;
  remaining gap 163/162. Variant reflow is **179→162**, inside the 40px limit.
  Departure/remount's `top === 0` assertion passes; no separate attachment records it.
- Six Work-board cases per OS cover 960/1024/1440 × both themes: four columns/nine
  cards, 2×2 narrow/4×1 wide layout, horizontal overflow at most 1px, wheel access,
  visible/hittable cards and empty drop zones. These tests use reduced motion; the
  separate transition regression above does not.

The transition regression emits JSON only; passing Work-scroll emits metrics only.
No new screenshot or trace directly captures those successful transition/scroll sequences.
The original macOS skip trigger and overlapping failure frame remain documented in
[the failed 749bc0c receipt](../ci-749bc0c/README.md); this green run does not rewrite it.

## Image review

**All 185 unique PNGs reviewed through 16 contact sheets; 63 targeted originals opened
at full size and retained.** Linux: 92 unique / 276 copies. macOS: 93 unique / 277 copies,
including the one packaged-smoke renderer. All 553 members reconcile by SHA-256:
184 test images have three copies each; smoke has one. [Image map](images.json) records
all copies, names, dimensions and contact sheets; [target map](target-images.json) records
the unchanged original PNG bytes. Contact JPEGs are labeled, resized review aids.

- Both OSes, all fourteen memory captures: refused Add keeps its exact readable draft;
  refused/partial deletion keeps surviving rows with failure feedback; accepted deletion
  shows the empty state. Pending owner views expose no previous-owner memory. **Existing
  incomplete loading labels (`settings`, `What remembers`) and ellipsized wipe helper
  text remain visible.** Passing persistence/race assertions are stronger than the stills.
- Provider captures at 960/1024/1440 in both themes: saved `WXYZ` hint, full model name,
  `100K context · $1 / $2 per 1M` and capability badges are readable. Narrow badges wrap;
  wide rows remain inline. The test checks the first matching reasoning-model row;
  dedicated narrow provider-detail model-row coverage is not established here.
- French terminal, both OSes: localized exit/truncation notices and original English
  output lookalikes are visible. Long command/output lines use horizontal scrolling;
  macOS's transcript command label is ellipsized. Engine/output/replay assertions pass
  with a local fake inference provider, not authenticated remote inference.
- Approval refusal copy and Retry remain legible. Work's narrow board wraps inside
  the pane; task refusal toasts stay above the composer; wide Kanban captures retain
  four columns. These stills show their captured states, not every scrolling position.
- Contact review still shows narrow Code draft prefixes and stacked `Message not sent`
  / `No model available` toasts with overlap. This receipt is not full presentation approval.

## Package, smoke and provenance limits

[Smoke log](logs/macos-smoke.log) records `Cortex cortex://app/index.html`, a live process
after ten seconds, shell text and `SMOKE OK`. [The 1440×900 renderer capture](images/macos/smoke-renderer.png)
shows the empty local Chat home. `screencapture -x out/smoke-screen.png` failed with
`could not create image from display`; the pinned smoke script catches that failure.
Thus the green step **does not prove native window chrome, menus or OS appearance pixels**.
The coordinator's installed-Mac recovery is a separate lot, not certified here.

| Artifact | Verified binding |
| --- | --- |
| Linux `11262189189`, 20,934,422 bytes | Downloaded outer ZIP SHA-256 equals API and upload log: `ca71dcfb0a55d6110bf11ab8e4189b7d3d1f38e09ed0467da551063e86bc5613` |
| macOS reports `11262444364`, 20,207,130 bytes | Downloaded outer ZIP SHA-256 equals API and upload log: `58bf8968ff968810b7f1c73f3d7e9f0d0e535ed872aeaddc29ceeab305e823c9` |
| Application ZIP `11262950335`, 144,627,076 bytes | API/upload-log digest agree: `c8eab98333d1107d79920b0676ce282be4b04fdccfdef3831a2a988e4fdb2a5b`. Coordinator downloaded it separately; **this audit neither downloaded nor opened its bytes** |

The report artifact contains one `.ips`: simulated **Setup Assistant**, dated
`2026-03-16`, not Cortex. Absence of a Cortex diagnostic is not a crash-free guarantee.
No Linux package/smoke or Windows job runs in this workflow.

Raw archives, complete reports/logs, member manifests, pinned source and the audit script
remain at `/tmp/opencode/recovery-ci-b0e6d78-review/`. This compact receipt retains API
metadata, source/report hashes, individual case outcomes, decoded attachments, selected
logs and images; it omits the reports' repeated full source diff and test-data databases.
[Review record](review.json) and `SHA256SUMS` describe and bind the retained scope.
Audit activity was API/download/hash/report/source/image inspection only: no application
build/test, CI rerun, native operation or commit.
