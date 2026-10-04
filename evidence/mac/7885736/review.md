# Installed 7885736 — independent native evidence audit

**Bounded approval; no new blocker found.** Eight captures individually reviewed at full
resolution: **six auth + two Approvals**, English, **960×640**, both themes, sidebar shown.
Offline archive/source/assertion/pixel review only; no app, test, build, CI or Mac execution.

## Artifact and source binding

| Verified item | Result |
| --- | --- |
| Application | `78857365a509d78af10ebdda5b52348a2e50e961` |
| Inner ZIP SHA-256 | `1e01275d753635ed47a0eedb0e6711281fd0e388511fe80d072179a2827ee884` |
| ASAR SHA-256 | `8bab83a00e049d7f3706b7179b2343be25f39e9b603d360e3f58cf506c9f6d49` |
| Embedded build members | **90/90** byte-match `/tmp/opencode/build-7885736` and both member receipts |
| Packaged resources | **104 catalogs / eight locales + one summarize skill**, ZIP bytes match pinned Git; no fixture/source-stamp locale resources |
| Pinned build inputs | **540/540** hashes match Git at the application pin |
| Renderer fingerprint | **473 inputs**, recomputed `6a17e5001e296fcf502782e0641d00b9d169f112c210663b6b79da02e2afebdc` |
| Main sourcemap workspace sources | **30/30** match pinned Git, unchanged from `ffc118a` |
| Embedded SDK sources | **16/16** match SDK 0.3.5 archive bytes; archive matches pinned Git/current vendor and SHA-256 `5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8` |

The ZIP's embedded ASAR equals the separately retained ASAR and installation/capture
receipt hashes. Outer artifact/API digest remains the [download receipt](download.json),
not a fresh network check. Source counts above distinguish package inputs, renderer inputs
and physical main workspace sources; this is not a claim to validate every dependency map
entry or reproduce a build. Concurrent main/core work is outside this artifact.

## Images and execution assertions

All **8 original PNG / retained WebP pairs** pass independent SHA-256, manifest, dimension
and decoded **RGBA equality, including alpha**. Eight unique image hashes within this run.
Original and retained manifests agree. Native chrome/traffic lights are visible; no sheet
or overlay obstructs the reviewed content. Contact sheets were not used for acceptance.

| Scope | Reviewed evidence |
| --- | --- |
| [Auth](auth/manifest.json), 05:05:51–05:08:38 UTC | **11 recorded checks**, including wrong-code draft retention, one held submit per theme despite double-click, accepted sign-in, same-process renderer reload, Account device-local sign-out, cancelled late replies and status-only unavailable MFA enrollment. All six images show readable headings/copy/actions. |
| Auth boundary | **10/10 fixture-secret inspections** pass across public IPC/headers, DOM, storage, cookies, IndexedDB and caches; renderer HTTP empty. Backend records **6 email / 8 code requests, 2 sessions, 2 refusals, 2 enrollments, 2 aborted replies, 0 logout calls, 0 errors**, no remaining held request. Page/console errors and unexpected dialogs are zero. |
| [Approvals](approvals/manifest.json), 05:09:05–05:09:27 UTC | Two preview captures. Exact two headings/rows, loaded fonts, full opacity, actual clipping-ancestor containment and center hit targets asserted before/after native capture. Notification title wraps onto two lines; descriptions sit **2px below title ink** and clear both controls. |
| Approvals keyboard | From focused Usage, real Tab input reaches **Deep code**, then **Notify approvals**; both focused, enabled, center-hit. Switch focus ring visible in both images. This proves traversal, not opening the selector, toggling the switch or enforcing a permission policy. |

The model description ends at x=776.421875, before its control at x=798.984375; notification
description ends at x=801.734375, before its switch at x=867. Title ink also clears controls.
Geometry is identical before/after both captures. The lower always-allowed-command list
continues beyond the photographed scrollport; no whole-pane-visible-at-once claim.

## Change isolation and same-process boundary

- Auth helper and loopback backend are byte-identical to the prior retained scripts;
  their manifest hashes match. Approvals helper matches
  `f286c9423d24f13b1f7d0e6cecb71f6a0ffdce61078769080f64797a5f371d6c`.
- All **six auth PNG/WebP images are byte-identical to `ffc118a`**. Fresh run timestamps,
  fixture run ID, PID **49500**, window **8349** and new ASAR receipts establish this
  execution's binding; identical pixels alone do not identify the dependency version.
- Pinned application diff contains the SDK dependency/lock change plus the scoped
  Code Settings class/CSS change. Main/auth/core/schema sources are unchanged. The
  compiled bundle contains the narrow stacking/wrapping rules shown by the captures.
- Of the 16 embedded SDK sources, **12 are unchanged; four changed**: `dist/client.js`,
  `dist/gen/core/serverSentEvents.gen.js`, `dist/gen/sdk.gen.js`, `dist/stream.js`.
  Auth success now reads bytes once and rewraps the response instead of cloning it;
  the actual compiled main bundle contains this sequence, followed by the abort guard
  before cookie/token adoption. Header handling, SSE cursor, screenshot and media-tail
  changes also exist; these eight captures do not exercise all SDK changes.
- Main still validates auth results and retains secrets privately. PID/ASAR identity
  remains stable through renderer reload. This native batch does **not** prove process
  restart, refresh/persistence, hosted account access, server revocation or remote inference.
  Approvals is explicitly `?shot` preview data; its visible policy copy is not live-policy proof.

## Cleanup and limits

[Cleanup](cleanup.json) records both owned helpers stopped, ordinary LaunchServices reopen,
dark appearance restored. [Port receipt](ports-closed.json) records **9444, 9445, 9456, 9457,
9458 closed**. Lease release is coordinator-recorded; no lease/native query performed.

Acceptance is limited to this installed **7885736 / SDK 0.3.5 auth and narrow Approvals**
scope. Historical `f9aca44`/426-state evidence and the **28 `ffc118a` captures** retain their
separate revisions and outcomes. No whole-product, all-screen, real-account or inference approval.

Offline verifier passed: `python3 /tmp/opencode/native-7885736-audit/verify.py`.
Detailed results: that directory's `integrity.json`, `images.json`, `sources.json`,
`visual-review.json`, helper copies and pinned application/SDK diffs.
