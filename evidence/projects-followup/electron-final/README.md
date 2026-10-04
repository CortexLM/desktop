# Projects — production Linux artifact audit

**PASS within the recorded local scope.** Full Electron: **116/116**, 426 registered render visits, 284141.15ms; targeted production confirmation: **16/16**, 56659.348ms. Both raw reports contain one attempt per case, zero retries/skips/flaky outcomes, zero unexpected results or report errors. This audit executed no tests/builds/captures/browser/network/CI/Mac actions.

## Source and package binding
- Original runs used dirty base `0597848cdbdec362e1441b44c67bf74c525feefa`; their documentary manifests retain that identity. The coordinator subsequently committed identical inputs at `8e3fd795b699c8ff07357544421d00f34dc2823c`.
- Independent before/after hashing matches **515 package inputs**, **473 renderer inputs**, all **90 frozen/current build members**. All515 also match Git blobs at the later commit; this is byte binding, not a new clean-checkout run. See [binding](binding-after.json), [original dirty manifest](../production/pinned-inputs.json).
- Renderer fingerprint: `6070fc3282e019c04a29f6a2a68f36f029c56e7813c4aecd84cba46f071a5bb4`.
- Linux ASAR: `5a92b306afc07184af30404d3d04ae596554ea9800bf31e3a0e3f2fd5c74d9ad`; independently extracted/hash-checked all90 build members. Archive has91 files including packaged `package.json`; [member map](asar-members.json).
- `tests/e2e/projects.spec.ts`: **363 lines**, three cases, SHA-256 `a2d30f707d733e1dff8302404f3b2f01860da7fcf491bf75dc031058c09d8c9d`; current source, recorded test pin and later commit match. Source snapshots retained under `source/`.
- Baseline `99e3d04` comparison:14 production source changes plus one README input. Memory block, complete `ProjectPreview()` and System CSS remain byte-exact; [preservation](preservation.json). From the earlier Projects candidate, only sidebar source and the strengthened Projects test differ in the recorded source map; build environment also changes to production.

## Actual image coverage
| Scope | PNG files | Inline PNGs | PNG attachments | Unique images |
| --- | ---: | ---: | ---: | ---: |
| Full run | 314 | 4 | 161 | 155 |
| Targeted run | 76 | 0 | 38 | 32 |
| Combined, deduplicated | 390 copies | 4 | 199 | **156** |

Targeted adds one distinct auth-unavailable frame;31 images exactly match the full run. All156 unique frames were inspected through **13 contact sheets**. **Eight Projects originals** additionally inspected full-size: six960×640 creation/overview/saved-instructions views, two1440×900 post-restart grids; both themes. No new visual blocker found in this bounded inspection. Full-size notes: [targets](fullsize-targets.json); contact notes: [contacts](contacts.json).

Creation controls/actions are visible; narrow overview scroll and saved instructions remain readable; neutral covers and unavailable files are honest; post-delete grids show the surviving project and detached chat in Recents. Contacts show expected refusal/recovery states and coherent sidebar placement. Contact-scale review does not certify every small label or every scroll position.

**41 existing RGBA-exact canonical images reused**; **115 new lossless WebP** retained (3,434,972 bytes). Every retained image was decoded and compared to original RGBA; no resizing in canonical retention. JPEG contacts are labeled review derivatives. [Image index](image-index.md), [hash/alias ledger](images.jsonl), [counts](image-counts.json). Four inline report PNGs are included, not lost in filesystem counting. Seventy-five JSON attachments become51 unique compressed records.

## What the passing cases establish
- Real Electron IPC with local fake provider: duplicate-name ID separation, real422/`provider_disabled` refusal, same-session retry, original/revised project instructions in provider requests, move/detach, Search/Library/History/sidebar identity, deletion preserving transcripts, two full same-profile restarts per themed case, follow-up without deleted-project instructions.
- Full-run Projects durations: light13391ms, dark13352ms, race2826ms. Race source includes delivered-response/paint fences, retained newer drafts, stale A reads/writes while B is active, Back/Forward, real400/`invalid_request` retention/retry and sustained Library read refusal followed by explicit recovery. It has no screenshots. [Case proof map](projects-checks.json).
- `screens.spec.ts` records426 theme/state visits and checks content/raw keys/page errors; it does **not** produce426 screenshots or prove every live surface. Gallery count and image inventory are distinct.
- Report/result errors are zero. Observed renderer-error/network fields are empty except the three deliberately injected native callback failures required by `navigation.spec.ts:67–80`; [error observations](error-observations.json). No blanket zero-console-errors claim.
- Existing logs show252 units passed/one optional skip,23 files; i18n65 files/2275 used keys/3405 English keys/zero findings. Lint/typecheck supplied exit0 with no diagnostics; audit did not rerun them. Exact raw logs retained where existing copies only normalized surrounding whitespace; [checks](checks.json), [retention](retention.json).
- Existing production Linux package smoke says `SMOKE OK`; verified against the matching ASAR. Process log retains nine headless D-Bus diagnostics. No independent OS crash inventory or smoke screenshot inspection; [smoke](smoke.json).

## Historical and acceptance limits
Initial targeted2-pass/1-fail and development-build109-pass/7-fail logs remain separate. Their JSON reports were overwritten by the configured reporter; no reconstructed raw report is claimed. The one-shot Library refusal, later persistent-refusal correction, stronger test fences and production build retain distinct provenance; [history](historical-attempts.json), [original explanation](../initial/README.md).

Evidence/source audit only. No fresh capture, pixel comparator, CI query, installed-Mac verification or real Cloud account/inference acceptance. Comparator/native owners retain their scopes. Project files, sharing, metadata editing, assigned Bot and archive remain unfinished; the full rewrite objective remains incomplete.
