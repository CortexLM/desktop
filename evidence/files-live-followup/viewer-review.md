# Files viewer — independent source review
**Changes required: two P2 findings.** Static review only; no runtime/native acceptance.
Checkpoint `2026-10-03T20:22:22Z`: documentary HEAD `d390cce590600cf5896fa19acf0ddd44d7057e2c`, application base `9ba8e59`; reviewed five uncommitted files below against the delivery contract and its contract review.

## P2 — Stable tuples acquire new loader owners on shell rerenders
- `packages/app/src/screens/files/image.tsx:27,33–35,103–104`: `target(params)` allocates a fresh object each render; `[tuple]` therefore tears down/recreates the effect even with the same complete tuple/key.
- `packages/app/src/shell/shell.tsx:37–59,63–64,82–87,95,104` rerenders this child on theme/sidebar/focus changes. Cleanup revokes the ready URL and cancels reads/download validation; setup fetches/decodes again. A new `data.url` remounts `ZoomView` at Fit (`image.tsx:119`). Repeated shell changes also issue redundant reads while earlier reads remain outstanding.
- Concrete interleaving: ready image, zoom/pan, start Download with its session GET held, toggle the sidebar or theme, release GET. The old owner is unmounted, so its accepted download never dispatches; the replacement owner reloads the unchanged image and loses zoom/pan. This is same-owner UI interaction, not departure.
- Smallest fix: stabilize the parsed Target by the existing serialized full-tuple key; keep hooks unconditional. Preserve actual-URL `sync`, tuple-change remounts and deletion tombstones.
- Regression: zoom/pan then toggle sidebar/focus/theme; retain image URL and zoom, clamp pan only for real size changes, issue no new session/history reads. Hold Download GET across the same toggles; release it and require exactly one download. A deleted owner must remain unavailable across a shell rerender.

## P2 — An accepted long filename can consume the entire viewer height
- `image.tsx:67,114` renders the original unbounded filename; `packages/schema/src/index.ts:207` imposes no length cap. The bounded download basename does not bound this display string.
- `packages/app/src/screens/files/files.css:313–314` makes the header auto-height with unrestricted wrapping; inherited `.content-top` has `flex-shrink:0` (`kit/styles.css:209`). The enclosing frame/window clips overflow (`:65–66,123`). A saved filename such as `"W".repeat(5000)+".png"` wraps beyond the 640px window, placing zoom/Fit/image content below the visible frame without a scroll path.
- Smallest fix: bound the live filename block to a few lines with its own keyboard-scrollable overflow, retaining the full text. Keep the header controls and image area outside that overflow; preserve preview rules.
- Regression: an accepted 5,000-character filename at 960×640, sidebar shown, both themes; assert positive visible image area, reachable Download/zoom/Fit, accessible full filename and no page overflow. Repeat a normal filename to guard ordinary geometry.

## Confirmed source boundaries
- `index.tsx:26` returns a child beneath committed NavCtx. Preview/shot selects existing fixtures; all identifiers absent selects Upload. Other inputs require one lowercase-prefixed, minimum-32-hex value per ID; exact Chat kind plus message/part ownership is checked.
- Actual route/tuple/preview fencing, subscription before reads, sequence/deleted/ready guards and canceled-departure Back reloads are present. Matching deletion clears an outgoing owner even when its actual URL has departed; matching part updates invalidate pending downloads. These controls are undermined only by the unnecessary owner replacement above.
- `readRaster` runs before Blob URL/native source assignment. Its typed success contract is consumed correctly; native decode is separately checked. Displayed dimensions use `naturalWidth/Height`, not encoded header dimensions. Raster implementation/tests and active Chat changes were not reviewed.
- Ready display URLs are revoked on clear; decode continuations cannot republish stale owners. 404 maps to unavailable, other read failures to Retry; synchronous reading/downloading flags reject duplicate respective actions. Only existing session/history GETs are used.
- Download freshly revalidates session identity/kind and owner/sequence/ready/deleted state, then hands off original validated Blob bytes through an independent 60-second URL. No same-stack revocation or saved-success toast; embedded metadata is preserved, not sanitized.
- Live Fit/pan bounds use the contained image with 16px margins; small images upscale consistently with `object-fit:contain`. ResizeObserver reclamps against current zoom; minimap uses actual aspect ratio and separate viewport axes. Keyboard, wheel and double-click controls remain present.
- `dimensions` identity/zoom changes recreate the observer (`media.tsx:123–131`); its updates remain local to ZoomView, so this is bounded churn, not a self-sustaining render loop. The no-dimensions preview path retains the previous rendered labels/styles and bounds formulas.
- Narrow live panes stack metadata below the image with a 150px maximum. This does not constrain the filename header identified above. English adds exactly 19 keys; existing values are unchanged.

## SHA256 checkpoint
Paths below are relative to the repository; all five pins match the earlier review reads.
- `packages/app/src/screens/files/image.tsx`: `532c832d5c641a11562c22f1be7ef3e819473fa76d43db94b0aaee3cb3901329`
- `packages/app/src/screens/files/index.tsx`: `9a4a311aab89488bae16530859efd8ca40ea5ae68c904f320e0af0e2a0655704`
- `packages/app/src/screens/files/media.tsx`: `6b545f9544152329a5a09ff4da13683209564cff09755379ba71c7513981fcca`
- `packages/app/src/screens/files/files.css`: `c57d3c5a7874116c61598bfe638df57399a0605e2b60827ac240560ab783ff48`
- `packages/i18n/locales/en/files.json`: `1c0420582b0b9e035d347bf1258bdd7e146a6cff4853ca69c05cc0b252e4fc69`

Only this report written. No delegation, source edits, application tests/builds/runtime, device/lease actions, CI/network queries or commits. Regression sequences above are required checks, not executed results.
