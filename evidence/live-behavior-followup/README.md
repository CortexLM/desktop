# Live Code model choice and routine outcomes

Application `d635fcf34f83db7849a1ee59ab3d790b20f74c9f` is pushed.
[CI 37074187552](https://github.com/CortexLM/desktop/actions/runs/37074187552) passes Linux/macOS
E2E and macOS package/smoke, but **fails overall**: eight locale-render unit cases lack a
`localStorage` test fixture after Code starts rendering the live composer. The test-harness
correction preserves all locale assertions and the real composer; Node 22 now passes all 178 units
plus the existing optional backend skip. Test-only correction `ea1c54b` is pushed;
[CI 37075722150](https://github.com/CortexLM/desktop/actions/runs/37075722150) is pending.
[Installed-Mac proof](../mac/d635fcf/README.md) passes on the exact `d635fcf` artifact:
twelve inspected native captures, both themes, Code model/image refusal/recovery and routine outcomes.
Prior green CI/native acceptance remains pinned to `9d704ee`. Existing screens and local contracts
are used here; no new design source is imported.

## Routine corrections

- `promptAndWait` propagates persisted assistant cancellation; scheduled interruptions become
  `error`/`aborted` rather than success.
- Manual start reserves the routine synchronously; another start receives `conflict`/409 before
  creating another session. Reservation lasts through final persistence.
- Startup recovers abandoned persisted Running records as interrupted; active in-process runs
  survive a timer restart. A file-backed reopen regression verifies subsequent successful re-run.
- Deleted routine history stays deleted after in-flight completion; the running session can finish.
- Live history uses Running/Failed/Succeeded, latest eight outcome dots and accepted-only run
  feedback. Refused deletion reports existing localized failure copy.

Four core pre-fix negatives cover interruption, duplicate admission, abandoned-run recovery and
deleted-history resurrection. Four initial renderer regressions retain running-as-success,
duplicate start and refusal-feedback failures in both themes. The final core review predates
the additional file-backed reopen assertion, whose separate check passes without further core changes.

## Code model correction

The live chooser now selects actual configured catalog models and reasoning options for new tasks
and follow-ups. Reopening initializes from the session model despite an unrelated global choice.
Missing, disabled and unsupported choices preserve drafts without fallback. Keyless configured
endpoints are covered. Folder cancellation retains the draft before creating a session.

The [pre-fix model failure](before/code-model-error-context.md) records the missing catalog choice;
its original command output was not redirected to a log. Independent review initially proposed an
implicit-selection defect, then [withdrew it](code-model-review-final.md): provider mutations emit no
refresh event, so that proposed path was unreachable. Both reports are retained.

The attachment review reproduced a real second defect: a long-filename Remove control sat under
the refusal toast in both themes. The anchor now covers the entire Code attachment/composer area.
Both-theme regressions verify real capability refusal, unchanged draft/file/history, reachable
controls and accepted image recovery exactly once. [Negative geometry](before/code-attachment-review.md).

## Verification and visual scope

- [Units](units.log): **178 pass, one optional backend skip**, before the Code renderer integration.
  This was not a final integrated unit run; CI exposes that verification gap. Lint/types/i18n pass; audit:
  63 files, 2,266 used keys, 3,395 English keys, zero findings.
- [Initial full Electron run](e2e-initial.log): **59/59**, 426 registered renders, no retries,
  flaky cases or skips. This precedes the attachment-anchor and capture-guard follow-ups.
- [Final targeted Electron run](e2e-final.log): **17/17**, including two new attachment cases,
  Code/routines and existing Chat/Work/Bot/provider refusal flows; zero retries/flaky/skips.
  The complete suite now passes **61/61 on Linux and macOS** in the otherwise-failed CI run.
- Both builds and Linux packaged smoke pass; [final smoke](smoke-final.log).
- [Final frozen comparison](compare-final/index.html): **10/10 comparisons, zero missing in this
  scope, maximum 0.05%**, Code home/session and three Automations states in both themes. Code's
  four settled frames round to 0.00% (198–228 differing pixels, not pixel identity).
  Full historical reference gaps remain open.
  [First comparison](compare/index.html) predates only the attachment-anchor correction; manifests
  preserve dirty HEAD `0257395` plus exact working-source and served-asset fingerprints.
  The final 473-file renderer fingerprint `822f33bc4fa69476a08baf00509f5ae2b1208a441bcab4eefbaac3d26471c4ed`
  matches the committed `d635fcf` source; the original manifest revision field is preserved.
- All ten comparison plates inspected. Eight initial and ten final live captures retained; both
  final attachment images and the corrected dark routine capture inspected full-size.
- Initial dark interrupted routine screenshot has a blank row despite passing history assertions.
  A bounded 12-reload probe observed history ready before row opacity reached 1 in five of six
  legacy samples; all 24 probe screenshots contained row content, so the exact blank was not
  reproduced. No persistent defect or bot-name remount was established. Capture now requires
  resolved content, opacity 1 and hit-testable controls; no sleep/timeout relaxation.
- Initial comparison hit an unrelated iOS server on port 5299 and timed out before registering
  screens. The retained failure is separate; successful checks served this build on port 5309.
- The mechanical design scan reports 15 warnings, all on unchanged font/motion/gradient CSS.
  The pinned reference remains the visual authority; no typography or motion redesign follows.

These are controlled-provider local-engine checks. Native evidence is separately linked above;
real inference and full-objective acceptance remain unproven. The initial blank capture, earlier
negative suites and source pins remain intact.
The [independent final review](final-review.md) verifies the scoped source, logs, comparison hashes,
packaged build bytes and all ten final live images; no scoped critical blocker found.
That review predates the CI unit failure; its integrated-unit wording is superseded above.

## External delivery gates

Bounded 22:53 UTC owner readback keeps G3 PR #447 at `7633f7e2`, with no canonical
versioned pair. The combined design candidate exists; explicit G1 source/state import permission
remains absent. Existing targeted behavior fixes do not resolve remote authentication/inference,
missing-surface integration or full-reference/native acceptance.
