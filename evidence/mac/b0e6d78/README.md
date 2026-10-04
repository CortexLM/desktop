# Installed recovery — b0e6d78

**Twelve recovery assertions/captures pass; two Work bottom-scroll captures pass. Terminal
verification exposed two additional application defects.** This is scoped installed evidence,
not full acceptance. The uncommitted sign-in implementation is outside this package.

## Package and launch

- CI `37091082338`, package artifact `11262950335`; application
  `b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874`.
- Downloaded ZIP SHA-256 `a7844d93d70286e6b0ed31e2ea82e26616a777b8a100e06c9ca2eba1715f755b`;
  installed ASAR `71f560e62bf0d0a8cf0e72beb85611eb413acf9fe10e2cacc3d9f1fedd5b4c04`.
- [Outer artifact digest](outer-artifact.json) matches GitHub's `c8eab983…`; its inner ZIP
  exactly equals the separately downloaded/installed archive.
- [Pristine build](build/README.md): 598 Git blobs, 473 renderer inputs, Bun 1.4.2/Node 22;
  [all 90 packaged build members match](build/package-match.json). [Full member receipt](package.json).
- GUI `open -na /Applications/Cortex.app`, isolated engine/profile/project, empty initial
  engine, deterministic catalog. Native pixels use the GUI capture helper; assertions use CDP/IPC.
- Recovery script inspected a concurrently changed checkout. [Source observation](source-observation.json)
  names its three auth-related differences; the immutable package/build chain supplies the actual
  application binding. Those mixed observations are never relabeled pristine package sources.

## Passed scope

[Recovery manifest](recovery/manifest.json): both themes at 960×640, sidebar shown. Real
engine refusals preserve memory drafts/rows; one pending Add; partial wipe retains survivor;
approval-list failure offers Retry; model metadata/hint wrap readably. Twelve native images.
The partial-wipe captures retain a native confirmation overlay above the updated survivor/error;
the manifest assertions and screenshots have distinct visibility limits.

[Work manifest](work/work-manifest.json): two 960×640 captures, exact bottom after fonts;
real wheel input moves away. Warm/ambient installed proof; cold font ordering remains in E2E.
Initial script failed before app interaction because its temporary import could not resolve
Playwright; fixing module resolution produced the two passing captures.

## Retained failures

1. [Terminal startup](terminal-first-failure/manifest.json): provider not listening. macOS
   `/tmp` versus `/private/tmp` made the helper's direct-entry comparison skip startup.
   Canonicalizing its launch path started the provider; no application success claimed.
2. [Preview departure](terminal-departure-failure/manifest.json): after Work preview, a
   same-document navigation into live Code throws while destructuring a null preview context.
   No terminal captures in that run. A full document load isolated the subsequent terminal case;
   this does not waive or fix the navigation failure.
3. [Terminal viewport](terminal-viewport-failure/manifest.json): real `bash` exit/truncation
   metadata, exact localized French text and reload pass. Native exit screenshot captured.
   The omission marker is outside the visible viewport: `.split-r` grows to 59,028px,
   `pre.term` to 58,966px; scrolling the pre remains zero. The desired visibility assertion
   fails. Diagnostic screenshot is English after script cleanup; French exit image stays original.
   Both application failures have source/regression corrections underway.

All sixteen retained PNG-derived WebPs preserve exact decoded RGBA, including alpha.
Helpers/debug ports and SSH forwarding closed; ordinary installed app restored, dark OS
appearance restored, shared Mac lease released. [Cleanup](cleanup.json), [port check](ports-closed.json).

[Independent audit](review.md) inspects all sixteen originals full-size, verifies exact
retained RGBA/hashes/dimensions and the package's 90 build members, 104 locale catalogs
and summarize skill. It preserves both application failures and native overlay limits.
