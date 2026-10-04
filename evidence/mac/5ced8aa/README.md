# Installed Mac verification — 5ced8aa

Clean-installed unsigned arm64 [CI artifact 11229618220](https://github.com/CortexLM/desktop/actions/runs/37015801908/artifacts/11229618220)
from green [CI 37015801908](https://github.com/CortexLM/desktop/actions/runs/37015801908).
Application revision: `5ced8aa1d2eb04ed3131ffb40c0d360e5706526d`.

- Launched with `open -na /Applications/Cortex.app` through the authorized GUI session.
- `install.json`: installed asar hash, eight locales with 13 catalogs each, no raw fixtures
  or translation source stamps, bundled summarize skill.
- `manifest.json`: **426 native window captures**, 213 states in both appearances,
  **1024×685**, zero renderer errors. All PNG/WebP hashes retained; RGBA conversion
  verified byte-for-byte, including transparent pixels.
- [Full-resolution images](index.html); eleven contact sheets support inspection.
- `menus/`: seven native menus in both appearances, 14 distinct image hashes; all pairs inspected.
- `window-actions.json`: native minimize/restore and fullscreen entry/exit confirmed with
  accessibility read-back. Fullscreen capture is 1024×768.
- `gallery.json`: native Help opens Gallery at scrollTop 0 with one loaded preview;
  native Go → Chat returns to Home, preserving the existing preview query.
- Cleanup: capture helper and SSH forwards stopped; remote 9444/9445 confirmed closed;
  shared lease released. Cortex relaunched in live mode without debugging enabled.

These captures cover this revision. Work-board minimum-window overflow and refusal-toast
overlap found during CI review require subsequent corrections; this baseline does not prove
them. Native rendering is not exhaustive live interaction acceptance.
The independent [review](review.md) records partial contact-sheet screening and five named
full-resolution frames, plus all 426 file/hash/dimension checks. Opening all eleven sheets
is explicitly not counted as exhaustive visual review.
