# Saved local image attachments — delivery contract

Base application `9ba8e59`, documentary `d390cce`; Activity evidence closed independently.
Authority: `/tmp/opencode/g1-files-live-contract.md` plus its independent `-review.md`.
Existing Cortex/Base UI image viewer and frozen `7b388e2d9674` reference remain the visual authority.

## Scope
- Existing `file-image` route opens saved local Chat PNG/JPEG/WebP attachments by exact `session`, `message`, `part` query values. One value each; all absent uses Upload, partial/duplicate/malformed tuples unavailable. Require exact Session.kind=chat and message/part ownership via existing APIs.
- Static raster files only. One inline raw-base64 `data` OR exact matching `data:<MIME>;base64,` URL; both defined or neither refused. Bare MIME case-insensitive. No external URL, filesystem path, arbitrary blob, SVG/HTML, APNG or animated WebP.
- Inclusive ceilings: 50,000,000 file bytes after base64 decoding; 40,000,000 encoded pixels; 32,768 per positive encoded dimension. Header/container preflight precedes native source assignment. Validate native decode separately. This does not bound history IPC, cumulative thumbnail or total renderer/decoder memory.
- Base64: standard alphabet, correct optional trailing padding, canonical zero pad bits; unpadded mod4=2/3 allowed. Reject mod4=1, whitespace, URL-safe alphabet, internal/excess padding. Check length before expansion. Preserve original bytes.
- PNG IHDR and chunk bounds, JPEG SOF/length framing, WebP RIFF/VP8/VP8L/VP8X must agree with MIME and supply bounded dimensions. Reject conflicting dimensions, malformed/unsupported structure and animation. Native decode still must succeed. Avoid inventing a complete codec validator.
- A shared Files-owned validator returns typed success/unsupported/invalid/too-large results; no provider call, engine/store/IPC/dependency change.

## UX and ownership
- Safe saved thumbnails become native keyboard/pointer buttons with `files.upload.open`. Unsupported/invalid attachments remain a text/file card; never assign the original unsafe URL. No new open action may discard an unsent/refused draft, files, in-flight read or submission. Synchronous composer leave guard + localized explanation; accepted Open latches composer interaction until departure, canceled navigation restores interaction.
- Committed NavCtx dispatch preserves preview fixtures. Key live loader by complete tuple; observe actual route/tuple/preview changes independently. Subscribe before reads. Cancel owners/decode/download on departure, changed parts or session deletion; remove displayed src/minimap/metadata/download immediately on observed deletion. Late results never republish. Canceled Back rereads authoritatively.
- Ready view uses real file bytes, dimensions after native decode, truthful format/size. Existing media header, metadata card, zoom/Fit/pan/minimap geometry; fit-relative zoom labeled explicitly. Live-only styling wraps long filenames/control labels and metadata at 960×640. Keep preview geometry unchanged.
- Native `<a download>` uses original validated Blob bytes, fresh session existence/kind revalidation, exact owner fencing and independent short-lived URL. Strip path/control/bidi chars from bounded basename; append validated extension. No saved-success toast. Download preserves embedded metadata; dispatched downloads cannot reliably be canceled by later deletion.
- Session/history 404 or mismatched ownership: unavailable. Other reads: real Retry. Corrupt decode: cannot-open state. Too-large and unsupported: honest reason. Retry pending never duplicates work.
- No live Ask/share/retouch/compare/versions/file-delete promises. Existing preview states remain separate. Local saved viewing works with provider disabled and without an account.
- Logical session removal, not physical journal erasure. Missed SSE events remain possible; re-entry/download revalidate. No total revocation/atomic deletion guarantee.

## Ownership
- Coordinator: Files route wrapper, tuple loader/view, media ZoomView live geometry, files.css, English catalog, docs/evidence/production verification.
- Raster author: `packages/app/src/screens/files/raster.ts` and `raster.test.ts` only; compact shared pure preflight and meaningful malformed/budget/animation tests.
- Chat author: `screens/chat/live-chat.tsx`, `model-composer.tsx`, `chat.css` only; safe shared validator thumbnails, exact-ID Open and no-draft-loss guard. Wait for shared exports contract below.
- Test author: `tests/e2e/files-live.spec.ts` only; real IPC data + UI interactions, frozen old-build negative then same assertions on rebuilt candidate.
- Locale author: seven non-English files.json catalogs only after English keys pinned. No other writes/delegation by executors.

## Shared raster exports
`Raster = { bytes: Uint8Array<ArrayBuffer>; mime: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number }`.
`readRaster(input: { mime: string; data?: string; url?: string }): { ok: true; value: Raster } | { ok: false; reason: "unsupported" | "invalid" | "tooLarge" }`.
`rasterFilename(name: string | undefined, mime: Raster["mime"]): string` returns bounded safe basename with validated extension; fallback `image` is a download basename, not UI copy.

## Proof
- Focused raster unit file; one Electron file: real accepted saved PNG/JPEG/WebP, raw/data URLs/padding, duplicate-name exact identity, provider-disabled restart, zoom/Fit/resize/pan/download byte equality, malformed/oversized/animated/source refusals, no external fetch, dirty/refused/in-flight draft preservation.
- Held GET/decode/download admission across deletion, tuple changes and preview/Back; immediate removal, no resurrection, owned URL cleanup. Verify header-over-limit refusal before native decoder. Themes/minimum/wide, long name, eight locale geometry; frozen image/Chat preview comparisons and existing full regression afterward.
- Production build, source-bound package, CI/macOS smoke and matching bounded native proof after implementation. Existing Activity evidence does not establish Files acceptance.
