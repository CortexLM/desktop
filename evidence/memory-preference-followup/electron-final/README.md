# Memory preference — final local artifact audit

**PASS within retained production Linux scope.** Raw reports independently confirm **125/125 full cases**, **426 render visits**, **293.094633s**; corrected targeted run **21/21**, **24.173828s**. Exactly125/21 attempts; zero retries, skips, flaky outcomes, unexpected results or report errors. Audit ran offline integrity/image checks only.

## Tested bytes
- Original run: dirty `74579d574646aff5dbd462247b4fd47a99dd2cdd`. Original `../final/` manifests remain unchanged; updated temporary manifest headers are later attribution, not a clean-checkout retest.
- Independently verified **all516 frozen/current package inputs against Git `96df66ce727c42ddf647b2dcb4eeeff04fda4927`**, **474 renderer inputs**, **90 frozen/current dist members**. Checks enumerate actual path sets, reject duplicates/missing/extra files, then hash every member. [Binding](binding-before.json), final readback in `binding-after.json`.
- Renderer fingerprint: `64a314be9950c61466f8beec1b1ef50aa7f5b60a7f67d67bc3deff805a5800ef`.
- Linux ASAR: `b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44`; all90 build entries independently extracted/hashed. Archive has91 entries including packaged `package.json`; [map](asar-members.json).
- Initial candidate renderer `30ec7f97fb1de75ba4dc66fa81a4dfba0e76cd16008bfa53600d7ca512b810fb` remains separate. Of516 inputs, only `packages/app/src/state/runtime-settings.ts` differs: **+18/−10**, final SHA-256 `a441e7e520e803c49f1fb5a5755c8e2cb0efed9dcdb4f30ce284a789f44e8c00`. Main/preload and maps are byte-identical; engine inputs unchanged. [Source comparison](source-change.json).
- `tests/e2e/runtime-settings.spec.ts`:278 lines/six cases, SHA-256 `a3749931aa28b459844b9c4ab24bb52d8762a079210a379de524416624acffe8`; unchanged between navigation failure and final passes. Original218-line/five-case `47b4b17a…` is an exact prefix;60 lines appended. Test/source snapshots retained under `source/`.

## Actual image inventory and review
| Run | Filesystem PNG copies | Inline PNGs | PNG attachments | Unique images |
| --- | ---: | ---: | ---: | ---: |
| Final full | 342 | 4 | 175 | **169** |
| Boundary targeted | 52 | 0 | 26 | **26** |
| Combined | 394 | 4 | 201 | **173** |

- All173 unique frames inspected across **15 contact sheets**. **12 full-size original PNGs** inspected: eight dark Memory locale frames, four English Memory/Privacy frames across both themes; every target960×640. No new visual blocker observed. [Target notes](fullsize-targets.json), [contact notes](contacts.json), [visual disposition](visual-review.json).
- Paused descriptions, manual-add empty copy, banner and focus ring fit; CJK glyphs appear populated; saved-note cards/delete/export remain visible. English Privacy description wraps clear of its switch. Existing shell/composer/refusal/recovery states remain coherent at contact scale.
- **148 canonical reuses**:100 from Projects `ci-f82a648`,22 from prior local Projects,26 from this feature’s targeted archive. **25 new lossless WebP**,803,438 bytes. Each reuse/new image independently decoded and compared for identical full-size RGBA. [Per-row PNG/RGBA hashes and aliases](images.jsonl), [index](image-index.md).
- Targeted contributes four distinct frames; each differs from its final counterpart by only6 or12 pixels in small chrome/rail bounds. Exact differences retained in [targeted drift](targeted-image-drift.json); causes unassigned. Four inline approval PNGs are included in the169, not lost in filesystem counting.
- **14 existing Memory-safety before/after pairs** reviewed across four additional comparison sheets. Five RGBA-exact; four copy-changing frames reflow title/empty text and following content; five others differ12–28 pixels. Controls remain contained. **No blanket unchanged-geometry claim.** [Comparison ledger](safety-comparisons.json).

## Behavior established by these artifacts
- `runtime-settings.spec.ts:81–136`: real renderer/IPC, two isolated Bots, persisted off across one same-profile restart per theme, exact retained note/history equality, manual Add while paused, keyboard re-enable. Four captured fake-provider system payloads per theme prove own-note on, notes absent/persona retained off, manual paused note restored on, no Bot-note leakage into ordinary Chat. [Payload checks](behavior-checks.json).
- `:139–217`: no-Bot defaults, preview isolation, engine-value precedence over legacy import, real400 refusal/retry, one pending PUT, stale GET rejection after events/navigation, real404 read recovery. These are real engine responses through controlled IPC faults, not fabricated success responses.
- `:220–278`: canceled-preview regression’s held GET/PUT now restore visible enabled controls matching engine true/false without remounting the owner. Final raw receipt shows both positive phases; [before/after observations](navigation-comparison.json).
- Memory localization records **64 states/112 text rows per run**: eight locales ×two themes ×enabled/paused/Privacy/Bot-empty. Every recorded ink bound/scroll-width assertion passes. Eight dark screenshots reviewed full-size; geometry assertions also cover light states. [Locale summary](locale-summary.json). Auth’s separate12 glyph-raster weight checks pass; not relabeled as Memory font probes.
- `screens.spec.ts` stdout explicitly says `rendered 426 screen states`; source checks nonempty text, raw keys and page errors. **426 visits are not426 screenshots or426 live workflows.**
- Both final reports have zero result errors/stderr. Observed unexpected renderer-error/network fields are empty; navigation intentionally injects **three callback errors per run** with three corresponding rejection records. Expected400/404 refusal responses remain evidence, not application crashes. [Error observations](error-observations.json).
- Initial candidate logs: **260 units passed/one optional backend skip**,24 files; i18n66 files/2277 used keys/3412 English keys/zero findings. Final engine/main bytes match that candidate; no final unit rerun claimed. Final lint/typecheck logs contain no diagnostics; exit0 is coordinator-supplied. Matching Linux package receipt says `SMOKE OK`; no fresh launch or OS crash inventory. [Checks](checks.json).

## Original negatives retained
- Actual `f82a648` cosmetic collector records Privacy localStorage=`false`, Memory still checked, Memory checked after reload. Its initial accessible-name failure remains separate. Collector proves UI preference mismatch/remount reset; it did not send a provider turn.
- Five new tests against old `f82a648` fail: two GET `/api/settings`404, one unchecked live `?v=off`, two missing engine-write gate timeouts. They are **not five identical reproductions** of the cosmetic defect.
- Initial14-targeted/124-full green candidate lacks the appended regression. Later single navigation case fails **two assertions**: missing control after held GET; checked/disabled after accepted false PUT. Same test passes after the one-hook correction, in both21-targeted and125-full runs. [History](historical-attempts.json), [raw-report links](reports.json).

## Recheck and scope
`python3 evidence/memory-preference-followup/electron-final/verify.py --local` verifies retained reports, negative/positive transitions, actual payloads, image pixels, complete source/build path sets, Git96 blobs and ASAR members without launching the app. Omit `--local` for retained-evidence verification after temporary originals disappear. Python/Pillow required; no installation/network performed.
Raw report/log gzip files already retained by the coordinator are referenced and byte-verified, not duplicated. [Retention](retention.json), `SHA256SUMS`, [offline check receipt](integrity.json).
Local artifact acceptance only. CI/native acceptance and final renderer lifecycle source-review disposition remain separately owned. No real Cloud account/inference claim, fresh browser capture, application test/build, network/CI/Mac access, source edit or commit by this audit. Personal cross-Chat memory, automatic learning and the full rewrite objective remain incomplete.
