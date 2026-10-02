# Composer recovery and honest Work completion

Application correction: `41998a8`. Integrated route-identity verification follows separately.

Final application source: `cc758a69fe9349d17f6a4bf7accd978421035519`, fingerprint
`8321a20fdcb25b29b884969901e6ba60ffdbcacb3c93f7b84e7f92e91c763462` (473 files).
Local integrated checks: **50/50 Electron cases**, zero retries/flaky/skips, 426 registered
state renders; lint/types, 131 units plus one optional backend skip, i18n and Linux package/smoke.
`final/` retains those results, 44 pixel-verified lossless screenshots and two inspected contact
sheets. `compare-final/` retains 32 captures / 30 frozen comparisons, two Home-menu gaps,
maximum difference 0.45%, inspected contact sheet, selected images and source attribution.
[CI 37039827971](https://github.com/CortexLM/desktop/actions/runs/37039827971), CodeQL and
unsigned macOS package/smoke pass. [Installed Mac proof](../mac/cc758a6/README.md) records
eighteen native captures, both appearances, with explicit timer and interaction limits.
[Independent CI review](final/ci-review.md) verifies **50/50 per OS**, zero retries/flaky/skips,
all 88 E2E images inspected on twelve sheets, 26 also full-resolution. The selected images
are retained losslessly with original PNG hashes. No changed-regression blocker was found;
renderer captures and native captures retain their distinct scopes.

The [8b90a8e CI review](../fidelity-followup/ci-review.md) exposed two gaps beyond the earlier
small-window correction:

- Nested Work and wide Chat composers remained under bottom-right notifications.
  Native CSS anchors now place transcript notifications above the actual composer dock,
  accounting for attachments and window width. Popup menus render above notifications.
- An idle Work session was incorrectly treated as completed. The board and transcript now
  require a successful completed latest assistant message before showing Done. Empty/refused
  sessions remain To do, persisted failures show Failed, aborted tasks show Paused. Board
  history reads currently use one request per root Bot session; no bulk summary API exists.

The existing regression flows now require pointer access while notifications remain visible
and cover refused, successful, later-failed and aborted Work histories across reloads.
Saved-look notification checks cover Chat at 960×640 and 1440×900 in both themes. Reasoning
captures wait for the expanded list to enter the viewport, preserving their existing assertions.

Initial targeted verification: fourteen Bot/composer cases and seven Chat/interaction cases
pass; the Work abort extension passes both themes. A route snapshot race is being investigated
before integrated acceptance. These results do not refresh the earlier full frozen/native sweeps.
CI 37032922991 at `41998a8` passes 46/46 on Linux and 45/46 on macOS: the remaining failure
is rapid keyboard selection of Work after returning Home. Recovery/status cases pass both OSes.
The 28-state frozen comparison has no reference gaps, maximum difference 0.45%; its contact
sheet is inspected. It remains scoped to the initial recovery source before navigation changes.
Static checks pass: 131 unit cases plus one optional backend skip; lint/types; i18n audit
63 files, 2,265 used keys, 3,395 English keys, zero findings.

The mechanical design detector reports fifteen existing frozen-reference choices (Geist,
thinking shimmer, spring curves and layout transitions). None flags the new anchor or status
logic; these warnings do not authorize a redesign of the pinned reference.

Independent bounded source review accepted the recovery diff: persisted outcomes, stale
query invalidation, task identity reset, preview isolation, popup stacking, Undo semantics
and reload assertions. That review ran no tests and did not inspect the concurrent navigation fix.
`log-normalization.json` records original and retained hashes for saved logs whose ANSI/BOM
formatting or trailing whitespace was removed; assertions, errors and timestamps are preserved.

## Separate reduced-motion delivery

Application revision: `9924911`.

The design owner delivered a live-only accessibility correction: global reduced-motion
transitions use `0s`, preventing Chromium from retaining stale inherited text colors during
dark initialization. Animations remain `1ms` for completion hooks. Only that CSS value is
ported; the frozen source remains immutable. The startup regression checks both theme colors
and effective durations. Its pre-fix run failed on the old 1ms transition, not on text color;
the original intermittent color failure is owner-verified rather than reproduced by that run.
The corrected source passes twenty targeted Electron cases, including both cold-reload themes,
native-menu assertions and composer/Bot lifecycle flows. Independent source review found no
app-owned transition-end dependency; explicit animation completion paths remain intact.
The reduced-motion build also passes packaged Linux launch smoke.
[CI 37035107514](https://github.com/CortexLM/desktop/actions/runs/37035107514) at `9924911`
passes 47/47 Electron cases per Linux/macOS, zero retries/flaky/skips, static checks and
unsigned macOS package/smoke. The earlier navigation failure remains an explicit investigation.

## Incoming references

Productivity's original nine-route, 72-state receipt is an isolated design build, excluding an
unfinished Public module; it is not a full integrated product build. Later scoped defect
confirmations and source changes must retain their own pins. The desktop integration map is
kept separate from acceptance; the original freeze is not extended by draft route inventory.
Backend contract blob `d6d46014` is independently hash-verified (422 operations). The desktop
SDK remains unchanged pending its owner's regenerated package and runtime handoff.
The [18:23–18:24 UTC SDK readback](remote-integration-readback.md) keeps remote auth/inference
active: no replacement pair announced in the inspected handoff. PM heads remain 15:05-only;
the delivered G2 body correction, local-provider inference and native Mac supplements have
separate revision scopes. Existing passing tests were not repeated.

### Latest handoff correction

[Reconciliation](handoff-correction.json) records **59 double-confirmed legacy units, three
B-only, one open P1 M02**, within the original 63. The blank-specialist path is reported to
replace the primary Bot; focused owner repair is underway. The on-disk ledger still claims
63 closures on later pins. These conflicting dispositions require owner reconciliation;
the latest handoff controls the integration hold. Historical source-bound receipts are retained.

Product's combined review covers **17 routes and eight defects**, including P1 MCP argument
secret-copy and empty-registry sample fallback. Repairs belong to one design owner; an
approved immutable package remains pending. This supersedes present-tense closure claims,
not the original nine-route Productivity or eight-route Platform receipt counts.

The corrected Public pin's 511 source files, 342 build artifacts, 151 recorded passing checks
and 14 image hashes are verified read-only. All 45 icon additions remain separately usable;
the `settings-2` placement is recorded under its preferences request. Two independent iOS
per-route reviews are reported underway; the verified web freeze establishes no native acceptance.

## Route identity and pending tab intent

The route and history-entry key now travel in the same React snapshot. An unrelated shell
update during a deferred navigation cannot remount the outgoing Work tree under the new key.
The deterministic regression failed before this fix, disconnecting the old tree and losing
its draft; it passes after the fix and checks restored sidebar Bot activity.

Independent review then identified a distinct tab-intent race. A newer Work choice made
after Home's URL update but before Home's React commit was discarded. A held-callback
regression reproduces the stuck-Home result. Segmented controls now distinguish their own
prior requested value from external resets, preserving the newer pending timer and checking
the latest committed/requested value rather than a stale closure. Ownership also matches
the exact history-entry key: a Back action to a different Chat entry cancels the timer even
though its label matches the earlier request. That third regression fails before key binding.
All three regressions and the existing navigation/keyboard cases pass (six targeted cases).

Settled keyboard sequences explicitly wait for rendered-route readiness. The pending-input
requirement has its own deterministic test. The responsive test separately retries geometry
from a connected inline Review comment; viewport, hit testing and applied-result assertions
remain intact. These findings do not establish the exact cause of every historical CI failure.
Independent [source review](navigation-review.md) confirms both identified tab-intent fixes;
its earlier findings are preserved as superseded states, not deleted from the record.

The [Productivity contract map](productivity-contract-map.md) records nine local-route mappings,
288 matching receipt-image hashes, current TSX drift and missing lifecycle/secret-handling
contracts. The earlier eight scoped design confirmations remain attributed to their receipt
pin; current repair/package disposition is stated above.

Platform's [receipt verification](platform-receipt.json) checks the original source snapshot,
396 images, twelve evidence files, three on-disk and HTTP-served build assets, eight routes
and 94 variants. It records 376 distinct passing views: 372 initially, four confirmed on
unchanged source/build, with cause unproven; all 52 targeted groups passed. At the earlier
receipt readback, TSX/CSS matched the later corrective snapshot; its A/B reports recorded
their scoped disposition. Original captures are not reattributed. The reports were read and
hashed; their browser journeys were not rerun.
No sample credentials or prototype source is imported into the desktop.
The [Platform contract map](platform-contract-map.md) identifies the draft's incompatible-model
attachment deletion as a conflict with accepted desktop retention. Both pinned and current source
still contain that behavior; a correction/exclusion is requested. Model Test availability, untyped
remote turn/approval payloads, origin/account-bound main-only auth and local/remote permission
semantics remain explicit binding gates. No source behavior is changed by this receipt.

The later [design update receipt](design-update-receipt.json) verifies historical 5609 and
5610 integration sources/images, the `d814599e9654` assembly's stored checks and served build,
two distinct Quiver glyph variants and the separate iOS web freeze. Original report counts,
later scoped confirmations and native-product acceptance stay revision-bound; browser results
were read back, not rerun. Detailed boundaries: [reference status](../compare/reference-status.md).
The [corrected-reference crosswalk](corrected-reference-map.md) maps the 63-unit inventory,
existing live safeguards and five bounded candidate gaps, keeping prototype-only operations
separate from functional engine delivery. Its historical closure table is superseded by the
current 59/3/1 handoff hold. Its source inspection ran no tests.
