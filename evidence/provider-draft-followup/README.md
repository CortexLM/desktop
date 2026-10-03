# Provider replacement-key draft

Baseline application: `2956564fbe31f882014d74ff3a7f920e839fd634`; documentary
`10a57be97ee9e9f9ea0c761784279ec8744b70d3` has identical application inputs.
Correction pushed: `37c22c2fcff92fb76b10ffc97ec0643ac325d62f`; frozen renderer fingerprint
`5538c5298dbad432d82cf18781b9f7e62b5a861311ad61c6fc518c0cdb6e1ae7`.

Source review finds that Settings → Providers & models clears the replacement-key draft
after a successful Enable preference PATCH. That PATCH changes only provider configuration;
the replacement draft was not submitted. The existing saved credential remains separate.

The [ordinary Enable reproduction](toggle-baseline/README.md) confirms two failed cases/four intended draft assertions
in light/dark at 960×640. Both preference writes return 200 and leave saved hint `1111`;
the unsaved replacement disappears. Explicit Save then writes `2222` and clears correctly.
Earlier launch/capture setup attempts are retained separately.

The [pending-response baseline](pending-baseline/README.md) adds two cases/four failures: accepted PUT and DELETE replies
erase newer edits after delivery. Real oversized-key refusal and unchanged-draft Remove
controls pass. All responses are real completed engine results held before IPC delivery.

The three-line correction implements the [reviewed proposal](source-plan-review.md):
Enable opts out of clearing; credential actions clear only a matching captured raw draft.
All four unchanged regressions pass (18.487s). Lint/types, 245 units plus one optional skip,
i18n (65 files/2,272 used keys/3,405 English keys/zero findings) pass. The targeted design
detector reports no findings. The final **111-case Electron suite passes**, zero retries,
skips or flaky cases; Linux package/smoke passes and all 90 packaged build members match.
[Actual source review](source-review.md) approves the exact three-line diff. [Final artifact
audit](electron-final/README.md) verifies 147 images, 19 contacts and six full-size correction
views; all 90 build members and the committed source match. New-revision CI/installed proof
remains separate.
[Native harness review](native-preparation/provider-draft-native-review.md) approves the
prepared four-capture sequential Enable/Save check; it reuses the accepted launcher and
fixture unchanged. No execution or new installed acceptance follows from preparation.
CI [37118586276](https://github.com/CortexLM/desktop/actions/runs/37118586276) passes all
three jobs. [CI artifact audit](ci-37c22c2/README.md) verifies 111 cases/426 renders per OS,
296 images/28 full-size target views and all sixteen locale images pixel-exact to `2956564`.
Twelve glyph-weight checks pass per OS; original native CI capture failure stays retained.
[Matching installed confirmation](../mac/37c22c2/README.md)
passes four native captures and eight UI writes/action checks in both themes, with no
inference and completed cleanup. [Independent native review](../mac/37c22c2/native/README.md)
verifies all four originals, RGBA-exact retained images and source/package identity.
The first installed attempt hit a [collector geometry error](../mac/37c22c2/initial-geometry/README.md)
after successful draft-preserving toggles. No captures were admitted; the original failure
is retained before the passing collector-only correction and fresh-profile confirmation.
The executed collector checks ancestors but omits text self-clipping; review narrows that
guard for future use. The four known-state images remain independently reviewable; no
runtime result is transferred to the later unexecuted collector.

Scope: existing Settings input lifecycle only. CSS, catalogs, credential storage and API
contracts are unchanged. Captured-input equality protects changed contents, not edit-history
identity or serialization of concurrent Enable actions. The active Cortex UI design work
and five remote-state deliveries remain with their assigned design owner.
