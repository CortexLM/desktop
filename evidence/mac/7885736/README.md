# SDK 0.3.5 and narrow Approvals — installed verification

**Eight installed native captures pass:** authentication (6), narrow Approvals (2).
Package verification passes; [independent review](review.md) verifies all eight full-size
images, package members, resources, source pins and the embedded SDK 0.3.5 modules.

- Application `78857365a509d78af10ebdda5b52348a2e50e961`, CI `37097480122`, artifact `11265650279`.
- [Download](download.json): outer ZIP matches GitHub's SHA-256; inner ZIP
  `1e01275d753635ed47a0eedb0e6711281fd0e388511fe80d072179a2827ee884`.
- ASAR `8bab83a00e049d7f3706b7179b2343be25f39e9b603d360e3f58cf506c9f6d49`;
  all [90 embedded members](package.json) match the frozen built revision.
- [Resources](resources.json): 104 catalogs/eight locales and summarize skill match pinned
  source; no fixture/source-stamp resources. [540 build inputs](pinned-inputs.json) match Git.
- [473 renderer inputs](source.json): `6a17e5001e296fcf502782e0641d00b9d169f112c210663b6b79da02e2afebdc`.

LaunchServices opens `/Applications/Cortex.app` with isolated renderer/engine directories.
Controlled loopback authentication tests use the installed main-only SDK. Approvals captures
use preview fixtures. Neither establishes a real Cloud account or remote inference.
Earlier [ffc118a evidence](../ffc118a/README.md) retains its separate SDK 0.3.1 binding.

## Native results

- [Authentication](auth/manifest.json): both themes, 960×640; wrong-code retention,
  single pending verification, renderer reload, device-local sign-out, late cancellation,
  unavailable enrollment and private-boundary checks pass with the new SDK.
- [Approvals](approvals/manifest.json): both themes, 960×640; description ink sits below
  labels, inside its text column, clear of controls. Real Tab reaches the model selector
  and notification switch; both remain enabled and hit-testable. Sidebar stays visible.
- All eight full-size images inspected. All are exact-RGBA lossless copies of native PNGs;
  page/console errors remain zero. Preview controls establish no live approval-policy wiring.
- [Cleanup](cleanup.json): isolated app/helpers stopped, ordinary app reopened through
  LaunchServices, dark appearance restored. [Ports](ports-closed.json) 9444/9445/9456/9457/9458
  closed; local SSH forward stopped; shared Mac lease released.
