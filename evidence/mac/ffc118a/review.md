# Installed ffc118a — independent evidence audit

**Bounded approval. No new blocker in the verified scope.** All **28 positive native
captures** inspected individually at full resolution, plus the three captures from the
failed recovery run. Offline receipt/archive/pixel checks only; no app, test, build, CI or
Mac actions. Application revision: `ffc118a2e58df66f430f3078e00f6e931dd910cf`.

## Integrity and provenance

- Local `Cortex.zip` independently hashes to
  `4f1932295847bfad10d174e7a607153798d1a59d68cc1dcb460ef37b10b823b1`.
  Its embedded ASAR matches the extracted archive, installation/capture receipts and
  `62ddb71be7bcbd25c37a4519f7a0d982b1d93d4fada6d63dfc2e218add65fa8b`.
  Outer GitHub artifact/API-digest verification is the retained download receipt, not
  a fresh network check by this audit.
- **90/90 ASAR build members** independently match `/tmp/opencode/build-ffc118a`
  and its member receipt. **104 catalogs, eight locales, one summarize skill** match
  both ZIP bytes and pinned Git blobs; no fixture/source-stamp locale resources.
- **418 package-input hashes** match pinned Git. Main sourcemap contains **30 matching
  workspace sources** and **16 SDK sources matching the pinned 0.3.1 archive**. The
  renderer's 473-input source fingerprint remains its retained build receipt; these
  offline checks do not claim a new reproducible build.
- All **31 PNG/WebP pairs** match retained hashes, manifest hashes, dimensions and exact
  decoded **RGBA, including alpha**. Positive set: **28 unique images**. The failed-run
  three PNGs are byte-identical to the corresponding later positive memory captures;
  they remain separate failed-run provenance, not three extra visual states.
- **24 positive images are 960×640 English**; **four terminal images are actually
  1024×685 French**, despite the helper requesting 1024×686. Native chrome/traffic lights
  and sidebar are visible. No contact-sheet-only approval.

## Verified behavior and pixels

| Scope | Captures | Audit result |
| --- | ---: | --- |
| [Auth](auth/manifest.json) | 6 | Real installed main SDK/IPC against controlled HTTP. Wrong-code retention, one held verification submit, sign-in, same-process reload, device sign-out, cancelled late replies and unavailable MFA enrollment pass in both themes. Controls/copy readable. Ten public-boundary inspections pass; no renderer HTTP, leaked fixture secrets, page/console errors or unexpected dialogs. |
| [Code](code/manifest.json) | 4 | Ordinary same-document Work-preview departure leaves live Code without preview controls or engine-list mutation. Four explicitly approved real writes produce one short and one **161-line** file per theme. Exact disk-byte/model/tool-result checks pass in execution receipts. Actual wheel input reveals the long tail; both headers, copy controls and short result remain visible. |
| [Terminal](terminal/manifest.json) | 4 | Real approved `bash`, exit 7, exact truncation metadata `{exit:0,outputLength:50000,truncated:24}`, preserved lookalike output, reload and model replay pass. French exit and final `… [24 caractères omis]` are visibly inside the terminal. Tail capture uses programmatic terminal scrolling; wheel proof belongs to Code above. |
| [Recovery](recovery/manifest.json) | 12 | Real engine refusals retain Add drafts/single rows; pending Add stays single; partial wipe retains the exact survivor, then accepted retry erases it. Approval-list Retry and narrow model metadata pass. Both partial-wipe frames are unobstructed: survivor, error toast and actions visible. Four native confirmations, **28 strict AX/CG clearance checks**, zero page/console errors. |
| [Work](work/work-manifest.json) | 2 | Preview Done rests at exact bottom (`gap:0`); user wheel creates `gap:140`. Summary/composer readable in both themes. Warm/ambient font readiness only. |

The pending terminal-command description is horizontally clipped in the exit captures;
Allow once / Always allow / Refuse remain visible and the recorded Allow once action
completes. This is retained visibility scope, not an assertion that the entire command is
readable or that the approval widget has full layout acceptance. Narrow Settings lower
content also continues below the photographed scrollport; claimed metadata/hint are visible.

## Negative evidence and helper corrections

- Both original Code attempts remain failed, with no captures/session creation and the
  same predicate-failure digest. The measured 34px heading range extends 1px beyond its
  32px **visible-overflow** line box but fits the actual clipping ancestors. The corrected
  helper checks viewport and actual clipping ancestors, retaining text/header/tail/hit
  assertions. [Prior predicate review](glyph-predicate-review.md) is consistent. No app
  change follows from this helper correction; exact old/new helper diff was unavailable.
- The used-engine recovery attempt correctly refused its freshness precondition. The
  next run remains failed: after CDP confirmation acceptance, native clearance still saw
  **one AXSheet and two layer-zero CG windows after 10,007ms**. Its three earlier captures
  do not show the later sheet; the AX/CG receipt is the retained failure evidence.
- Final recovery helper clicks the actual native **OK** through Accessibility rather
  than CDP acceptance, then enforces the same strict clearance predicate. Final wipe
  pixels independently show no sheet or stale overlay. Earlier failures and historical
  `f9aca44`/`b0e6d78` evidence retain their original outcomes.

## Boundaries and cleanup

This approval covers **ffc118a with SDK 0.3.1**, not concurrent approval-CSS/dependency
changes. Controlled backend/model fixtures establish no real Cloud account or hosted
inference. Native auth proves renderer reload, not process restart; recovery deliberately
rewrites/delays requests to obtain real engine errors and ends approval Retry at an empty
list, not pending-permission resolution. Work is preview data. No whole-product approval.

[Cleanup](cleanup.json) records stopped owned helpers, ordinary LaunchServices reopening
and restored dark appearance. [Port receipt](ports-closed.json) records 9444/9445/9456/9457/
9458 closed. Lease release is coordinator-reported; these receipts do not independently
record lease state. No remote machine was accessed during this audit.

Offline verifier and detailed per-image/archive/source results:
`/tmp/opencode/native-ffc118a-audit/{verify.py,images.json,integrity.json,pinned-inputs.json,observations.json,sdk-and-counts.json}`.
