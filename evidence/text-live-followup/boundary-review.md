# Saved text — independent primitive and Chat boundary review
**APPROVED in the reviewed source scope; no blocking P1/P2 finding.** Base `f2c1bc828d2eb64fbe0792031c2e33de63c54957`.
Read the 40-line contract, independent contract review, primitives/tests, raster delta and narrow Chat delta.
Only this report written. No source/test/catalog edits, delegation, collector/app/test/build/device/network/CI execution.

## Exact SHA-256 pins
Paths below are under `packages/app/src/screens/`:
- `files/bytes.ts`: `8974b2992fc5657de9bd75234f19499aa2c9d43a5763f30d9017e22543339d2a`
- `files/text-data.ts`: `2af68813641f15d10ce2f37e25516172f530187722ed6a24120621e7e52e12dc`
- `files/text-data.test.ts`: `fd2b6a3d3d5c0b6f635584562744a1dc843c5eafa0bf0725aa779e0a29856e4b`
- `files/raster.ts`: `76bd8d3dd214dd91e11183da7187dd2a653cddc91673aaf363dfbbe5c09e454d`
- `files/raster.test.ts`: `619ec5fe7d970224ef1309e862c24130a01bfda18aa6a0c4656e54c6ba38f031`
- `chat/live-chat.tsx`: `e8622687ab5fa179fcc8fb26974895572169c70761a51d4f3ecdf4e1e8cc0e04`
- `chat/chat.css`: `a6b3ce458c29b88048d242a864e085f05f3b68078c66a87f2499bb7f5b707a0e`

## Boundary findings
- `bytes.ts:5–28`: exactly one defined inline source; field types, canonical alphabet/padding/zero pad bits, encoded and decoded length checked before `atob`/byte allocation. Text permits explicit empty; raster remains nonempty.
- `text-data.ts:6–17`: only bare case-insensitive `text/plain`/`text/markdown`; no parameters, whitespace, filename guesses or external URLs. Missing/ambiguous sources and unrecognized headers are unsupported; recognized header/MIME mismatch or malformed fields/base64 are invalid.
- Inclusive text byte ceiling is 5,000,000, including BOM. Fatal UTF-8 decoding rejects malformed/overlong/surrogate sequences and UTF-16 BOMs; default decoder handling removes exactly one initial UTF-8 BOM. Original bytes remain intact.
- `:18–29`: empty decoded text has zero rows; nonempty starts at one; CRLF counts once, lone CR/LF each count once, trailing empty row retained. Inclusive 50,000 logical rows/100,000 UTF-16 units per row are checked before display normalization; no truncation.
- Copy string retains original CR/LF, tabs, Unicode and any second/interior BOM. Only display CRLF/CR becomes LF. NUL/C0 except HT/LF/CR and DEL are unsupported. Other Unicode, including U+2028/U+2029 and bidi controls, intentionally survives.
- Thus row counts/limits are explicitly CR/LF-logical, not a promise about visual Unicode line breaking or bidi order. No text sanitization, reliable binary detection or browser-layout acceptance follows from this primitive.
- `attachmentFilename`: extraction is source-identical to the prior raster path apart from trusted fallback/extension. Last-dot suffix scans disjoint dot-free runs; anchored leading trim and post-60-code-point trailing trim preserve the 200,000-space regression fix. No new quadratic filename path found.
- Separators, controls/format/bidi and unsafe filename characters are stripped; reserved names fall back; trusted `.txt`/`.md` are forced. Original text/source bytes are not rewritten by filename handling.
- Raster PNG/JPEG/WebP parser bodies and all 18 existing test cases are byte-exact to HEAD. Base64 extraction changes only caller byte budget/empty policy; raster passes 50,000,000/default-nonempty. Additional raster-only header gate preserves unsupported foreign headers versus invalid supported-MIME mismatch, including source-ambiguity precedence.

## Chat boundary and proof limits
- `FileThumb:201–217` checks bare MIME for text Open without decoding text. Existing raster memo immediately refuses text MIME; importing `text-data` introduces no eager decoder/history work or top-level runtime effect.
- New native `type="button"` has a localized name, escaped JSX filename, decorative icon, phrasing-only descendants and inherited focus styling; no nested interactive element. CSS adds only text alignment/token hover on the live text class.
- `LiveChat:311–324` preserves exact session/message/part IDs, ready Chat ownership, preview/shot exclusion, live route recheck, synchronous opening latch, busy/header-write guards and existing composer `tryLeave`/resume. Only destination selection changes to `file-code` for text.
- `ModelComposer` remains byte-identical to HEAD: text/attachments, FileReader reads, pending sends/refusals and canceled navigation still use the established guard. `PreviewChat` body is byte-identical; frozen preview gains no new text button.
- Strings remain literal data in these primitives; source interpretation/escaped `<pre>`, actual Copy/Download ownership and UI rendering belong to the separately owned FileText review, not this approval.
- Author-reported **35 passing targeted cases** agrees with registered source counts: **17 text + 18 raster**. Independently inspected tests and extraction equality; no concrete reproduction required another test run. No claim of reviewer-executed tests.
- English catalog now hashes `af62c6f85efb5e26056f72283011320fa3a35446b9853c876f22557d1744ff99`; restoring one leading space on `code.contents` exactly recovers prior `f17f623e…` bytes. All 290 incumbent English values remain equal; 22 additions unchanged.
- Viewer preflight does not bound full history/IPC, total decoded/render memory or upper-budget responsiveness. It establishes no model capability, inference admission/token budget, native clipboard/download, visual escaping or full-product acceptance.
