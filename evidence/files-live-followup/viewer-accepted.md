# Files viewer — final source review
**APPROVED, source-only: both reported P2 causes are corrected.** Post-fix runtime/native acceptance remains pending.
Checkpoint `2026-10-03T20:50:37Z`, HEAD `d390cce590600cf5896fa19acf0ddd44d7057e2c`; supersedes the two findings in `/tmp/opencode/g1-files-viewer-review.md` for these exact pins.
- `image.tsx:25–30`: canonical key retains all values of session/message/part, including duplicates; other query fields cannot replace the owner. Unconditional `useMemo` stabilizes Target across sidebar/focus/theme renders. Complete tuple changes still key-remount; malformed/missing/duplicate validation remains intact.
- Loader effect, actual-URL/preview fencing, deletion tombstone, part-update invalidation and download ownership are byte-unchanged. Canceled departure/Back still clears and rereads; a mere shell rerender now preserves ready URL, zoom and pending download validation.
- `image.tsx:117`, `files.css:314`: original filename still wraps fully; live-only `max-height:3lh; overflow:auto` bounds the header while ready filenames receive `tabIndex=0`. Full text remains accessible in its own native scroll area; image/control layout stays outside that overflow. Preview rules remain unchanged.
- Reversing only the tuple memo/key, filename tabindex and two CSS declarations reconstructs both original reviewed hashes exactly. No additional viewer implementation change found.
- Retained `/tmp/opencode/files-live/viewer-before.{json,log}` reports two failures: changed Blob src after the first sidebar toggle while Download GET was held; zero visible image height on the initial light-theme long-name iteration. Later assertions/dark iteration were not reached.
- New case `tests/e2e/files-live.spec.ts:314–343` checks same src/150% zoom, no extra reads, held download across sidebar/focus/theme changes, exactly one completed byte-equal download after release, then deletion surviving another sidebar toggle. It does not assert nonzero pan preservation.
- New case `:345–373` targets 960×640/sidebar shown/light+dark, ancestor-clipped image area ≥120×120, complete filename text, keyboard Home/End scrolling and Tab-to-Download, visible/hit-reachable controls and no page overflow. End checks positive scroll, not exact bottom. These are source coverage statements, not post-fix results.

## Current SHA256 pins
- `packages/app/src/screens/files/image.tsx`: `1c367df802dc6a55bfd9ac68b295209bf5c91b8801a3527fb766e49800bdaba7`
- `packages/app/src/screens/files/files.css`: `621c4d879ea13fe5d4a8fe2b34931afd0dd910bdc64b1dba5c3953f41c6d5379`
- `packages/app/src/screens/files/index.tsx`: `9a4a311aab89488bae16530859efd8ca40ea5ae68c904f320e0af0e2a0655704`
- `packages/app/src/screens/files/media.tsx`: `6b545f9544152329a5a09ff4da13683209564cff09755379ba71c7513981fcca`
- `packages/i18n/locales/en/files.json`: `1c0420582b0b9e035d347bf1258bdd7e146a6cff4853ca69c05cc0b252e4fc69`
- `tests/e2e/files-live.spec.ts`: `a7bd52dbc4577825bbaf2b50fff0de17801faa521ca98c6369c37b53e0f1e498` (current whole-file pin; differs from the reported pre-fix `5ef6cf…`).
- Negative JSON: `ea0f537e0335ca489c6348a37a21774cced0fdeae6d6e0da0707981fb9c62897`; log: `ecc4a7c6df8ff4f24da760222c34ec4e4845faeaa77aa2057cf9a375807aa7de`.

Only this report written; no delegation, source edits, tests/builds/app/device/network/CI actions. Raster, Chat and unrelated test-setup changes remain separately reviewed. No new viewer P2 found; matching post-fix execution remains coordinator-owned.
