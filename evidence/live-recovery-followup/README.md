# Live recovery corrections

Recovery application `749bc0c035391d72aeafb4b5ce39cc0aa5342830` is pushed. Local checks pass;
[CI 37088533094](https://github.com/CortexLM/desktop/actions/runs/37088533094) passes checks
and Linux 83/83; macOS 82/83 exposes an unhandled skipped-view-transition rejection.
Mac packaging/smoke did not run; matching installed-native checks remain pending;
the earlier green CI and full native/reference refresh remain bound to `f9aca44`/`6d96535`.
The full [source/product audit](../current-full-followup/completion-audit.md) retains broader
unfinished live workflows; this batch addresses the concrete failures below.

## Reproduced before correction

- **Approval-list refusal:** both themes at 960×640, a real engine permission remains pending
  while a rewritten list request reaches a missing engine route. The old screen says “Nothing
  to approve” and “Every request has been handled.” Both new regression cases fail at the
  expected recovery heading. [Log](before/approvals.log), [images](before/images.json).
- **Bot memory Add:** deleting the loaded Bot makes the real POST return 404; the original
  draft disappears before acceptance. Reopening Add yields an empty field.
- **Bot memory wipe:** an isolated SQLite writer lock makes the real DELETE return 500;
  “Memory erased” appears despite the original row surviving reload and application exit.
  [Baseline report](before/memory/README.md) and verifier retain both concrete failures.
  The overall exploratory harness exited 1 during optional-case cleanup; the two completed
  Bot cases and separate artifact/persistence verifier pass their stated assertions.
- **Model metadata:** both 960px theme regressions reject clipped model name/context/cost.
  [Log and images](before/provider-metadata/) retain the old row's “100…” display.
- **Terminal annotations:** real core shell execution and French Code rendering reproduce
  Cortex-authored English exit/truncation notices. Two desired assertions fail; the isolated
  unapplied proposal passes eleven checks/64 renders, including command-output lookalikes,
  all eight locales and unchanged model replay. [Bounded receipt](before/terminal/README.md).
- **Work Done initial position:** the full comparison's independent browser diagnostic
  reproduces font reflow leaving `scrollTop=391` instead of the settled bottom `392`.
  Disabling anchoring only in a diagnostic or scrolling after font readiness removes the gap.
  [Original images and causal limits](../current-full-followup/compare/review/README.md).

## Current correction scope

- Approval read errors use the existing blocked/retry state; successful reload restores the
  real pending permission. Cancellation then establishes the genuinely empty list.
- Model rows wrap capability badges when narrow and preserve full name/context/cost text.
  Existing key-save/reload/removal tests now check metadata at 960/1024/1440 in both themes.
- Memory writes await persistence before clearing drafts or announcing success; implementation
  is integrated with eight real-engine refusal/partial-write/race cases. Owner-bound reads,
  initial-load gating and retired deletion IDs prevent the three reviewed loading races.
  [Read-race baseline](before/memory-read-races/e2e.log) preserves the negative reproduction.
- Code terminal annotations use localized display metadata. Arbitrary command output, model
  replay and unverifiable legacy records remain intact. Eight-locale rendered assertions and
  real core producer/replay checks pass; French Electron proof passes in the first targeted run.
- Work's state-opening scroll waits for font/layout readiness, with cancellation for departure
  or user navigation. Both cold/warm/font-readiness Electron cases pass in the first targeted run;
  original before scores and the earlier non-reproducing test attempt remain retained.
  [Scoped post-fix pixels](work-scroll-compare/README.md): both Done themes have zero bottom
  gap and an exactly matching 1,303,400-pixel transcript region. Whole frames retain 13/235
  threshold mismatches; rounded 0.00% does not mean zero. Served assets and Work source are
  pinned; this intermediate build predates the final memory/approval-hook corrections.

Existing screens/components supply the correction patterns. Earlier negative attempts remain
retained below; they are not replaced by passing follow-ups.

## Checks so far

[Node 22 unit run](units-node22.log): **188 passed, one optional backend test skipped**,
16 files. Core/terminal/locale corrections are integrated; Work scroll readiness was still
under integration. This is not a claim that the pending Electron/native checks passed.

Initial lint/types pass; i18n checks **63 files / 2,269 used keys / 3,398 English keys / zero
findings**. The one mechanical UI-detector warning is the pre-existing progress `width`
transition in `system.css`, outside the changed model-row rules; no detector override was added.
[Terminal boundary review](terminal-review.md) passes within its scope. [Initial memory review](memory-review-initial.md)
identifies three additional loading/owner/refresh races; the follow-up implementation and
read-barrier regressions are integrated. First targeted runtime checks precede those follow-ups.

[First targeted run](first-targeted/e2e.log): **7 passed, 2 failed**. Both model-row/key flows,
French real shell/replay/reload, both Work font-scroll cases and provider/image recovery pass.
Both approval cases pass refusal/Retry, then expose stale UI after session abort: the engine's
permission disappears without a permission-reply event. The hook now also observes existing
session status/deletion events; the assertion remains intact for the next integrated run.
[Independent ordering review](approval-cancellation-review.md) confirms pending asks are removed
before idle/deleted events and the existing query sequence guard rejects older list responses.

## Integrated local result

- [Full Electron run](e2e-final.log): **83 passed**, 426 registered renders, no retries/skips.
  This precedes the final one-line exclusion-lifetime fix described next.
- [Final source review](memory-review-final.md) found one remaining return-navigation race:
  changing owners cleared the accepted-deletion Set while old list reads stayed cached.
  [Negative regression](before/memory-return/e2e.log) reproduces the deleted row reappearing.
  Its screenshot follows cleanup/released reads and does not show the failed assertion frame.
  Keeping global memory IDs excluded across mounted owner changes closes it; both-theme
  [eight-case memory rerun](memory-final/e2e.log) passes after rebuilding. Source review approves.
- Final lint/types and i18n pass. [Linux package receipt](package-linux.json) verifies all
  90 embedded build members against this build; [smoke](smoke-return.log) passes with the
  [captured renderer](packaged-linux.png). This receipt precedes commit assignment.
- [Final memory images](memory-final/contact.jpg) cover all fourteen new captures in both
  themes. Changed application CI, macOS package and installed-native checks remain pending.
- [Independent local artifact review](local-review/README.md) verifies the 83-case report,
  all 92 unique attached images, 32 full-resolution selections and eight geometry attachments.
  Its full-run pin still predates the separate final return-navigation correction.
- [Final source-bound comparison](compare-final/README.md) covers 58 renders/42 references,
  sixteen explicit Settings gaps, maximum 0.0638503% (rounded 0.06%). The final Done frames
  retain 236/240 threshold mismatches but have zero transcript offset. This final run is
  separate from the intermediate two-state 13/235 result and all historical raw captures.

## Changed-revision CI failure

At `749bc0c`, the dark macOS Work-scroll test passes its geometry/cancellation checks but
collects `Transition was skipped` in the renderer-error assertion. The assertion remains
intact. The scoped correction handles native `ready` AbortError only;
[source review](skipped-transition/independent-review.md) approves it. After rebuilding,
[seven Electron regressions](skipped-transition/test-after.log) pass: route/theme callbacks
still commit and injected callback failures remain reported. The original macOS trigger
is not established by its trace; real native skips reproduce both application call sites.
Changed-revision CI remains pending.
Earlier Mac `f9aca44` remains installed. Prepared recovery capture scripts have not run;
the reserved Mac lease was released after the skipped-package result.

[CI artifact review](ci-749bc0c/README.md) verifies 83 Linux passes, 82 macOS passes/one
failure and zero retries, plus 185 unique PNGs/43 full-resolution selections. Its package
steps are explicitly skipped. SDK 0.3.1/0.2.0 intake independently passes 44 probe cases plus
one optional backend skip; new sign-in integration is separate work.

## Later recovery revision

`b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874` includes the native-transition correction and
scoped SDK intake. [CI 37091082338](ci-b0e6d78/README.md) verifies 188 units plus one optional
skip, 84 Electron cases/426 renders per OS, Mac package and renderer smoke. Independent review
inspects 185 unique PNGs/63 originals; native display capture in CI still fails separately.

[Installed proof](../mac/b0e6d78/README.md) verifies the matching package against all 90
pristine-build members, twelve live-recovery captures and two Work bottom-scroll captures.
It also exposes a preview-departure crash and unreachable long terminal output; their failure
receipts remain explicit. Both corrections are underway with meaningful regressions.
