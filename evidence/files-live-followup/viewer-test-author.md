# Files viewer regression source handoff

Appended exactly two cases to `tests/e2e/files-live.spec.ts:314–373`; now 373 lines / 11 cases.
Full SHA-256: `5ef6cf529cc6ad9be79d3417db9242efec1d434a479ba82a4b194c4b985f5740`.
First 312 lines preserve exact bytes/SHA-256 `0982831cc5fc8a569bdd0a08b5e13515cc3796de717283fb53ce6fd42ecdf1e6`; earlier nine cases untouched.

## New assertions
1. **Same image owner preserves zoom and a held download across shell changes** — saved real PNG, ready Blob URL, 150% zoom; hold exact successful session GET used by Download. While reply remains held, toggle sidebar/focus and rail theme; require retained src/zoom, unchanged tuple, no extra session/history reads and no dispatched download. Release; exactly one actual completed native download, original-byte equality. Deleted owner remains unavailable across a later sidebar toggle.
2. **A 5000-character saved filename keeps the image and controls reachable in both themes** — one real admitted attachment, full original name, both themes, 960×640/sidebar shown. Require image pane's ancestor-clipped visible dimensions ≥120×120, full filename text, keyboard focus/own overflow, Home/End scrolling, Tab to Download, reachable Download/Fit/zoom controls and no page overflow. Two scoped captures.

Reuses existing real IPC/native-download collectors and per-test cleanup. No fake engine events/records, product-source change or additional helper imports.
Case 1 should fail before the owner fix at unchanged-src assertion after Hide sidebar, while download response remains held. Case 2 should fail before the header fix at clipped visible image-area assertion. These are source expectations, not executed failures.
Checks: file-scoped ESLint passes; first-312-line hash independently verified. No build, app/E2E run, network/device/CI or delegation.
Coordinator owns current-build negative runs and candidate verification. Earlier e28 baseline/initial-target and 098 rename-baseline receipts retain their own source bindings; they cannot inherit these appended cases.
Ownership released. No changes to earlier collectors, old failures or application source.
