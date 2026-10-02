# Composer recovery and honest Work completion

Application correction: `41998a8`. Integrated route-identity verification follows separately.

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
