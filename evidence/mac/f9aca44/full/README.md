# Installed Mac full sweep — f9aca44

**426 native window captures:** 213 registered states, both appearances, **1024×686**.
Zero observed renderer errors. Same installed artifact **11258159964** as the
[Work/Search proof](../README.md); ASAR
`23decdd0596b89e8e83284b62f6e7f0eb5314b081ccf178f7dde31c8ac04af77`.
The parent [package receipt](../package.json) binds all 90 build members and eight locale sets.

- Launched through GUI LaunchServices with an isolated engine/profile, English locale,
  an empty catalog and `#/gallery`; navigation uses CDP, pixels use native `screencapture`.
- `capture-manifest.json` is the unchanged capture receipt. `manifest.json` adds PNG/WebP
  hashes and dimensions. All 426 WebPs preserve the original RGBA bytes, including alpha.
- [Full-size screens](index.html), eleven contact sheets; original PNGs remain at
  `/tmp/opencode/current-full-native-f9aca44`.
- `menus/` contains fourteen native menu images: seven menus × light/dark, accessible
  item labels and hashes. OS appearance changes are visible in both menu and live app.
- `window-actions.json` preserves a failed initial AppleScript minimize attempt.
  Subsequent coordinate menu clicks verify minimize/restore and fullscreen entry/exit
  through accessibility state; fullscreen is 1024×768.
- Native Help opens Gallery; its real scroll container remains at zero with one loaded
  frame. The initial `iframe[src]` count was invalid for this loading implementation;
  the separate `gallery-verified.json` checks actual frame URLs. Native Go returns to Chat.
- Capture helper stopped, SSH forwarding closed, ports 9444/9445 closed, ordinary app
  reopened without debug/test overrides; shared Mac lease released. `cleanup.json`
  records remote port/hash checks; remaining cleanup actions are operator observations.

The installed application is `f9aca44`; repository HEAD at capture was `6d96535`, whose
application/package inputs are identical. Native preview shared state persists across
same-document visits, including the preview Bot's paused state; these are sequential
captures, not independently reset fixtures. Clock and motion are ambient.

This refresh establishes current registered-screen/native-menu capture coverage. It does
not cover absent routes, every live interaction, continuous motion, every control at the
960×640 minimum or whole-product design acceptance.
