# Work Activity — final CI artifact audit

**Scoped pass:** [CI 37145831654](https://github.com/CortexLM/desktop/actions/runs/37145831654),
application **`9ba8e59fbec8c1f38f93ace25414d4a3489aede3`**; three successful jobs. Offline review.
Full goal incomplete; matching package/native acceptance belongs to the coordinator.

## Derived results
| Evidence | Linux | macOS |
| --- | ---: | ---: |
| Electron cases / attempts / passes | 132 / 132 / 132 | 132 / 132 / 132 |
| Registered theme/state render visits | 426 | 426 |
| Retries / skips / flaky / unexpected / runner errors | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Workers / duration | 4 / 229.481008s | 1 / 724.028967s |
| PNG copies / unique PNG and RGBA images | 547 / 181 | 549 / 183 |

Reports/stdout derive counts; 426 means visits. **260 units + one optional real-backend skip**, 24 files.
Lint/types/i18n pass: **67 files / 2,279 used keys / 3,419 English keys / zero problems**; **132 JSON attachments** parse.
[E2E](e2e-summary.json), [cases](cases.jsonl), [checks](checks-summary.json), [JSON validation](attachment-validation.json).

## Exact artifact and source binding
| Artifact | Bytes / extracted files | Independently verified ZIP SHA-256 |
| --- | ---: | --- |
| Linux `11281234763` | 39,215,269 / 551 | `2d48843a55cfa32e1a5e09437333ec13b316f687150e17122b92187b8f2e37bb` |
| macOS `11283070526` | 38,018,345 / 554 | `e18c8210872a8e127c737b7b2a103650c62b6e2350e2a5642c61bfa517a6db8e` |

Metadata/upload digests, CRC, safe unique paths and every extracted file/byte verified.
All job logs/reports name checkout **`10c98bdd34f4fe1e7ff38f8cf1c921bb52ef8cbb`**. Coordinator raw
Git API payload reconstructs that exact signed commit-object SHA-1 offline. Its tree equals head:
**`d45d569a2526da17d64a16cd56a9b5bac073c968`**. GPG signature itself was not revalidated.

Complete **517 inputs / 475 renderer inputs / 90 build members** verified against Git `9ba8e59`
and `/tmp/opencode/build-work-activity`; historical production sets/bytes match. Renderer fingerprint
`a4a815bac24ce5f509f813d06371b8a754908b4b472c3d786f1325dbed53b8df`.
Frozen main/preload exactly match `96df66c`. Local receipt reports ASAR
`22760335b8eef317c2c325cde1a7d4c09ecb888780226aaeb0e8ae4353a4bf26`; binary/package admission is separate.
[Downloads](downloads.json), [checkout proof](checkout-binding.json), [input pins](provenance/input-pins.jsonl).

## Final assertions and retained negative history
**33 existing E2E files unchanged**; six new Activity behavior cases plus one locale case.
Engine/IPC/dependencies/workflow/workers unchanged. Final **211-line** behavior test is
`d98c9205c5dbddfe349a06a4271b4a2a1c135248cf84817705b6d81e11916744`.
Both full CI runs execute exact-query `/api/sessions?kind=bot` held-read retirement, unfiltered
non-resurrection, Activity-owned header continuity and actual canceled-preview URL assertions.
Three saved-row comparisons retain exact equality through `useInnerText:true`.

Previous `96df66c` baseline: **six failures**, five first missing-row/one first missing-source-error
assertions; downstream identity/restart/race checks were not reached. Original `0166d765…` stays retained.
Initial new-app target: **5/7 pass**, two text-reader mismatch failures at line 109; not evidence of lost
outcomes. Local **132-case** full pass used narrower `5740841a…`; later strengthening cannot be inherited
by that run. Separate final **6/6** and these CI runs use `d98c9205…`, on the same application inputs.
Locale baseline stops at missing scope copy with **zero measurements**; its older `d40d9be0…` source
remains distinct from final clipping-aware `bfda7f43…` and its passing 112 measurements/OS.
[History](historical-results.jsonl), [negative binding](negative-to-positive.json), [test delta](provenance/full-to-final-test.diff).

Real IPC/engine persistence covers finished success, HTTP-200 SSE failure, API abort, successful routine,
earlier outcome during follow-up/reload, deliberate SIGKILL restart, exact Bot/session identity,
40-root selection before filters, source Retry and stale deletion/ownership. Locale failure uses
HTTP 400. **All prompts use IPC**, while filters, Retry and row navigation use UI. No real Cloud inference.
The cap bounds history fan-out, not list/history bytes. Outcomes describe historical turns, not fulfilled
tasks. Private fixture sentinels stay out of the feed; underlying history is not erased.
[Coverage/bounds](activity-checks.json), [43 calls/6 real 404s per OS](source-refusals.json).

## Images and locales
Inspected **364 unique images / 32 contacts / 24 primary full-size Activity originals**: eight dark
populated locale frames plus four English lifecycle/restart frames per OS. Twin ordinals and orange/
violet mascots distinguish owners; 80-W titles wrap, timestamps stay separate. Restart frames retain
four historical outcomes, Café now Failed. CJK glyphs visibly render; fixture names remain English,
sidebar names ellipsize. No filter-menu or neutral Work-target screenshot: final assertions cover them.
Five additional current drift frames and two historical empty-screen negatives opened full-size.

Retained **72 new lossless WebPs; 292 exact prior canonicals**. Full decoded RGBA bytes/dimensions and
canonical hashes verified; ultimate paths preserved. **350 common aliases: 302 exact / 48 changed**.
All **16 Memory locale** and **16 auth-locale PNG/RGBA frames** exactly match `96df66c`; reviews inherited.
22/24 prior primary Memory frames are exact; two Linux light frames differ by six chrome pixels each,
opened full-size. Other drift has no assumed cause; toast overlap, logo crop, Code truncation and
scrollport limits retain qualifications. [Image index](image-index.md), [review](visual-review.json).

Activity per OS: **16 empty + 16 populated locale/theme states; 112 measurements / 304 text fragments**,
all clipping/width checks pass. Locale photos show dark populated states only; no native-speaker or
contrast certification. Seven new keys per locale; prior catalog values unchanged. Auth per OS retains
48 states/384 text rows/144 reachable Tab stops/12 passing glyph probes; Linux fonts: 87 patterns/61 files,
exact prior inventory. [Activity geometry](activity-locale-summary.json), [inheritance](inherited-fullsize-reviews.jsonl).

## Smoke and integrity
Unsigned arm64 Mac process/window/renderer smoke passes; native capture **fails**, cause unknown:
`could not create image from display`; `screencapture failed: Command failed: screencapture -x out/smoke-screen.png`.
Only diagnostic: historical simulated Setup Assistant **EXC_GUARD / WEBKIT**, same bytes; no crash-free proof. Intentional callback errors remain fixtures.
Full reports/log retained gzip; no audit app tests/builds/captures/network/source edits.
Check: `python3 evidence/work-activity-followup/ci-9ba8e59/verify.py`.
[Audit](audit.json), [retention](retention.json), [diagnostics](smoke-and-crash.json), [SHA256SUMS](SHA256SUMS).
