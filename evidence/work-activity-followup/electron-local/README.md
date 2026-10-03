# Work Activity — retained local Electron artifact audit

**PASS within the retained local artifact scope.** No blocking finding in reviewed reports, pixels or source/binary identity.
Offline review only; source approval, frozen comparison, CI and installed-native acceptance remain separately owned.

## Execution and attribution
- Full: **132/132**, **426 rendered states**, 294,848.924 ms; 132 attempts, zero retries/skips/flaky/top-level or result errors.
- Supplemental: **6/6**, 7,286.332 ms; all six behavior cases rerun against the same production application bytes.
- Full behavior source: `5740841a75bda4c688f5407122b870bda049698c1b5e80c6746ce55b82ba4af0` (208 lines).
- Supplemental behavior source: `d98c9205c5dbddfe349a06a4271b4a2a1c135248cf84817705b6d81e11916744` (211 lines).
- Full locale source: `bfda7f43480e7f20e8101480950c28c5ea149b0f6f3bedf231d56c3ed7a5e087` (112 lines).
- Source snapshots: [source-pins.json](source-pins.json); exact report/log retention: [retention.json](retention.json), [reports.json](reports.json).
- JSON reports contain case IDs/locations, not test-source hashes. Binding uses archived sources and execution receipts; later assertions never upgrade the earlier full run.

## Source and package identity
- Original execution: dirty application based on `906987b94c04c3c4566ecb33394584ff0e93074e`; original [production manifests](../production/) preserved.
- Later attribution: all **517 inputs** exactly match Git `9ba8e59fbec8c1f38f93ace25414d4a3489aede3`; this is byte binding, not a clean rebuild claim.
- Actual path sets and SHA-256 verified for **517 package inputs**, **475 renderer inputs**, **90 dist members**, frozen and current.
- Renderer fingerprint: `a4a815bac24ce5f509f813d06371b8a754908b4b472c3d786f1325dbed53b8df`.
- Linux ASAR: `22760335b8eef317c2c325cde1a7d4c09ecb888780226aaeb0e8ae4353a4bf26`; all 90 build members match; only other archive entry is `package.json`.
- Memory `96df66c` delta: four renderer files plus seven added values in each of eight locale catalogs; previous catalog values unchanged. Activity source has 145 physical lines.
- Engine, main/preload sources and all four desktop bundle/map members remain byte-identical to Memory. [Source delta](source-change.json), [before](binding-before.json), [after](binding-after.json).

## Images and observations
- Full: 187 PNG attachments, 181 unique RGBA frames; 366 disk PNG copies plus four inline attachments. Supplemental: four additional unique frames/eight disk copies.
- Union: **185 unique frames**; all inspected through **16 contacts**. **16 Activity originals inspected full-size**: eight dark locales, four full-run English lifecycle, four supplemental English lifecycle.
- **140 canonical reuses** verified by exact decoded RGBA equality: 110 prior Memory CI images, 30 prior Memory local images. **45 new lossless WebP**, 1,378,326 bytes; exact RGBA rechecked after encoding.
- Supplemental frames differ from matching full-run frames by 184 timestamp pixels each (`18:44` versus `18:48`); originals retained separately. [Difference ledger](supplemental-image-drift.json).
- All Activity targets: 960×640. Long titles wrap; outcome/time columns remain distinct; missing-owner text neutral; Japanese/Chinese/Korean glyphs populated. No clipping/overlap observed; no language-fluency certification.
- [Image index](image-index.md), [RGBA ledger](images.jsonl), [contacts](contacts.json), [full-size review](fullsize-targets.json), [visual scope](visual-review.json).
- Locale attachment: **112 measurements**, 304 text fragments, 366 ink rectangles; eight locales × two themes × seven states. Every clipping-bound and width check passes; original old-build locale attempt recorded zero measurements.
- Full and supplemental recovery attachments each contain **43 real protocol calls**: 36 GET 200, six deliberate GET 404, one PATCH 200. Retry covers session, Bot and still-listed history failures.
- Recorded error fields contain no unexpected values; three intentional navigation callback errors remain explicit, separate from expected source refusals. [Error observations](error-observations.json).

## Behavior and retained negatives
- Persisted success, SSE failure, interruption, routine outcome, same-name exact Bot/session identity, latest-finished-turn retention, restart, bounded 40-root selection, neutral missing ownership and preview write isolation are exercised. [Proof map](behavior-proof-map.json).
- Supplemental `d98` alone adds stronger proof: clear filter after stale release; retire before exact `/api/sessions?kind=bot` release with `heldURL` assertion; retain Activity-owned header while cancelling the actual preview URL.
- Prompts use real IPC directly; filters/navigation/Retry use UI. Behavioral provider refusal is HTTP 200 SSE error; locale provider refusal is HTTP 400. This does not establish composer-send coverage or task fulfillment.
- Old Memory application: **0/6** behavior, five missing populated-row assertions plus one missing recovery state; later assertions unreached. Original behavior source `0166d765…` retained.
- Old locale: **0/1**, first missing scope label; original `d40d9be0…` source retained. Later `bfda` descendant-clipping checks belong to the corrected execution.
- Initial target **5/7**: two line-109 `innerText` snapshots compared with default `textContent`. Correction adds only three `{ useInnerText: true }` options, preserving exact equality; corrected lifecycle **2/2**, 5,161.413 ms.
- Intermediate `3cf71b7c…`: **1/1**, 3,188.593 ms; pathname-only hold could be consumed by sidebar Chat reads. Its receipt is retained, not credited with the final query-owner proof; no reconstructed source claimed.
- [Historical attempts](historical-attempts.json) preserves failures, corrections and their source distinctions; original raw/gzip report and log bytes verified.
- Existing logs: 260 unit passes/one optional skip, nine locale-parity passes, i18n 67 files/2,279 used/3,419 English keys/zero findings; package smoke `SMOKE OK`. Quiet lint/type logs have no diagnostics; exit-zero provenance remains the coordinator receipt.

## Offline reproduction
```sh
python3 evidence/work-activity-followup/electron-local/verify.py
python3 evidence/work-activity-followup/electron-local/verify.py --local
```
Requires existing Pillow; `--local` additionally needs original `/tmp/opencode` artifacts, current dist/ASAR and Git objects. No application execution or network.
Verifier checks actual path sets, hashes, report totals, geometry, source separation and lossless image retention. [Summary](summary.json), `SHA256SUMS` seal the bounded audit.
