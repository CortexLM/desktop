# Work task conversion and saved Bot search

Application `f9aca44476fcebd0699c09c9e3f7eebcd5151a2a` is pushed; [CI 37080136101](https://github.com/CortexLM/desktop/actions/runs/37080136101)
passes all jobs; [independent artifact review](ci/README.md) and [installed-Mac proof](../mac/f9aca44/README.md)
pass within their recorded scope.
Later `6d96535` [full-proof refresh](../current-full-followup/README.md) verifies unchanged
application/package inputs, a complete native screen/menu sweep and full fixed-clock comparison.
Initial integrated local checks pass. Work source review
found an enabled-but-inert Create action when the Bot list fails; correction is implemented,
with rebuild, thirteen scoped cases and Linux package/smoke passing.
The earlier Code/routine [green CI receipt](../live-behavior-followup/ci-93c1e78/README.md) does not
verify this later application batch.

## Reproduced baselines

- [Work conversion](before/work-routine-source.log): a real persisted Bot task renders its
  original prompt, but the live Task options button is missing. The existing preview action
  is therefore inaccessible in live mode.
- [Saved Bot search](before/search-bots.log): real persisted Bots match the query by name/persona,
  but the search lists only the matching session. Expected two Bot results, received zero.

Both baselines launch real Electron against the prior built application. Failure images and
error contexts are retained; logs have ANSI/trailing whitespace normalized, with original and
retained hashes in `retained-files.json`. Full traces remain in their original temporary paths.

## Delivered behavior

- Work task options open the existing routine editor with the first user request's non-synthetic
  text fragments joined, original Bot/model/agent/folder and a 60-character editable name.
  Cancel writes nothing; Create requires explicit confirmation, suppresses duplicate clicks and
  locks pending edits. Reload and same-Bot edit/save retain execution context. Reassigning during
  creation uses the chosen Bot's model without the source agent/folder.
- File-bearing histories and deleted sources/Bots refuse conversion. New files added while an
  editor is open are checked again before Create; refused writes preserve the draft. Delayed
  source and save responses cannot replace a newer route. Existing-task Bot reassignment keeps
  the current PATCH semantics; this change adds no clearing contract for optional execution fields.
  [Initial Work review](work-review-initial.md) records the Bot-list availability defect separately.
  [Baseline reproduction](before/work-routine-list.log) confirms enabled Create during list failure.
  The correction gates on an available selected Bot and offers localized Retry while retaining
  editable instructions; a held real retry response checks the pending state too.
  [Follow-up source review](work-review-final.md) closes that concrete defect; corrected runtime
  proof is recorded below.
- Search matches saved Bot names/personas alongside session titles, case/accent-insensitively.
  Category and keyboard order agree; exact IDs open the intended Bot. Either list failure offers
  Retry. Recent items stay session-only. [Independent Search review](search-review.md).

## Verification

- [Initial full Electron](e2e-initial-full.log): **69/69**, 426 registered theme/state renders,
  no retries/flaky/skips. It precedes the first-request text-fragment and Bot-list corrections.
- [Targeted Electron before Bot-list correction](e2e-final.log): **12/12**, new Work/Search cases plus routine regressions,
  both themes at 960×640, no retries/flaky/skips. The source prompt fixture now has two text fragments.
- [Node 22 units](units-node22.log): **178 pass, one optional real-backend skip**.
- Lint/types pass; [i18n](i18n.log): 63 files, 2,267 used keys, 3,395 English keys, zero findings.
- Pre-Bot-list-correction build, package and [Linux packaged smoke](smoke-final.log) pass.
- [Corrected Electron](e2e-corrected.log): **13/13**, including Bot-list refusal/held-retry recovery,
  no retries/flaky/skips. Corrected build/package/[smoke](smoke-corrected.log) pass; lint/types/i18n
  remain green. Nineteen corrected captures retained; the new unavailable-list image inspected.
  [Linux package receipt](linux-package.json) verifies all 90 embedded build members against the
  corrected local build byte-for-byte.
  Matching CI passes **70/70 per OS**, 426 renders, 178 units plus one optional backend skip,
  lint/types/i18n and macOS package/smoke; twenty CI images independently inspected.
- Eighteen final local PNGs retained; source editor and mixed Bot search captures inspected in both
  themes; all eighteen inspected on the retained contact sheet.
- [Frozen comparison](compare/index.html): **32 renders/32 references, zero missing within this
  scope**. Search max 0.03%, routine editor max 0.06%; Work computer/takeover states differ by
  3.68–8.19%. [Independent review](compare-review.md) traces 99.59–99.94% of differing pixels to
  the simulated desktop: the unchanged clock rule selects teal wallpaper at the reference's 12:09
  and purple wallpaper at the new capture's 23:45. CRM interiors are byte-identical. This is an
  uncontrolled capture-clock defect; residuals remain, thresholds and outliers are preserved.
  The manifest preserves
  dirty `f790056` and the 473-file fingerprint `78e91a2c0392e17b1ff128b37ad333481298f3c4efca8538633c1513b8098a63`.
  `compare/retained.json` binds original PNGs to pixel-identical lossless WebP copies.
- [Corrected editor comparison](compare-corrected/index.html): **8/8, zero missing, max 0.06%**,
  after the Bot-list correction. Fingerprint `5f709c11d836948142b65c5c2b4fe0582bddbfc19f76dbe15cf6d2146a6bcf0f`;
  this fingerprint matches committed `f9aca44`; historical Work outliers remain separate.
  Earlier comparison files/provenance are preserved.
- [Clock-controlled Work rerun](compare-clock/README.md): **16/16, zero missing**, same application,
  explicit `2026-10-02T12:09:00Z`/UTC and real timers. Computer/takeover differences fall to
  0.00–0.02%; overall max remains 0.45% at Done light. Original ambient outliers are preserved;
  reference timezone/mount time remain unattested. Independent pixel review verifies a 1 CSS-pixel
  transcript offset in Done light, without establishing its cause or waiving that residual.
- Installed matching macOS artifact: **ten native captures**, both themes at 960×640, source
  conversion/context, cancellation, Bot-list failure/Retry, routine execution and exact-ID Search.
  Original scroll-edge images remain beside centered-scroll control proof. Helpers stopped,
  ports/forwarder closed, ordinary app restored and Mac lease released.

[Independent final review](final-review.md) verifies committed source identity, all three local
Electron reports, 90 package members, retained image bindings and all nineteen corrected captures.
Its one stale i18n-count finding is corrected in `evidence/STATUS.md`.

Existing routes, localized copy and engine contracts; no new design source imported. Controlled
provider responses prove routing/persistence, not real inference. Bounded owner readback at
23:42 UTC still finds no canonical SDK pair or explicit new G1 design import authorization.
