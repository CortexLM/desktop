# Saved raster preflight — independent source review
**P2 correction required: unbounded filename suffix matching can stall the renderer.**
Scope: released `raster.ts`, `raster.test.ts`, author handoff and corrected Files contracts; source-only review.
Verified SHA-256: `raster.ts` (158 lines) `ee05e29a8d4c4d5b25d588df1f2d100cf9c717a4c82213d3306ba4200179794e`.
Verified SHA-256: `raster.test.ts` (133 lines) `5c2f28910314b5f7005944c5d3d750a0466fd0eb4c13e9cf691c92f138e04981`.

## Required correction
- **P2 — `raster.ts:153`, before the bound at `:155`.** `/^[ .]+|[ .]+$/g` has an unanchored, greedy suffix arm over the complete untrusted filename.
- Crafted input: `rasterFilename("a" + " ".repeat(200_000) + "b.png", "image/png")`.
- Extension removal leaves `a`, the long space run, then `b`. At each space the suffix arm scans/backtracks to the terminal non-space, fails, retries at the next offset: quadratic work before the 120-unit/60-code-point cap. The 50 MB image limit does not constrain filenames.
- Expected bounded result is `a.png`; current output computation can synchronously stall rendering/download admission. This is source-derived; no timing experiment executed.
- Minimal fix: replace `.replace(/^[ .]+|[ .]+$/g, "")` with `.replace(/^[ .]+/, "")` at `:153`. Keep `:155`'s existing bounded trailing trim. Output semantics remain equivalent; no parser/framework change needed.
- Author regression: long interior spaces ending in a non-space plus extension, alongside the existing filename cases; confirm bounded completion and `a.png`.

## Boundary review
- `:123–142`: exactly one defined source; strict bare case-insensitive MIME/data-URL matching; no arbitrary URLs, SVG/HTML, parameters or whitespace. Canonical alphabet/padding/unused bits are checked before `atob`; canonical unpadded remainder 2/3 accepted.
- Byte arithmetic admits exactly 50,000,000 decoded file bytes and rejects excess before expansion. Encoded cap 66,666,668 alone is insufficient; the separate decoded-length check correctly closes that boundary.
- `:8–11`: positive encoded dimensions, inclusive 32,768 per dimension and 40,000,000 pixels; values originate in bounded unsigned header fields.
- PNG: signature, unique first IHDR, legal header fields, chunk bounds, palette requirement, contiguous IDAT and terminal IEND. APNG flags/chunks cannot hide in an unvisited structural chunk; ancillary payload substrings are correctly ignored.
- JPEG: single 8-bit SOF0/1/2, bounded segments/SOS, progressive scans, stuffed FF00/restarts and terminal EOI. A real second SOF after entropy is parsed/refused; SOF-looking metadata or stuffed bytes cannot change dimensions. Hierarchical/DNL/other processes intentionally unsupported.
- WebP: exact RIFF length, bounded/padded chunks, one VP8/VP8L image, first-only VP8X and canvas/bitstream equality. Animation flags/ANIM/ANMF refused; ALPH requires extended lossy-alpha framing and is excluded from VP8L. Bounded unknown chunks remain permissible.
- No encoded-dimension/animation bypass identified in those walks. CRCs, JPEG tables/entropy and compressed pixel integrity are intentionally delegated to mandatory native decoding.
- `Uint8Array<ArrayBuffer>` matches the released Blob-facing export contract; no DOM/Buffer/codec/network dependency introduced by this helper. Node 22/browser `atob` is the intended runtime primitive.

## Filename and proof limits
- Last-component selection, control/format/bidi removal, invalid punctuation removal, MIME-derived suffix (`jpg`) and ordinary reserved-device fallbacks are present. Original embedded metadata is preserved.
- The initial 120-UTF-16-unit slice cannot leave a newly split surrogate inside the final 60 code points: a high surrogate cut at index 119 necessarily follows at least 60 complete code points and is discarded. This is not an additional truncation defect.
- Final length fits 255 UTF-8 bytes/UTF-16 units. Existing unpaired surrogates are not explicitly normalized; no demonstrated path/extension bypass follows from that observation.
- Unit receipt `/tmp/opencode/g1-files-raster-unit.json`: **18 passed, zero failed/pending**. Ten encoded-format fixtures plus eight focused boundary cases exercise byte preservation, refusals, pre-`atob` limits, framing and names. Receipt attribution comes from the hash-matching author handoff, not an embedded source hash.
- Mutated CRC/entropy and intercepted-atob fixtures establish structural preflight only. They do not establish native decoding, actual displayed dimensions, UI behavior or download completion.
- Caller acceptance must separately bound positive native displayed dimensions/product after successful decode, accounting for orientation/density. Preflight must precede source assignment for both saved thumbnails and Files; those owners are outside this review.
- Per-file encoded budgets do not bound cumulative thumbnails, history IPC or total decoder memory. No additional allocation guarantee inferred.
- Only this report written. No source edits, tests/builds, GUI, network, CI/Mac access or delegation; Activity acceptance supplies no Files proof.
