# Appearance theme correction — CI artifact audit

**Scoped pass:** [CI 37124432902](https://github.com/CortexLM/desktop/actions/runs/37124432902),
all three jobs successful, application **`99e3d04a8dab6b51b6cf23bcdae0365624492e0f`**.
Both OSes pass **113 cases / 113 attempts / 426 registered render visits**, zero retries,
skips, flaky/unexpected results or runner errors. Both unchanged Appearance cases pass;
all **17 original failed assertions per OS** resolve. All prior 111 cases remain green.

## Revision and artifact binding

All three complete job logs and both reports identify checkout
`6d6cae30fea21f6177832be478a3913e71a3ef69`; its tree and application's tree equal
`648b60cffa6abe3255358766cb347ce0d6b16bd9`.
Verified **514 frozen inputs / 473 renderer inputs / 90 build members**, including exact
build file-set equality, against `/tmp/opencode/build-appearance-theme-final`.
Renderer fingerprint: `474405faaf26dba6319cb1c139f0b32ef04adf2b7e600d6edee37f72b4fabf44`.
Frozen main SHA-256: `f0fc4522cde726dd8b88dcbb56f4116ba93dc87e1e9e29163502d25e522512c7`.
This binds source and the frozen local receipt; it does not reproduce the build or establish
CI ASAR equality. Test artifacts contain no main bundle or ASAR.

| Test artifact | Bytes | ZIP SHA-256 |
| --- | ---: | --- |
| Linux `11274498985` | 32,303,783 | `08ce6960a3960e6f34be95e84fd90a0710e2d12fb7c299a3cf9f1ee809e365f1` |
| macOS `11274651210` | 31,280,372 | `f38ef6025cb34a45396445389c555b4ecacc9f92d472811e8c5000ca4e1da6c5` |

Each downloaded once; supplied/API/upload digests agree **before extraction**. ZIP CRC,
unique safe member paths verified: **451 Linux / 454 macOS files**. Complete log ZIP:
97,945 bytes, `d0e31b14e1ace4761000eee4fb837cc39750b1602bb68e6471c7cea36f260c0f`,
52 files; no API log-ZIP digest exists, so its recorded digest is locally computed.
Original ZIPs/extractions remain only under `/tmp/opencode/ci-99e3d04/`.
Package **11274389994** remains coordinator-owned; not downloaded or inspected here.
[Downloads](downloads.json), [checkout binding](checkout-binding.json), [source pins](source-pins.json).

## Source and historical failure binding

Production delta from `37c22c2`: **12 additions / 10 removals**, exactly three files:
`packages/app/src/screens/system/settings.tsx`, `packages/app/src/shell/nav.tsx`,
`packages/app/src/shell/shell.tsx`. CSS/catalogs unchanged; all **29 existing E2E files**
are byte-identical. Only `tests/e2e/appearance-theme.spec.ts` is new.

| Source | SHA-256 |
| --- | --- |
| Settings | `4f0b4f911195eb7e5a12dc22ff9e940f0cd67190ce9eb44ae7c99d6054c80461` |
| Nav context | `876682aef675ef9e0b1c5a3a59a49b00acbb1da84a7897f0dc17efa287579315` |
| Shell | `880240350484738971849dbabdfe591cd90471afc08fa0ffca02ef6f78a6ae67` |
| Appearance test, 93 lines | `2bff6928c640ef274363b00e3861027488fa1025d0087135a93ddbee061949ba` |

Test bytes exactly match the retained negative baseline and initial candidate.
Baseline has **nine light-start / eight dark-start failures** at lines `37,46,47,55,65,80`
(repeated arrow/System assertions retain separate occurrences). Dark-start Tab exit already
passed. Fresh hash/selected-card mismatch was **observed only**, not an eighteenth failure.
The baseline's original before/after receipts cover **512 non-Markdown inputs**, excluding
`packages/core/README.md` and `skills/summarize/SKILL.md`; that historical scope stays 512.
This CI audit independently verifies all **514** final frozen input entries.

Initial candidate failures remain separate: two cases stop at pointer setup `34`, storage
null; two existing keyboard cases pass. Exact candidate-to-final source comparison finds
only selected-card `onClick={() => { if (pref === x) setTheme(x); }}` added to Settings.
It restores explicit selection persistence without changing the regression test.
[Source delta](source-change.json), [historical binding](historical-source-binding.json),
[baseline failures](negative-baseline.json), [initial candidate](initial-candidate.json),
[negative-to-positive](negative-to-positive.json).

## Checks and actual observations

Lint/types pass; **245 unit passes + one optional real-backend skip**, 22 files.
i18n: **65 files / 2,272 used keys / 3,405 English keys / zero problems**.
Linux Electron: four workers, 208.985393s; macOS: one worker, 624.904701s.
macOS private-core HTTP units are not exercised by this workflow.

Each Appearance case reaches **nine stages**: 18 stages per OS, 36 across both OSes.
Every stage has one checked card, exactly that card as the sole main Tab stop, and matching
rail selection. Initial hash selects the requested card with null storage; selected-card
click writes the preference. Independent Right/Left arrows focus/select their adjacent
card and persist it. Passing unchanged line55 proves Tab exits to English; stage data
records no focused main radio, not a separate English-focus identity.

Rail Space selection updates the mounted main group to the opposite theme. System remains
selected/stored under both **emulated** OS schemes; reload retains System and dark HTML.
All Appearance page-error lists are empty; this test has no console/request listener.
Four arrows/full wrapping, physical OS changes and native main-card focus-ring proof belong
to the separate native helper, not these two CI cases.
[Appearance traces](appearance-checks.json), [case list](cases.json), [checks](checks-summary.json),
[prior Chat traces](chat-checks.json), [prior Bot traces](bot-checks.json),
[supplemental checks](supplemental-checks.json).

## Fonts and bounded image review

Linux provisions **`fonts-noto-cjk 1:20230817+repack1-3`**; complete job log and uploaded
inventory verify **87 patterns / 61 files**. Normalized fontconfig/package inventories
exactly match CI37. Actual Japanese/Chinese headings select Noto Sans CJK JP; Korean selects KR.
Per OS: **48 primary states / 80 measurements / 384 readable text rows / 144 reachable Tab stops**;
six font records, **12 passing glyph-weight checks**, zero glyph-failure PNGs.
All **16 locale PNGs** exactly match CI37 original PNG hashes and decoded RGBA: zero changed
pixels. All sixteen originals were inspected full-size; CJK glyphs are visible.

**896 PNG copies / 300 unique images:** Linux **149**, macOS **151** including renderer smoke.
All **26 contact sheets** inspected; all **20 required full-size originals** inspected:
two Appearance and eight locale views per OS. Retained **39 new lossless WebPs**, reused
**261 RGBA-exact canonicals**; no tolerance or overwrite. Original bytes/hashes, paths,
attachment aliases and exact canonical provenance remain mapped in [images](images.json).

Four Appearance originals show complete cards/labels, correct selected ring/dot, rail
selection, English and Display controls. Focus is visibly on the rail. The previously
clicked unselected card has elevated styling; pointer/hover state was not recorded.
These frames establish selection/readability, not native or main-card focus-ring acceptance.
Same-OS comparison against CI37: **303 comparable aliases / 50 changed** (Linux 26, macOS 24).
Causes remain unknown. One provider-dark image differs by **37 sidebar pixels**, bounds
`[78,272,317,395]`; the provider pane `[337,0,960,640]` is decoded-RGBA exact. Other eleven
provider follow-up views are exact. No additional full-size provider review was needed.

Historical decorative email-step logo clipping, toast overlap/stacks, narrow Code placeholder
truncation and scrollport crops remain qualifications. Translation accuracy, Chinese regional
glyph preference, frozen-reference fidelity and full-resolution non-target acceptance are
outside this review. Appearance's frozen-reference gap remains explicit.
[Image index](image-index.md), [visual review](visual-review.json),
[locale comparison](locale-image-drift.json), [font provisioning](font-provisioning.json),
[font inventory comparison](font-inventory-comparison.json), [font records](font-records.json),
[prior-image comparison](prior-image-comparisons.json), [provider disposition](provider-image-disposition.json).

## Native and historical limits

CI process/window/renderer smoke passes; **native display capture fails** with
`could not create image from display` and
`screencapture failed: Command failed: screencapture -x out/smoke-screen.png`.
Cause unknown; no `smoke-screen.png`. This is a failed capture, not proof of a blank UI.
Renderer smoke cannot replace native proof. Only retained `.ips`: simulated **Setup Assistant,
2026-03-16, EXC_GUARD / WEBKIT**; no Cortex diagnostic does not prove crash-free operation.
Earlier glyph failures, cancellations, capture negatives and unknown drift causes retain
their original evidence/dispositions. Controlled fixtures establish no real Cloud account,
remote inference, server revocation or full-product acceptance.

Original report/job-log/HTTP gzip and normalized whitespace-clean text retained here;
full ZIPs, pinned source and offline helpers under `/tmp/opencode/ci-99e3d04/`.
Local-final audit and installed-Mac proof remain separate deliveries.
No application/test/workflow changes, builds, test/CI reruns, Mac operations, owner posts or commits.
[Audit](audit.json), [retention](retention.json), [native diagnostics](smoke-and-crash.json), [SHA256SUMS](SHA256SUMS).
