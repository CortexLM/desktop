# Projects — original CI artifact audit

**Bounded pass:** [CI 37130209247](https://github.com/CortexLM/desktop/actions/runs/37130209247),
application **`8e3fd795b699c8ff07357544421d00f34dc2823c`**; all three jobs successful.
**Later known defect:** accepted 48-character unbroken names/4,000-character unbroken instructions
overflow at this pin; coordinator correction tracked separately under `/tmp/opencode/projects-wrap`.
This original audit excludes that correction; the full six-proof objective remains open.

## Derived results

| Evidence | Linux | macOS |
| --- | ---: | ---: |
| Electron cases / attempts / passes | 116 / 116 / 116 | 116 / 116 / 116 |
| Registered theme/state render visits | 426 | 426 |
| Retries / skips / flaky / unexpected / runner errors | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Workers / duration | 4 / 216.336074s | 1 / 642.758013s |
| PNG copies / unique PNG and RGBA images | 469 / 155 | 470 / 156 |

Counts derive from both complete raw reports, including `rendered 426 screen states` stdout;
426 means render visits, not 426 screenshots. Lint/types pass. Units: **252 passed + one optional
real-backend skip**, 23 files, including seven new Projects server-contract cases.
i18n: **65 files / 2,275 used keys / 3,405 English keys / zero problems**.
[Reports and summaries](e2e-summary.json), [cases](cases.jsonl), [checks](checks-summary.json).

## Run, archive and source binding

| Artifact | Bytes | Independently verified ZIP SHA-256 |
| --- | ---: | --- |
| Linux `11275989759` | 34,216,579 | `11548b473f13e253e78a2d0b27108bed2df50213b0216e28cdc52f6341b0e7b9` |
| macOS `11276134891` | 33,109,070 | `9cebd1aed415bc8234276768638786421279215e84944f4decc4b4a1fd2c045a` |

Both raw ZIPs match API metadata and upload-log digests; CRC, unique safe paths and every extracted
byte verified: **473 Linux / 475 macOS files**. Both disk reports and **118 embedded JSON attachments**
parse successfully. Original archives/extractions remain in `/tmp/opencode/projects-ci-37130209247`.
All three checkout logs and both reports identify **`f8751ae242704b9b9d679ec9f5e1d842fbc6730e`**.
That merge object is unavailable locally; its exact tree equality remains **unproved**.
Application tree: `c32c6daa99b56d5936c08bf05b5404847c58c84b`; coordinator owns missing-object resolution.

Verified against Git `8e3fd79` and `/tmp/opencode/build-projects-production`: **515 frozen inputs /
473 renderer inputs / 90 build members**, exact frozen file-set and byte hashes.
Renderer fingerprint: `6070fc3282e019c04a29f6a2a68f36f029c56e7813c4aecd84cba46f071a5bb4`.
Main SHA-256: `e838b642a59244b22296ab2f2506c4d02aa6d6b8fd59c9675f8ec655273203f7`.
All **30 prior E2E files** are unchanged from `99e3d04`; Projects adds three cases.
Pinned Projects test: **363 lines**, SHA-256 `a2d30f707d733e1dff8302404f3b2f01860da7fcf491bf75dc031058c09d8c9d`.
Later working-tree CSS/test edits are not inputs to this audit. Test artifacts contain no ASAR/main
bundle; package byte equality and installed-native checks remain coordinator-owned.
[Archive binding](downloads.json), [checkout binding](checkout-binding.json), [source delta](source-change.json).

## Projects assertions and semantic image review

Per OS, two theme cases exercise duplicate names with exact IDs, two Electron restarts, instructions
in actual fake-provider requests, rejected-send draft retention/session reuse, edit Cancel/Save,
move/detach, filtered history, Search/Library identity, sidebar keyboard/inert behavior and atomic
delete preserving chats. Third case covers pending duplicate saves, newer drafts, stale-owner
reads/writes, real validation refusal and Library Retry. Page/console error assertions pass.
[Source-bound assertion map](project-checks.json).

Inspected **all 311 unique images on 26 contacts**, plus **32 full-size originals**:
**16 Projects** (create/overview/saved instructions/grid, both themes/OSes), **16 auth locales**.
Projects show `Café preparation`, Rocket/Orange selection, `1 chat`, `Prepare the project handoff`,
`Not available yet`, `Use the updated amber instructions.`, `Instructions saved`; persisted grid
shows the surviving `0 chats` card plus detached chat in Recents. Labels/actions are visible;
saved toast clears the instruction card. Scope: twelve 960×640 Project frames, four 1440×900 frames.
Contact-only non-targets retain qualifications: decorative email-login logo clipping, toast
overlap/stacks, narrow Code placeholder truncation and scrollport crops.

Retained **230 new lossless WebPs**; reused **81 full-image RGBA-exact CI99 canonicals**, with verified
prior canonical SHA-256, dimensions and RGBA hashes. Every PNG copy/alias/hash remains indexed.
Against same-OS CI99: **306 comparable aliases / 81 exact / 176 sidebar-only / 49 other drift**.
Project navigation legitimately changes the live sidebar; causes of the other 49 remain unknown.
[Image index](image-index.md), [compact hashes/provenance](images.jsonl), [visual review](visual-review.json).

## Auth locales, fonts and remaining limits

All **16 locale frames** differ only within sidebar bounds `[78,382,317,500]`; each auth pane
`[337,0,960,640]` is decoded-RGBA exact to CI99. Localized headings, code cells, error/actions,
Cancel focus and actual CJK glyphs were inspected full-size. Entire frames are **not** exact.
Per OS: **48 primary states / 80 measurements / 384 readable text rows / 144 reachable Tab stops /
12 passing glyph-weight probes**. Ninety-six decorative OTP cells are not pointer hit targets;
keyboard controls remain reachable. Linux fonts: **87 patterns / 61 files**, inventories exact to CI99,
`fonts-noto-cjk 1:20230817+repack1-3`. Translation accuracy/regional glyph preference not reapproved.
[Locale drift](locale-image-drift.json), [locale observations](locale-summary.json), [font inventory](font-inventory-comparison.json).

CI packaged process/window/renderer smoke passes; native display capture **fails**:
`could not create image from display`; `screencapture failed: Command failed: screencapture -x out/smoke-screen.png`.
Cause unknown; no `smoke-screen.png`. Renderer smoke is not native acceptance.
Only `.ips`: simulated **Setup Assistant**, 2026-03-16, **EXC_GUARD / WEBKIT**, same bytes as CI99.
No Cortex diagnostic is not a crash-free claim. Historical capture/glyph/drift negatives remain open
within their original scope. Controlled fixtures prove no real Cloud account or remote inference.
Raw reports retained gzip; scoped log excerpts preserve original line numbers and capture errors.
No network, builds, app/test reruns or new captures performed. Verify retained receipt: `python3 evidence/projects-followup/ci-8e3fd79/verify.py`.
[Diagnostics](smoke-and-crash.json), [audit](audit.json), [retention](retention.json), [SHA256SUMS](SHA256SUMS).
