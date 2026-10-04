# Projects wrapping — final CI artifact audit

**Scoped pass:** [CI 37132419774](https://github.com/CortexLM/desktop/actions/runs/37132419774),
application **`f82a64800c0fffd6ebaa99e571a8af0fa4307095`**; all three jobs successful.
The unchanged long-input regression now passes both OSes. Original `8e3fd79` acceptance stays
bounded by its reproduced overflow; package/native acceptance and the full six-proof objective
remain separate deliveries.

## Derived results

| Evidence | Linux | macOS |
| --- | ---: | ---: |
| Electron cases / attempts / passes | 118 / 118 / 118 | 118 / 118 / 118 |
| Registered theme/state render visits | 426 | 426 |
| Retries / skips / flaky / unexpected / runner errors | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Workers / duration | 4 / 215.384873s | 1 / 642.413227s |
| PNG copies / unique PNG and RGBA images | 475 / 157 | 477 / 159 |

Counts derive from both complete reports, including `rendered 426 screen states` stdout;
426 means visits, not screenshots. Lint/types pass; **252 units + one optional real-backend skip**,
23 files, including seven unchanged Projects contract tests. i18n: **65 files / 2,275 used keys /
3,405 English keys / zero problems**. Both disk reports and **118 embedded JSON attachments** parse.
[Reports](e2e-summary.json), [cases](cases.jsonl), [checks](checks-summary.json).

## Archive and exact source binding

| Artifact | Bytes | Independently verified ZIP SHA-256 |
| --- | ---: | --- |
| Linux `11276384899` | 34,608,916 | `a5fd9482182f460108af860995cdc6691710df98d0aee5f23b1a199be308c6d2` |
| macOS `11277168889` | 33,529,617 | `034e5fa697b704196e0100d864e60510bd6fbad57c6345e35debb8dfb52e7d21` |

ZIPs match metadata/upload digests; CRC, safe unique paths, extracted file sets and every byte
verified: **479 Linux / 482 macOS files**. Raw archives remain under `/tmp/opencode/projects-wrap-ci-37132419774`.
All checkout logs/reports identify **`2e52e4480ad36e955c8a62aa865bd777e96de252`**.
Coordinator-supplied API response SHA-256 verified; its signed commit body reconstructs to that
exact Git object SHA-1 offline. Checkout/application trees both equal
**`bac9586cccd8ee5dc152f86ac68e53c14a228b2b`**. No Git-object import/network needed.

Verified **515 frozen inputs / 473 renderer inputs / 90 build members**, including exact file set,
against Git `f82a648` and `/tmp/opencode/build-projects-wrap`.
Renderer fingerprint: `2230ff6f2deeee6b9d2b7eff21e96f152c193e15dfa824080721b3d1853d4464`.
Frozen main: `e838b642a59244b22296ab2f2506c4d02aa6d6b8fd59c9675f8ec655273203f7`.
Test artifacts have no ASAR/main; CI package equality remains separately owned.
[Downloads](downloads.json), [checkout proof](checkout-binding.json), [input pins](provenance/input-pins.jsonl).

## Failure-to-pass binding

Production delta from `8e3fd79`: exactly **four CSS rules, +4/−2, two files**. No runtime JS,
dependencies, engine contract, workflow or worker configuration change. Projects test adds
**43 lines / two cases**; original **363-line prefix** and **30 other E2E files** remain exact.
Final **406-line** test matches archived failing test SHA-256
`899a1ae786d68645117d4bd0c9d6d1be413850a3b5bc3f2ab195f9abe319eef3`.

Original baseline: **two failed cases / eight errors**, four per theme: preview, Overview,
Instructions, then hard capture overflow. First three-rule correction: **three passes / two
failures**, only capture overflow remains; retained images show the toast name escaping right.
Final delta from that candidate changes only `.toast .t-body` sizing/wrapping. Same test passes
**five Projects cases per OS**, including both long-input cases; no retries/assertion weakening.
Both final runs reach grid/Library checks after the earlier stop at capture line 396, then verify
the original 4,000-character stored instruction. Historical reports/images retain their failures.
[Source delta](source-change.json), [negative results](negative-results.jsonl), [failure-to-pass](negative-to-positive.json).

## Image review and exact reuse

Inspected **all 316 unique images on 28 contact sheets**, **20 full-size Projects originals**
(ten/OS: eight original states plus light/dark long-input), plus four historical negative frames.
Short states show `Café preparation`, selected Rocket/Orange, `1 chat`, retained handoff chat,
saved amber instructions and the surviving `0 chats` grid card. **15/16 short Project frames**
are RGBA-exact to `8e3fd79`; macOS dark creation changes **12 color-control pixels**, cause unknown.
All target labels/actions were reviewed, not merely geometry.

Long-input frames: 48-W heading wraps onto three lines; New chat stays separate; Instructions/Edit
remain visible; instruction lines wrap horizontally; `Project created` description wraps within
the toast. **Frame limits:** lower instructions extend below the scrollport; the temporary toast
overlaps some visible rows; sidebar name ellipsizes. Long-input creation/grid/Library have passing
containment/text assertions, no separate CI frames. Complete vertical readability is not proved.

Retained **52 new lossless WebPs**; reused **264 full-frame RGBA-exact prior canonicals** with
verified dimensions/SHA-256/RGBA bytes. Same-OS aliases: **322 compared / 274 exact / 48 changed**;
no blanket drift cause assigned. Historical non-target logo clipping, toast stacks/overlap,
narrow Code placeholder truncation and scrollport crops retain their qualifications.
[Image index](image-index.md), [all hashes](images.jsonl), [visual review](visual-review.json).

## Locales, smoke and scope

All **16 auth-locale PNGs and decoded RGBA frames exactly match `8e3fd79`**; its hash-bound
full-size copy/CJK review is inherited, with current contact review. Per OS: **48 primary states /
80 measurements / 384 readable text rows / 144 reachable Tab stops / 12 passing glyph probes**.
Linux **87 font patterns / 61 files**, font/package inventories exact to prior CI.
[Locale inheritance](locale-review-inheritance.json), [locale observations](locale-summary.json).

Packaged process/window/renderer smoke passes; native capture fails with `could not create image from display`
and `screencapture failed: Command failed: screencapture -x out/smoke-screen.png`; cause unknown,
no display image. Only `.ips`: simulated **Setup Assistant**, 2026-03-16, **EXC_GUARD / WEBKIT**,
same historical bytes. No Cortex diagnostic is not a crash-free claim. Renderer smoke is not native
acceptance; fixtures establish no real Cloud account/remote inference. Frozen comparison remains separately owned.
Full raw reports retained gzip; scoped logs retain original line numbers/errors. No new capture,
build, app/test rerun, network or source edit. Receipt check: `python3 evidence/projects-followup/ci-f82a648/verify.py`.
[Diagnostics](smoke-and-crash.json), [audit](audit.json), [retention](retention.json), [SHA256SUMS](SHA256SUMS).
