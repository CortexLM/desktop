# Saved Files — retained local Electron artifact audit

**PASS within the retained local artifact scope.** No new blocking finding in reviewed candidate pixels, reports or source/binary identity.
Offline audit only; source approval, preview comparison, CI and installed-native acceptance remain separately owned.

## Execution and source binding
- Full: **143/143**, **426 render visits**, **303,294.426 ms**; 143 attempts, zero retries/skips/flaky/top-level or result errors, empty stderr.
- Corrected targeted: **11/11**, **17,183.195 ms**; same eleven Files cases and application bytes as the full run, zero retries/skips/flaky/errors.
- Both execute final source `a7bd52dbc4577825bbaf2b50fff0de17801faa521ca98c6369c37b53e0f1e498` (373 lines): frozen/current/Git copies match.
- JSON identifies case IDs/locations, not source hashes; frozen source plus execution receipts establish the positive-run attribution. [Reports](reports.json), [cases](cases.jsonl), [source pins](source-pins.json).
- Original execution was dirty at `d390cce590600cf5896fa19acf0ddd44d7057e2c`; original [production manifests](../production/) remain unchanged.
- Later Git `d20a012fbb774aa9b348fe1913f85d3476430098` matches **all 520 input paths/bytes**. Rebound temporary headers record later identity, not a clean rebuild.
- Independently verified frozen/current **520 package inputs**, **478 renderer inputs**, **90 dist members**, actual path sets and every SHA-256; [before](binding-before.json), [after](binding-after.json).
- Renderer fingerprint: `087587293bfb7c2ccf85176cece73982ae75db48318e1c381270caa5196a0d73`.
- Linux ASAR: `9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893`; all 90 build members match; only additional archive entry is `package.json`.
- Activity `9ba8e59` delta: **eight runtime renderer files, one raster unit file, eight Files catalogs**. Engine/main/preload sources and four desktop bundle/map members unchanged. [Source delta](source-change.json).
- `raster.test.ts` is counted because the manifest inventories source directories; it is not imported into the production renderer. Added catalog values: **19 × 8 = 152**, including 133 non-English; all previous values preserved.

## Image audit
- Full: **201 PNG attachments / 195 unique frames**, 394 disk copies plus four inline PNG attachments. Targeted: 14 attachments/28 disk copies, **all byte-identical to full counterparts**, zero additional frames.
- Including retained history: **216 unique RGBA frames** reviewed across **18 contacts**; 21 historical-only images retain separate run attribution.
- **14 primary Files originals inspected full-size**: four English lifecycle frames (960×640/1440×900), eight dark locale frames (960×640), two 5,000-character filename frames (960×640, both themes).
- **13 failure originals also inspected full-size**: eight old-build negatives, two collector failures, three application regressions. [Full-size observations](fullsize-targets.json), [contacts](contacts.json).
- **143 exact canonical reuses**: 117 prior Activity CI, 26 prior Activity local; original-to-canonical RGBA equality verified. **73 new lossless WebP**, 2,062,716 bytes: 52 candidate, 21 historical-only; decoded pixels rechecked after encoding.
- [Image index](image-index.md), [RGBA ledger](images.jsonl), [visual scope](visual-review.json). Eight existing Memory and eight auth locale frames exactly reuse Activity canonicals.
- Portrait/landscape aspect, truthful type/dimensions/byte size and Fit-relative controls remain readable; narrow metadata stacks, wide metadata stays beside the image. CJK glyphs populated; German hint wraps without overlap.
- Long names are fully retained in a focusable three-line scroll region, not fully visible at once. Both long-name captures show suffix access, image and controls; the Zoom out tooltip crosses the content edge slightly without covering controls.
- Files geometry assertions check element boxes/ancestor clipping and scroll width, **not text Ranges**; no serialized Files geometry attachment. Locale captures cover dark only; English lifecycle/long-name cover both themes. No fluent-language certification.

## Behavior and receipt boundaries
- [Proof map](behavior-proof-map.json): exact duplicate-name part selection; static PNG/JPEG/WebP raw/data sources; keyboard/drag displacement; Fit/resize; provider-disabled reload/restart; byte-equal original downloads; source/tuple/format/size refusals.
- Real IPC reads/accepted records, native image decode and UI actions exercise Retry, draft/read/refused/submitting guards, rename admission, delayed history/decode/download ownership, deletion, tuple replacement, canceled preview/Back and same-owner shell changes.
- Successful download assertions use native `will-download`, deterministic `setSavePath`, completed state and disk-byte equality (WebP in both lifecycle themes; PNG in same-owner case). They do **not** prove an installed Mac default Save dialog.
- Files has no JSON download/geometry/error attachment; those claims derive from preserved assertions and passing results. Full-run 66 JSON attachments remain indexed with their actual owning tests.
- No unexpected recorded error fields; three intentional navigation callback errors remain explicit. [Error observations](error-observations.json). Renderer unsafe-source observer begins after admission; no complete main/provider network-audit claim.
- Preflight enforces 50,000,000 file bytes, 40,000,000 encoded pixels and positive dimensions ≤32,768 before native assignment; caller checks native displayed dimensions afterward. Original metadata persists; no CRC/pixel-integrity or total IPC/decoder/cumulative-memory guarantee.

## Historical failures retained
- Old Activity build: **0/8**, 53,744.348 ms, original `e28ddaec…` test; 90 members match retained Activity freeze. First failures establish missing Open/view/read/decode or unsafe-card refusal only; downstream assertions unreached.
- Initial Files target: **6/8**, 28,128.594 ms, same `e28…`; two collector assumptions failed: mutated PNG still native-decodes, provider PATCH does not refresh mounted model selection. [Collector delta](source/files-collector-corrections.diff).
- Corrected fixture is independently diagnosed **30-byte WebP**: preflight succeeds, native decode rejects `EncodingError`, natural size 0×0. Six-fixture batch retains five decoded controls/mutations; all four earlier PNG probes decode successfully. Acceptance is not PNG validity/CRC certification. [Decoder summary](decoder-summary.json).
- Setup reload now precedes new no-model draft; prior accepted files must already be cleared. Keyboard/drag pan now compare before/after, and restarted provider GET explicitly asserts disabled. Final full run includes these stronger assertions.
- Rename-before **0/1**, `0982831…`: second editor count1 while first accepted PATCH reply held; no executed second write or early Open failure inferred.
- Viewer-before **0/2**, `5ef6cf52…`: Blob src changed after sidebar toggle; initial light long-name image area had height0. Retained screenshot shows header extending beyond viewport. Later assertions/dark iteration unreached.
- Reconstructed 9/11-case standalone snapshots retain that provenance. **All 13 original failure traces embed matching `e28`/`098`/`5ef` source bytes**, independently corroborating the author receipts. [Trace bindings](trace-source-binding.json), [failure ledger](historical-attempts.json).
- Initial `9c05e9d7…` source/dist sets verified separately; raster source/unit were reconstructed by reversing the documented later regex/assertion delta, not a contemporaneous clean-source freeze. [Historical binding](historical-binding.json).
- Filename regex P2 remains source-derived, not a measured old hang. Corrected 200,000-space assertion joins the existing **18/18** raster cases; no codec-policy expansion.

## Checks and reproduction
- Existing unit log: **278 passes + one optional skip**, 25 files, 12.13 s, including 18 raster and nine locale cases. It follows filename correction but precedes later viewer/rename corrections; no final-build unit rerun inferred.
- i18n: **69 files / 2,288 used keys / 3,438 English keys / zero findings**. Corrected lint/type logs contain no diagnostics; exit-zero provenance is the coordinator receipt. Production build and Linux `SMOKE OK` retained. [Checks](checks.json).
```sh
python3 evidence/files-live-followup/electron-local/verify.py
python3 evidence/files-live-followup/electron-local/verify.py --local
```
Existing Pillow required. `--local` additionally reads original `/tmp/opencode` files, current/frozen inputs, dist/ASAR and Git objects; neither command launches the app or uses network.
Verifier covers path sets, hashes, original reports/logs, source distinctions, trace sources, decoder receipts and lossless image retention. [Summary](summary.json), `SHA256SUMS` seal the audit.
