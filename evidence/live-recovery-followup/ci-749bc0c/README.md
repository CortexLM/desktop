# CI 37088533094 — failed recovery revision

**Overall FAIL.** [Run / attempt 1](https://github.com/CortexLM/desktop/actions/runs/37088533094)
reports `completed/failure`; API last update `2026-10-03T02:14:29Z`. This receipt applies only to:

- Head `749bc0c035391d72aeafb4b5ce39cc0aa5342830`.
- Checkout merge `e12ef51a418176d17f96ec66ef3c5c2c541fc7f9`, confirmed in all three checkout logs and both Electron reports.
- Identical head/merge tree `91ded82786a3995b1c834e5ffd142901206444a0`.

## Results

| Job | Observed result |
| --- | --- |
| Checks, `ubuntu-latest` | PASS: lint, typecheck; 16 unit files, **188 passed / 1 optional real-backend skip**; i18n: 63 files, 2269 used keys, 3398 English keys, **0 problems** |
| Linux, `blacksmith-4vcpu-ubuntu-2404` | Build PASS; **83/83 Electron cases passed**, four workers; 426 registered state/theme renders and copy checks passed |
| macOS, `blacksmith-6vcpu-macos-26` | Build PASS; **82 passed / 1 failed of 83**, one worker; 426 registered state/theme renders and copy checks passed |
| macOS package / packaged smoke | **Both SKIPPED. No package artifact, new application ZIP, ASAR or packaged-smoke proof from this run.** |

Each OS report contains exactly **83 test attempts**, all `retry: 0`: no E2E retries,
skips or flaky cases. macOS is 82 passes plus one failure, not 82 tests or a retry pass.
Both reports have zero runner-level `errors`; the macOS case records one page-error
assertion failure. The 426 renders are iterations inside one case per OS, not 426
screenshots, interaction passes or design approvals. Unit skip condition:
`CORTEX_TEST_BACKEND_URL` absent; no authenticated inference proof.

## Failed Work case

`work-scroll.spec.ts` → `Work initial scroll settles after fonts without taking back user control — dark`.
Final `expect(errors).toEqual([])` at pinned line 139 received `["Transition was skipped"]`.
All five preceding steps completed without a final geometry/assertion failure:

- Cold fonts: height 1069→1051, viewport 659, top 410→392; final bottom gap **0**.
- Warm remount: top 392, height 1051, viewport 659; final bottom gap **0**.
- User wheel: top **230 before/after** font readiness; remaining gap 162; subsequent wheel assertion passed.
- Variant change: top 179→162, a 17px change inside the 40px bound.
- Departure/remount: final top **0** assertion passed.

`failed-trace-findings.json` retains two intermediate `expect.poll` misses at lines
107/115, their successful parent completions, all five completed steps and the final
failure. These polling samples are not test retries or extra failed cases.
The nine-member trace contains `test.trace`, sources and attachments; no browser
trace/network stream. Its Work source matches the pinned source hash. It does not
identify the application rejection emitter or establish how long the visual overlap lasted.

The original [failure image](images/macos/test-failed-1.png), 1360×840, visibly combines
Work board and task content, including overlapping headings/composers. This negative
frame remains retained; successful geometry does not make it a clean visual pass.

## Image review

**All 185 unique PNGs reviewed through 16 contact sheets; 43 targeted originals opened
at full size and retained.** Linux: 92 unique / 276 copies; macOS: 93 unique / 278 copies.
All 554 extracted PNG copies reconcile by SHA-256: 184 images have three copies;
the failed frame has two. The trace embeds that same failed PNG; it adds no unique image.
`images.json` maps every image to its contact sheet and artifact members;
`target-images.json` maps the retained originals. Original PNG bytes are unchanged;
contact sheets are labeled, resized review aids.

- Memory, both OSes/themes at 960×640: refused-add draft remains legible; single-delete and partial-wipe survivors remain with failure copy. Accepted deletion shows the empty state and success toast.
- Eight passing memory cases per OS assert real-route `404/not_found` refusals, exactly one `201` after held duplicate Enter/blur, owner-bound drafts/reads, single-delete serialization, partial-wipe survivors and accepted Retry. Hooks control request paths/timing; engine replies are not fabricated. Screenshots prove their captured state, not those request counts.
- Pending-owner captures expose no previous-owner memory. Visible loading copy remains incomplete (`settings`, `What remembers`); narrow wipe helper text is ellipsized. No full presentation approval.
- Approval refusal: readable recovery heading/body and `Try again` at 960×640. Passing tests restore the actual pending permission on Retry, then verify its removal after abort. The refusal screenshot alone does not prove that sequence.
- Provider/model rows: saved `WXYZ` hint, `100K context · $1 / $2 per 1M` and capability badges are readable in both themes at 960×640; badges wrap below metadata. CI source checks first matching-model row geometry at 960/1024/1440. Dedicated narrow provider-detail-row coverage is not established here.
- Code refusal: composer displays only a short draft prefix; stacked `Message not sent` toast covers part of `No model available`. Retention assertions pass; these captures retain the presentation residuals.
- French terminal: both 1440×900 originals show localized exit/truncation annotations plus unchanged English output lookalikes. Passing local-fake tests verify stored output and model replay; this is source-build coverage, not installed-Mac or real-provider proof.

## Artifact provenance and limits

| Artifact | Binding |
| --- | --- |
| Linux `11261019492`, 20,929,886 bytes | Downloaded archive SHA-256 equals API and upload-log digest: `cdcdac54b6f4390ecbc9888ef486da88167f4637e2d05bc8bce2c62d95bda931` |
| macOS `11261149881`, API size 21,202,080 bytes | API equals upload-log digest: `611fe87c541c8354d219b93ff800376378e3d3237c4a4ed7ac4a6a2e76a9e323`. **Downloaded outer-ZIP hash unverified**: reused coordinator's extracted cache; no duplicate download |
| Failed trace, 157,737 bytes | SHA-256 `1de20105a8ce5b5a1d96aecaef40391b96bde5597cc3915f13f6084d58acfcf5`; retained at the cache path in `artifact-binding.json` |

Raw Linux artifact, complete 47-file log archive, pinned test/workflow sources and
audit scripts remain in `/tmp/opencode/recovery-ci-749bc0c/`. macOS cache remains
`/tmp/opencode/live-recovery-ci-failed-mac/`. Reports, API metadata, log excerpts,
failed-step log, member manifests, trace findings and selected images are retained here.
The API lists only `e2e-linux` and `macos`; the latter is a test-report artifact, not an app package.
`review.json` records the review scope; `SHA256SUMS` covers this retained receipt.

The cache contains one `.ips`: simulated **Setup Assistant**, dated `2026-03-16`,
not a current Cortex crash. Its presence is recorded in `artifact-binding.json`;
absence of a Cortex diagnostic does **not** establish a crash-free run. No smoke image
or smoke result exists in this cache.

Audit activity: metadata fetch, one Linux artifact download, existing macOS cache review,
source-pin/report/trace/hash validation. No CI rerun, application tests, builds or Mac
operations. Working-tree App/shell/navigation source was not read or modified.
Full installed-Mac native capture review remains a separate pending lot at this handoff.
Any later application transition correction needs its own revision-bound receipt;
it cannot turn this failed `749bc0c` run green.
